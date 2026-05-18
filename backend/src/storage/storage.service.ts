// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

export interface UploadFileOptions {
  file: Express.Multer.File;
  folder?: string;
  userId?: string;
  makePublic?: boolean;
}

export interface FileMetadata {
  key: string;
  url: string;
  size: number;
  contentType: string;
  uploadedAt: Date;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client;
  private bucketName: string;
  private region: string;
  private useCloudflareR2: boolean;
  private endpoint?: string;

  constructor(private configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET') || '';
    this.useCloudflareR2 = this.configService.get<string>('USE_CLOUDFLARE_R2') === 'true';
    this.endpoint = this.configService.get<string>('CLOUDFLARE_R2_ENDPOINT');

    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');

    if (!accessKeyId || !secretAccessKey) {
      this.logger.warn('AWS credentials not configured. File storage will not work.');
      return;
    }

    const s3Config: any = {
      region: this.region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    };

    // Cloudflare R2 uses a custom endpoint
    if (this.useCloudflareR2 && this.endpoint) {
      s3Config.endpoint = this.endpoint;
      s3Config.forcePathStyle = true; // R2 requires path-style addressing
    }

    this.s3Client = new S3Client(s3Config);
  }

  /**
   * Upload file to S3/R2
   */
  async uploadFile(options: UploadFileOptions): Promise<FileMetadata> {
    const { file, folder = 'uploads', userId, makePublic = false } = options;

    if (!this.s3Client || !this.bucketName) {
      throw new BadRequestException('File storage is not configured');
    }

    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Generate unique file key
    const fileExtension = file.originalname.split('.').pop() || 'bin';
    const fileName = `${uuidv4()}.${fileExtension}`;
    const key = userId ? `${folder}/${userId}/${fileName}` : `${folder}/${fileName}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: makePublic ? 'public-read' : 'private',
        Metadata: {
          originalName: file.originalname,
          uploadedBy: userId || 'anonymous',
        },
      });

      await this.s3Client.send(command);

      // Generate URL (public or signed)
      let url: string;
      if (makePublic) {
        // Public URL format depends on R2 or S3
        if (this.useCloudflareR2 && this.endpoint) {
          url = `${this.endpoint}/${this.bucketName}/${key}`;
        } else {
          url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
        }
      } else {
        // Generate signed URL (valid for 7 days)
        url = await this.getSignedUrl(key, 7 * 24 * 60 * 60);
      }

      this.logger.log(`File uploaded successfully: ${key}`);

      return {
        key,
        url,
        size: file.size,
        contentType: file.mimetype,
        uploadedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to upload file: ${error}`);
      throw new BadRequestException(`Failed to upload file: ${error}`);
    }
  }

  /**
   * Get signed URL for private file
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (!this.s3Client || !this.bucketName) {
      throw new BadRequestException('File storage is not configured');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      this.logger.error(`Failed to generate signed URL: ${error}`);
      throw new BadRequestException(`Failed to generate signed URL: ${error}`);
    }
  }

  /**
   * Delete file from S3/R2
   */
  async deleteFile(key: string): Promise<void> {
    if (!this.s3Client || !this.bucketName) {
      throw new BadRequestException('File storage is not configured');
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.log(`File deleted successfully: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete file: ${error}`);
      throw new BadRequestException(`Failed to delete file: ${error}`);
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(key: string): Promise<boolean> {
    if (!this.s3Client || !this.bucketName) {
      return false;
    }

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(key: string): Promise<FileMetadata | null> {
    if (!this.s3Client || !this.bucketName) {
      return null;
    }

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      return {
        key,
        url: await this.getSignedUrl(key),
        size: response.ContentLength || 0,
        contentType: response.ContentType || 'application/octet-stream',
        uploadedAt: response.LastModified || new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to get file metadata: ${error}`);
      return null;
    }
  }
}
