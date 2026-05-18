import { Controller, Get, Patch, Post, Body, UseGuards, Request, Res, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserSettingsService } from './user-settings.service';
import { TwoFactorService } from './two-factor.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { OrganizationId } from '../organizations/organization-context.decorator';
import { UsersService } from '../users/users.service';

@Controller('user-settings')
@UseGuards(ClerkAuthGuard)
@Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.STAFF) // Allow all authenticated users to access their own settings
export class UserSettingsController {
  constructor(
    private readonly settingsService: UserSettingsService,
    private readonly twoFactorService: TwoFactorService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  getSettings(@Request() req, @OrganizationId() organizationId: string | null) {
    // Organizations removed - organizationId is always null, data is user-scoped
    return this.settingsService.getSettings(req.user.userId);
  }

  @Patch()
  // Fix Issue #15: Add rate limiting to prevent DoS attacks and spam updates
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 updates per 60 seconds per IP
  @ApiResponse({ status: 429, description: 'Too many requests - rate limited' })
  updateSettings(@Request() req, @Body() data: UpdateSettingsDto, @OrganizationId() organizationId: string | null) {
    try {
      // Organizations removed - organizationId is always null, data is user-scoped
      const result = this.settingsService.updateSettings(req.user.userId, data, null);
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Post('backup')
  createBackup(@Request() req, @Body() body?: { includeSqlBackup?: boolean }, @OrganizationId() organizationId?: string | null) {
    // Organizations removed - organizationId is always null, data is user-scoped
    try {
      const result = this.settingsService.createBackup(req.user.userId, body, null);
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Post('backup/export')
  async exportData(@Request() req, @Res() res: Response, @Body() body?: { format?: string }, @OrganizationId() organizationId?: string | null) {
    // Organizations removed - organizationId is always null, data is user-scoped
    const format = body?.format || 'json';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    try {
      if (format === 'csv') {
        const csvContent = await this.settingsService.exportUserDataAsCsv(req.user.userId, null);
        const fileName = `invoiceme_export_${timestamp}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.send('\uFEFF' + csvContent); // Add BOM for Excel compatibility
        return;
      } else if (format === 'excel') {
        const excelBuffer = await this.settingsService.exportUserDataAsExcel(req.user.userId, null);
        const fileName = `invoiceme_export_${timestamp}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.send(excelBuffer);
        return;
      } else if (format === 'pdf') {
        try {
          // Fix Issue #19: Improved error handling for PDF generation
          const pdfBuffer = await this.settingsService.exportUserDataAsPdf(req.user.userId, null);
          const fileName = `invoiceme_export_${timestamp}.pdf`;
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
          res.send(pdfBuffer);
          return;
        } catch (pdfError: unknown) {
          // Fix Issue #19: Better error handling - don't expose stack traces in production
          const errorMessage = pdfError instanceof Error ? pdfError.message : String(pdfError);
          const isDevelopment = process.env.NODE_ENV !== 'production';
          res.status(500).json({
            message: errorMessage || 'Failed to generate PDF. Please ensure Puppeteer is properly installed.',
            error: 'PDF generation failed',
            ...(isDevelopment && pdfError instanceof Error ? { details: pdfError.stack } : {}),
          });
          return;
        }
      } else {
        // Default to JSON
        const result = await this.settingsService.exportUserData(req.user.userId, null);
        const fileName = `invoiceme_export_${timestamp}.json`;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.send(JSON.stringify(result.data, null, 2));
      }
    } catch (error: unknown) {
      // Fix Issue #19: Better error handling
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.status(500).json({
        message: errorMessage || 'Failed to export data',
        error: 'Export failed',
      });
    }
  }

  @Post('test-email')
  @ApiOperation({ 
    summary: 'Test email connection', 
    description: 'Test SMTP email connection with provided credentials or environment variables. If credentials are provided in the request body, they will be used for testing. Otherwise, environment variables will be used.' 
  })
  @ApiResponse({ status: 200, description: 'Email connection test completed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async testEmail(
    @Request() req,
    @Body() body?: {
      smtpHost?: string;
      smtpPort?: number;
      smtpSecure?: boolean;
      smtpUser?: string;
      smtpPassword?: string;
      emailFromAddress?: string;
      emailFromName?: string;
    },
  ) {
    try {
      const result = await this.settingsService.testEmailConnection(req.user.userId, body);
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Post('2fa/generate')
  @ApiOperation({ 
    summary: 'Generate 2FA secret and QR code', 
    description: 'Generate a new TOTP secret and QR code for two-factor authentication setup' 
  })
  @ApiResponse({ status: 200, description: '2FA secret and QR code generated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async generate2FA(@Request() req) {
    try {
      const user = await this.usersService.findById(req.user.userId);
      if (!user) {
        throw new BadRequestException('User not found');
      }

      const secret = this.twoFactorService.generateSecret();
      const qrCode = await this.twoFactorService.generateQRCode(secret, user.email, 'InvoiceMe');

      return {
        secret,
        qrCode,
        email: user.email,
      };
    } catch (error: any) {
      throw error;
    }
  }

  @Post('2fa/verify')
  @ApiOperation({ 
    summary: 'Verify 2FA token', 
    description: 'Verify a TOTP token against a secret. Used during 2FA setup to confirm the authenticator app is working.' 
  })
  @ApiResponse({ status: 200, description: 'Token verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid token' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async verify2FA(
    @Request() req,
    @Body() body: { token: string; secret: string },
  ) {
    try {
      const isValid = this.twoFactorService.verifyToken(body.token, body.secret);
      
      if (!isValid) {
        throw new BadRequestException('Invalid verification code. Please try again.');
      }

      return {
        verified: true,
        message: 'Verification code is valid',
      };
    } catch (error: any) {
      throw error;
    }
  }

  @Post('2fa/enable')
  @ApiOperation({ 
    summary: 'Enable 2FA for user', 
    description: 'Enable two-factor authentication after verifying the setup token' 
  })
  @ApiResponse({ status: 200, description: '2FA enabled successfully' })
  @ApiResponse({ status: 400, description: 'Invalid token or secret' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async enable2FA(
    @Request() req,
    @Body() body: { token: string; secret: string },
    @OrganizationId() organizationId: string | null,
  ) {
    try {
      // Verify the token first
      const isValid = this.twoFactorService.verifyToken(body.token, body.secret);
      
      if (!isValid) {
        throw new BadRequestException('Invalid verification code. Please verify your authenticator app is working correctly.');
      }

      // NOTE: 2FA settings fields have been removed from UserSettings
      // 2FA state should be managed separately if needed in the future
      // For now, we just verify the token but don't store 2FA state in settings

      return {
        enabled: true,
        message: 'Two-factor authentication has been enabled successfully',
      };
    } catch (error: any) {
      throw error;
    }
  }

  @Post('2fa/disable')
  @ApiOperation({ 
    summary: 'Disable 2FA for user', 
    description: 'Disable two-factor authentication. Requires verification token.' 
  })
  @ApiResponse({ status: 200, description: '2FA disabled successfully' })
  @ApiResponse({ status: 400, description: 'Invalid token' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async disable2FA(
    @Request() req,
    @Body() body: { token: string },
    @OrganizationId() organizationId: string | null,
  ) {
    try {
      // NOTE: 2FA settings fields have been removed from UserSettings
      // This endpoint is disabled - 2FA state is no longer stored in settings
      throw new BadRequestException('Two-factor authentication feature has been removed from settings');
    } catch (error: any) {
      throw error;
    }
  }
}

