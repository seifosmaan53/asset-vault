// Copyright (c) 2025 Asset Vault. All rights reserved.

import {
  Controller,
  Post,
  Get,
  Delete,
  UseInterceptors,
  UploadedFile,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  NotFoundException,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { StorageService } from './storage.service';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';

@ApiTags('storage')
@Controller('storage')
@UseGuards(ClerkAuthGuard)
@ApiBearerAuth()
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a file to S3/R2' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request & { user?: { userId: string } },
    @Query('folder') folder?: string,
    @Query('makePublic') makePublic?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    return this.storageService.uploadFile({
      file,
      folder: folder || 'uploads',
      userId: req.user?.userId,
      makePublic: makePublic === 'true',
    });
  }

  /**
   * A key is only usable by the user whose id is in its prefix. Any other key (someone else's,
   * malformed, or traversal) gets the same 404 as a key that does not exist, so keys can't be probed.
   */
  private requireOwnKey(
    key: string,
    req: Request & { user?: { userId: string } },
  ) {
    if (!StorageService.isKeyOwnedBy(key, req.user?.userId)) {
      throw new NotFoundException('File not found');
    }
  }

  @Get('url/:key')
  @ApiOperation({ summary: 'Get signed URL for one of your files' })
  async getSignedUrl(
    @Param('key') key: string,
    @Req() req: Request & { user?: { userId: string } },
    @Query('expiresIn') expiresIn?: string,
  ) {
    this.requireOwnKey(key, req);
    const parsed = expiresIn ? parseInt(expiresIn, 10) : 3600;
    // Bound the lifetime of a signed URL: 1 minute to 7 days.
    const expires = Number.isFinite(parsed)
      ? Math.min(Math.max(parsed, 60), 7 * 24 * 60 * 60)
      : 3600;
    const url = await this.storageService.getSignedUrl(key, expires);
    return { url };
  }

  @Delete(':key')
  @ApiOperation({ summary: 'Delete one of your files' })
  async deleteFile(
    @Param('key') key: string,
    @Req() req: Request & { user?: { userId: string } },
  ) {
    this.requireOwnKey(key, req);
    await this.storageService.deleteFile(key);
    return { message: 'File deleted successfully' };
  }

  @Get('metadata/:key')
  @ApiOperation({ summary: 'Get metadata for one of your files' })
  async getFileMetadata(
    @Param('key') key: string,
    @Req() req: Request & { user?: { userId: string } },
  ) {
    this.requireOwnKey(key, req);
    const metadata = await this.storageService.getFileMetadata(key);
    if (!metadata) {
      throw new BadRequestException('File not found');
    }
    return metadata;
  }
}
