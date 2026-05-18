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
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
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

  @Get('url/:key')
  @ApiOperation({ summary: 'Get signed URL for a file' })
  async getSignedUrl(
    @Param('key') key: string,
    @Query('expiresIn') expiresIn?: string,
  ) {
    const expires = expiresIn ? parseInt(expiresIn, 10) : 3600;
    const url = await this.storageService.getSignedUrl(key, expires);
    return { url };
  }

  @Delete(':key')
  @ApiOperation({ summary: 'Delete a file' })
  async deleteFile(@Param('key') key: string) {
    await this.storageService.deleteFile(key);
    return { message: 'File deleted successfully' };
  }

  @Get('metadata/:key')
  @ApiOperation({ summary: 'Get file metadata' })
  async getFileMetadata(@Param('key') key: string) {
    const metadata = await this.storageService.getFileMetadata(key);
    if (!metadata) {
      throw new BadRequestException('File not found');
    }
    return metadata;
  }
}
