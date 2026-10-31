import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as sgMail from '@sendgrid/mail';

export type EmailProvider = 'smtp' | 'sendgrid';

/** A complete SMTP configuration to test. Every field is the submitted value; none is optional,
 *  so nothing can be filled in from the environment. */
export interface SmtpTestConfig {
  host: string;
  port: number;
  /** Implicit TLS. Defaults to `port === 465` when omitted. */
  secure?: boolean;
  user: string;
  password: string;
}

const SMTP_TEST_TIMEOUT_MS = 10000;

function describeError(error: unknown): { message: string; code: string } {
  // Read structurally rather than with `instanceof Error`: socket errors can come from another
  // realm (e.g. under Jest), where instanceof is false for a perfectly ordinary Error.
  if (typeof error === 'object' && error !== null) {
    const message = 'message' in error ? error.message : undefined;
    const code = 'code' in error ? error.code : undefined;
    return {
      message:
        typeof message === 'string' && message
          ? message
          : 'Unknown error occurred',
      code: typeof code === 'string' ? code : 'UNKNOWN',
    };
  }
  return { message: String(error), code: 'UNKNOWN' };
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private emailProvider: EmailProvider = 'smtp';
  private sendGridConfigured = false;

  // List of placeholder/invalid SMTP hosts to reject
  private readonly invalidHosts = [
    'smtp.example.com',
    'example.com',
    'localhost',
    '127.0.0.1',
    'test',
    'placeholder',
    'smtp.test.com',
    'mail.example.com',
  ];

  constructor(private configService: ConfigService) {
    this.initializeEmailService();
  }

  private initializeEmailService(): void {
    // Check for SendGrid API key first (preferred)
    const sendGridApiKey = this.configService.get('SENDGRID_API_KEY');
    if (sendGridApiKey && sendGridApiKey.trim() !== '') {
      try {
        sgMail.setApiKey(sendGridApiKey);
        this.emailProvider = 'sendgrid';
        this.sendGridConfigured = true;
        this.logger.log('SendGrid email service configured successfully');
        return;
      } catch (error) {
        this.logger.warn(
          'Failed to configure SendGrid, falling back to SMTP',
          error,
        );
      }
    }

    // Fall back to SMTP
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    const smtpHost = this.configService.get('SMTP_HOST');
    const smtpPort = Number(this.configService.get('SMTP_PORT') ?? 587);
    const smtpUser = this.configService.get('SMTP_USER');
    const smtpPass = this.configService.get('SMTP_PASS');

    // Check if SMTP configuration exists
    if (!smtpHost || !smtpUser || !smtpPass) {
      this.logger.warn(
        'SMTP configuration is missing. Email sending will be disabled.',
      );
      this.logger.warn(
        'Please configure SMTP_HOST, SMTP_USER, and SMTP_PASS in your .env file',
      );
      this.transporter = null;
      return;
    }

    // Check if host is a placeholder/invalid value
    const isInvalidHost = this.invalidHosts.some((invalid) =>
      smtpHost.toLowerCase().includes(invalid.toLowerCase()),
    );

    if (isInvalidHost) {
      this.logger.warn(
        `SMTP host "${smtpHost}" appears to be a placeholder. Email sending will be disabled.`,
      );
      this.logger.warn(
        'Please configure a valid SMTP_HOST in your .env file (remove or update SMTP_HOST=smtp.example.com)',
      );
      this.transporter = null;
      return;
    }

    // Validate host format (basic check)
    if (!smtpHost.includes('.') || smtpHost.length < 4) {
      this.logger.warn(
        `SMTP host "${smtpHost}" appears to be invalid. Email sending will be disabled.`,
      );
      this.transporter = null;
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465, // true for 465, false for other ports
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        // Add connection timeout to prevent hanging
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 10000,
      });
      this.logger.log(
        `SMTP transporter configured successfully for ${smtpHost}`,
      );
    } catch (error) {
      this.logger.error('Failed to create SMTP transporter:', error);
      this.transporter = null;
    }
  }

  /** Rejects empty, placeholder and local hosts (see invalidHosts). Public so tests that run a
   *  synthetic SMTP server on 127.0.0.1 can allow exactly that address and nothing else. */
  isValidSmtpHost(host: string): boolean {
    if (!host || host.trim().length === 0) {
      return false;
    }

    // Check against invalid hosts
    const isInvalid = this.invalidHosts.some((invalid) =>
      host.toLowerCase().includes(invalid.toLowerCase()),
    );

    if (isInvalid) {
      return false;
    }

    // Basic format validation
    if (!host.includes('.') || host.length < 4) {
      return false;
    }

    return true;
  }

  /**
   * Check that a submitted SMTP configuration can connect and authenticate.
   *
   * Uses exactly the configuration passed in: nothing is read from the environment, so a
   * submitted host can never receive the server's own SMTP_USER / SMTP_PASS. The check is the
   * transport's verify() (connect, EHLO, STARTTLS when offered, AUTH, QUIT); no message is sent
   * and nothing is stored.
   */
  async testConnection(
    config: SmtpTestConfig,
  ): Promise<{ success: boolean; message: string }> {
    if (!this.isValidSmtpHost(config.host)) {
      return {
        success: false,
        message: `SMTP host "${config.host}" is a placeholder, a local address or not a valid host name.`,
      };
    }

    const testTransporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure ?? config.port === 465,
      auth: { user: config.user, pass: config.password },
      connectionTimeout: SMTP_TEST_TIMEOUT_MS,
      greetingTimeout: SMTP_TEST_TIMEOUT_MS,
      socketTimeout: SMTP_TEST_TIMEOUT_MS,
    });

    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        testTransporter.verify(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('SMTP verification timeout')),
            SMTP_TEST_TIMEOUT_MS,
          );
        }),
      ]);
      return {
        success: true,
        message: `Connected to ${config.host}:${config.port} and authenticated as ${config.user}. No email was sent.`,
      };
    } catch (error: unknown) {
      const { message: errorMessage, code: errorCode } = describeError(error);

      let message = 'Email connection test failed: ';
      if (errorCode === 'EAUTH') {
        message +=
          'SMTP authentication failed. Please check the SMTP username and password.';
      } else if (
        errorCode === 'ECONNECTION' ||
        errorCode === 'ETIMEDOUT' ||
        errorCode === 'ENOTFOUND' ||
        errorCode === 'ECONNREFUSED' ||
        errorCode === 'ESOCKET'
      ) {
        message +=
          'Cannot connect to the SMTP server. Please check the SMTP host and port.';
      } else if (
        errorMessage.includes('Invalid login') ||
        errorMessage.includes('authentication')
      ) {
        message +=
          'Invalid SMTP credentials. Please check your username and password.';
      } else if (errorMessage.includes('timeout')) {
        message +=
          'Connection timeout. Please check your SMTP settings and network connection.';
      } else {
        message += errorMessage;
      }

      this.logger.error('Email connection test failed:', {
        error: errorMessage,
        code: errorCode,
      });
      return { success: false, message };
    } finally {
      if (timer) clearTimeout(timer);
      testTransporter.close();
    }
  }

  /**
   * Send email with retry mechanism
   * FIXES: Issue #2 - Adds retry logic for failed emails
   * @param options Email options
   * @param maxRetries Maximum number of retry attempts (default: 3)
   * @param retryDelay Initial delay between retries in ms (default: 1000, exponential backoff)
   */
  async sendMail(
    options: {
      to: string;
      subject: string;
      html: string;
      from?: string;
      attachments?: Array<{
        filename: string;
        content: Buffer;
        contentType?: string;
      }>;
    },
    maxRetries: number = 3,
    retryDelay: number = 1000,
  ): Promise<void> {
    // Use SendGrid if configured
    if (this.emailProvider === 'sendgrid' && this.sendGridConfigured) {
      return this.sendMailViaSendGrid(options, maxRetries, retryDelay);
    }

    // Fall back to SMTP
    // Re-check SMTP configuration at runtime (in case .env was updated)
    const smtpHost = this.configService.get('SMTP_HOST');
    if (smtpHost && !this.isValidSmtpHost(smtpHost)) {
      const errorMessage = `SMTP host "${smtpHost}" is invalid or a placeholder. Please remove or update SMTP_HOST in your .env file. Email sending is disabled.`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    if (!this.transporter) {
      const errorMessage =
        'Email service is not configured. Please configure either SENDGRID_API_KEY or SMTP settings (SMTP_HOST, SMTP_USER, SMTP_PASS) in your .env file.';
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    let lastError: Error | null = null;

    // Retry logic with exponential backoff
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const from =
          this.configService.get('SMTP_FROM') ||
          'Asset Vault <no-reply@asset-vault.app>';

        // Verify transporter connection with timeout (only on first attempt)
        if (attempt === 0) {
          try {
            await Promise.race([
              this.transporter.verify(),
              new Promise((_, reject) =>
                setTimeout(
                  () => reject(new Error('SMTP verification timeout')),
                  10000,
                ),
              ),
            ]);
          } catch (verifyError: any) {
            // If verification fails, log but try to send anyway (some SMTP servers don't support verify)
            if (verifyError.message !== 'SMTP verification timeout') {
              this.logger.warn(
                'SMTP verification failed, but attempting to send email anyway:',
                verifyError.message,
              );
            }
          }
        }

        const result = await this.transporter.sendMail({
          from,
          to: options.to,
          subject: options.subject,
          html: options.html,
          attachments: options.attachments,
        });

        this.logger.log(
          `Email sent successfully to ${options.to}. Message ID: ${result.messageId}${attempt > 0 ? ` (after ${attempt} retry${attempt > 1 ? 'ies' : ''})` : ''}`,
        );
        return; // Success, exit retry loop
      } catch (error: any) {
        lastError = error;
        const errorMessage = error.message || 'Unknown error occurred';
        const errorCode = error.code || 'UNKNOWN';

        // Determine if error is retryable
        const isRetryable =
          errorCode === 'ECONNECTION' ||
          errorCode === 'ETIMEDOUT' ||
          errorCode === 'ENOTFOUND' ||
          errorMessage.includes('timeout') ||
          errorMessage.includes('ECONNRESET') ||
          errorMessage.includes('ENOTFOUND');

        // Don't retry on authentication errors or invalid configuration
        if (!isRetryable || attempt === maxRetries) {
          this.logger.error(
            `Failed to send email to ${options.to}${attempt > 0 ? ` after ${attempt} retry${attempt > 1 ? 'ies' : ''}` : ''}:`,
            {
              message: errorMessage,
              code: errorCode,
              stack: error.stack,
            },
          );

          // Provide more helpful error messages
          if (errorCode === 'EAUTH') {
            throw new Error(
              'SMTP authentication failed. Please check your SMTP_USER and SMTP_PASS credentials.',
            );
          } else if (
            errorCode === 'ECONNECTION' ||
            errorCode === 'ETIMEDOUT' ||
            errorCode === 'ENOTFOUND'
          ) {
            const smtpHost = this.configService.get('SMTP_HOST');
            throw new Error(
              `Cannot connect to SMTP server "${smtpHost}". Please check SMTP_HOST and SMTP_PORT settings. Make sure the host is not a placeholder value.`,
            );
          } else if (errorMessage.includes('Invalid login')) {
            throw new Error(
              'Invalid SMTP credentials. Please check your SMTP_USER and SMTP_PASS.',
            );
          } else if (errorMessage.includes('ENOTFOUND')) {
            throw new Error(
              `SMTP host not found. Please check that SMTP_HOST is correct and not a placeholder value like "smtp.example.com".`,
            );
          } else {
            throw new Error(`Failed to send email: ${errorMessage}`);
          }
        }

        // Retryable error - wait before retrying
        const delay = retryDelay * Math.pow(2, attempt); // Exponential backoff
        this.logger.warn(
          `Email send failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`,
          errorMessage,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // Should never reach here, but TypeScript requires it
    if (lastError) {
      throw lastError;
    }
    throw new Error('Failed to send email: Unknown error');
  }

  /**
   * Send email via SendGrid
   */
  private async sendMailViaSendGrid(
    options: {
      to: string;
      subject: string;
      html: string;
      from?: string;
      attachments?: Array<{
        filename: string;
        content: Buffer;
        contentType?: string;
      }>;
    },
    maxRetries: number = 3,
    retryDelay: number = 1000,
  ): Promise<void> {
    const fromEmail =
      options.from ||
      this.configService.get('SMTP_FROM') ||
      'no-reply@asset-vault.app';

    // Extract email from "Name <email>" format if needed
    const fromMatch = fromEmail.match(
      /<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/,
    );
    const from = fromMatch ? fromMatch[1] : fromEmail;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const msg: sgMail.MailDataRequired = {
          to: options.to,
          from: from,
          subject: options.subject,
          html: options.html,
        };

        if (options.attachments && options.attachments.length > 0) {
          msg.attachments = options.attachments.map((att) => ({
            content: att.content.toString('base64'),
            filename: att.filename,
            type: att.contentType || 'application/octet-stream',
            disposition: 'attachment',
          }));
        }

        await sgMail.send(msg);
        this.logger.log(
          `Email sent successfully via SendGrid to ${options.to}${attempt > 0 ? ` (after ${attempt} retry${attempt > 1 ? 'ies' : ''})` : ''}`,
        );
        return;
      } catch (error: any) {
        lastError = error;
        const errorMessage = error.message || 'Unknown error occurred';

        // SendGrid specific error handling
        if (error.response?.body?.errors) {
          const sgErrors = error.response.body.errors;
          const isRetryable = sgErrors.some(
            (e: any) =>
              e.message?.includes('timeout') ||
              e.message?.includes('rate limit') ||
              e.message?.includes('temporarily'),
          );

          if (!isRetryable || attempt === maxRetries) {
            this.logger.error(`SendGrid email send failed:`, sgErrors);
            throw new Error(
              `SendGrid error: ${sgErrors.map((e: any) => e.message).join(', ')}`,
            );
          }
        } else {
          // Network or other errors
          const isRetryable =
            errorMessage.includes('timeout') ||
            errorMessage.includes('ECONNRESET') ||
            errorMessage.includes('ENOTFOUND');

          if (!isRetryable || attempt === maxRetries) {
            this.logger.error(
              `Failed to send email via SendGrid to ${options.to}:`,
              errorMessage,
            );
            throw new Error(
              `Failed to send email via SendGrid: ${errorMessage}`,
            );
          }
        }

        const delay = retryDelay * Math.pow(2, attempt);
        this.logger.warn(
          `SendGrid email send failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    if (lastError) {
      throw lastError;
    }
  }
}
