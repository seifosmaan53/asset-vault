import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import type { Request as ExpressRequest, Response } from 'express';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { positiveIntFromEnv } from '../common/utils/env-int.util';
import {
  SMTP_TEST_LIMITS,
  SmtpTestThrottlerGuard,
} from './smtp-test-throttler.guard';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserSettingsService } from './user-settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { TestEmailConnectionDto } from './dto/test-email.dto';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import type { RequestUser } from '../auth/interfaces/request-user.interface';

interface AuthenticatedRequest extends ExpressRequest {
  user: RequestUser;
}

@ApiTags('settings')
@Controller('user-settings')
@UseGuards(ClerkAuthGuard)
@Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.STAFF) // Allow all authenticated users to access their own settings
export class UserSettingsController {
  constructor(
    private readonly settingsService: UserSettingsService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  getSettings(@Request() req: AuthenticatedRequest) {
    // Organizations removed - organizationId is always null, data is user-scoped
    return this.settingsService.getSettings(req.user.userId);
  }

  @Patch()
  // Fix Issue #15: Add rate limiting to prevent DoS attacks and spam updates
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 updates per 60 seconds per IP
  @ApiResponse({ status: 429, description: 'Too many requests - rate limited' })
  updateSettings(
    @Request() req: AuthenticatedRequest,
    @Body() data: UpdateSettingsDto,
  ) {
    // Organizations removed - organizationId is always null, data is user-scoped
    const result = this.settingsService.updateSettings(
      req.user.userId,
      data,
      null,
    );
    return result;
  }

  @Post('backup')
  createBackup(
    @Request() req: AuthenticatedRequest,
    @Body() body?: { includeSqlBackup?: boolean },
  ) {
    // Organizations removed - organizationId is always null, data is user-scoped
    const result = this.settingsService.createBackup(req.user.userId, body);
    return result;
  }

  @Post('backup/export')
  async exportData(
    @Request() req: AuthenticatedRequest,
    @Res() res: Response,
    @Body() body?: { format?: string },
  ) {
    // Organizations removed - organizationId is always null, data is user-scoped
    const format = body?.format || 'json';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    try {
      if (format === 'csv') {
        const csvContent = await this.settingsService.exportUserDataAsCsv(
          req.user.userId,
        );
        const fileName = `asset-vault_export_${timestamp}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${fileName}"`,
        );
        res.send('\uFEFF' + csvContent); // Add BOM for Excel compatibility
        return;
      } else if (format === 'excel') {
        const excelBuffer = await this.settingsService.exportUserDataAsExcel(
          req.user.userId,
        );
        const fileName = `asset-vault_export_${timestamp}.xlsx`;
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${fileName}"`,
        );
        res.send(excelBuffer);
        return;
      } else if (format === 'pdf') {
        try {
          // Fix Issue #19: Improved error handling for PDF generation
          const pdfBuffer = await this.settingsService.exportUserDataAsPdf(
            req.user.userId,
          );
          const fileName = `asset-vault_export_${timestamp}.pdf`;
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="${fileName}"`,
          );
          res.send(pdfBuffer);
          return;
        } catch (pdfError: unknown) {
          // Fix Issue #19: Better error handling - don't expose stack traces in production
          const errorMessage =
            pdfError instanceof Error ? pdfError.message : String(pdfError);
          const isDevelopment = process.env.NODE_ENV !== 'production';
          res.status(500).json({
            message:
              errorMessage ||
              'Failed to generate PDF. Please ensure Puppeteer is properly installed.',
            error: 'PDF generation failed',
            ...(isDevelopment && pdfError instanceof Error
              ? { details: pdfError.stack }
              : {}),
          });
          return;
        }
      } else {
        // Default to JSON
        const result = await this.settingsService.exportUserData(
          req.user.userId,
        );
        const fileName = `asset-vault_export_${timestamp}.json`;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${fileName}"`,
        );
        res.send(JSON.stringify(result.data, null, 2));
      }
    } catch (error: unknown) {
      // Fix Issue #19: Better error handling
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      res.status(500).json({
        message: errorMessage || 'Failed to export data',
        error: 'Export failed',
      });
    }
  }

  @Post('test-email')
  // Per address (global guard, before auth) and per verified user (route guard, after auth);
  // MailService also caps tests in flight. All counts are per process; see .env.example.
  @Throttle({
    default: {
      // A function, read per request: a value computed at import time would miss .env, which
      // ConfigModule loads after this module is imported.
      limit: () =>
        positiveIntFromEnv(
          'SMTP_TEST_IP_LIMIT_PER_MINUTE',
          SMTP_TEST_LIMITS.perIpPerMinute,
        ),
      ttl: 60000,
    },
  })
  @UseGuards(SmtpTestThrottlerGuard)
  @ApiResponse({
    status: 429,
    description:
      'Rate limited: per user (5/min, 20/h by default), per client address (20/min), or a test is already running for this account / the server is at its concurrent-test cap',
  })
  @ApiOperation({
    summary: 'Test an SMTP configuration',
    description:
      'Connects to the submitted SMTP server and authenticates with the submitted username and password (transport verify only: no email is sent, nothing is saved, and neither stored settings nor the server environment are used). The password must be submitted: omitted, empty, or the stored-password placeholder "***ENCRYPTED***" returns 400 for any host, because a stored password is never reused for a test. Connection and authentication failures are reported as { success: false, message }.',
  })
  @ApiResponse({
    status: 201,
    description: 'Test completed; see success and message',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid body, or the password was omitted/redacted',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async testEmail(
    @Request() req: AuthenticatedRequest,
    @Body() body: TestEmailConnectionDto,
  ) {
    const result = await this.settingsService.testEmailConnection(
      req.user.userId,
      body,
    );
    return result;
  }
}
