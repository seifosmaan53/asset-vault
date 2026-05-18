// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Injectable, NestMiddleware, BadRequestException, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * File Upload Validation Middleware
 * Fixes Issue #9: Missing File Upload Size/Type Validation
 */
@Injectable()
export class FileUploadValidationMiddleware implements NestMiddleware {
  private readonly logger = new Logger(FileUploadValidationMiddleware.name);
  
  // Allowed MIME types for images
  private readonly allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
  ];

  // Maximum file size: 5MB
  private readonly maxFileSize = 5 * 1024 * 1024; // 5MB in bytes

  use(req: Request, res: Response, next: NextFunction) {
    // Check if this is a file upload request
    if (req.headers['content-type']?.includes('multipart/form-data')) {
      // Multer will handle the actual file validation
      // This middleware just sets up validation rules
      // The actual validation happens in the controller using multer options
    }

    next();
  }

  /**
   * Validate file based on size and MIME type
   */
  validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Check file size
    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.maxFileSize / 1024 / 1024}MB`
      );
    }

    // Check MIME type
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type not allowed. Allowed types: ${this.allowedMimeTypes.join(', ')}`
      );
    }

    // Additional validation: check file extension matches MIME type
    const extension = file.originalname.split('.').pop()?.toLowerCase();
    const expectedExtensions: Record<string, string[]> = {
      'image/jpeg': ['jpg', 'jpeg'],
      'image/png': ['png'],
      'image/gif': ['gif'],
      'image/webp': ['webp'],
      'image/svg+xml': ['svg'],
    };

    if (extension && expectedExtensions[file.mimetype]) {
      if (!expectedExtensions[file.mimetype].includes(extension)) {
        this.logger.warn(
          `File extension (${extension}) does not match MIME type (${file.mimetype})`
        );
      }
    }
  }

  /**
   * Get multer configuration options
   */
  getMulterOptions() {
    return {
      limits: {
        fileSize: this.maxFileSize,
      },
      fileFilter: (req: Request, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
        if (this.allowedMimeTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              `File type not allowed. Allowed types: ${this.allowedMimeTypes.join(', ')}`
            ),
            false
          );
        }
      },
    };
  }
}

