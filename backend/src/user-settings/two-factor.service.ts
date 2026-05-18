// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);

  constructor(private readonly configService: ConfigService) {
    // Configure TOTP defaults
    authenticator.options = {
      window: [1, 1], // Allow 1 time step before and after current time
    };
  }

  /**
   * Generate a new TOTP secret for a user
   */
  generateSecret(): string {
    return authenticator.generateSecret();
  }

  /**
   * Generate a QR code data URL for the TOTP secret
   */
  async generateQRCode(secret: string, email: string, serviceName: string = 'InvoiceMe'): Promise<string> {
    try {
      const otpAuthUrl = authenticator.keyuri(email, serviceName, secret);
      const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);
      return qrCodeDataUrl;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to generate QR code: ${errorMessage}`, error);
      throw new BadRequestException('Failed to generate QR code');
    }
  }

  /**
   * Verify a TOTP token against a secret
   */
  verifyToken(token: string, secret: string): boolean {
    try {
      if (!token || !secret) {
        return false;
      }
      // Remove any spaces from the token
      const cleanToken = token.replace(/\s/g, '');
      return authenticator.verify({ token: cleanToken, secret });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to verify TOTP token: ${errorMessage}`, error);
      return false;
    }
  }

  /**
   * Generate a TOTP token for testing purposes
   */
  generateToken(secret: string): string {
    try {
      return authenticator.generate(secret);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to generate TOTP token: ${errorMessage}`, error);
      throw new BadRequestException('Failed to generate TOTP token');
    }
  }
}

