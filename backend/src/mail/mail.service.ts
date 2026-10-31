import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import SMTPConnection from 'nodemailer/lib/smtp-connection';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import * as sgMail from '@sendgrid/mail';
import * as net from 'net';
import { isIP } from 'net';
import { isPublicAddress, resolveHostAddresses } from './smtp-address.util';
import { positiveIntFromEnv } from '../common/utils/env-int.util';

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

/** Whole-test deadline default (SMTP_TEST_TIMEOUT_MS, 1000-120000) and in-flight cap default (SMTP_TEST_MAX_CONCURRENT). */
export const SMTP_TEST_DEFAULTS = {
  timeoutMs: 10000,
  maxConcurrent: 8,
} as const;

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

/** One string field of a thrown value, read structurally (see describeError). */
function errorField(
  error: unknown,
  field: 'message' | 'stack',
): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  let value: unknown;
  if (field === 'message') {
    value = 'message' in error ? error.message : undefined;
  } else {
    value = 'stack' in error ? error.stack : undefined;
  }
  return typeof value === 'string' ? value : undefined;
}

/** The `response.body.errors` list SendGrid attaches to a failed request, if present. */
function sendGridErrors(error: unknown): { message?: string }[] | undefined {
  if (typeof error !== 'object' || error === null || !('response' in error)) {
    return undefined;
  }
  const { response } = error;
  if (
    typeof response !== 'object' ||
    response === null ||
    !('body' in response)
  ) {
    return undefined;
  }
  const { body } = response;
  if (typeof body !== 'object' || body === null || !('errors' in body)) {
    return undefined;
  }
  const { errors } = body;
  if (!Array.isArray(errors)) return undefined;
  return errors.map((e: unknown) => {
    const message =
      typeof e === 'object' && e !== null && 'message' in e
        ? e.message
        : undefined;
    return { message: typeof message === 'string' ? message : undefined };
  });
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter<SMTPTransport.SentMessageInfo> | null =
    null;
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

  private readonly testTimeoutMs: number;
  private readonly maxConcurrentTests: number;

  constructor(private configService: ConfigService) {
    const timeout = positiveIntFromEnv(
      'SMTP_TEST_TIMEOUT_MS',
      SMTP_TEST_DEFAULTS.timeoutMs,
    );
    if (timeout < 1000 || timeout > 120000) {
      throw new Error('SMTP_TEST_TIMEOUT_MS must be between 1000 and 120000');
    }
    this.testTimeoutMs = timeout;
    this.maxConcurrentTests = positiveIntFromEnv(
      'SMTP_TEST_MAX_CONCURRENT',
      SMTP_TEST_DEFAULTS.maxConcurrent,
    );
    this.initializeEmailService();
  }

  private initializeEmailService(): void {
    // Check for SendGrid API key first (preferred)
    const sendGridApiKey = this.configService.get<string>('SENDGRID_API_KEY');
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
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpPort = Number(
      this.configService.get<string | number>('SMTP_PORT') ?? 587,
    );
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');

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

  /** Public internet addresses only (see smtp-address.util). Public so tests that run a
   *  synthetic SMTP server on 127.0.0.1 can allow exactly that address and nothing else. */
  isAllowedSmtpAddress(address: string): boolean {
    return isPublicAddress(address);
  }

  /** Users with a connection test in flight in this process (one per user, capped overall). */
  private readonly testsInFlight = new Set<string>();

  /** Connection tests running in this process right now (for tests and diagnostics). */
  get connectionTestsInFlight(): number {
    return this.testsInFlight.size;
  }

  /**
   * Check that a submitted SMTP configuration can connect and authenticate.
   *
   * Uses exactly the configuration passed in: nothing is read from the environment, so a
   * submitted host can never receive the server's own SMTP_USER / SMTP_PASS. The check is
   * connect, EHLO, STARTTLS when the server offers it (as for real sending), AUTH, QUIT on
   * a single SMTPConnection; no message is sent and nothing is stored.
   *
   * Bounds, all per process (see SMTP_TEST_* in .env.example): one test in flight per user,
   * SMTP_TEST_MAX_CONCURRENT in flight overall, and SMTP_TEST_TIMEOUT_MS for the whole test,
   * after which the socket is destroyed. Excess requests get 429 without opening a connection.
   */
  async testConnection(
    userId: string,
    config: SmtpTestConfig,
  ): Promise<{ success: boolean; message: string }> {
    if (this.testsInFlight.has(userId)) {
      throw new HttpException(
        'A connection test for this account is already running. Wait for it to finish.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (this.testsInFlight.size >= this.maxConcurrentTests) {
      throw new HttpException(
        'Too many connection tests are running on this server. Try again in a moment.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.testsInFlight.add(userId);
    try {
      return await this.runConnectionTest(config);
    } finally {
      this.testsInFlight.delete(userId);
    }
  }

  /** Never in production: credentials only go over TLS. Public only so specs with a plaintext
   *  synthetic server can allow it, as they allow loopback through isAllowedSmtpAddress. */
  allowsPlaintextAuth(): boolean {
    return false;
  }

  private async runConnectionTest(
    config: SmtpTestConfig,
  ): Promise<{ success: boolean; message: string }> {
    // One deadline for the whole test: DNS, TCP, TLS, EHLO, AUTH.
    const deadlineAt = Date.now() + this.testTimeoutMs;
    const remaining = () => Math.max(1, deadlineAt - Date.now());

    if (!this.isValidSmtpHost(config.host)) {
      return {
        success: false,
        message: `SMTP host "${config.host}" is a placeholder, a local address or not a valid host name.`,
      };
    }

    // Resolve once, require EVERY address to be public, and connect to the address that was
    // checked, so a DNS answer cannot change between the check and the connection. One message
    // for "does not resolve" and "not public", so this cannot confirm which internal names exist.
    // A lookup still running at the deadline counts as "does not resolve".
    const addresses = await new Promise<string[]>((resolve) => {
      const timer = setTimeout(() => resolve([]), remaining());
      void resolveHostAddresses(config.host).then((found) => {
        clearTimeout(timer);
        resolve(found);
      });
    });
    if (
      addresses.length === 0 ||
      !addresses.every((address) => this.isAllowedSmtpAddress(address))
    ) {
      return {
        success: false,
        message: `SMTP host "${config.host}" could not be resolved to a public internet address.`,
      };
    }

    // Prefer an IPv4 address when the host has both families, as nodemailer's own lookup did.
    const target =
      addresses.find((address) => isIP(address) === 4) ?? addresses[0];
    const secure = config.secure ?? config.port === 465;

    // This process owns the TCP socket, so the deadline can destroy it at any stage; a peer
    // that keeps the SMTP exchange alive (e.g. endless 250- continuation lines) cannot hold it.
    const socket = net.connect({ host: target, port: config.port });
    let connection: SMTPConnection | undefined;
    let succeeded = false;

    try {
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const settle = (error?: unknown) => {
          if (settled) return;
          settled = true;
          clearTimeout(deadline);
          if (error === undefined) resolve();
          else {
            // Keep the driver's code: instanceof Error can be false across realms (Jest).
            const { message, code } = describeError(error);
            reject(Object.assign(new Error(message), { code }));
          }
        };
        const deadline = setTimeout(() => {
          settle(
            Object.assign(new Error('SMTP connection test timeout'), {
              code: 'ETIMEDOUT',
            }),
          );
          socket.destroy();
        }, remaining());

        socket.once('error', (error) => settle(error));
        socket.once('connect', () => {
          const smtp = new SMTPConnection({
            connection: socket,
            host: target,
            port: config.port,
            secure,
            // STARTTLS is required when TLS is not implicit: credentials never go in clear.
            requireTLS: !secure && !this.allowsPlaintextAuth(),
            // Certificates are checked against the name the user entered, not the address.
            tls: isIP(config.host) ? undefined : { servername: config.host },
            connectionTimeout: remaining(),
            greetingTimeout: remaining(),
            socketTimeout: remaining(),
            logger: false,
            debug: false,
          });
          connection = smtp;
          // Persistent listeners: a late 'error' after settling must never be unhandled.
          smtp.on('error', (error) => settle(error));
          smtp.on('end', () =>
            settle(
              Object.assign(new Error('Connection closed by the server'), {
                code: 'ECONNECTION',
              }),
            ),
          );
          smtp.connect((error) => {
            if (error) return settle(error);
            smtp.login(
              { user: config.user, pass: config.password },
              (loginError) => {
                if (loginError) return settle(loginError);
                smtp.quit();
                settle();
              },
            );
          });
        });
      });
      succeeded = true;
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
      } else if (errorCode === 'ETIMEDOUT') {
        message +=
          'Connection timeout. Please check your SMTP settings and network connection.';
      } else if (errorCode === 'ETLS') {
        message +=
          'The server did not offer a secure (TLS) connection, so the password was not sent.';
      } else if (
        errorCode === 'ECONNECTION' ||
        errorCode === 'ENOTFOUND' ||
        errorCode === 'EDNS' ||
        errorCode === 'ECONNREFUSED' ||
        errorCode === 'ECONNRESET' ||
        errorCode === 'EHOSTUNREACH' ||
        errorCode === 'ENETUNREACH' ||
        errorCode === 'ESOCKET'
      ) {
        message +=
          'Cannot connect to the SMTP server. Please check the SMTP host and port.';
      } else {
        // Never echo the driver's text: for a non-SMTP service it carries that service's reply.
        message += 'The server did not complete the SMTP connection test.';
      }

      // Code only: the driver text can carry the remote service's reply.
      this.logger.warn(
        `SMTP connection test failed: ${errorCode || 'unknown'} (${errorMessage.length} chars of driver text withheld)`,
      );
      return { success: false, message };
    } finally {
      connection?.close();
      if (succeeded) {
        // Let QUIT reach the server, but never wait on the peer for long.
        setTimeout(() => socket.destroy(), 1000).unref();
      } else {
        socket.destroy();
      }
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
    const smtpHost = this.configService.get<string>('SMTP_HOST');
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
          this.configService.get<string>('SMTP_FROM') ||
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
          } catch (verifyError: unknown) {
            // If verification fails, log but try to send anyway (some SMTP servers don't support verify)
            const verifyMessage = errorField(verifyError, 'message');
            if (verifyMessage !== 'SMTP verification timeout') {
              this.logger.warn(
                'SMTP verification failed, but attempting to send email anyway:',
                verifyMessage,
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
      } catch (error: unknown) {
        const { message: errorMessage, code: errorCode } = describeError(error);
        lastError = error instanceof Error ? error : new Error(errorMessage);

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
              stack: errorField(error, 'stack'),
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
            const smtpHost = this.configService.get<string>('SMTP_HOST');
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
      this.configService.get<string>('SMTP_FROM') ||
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
      } catch (error: unknown) {
        const { message: errorMessage } = describeError(error);
        lastError = error instanceof Error ? error : new Error(errorMessage);

        // SendGrid specific error handling
        const sgErrors = sendGridErrors(error);
        if (sgErrors) {
          const isRetryable = sgErrors.some(
            (e) =>
              e.message?.includes('timeout') ||
              e.message?.includes('rate limit') ||
              e.message?.includes('temporarily'),
          );

          if (!isRetryable || attempt === maxRetries) {
            this.logger.error(`SendGrid email send failed:`, sgErrors);
            throw new Error(
              `SendGrid error: ${sgErrors.map((e) => e.message).join(', ')}`,
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
