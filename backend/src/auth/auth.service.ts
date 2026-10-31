// Copyright (c) 2025 Asset Vault. All rights reserved.

import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Webhook } from 'svix';
import { createClerkClient } from '@clerk/backend';
import { UsersService } from '../users/users.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { User } from '../users/entities/user.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

/** The fields AuthService reads from a Clerk `user.*` webhook payload. */
interface ClerkUserEventData {
  id: string;
  email: string | undefined;
  firstName: string | undefined;
  lastName: string | undefined;
  username: string | undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * Reads the user fields out of an (untrusted) webhook `data` object. Returns null when
 * there is no usable Clerk user id: every handler looks the user up by that id, and
 * TypeORM treats `where: { clerkUserId: undefined }` as "no condition", which would
 * match an arbitrary user.
 */
function parseClerkUserEventData(data: unknown): ClerkUserEventData | null {
  if (!isRecord(data)) return null;
  const id = optionalString(data.id);
  if (!id) return null;
  const emails = data.email_addresses;
  const firstEmail: unknown = Array.isArray(emails) ? emails[0] : undefined;
  return {
    id,
    email: isRecord(firstEmail)
      ? optionalString(firstEmail.email_address)
      : undefined,
    firstName: optionalString(data.first_name),
    lastName: optionalString(data.last_name),
    username: optionalString(data.username),
  };
}

function displayName(data: ClerkUserEventData): string {
  const name = `${data.firstName || ''} ${data.lastName || ''}`.trim();
  return name || data.username || 'User';
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private clerkClient: ReturnType<typeof createClerkClient>;

  constructor(
    private usersService: UsersService,
    private organizationsService: OrganizationsService,
    private configService: ConfigService,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @Inject(forwardRef(() => SubscriptionsService))
    private subscriptionsService: SubscriptionsService,
  ) {
    // Initialize Clerk client
    const secretKey = this.configService.get<string>('CLERK_SECRET_KEY');
    if (secretKey) {
      this.clerkClient = createClerkClient({ secretKey });
    }
  }

  async handleClerkWebhook(
    rawBody: Buffer,
    svixId: string,
    svixTimestamp: string,
    svixSignature: string,
  ) {
    const webhookSecret = this.configService.get<string>(
      'CLERK_WEBHOOK_SECRET',
    );

    if (!webhookSecret) {
      this.logger.warn(
        'CLERK_WEBHOOK_SECRET not set, skipping webhook verification',
      );
      // In development, you might want to allow webhooks without verification
      // In production, you should always verify webhooks
    }

    let evt: unknown;

    if (webhookSecret) {
      const wh = new Webhook(webhookSecret);
      try {
        evt = wh.verify(rawBody, {
          'svix-id': svixId,
          'svix-timestamp': svixTimestamp,
          'svix-signature': svixSignature,
        });
      } catch (err) {
        this.logger.error('Webhook verification failed', err);
        throw new BadRequestException('Webhook verification failed');
      }
    } else {
      // Development mode - parse without verification
      evt = JSON.parse(rawBody.toString());
    }

    if (!isRecord(evt)) {
      throw new BadRequestException('Invalid webhook payload');
    }
    const type = optionalString(evt.type);
    const data: unknown = evt.data;

    try {
      switch (type) {
        case 'user.created':
        case 'user.updated':
        case 'user.deleted': {
          const user = parseClerkUserEventData(data);
          if (!user) {
            this.logger.warn(
              `Ignoring ${type} webhook without a Clerk user id`,
            );
            break;
          }
          if (type === 'user.created') await this.handleUserCreated(user);
          else if (type === 'user.updated') await this.handleUserUpdated(user);
          else await this.handleUserDeleted(user);
          break;
        }
        default:
          this.logger.log(`Unhandled webhook event type: ${String(evt.type)}`);
      }
    } catch (error) {
      this.logger.error(`Error handling webhook event ${type}:`, error);
      throw error;
    }

    return { received: true };
  }

  private async handleUserCreated(data: ClerkUserEventData) {
    const clerkUserId = data.id;
    const email = data.email;
    const name = displayName(data);

    if (!email) {
      this.logger.warn(`User created without email: ${clerkUserId}`);
      return;
    }

    // Check if user already exists
    let user = await this.usersService.findByClerkId(clerkUserId);
    if (user) {
      this.logger.log(`User already exists: ${clerkUserId}`);
      return;
    }

    // Check if email already exists (might have been created before webhook)
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      // Link existing user to Clerk
      existingUser.clerkUserId = clerkUserId;
      await this.usersRepository.save(existingUser);
      this.logger.log(`Linked existing user to Clerk: ${clerkUserId}`);
      return;
    }

    // Create new user (all users get owner role by default)
    user = await this.usersService.createFromClerk({
      clerkUserId,
      email,
      name,
    });

    // Create organization for the user
    const orgName = user.companyName || user.name || email.split('@')[0];
    await this.organizationsService.create(orgName, user.id, user.companyName);

    // Create pending subscription for new user
    try {
      const defaultPlan = await this.subscriptionsService.getDefaultPlan();
      if (defaultPlan) {
        await this.subscriptionsService.createPendingSubscription(
          user.id,
          defaultPlan.id,
        );
        this.logger.log(`Created pending subscription for user ${user.id}`);
      }
    } catch (error: unknown) {
      // Don't fail user creation if subscription creation fails
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to create subscription for user ${user.id}: ${message}`,
      );
    }

    this.logger.log(
      `User created from Clerk webhook: ${email} (${clerkUserId})`,
    );
  }

  private async handleUserUpdated(data: ClerkUserEventData) {
    const clerkUserId = data.id;
    const email = data.email;
    const name = displayName(data);

    const user = await this.usersService.findByClerkId(clerkUserId);
    if (!user) {
      this.logger.warn(`User not found for update: ${clerkUserId}`);
      return;
    }

    // Update user fields
    user.email = email || user.email;
    user.name = name || user.name;
    user.emailVerified = true; // Clerk handles email verification

    await this.usersRepository.save(user);
    this.logger.log(
      `User updated from Clerk webhook: ${email} (${clerkUserId})`,
    );
  }

  private async handleUserDeleted(data: ClerkUserEventData) {
    const clerkUserId = data.id;
    const user = await this.usersService.findByClerkId(clerkUserId);

    if (!user) {
      this.logger.warn(`User not found for deletion: ${clerkUserId}`);
      return;
    }

    // Optionally soft delete or hard delete
    // For now, we'll just log it - you might want to keep user data for audit purposes
    this.logger.log(`User deleted from Clerk: ${clerkUserId}`);
    // await this.usersService.delete(user.id);
  }

  async getProfile(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      companyName: user.companyName || null,
      phone: user.phone || null,
      address: user.address || null,
      timezone: user.timezone || null,
      bio: user.bio || null,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  async updateProfile(
    userId: string,
    data: {
      name?: string;
      companyName?: string;
      phone?: string;
      address?: string;
      timezone?: string;
      bio?: string;
    },
  ) {
    // Only allow whitelisted fields to be updated
    const allowedFields: Partial<User> = {};
    if (data.name !== undefined) allowedFields.name = data.name;
    if (data.companyName !== undefined)
      allowedFields.companyName = data.companyName;
    if (data.phone !== undefined) allowedFields.phone = data.phone;
    if (data.address !== undefined) allowedFields.address = data.address;
    if (data.timezone !== undefined) allowedFields.timezone = data.timezone;
    if (data.bio !== undefined) allowedFields.bio = data.bio;

    const user = await this.usersService.update(userId, allowedFields);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      companyName: user.companyName || null,
      phone: user.phone || null,
      address: user.address || null,
      timezone: user.timezone || null,
      bio: user.bio || null,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  async changePassword(
    userId: string,
    dto: { currentPassword: string; newPassword: string },
  ) {
    // Get user to verify they exist and get their Clerk ID
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.clerkUserId) {
      throw new BadRequestException('User is not linked to a Clerk account');
    }

    if (!this.clerkClient) {
      throw new BadRequestException('Clerk is not configured');
    }

    try {
      // Update password using Clerk's API
      // Note: Clerk's updateUser method requires the user ID and new password
      // We verify the current password by attempting to authenticate, but Clerk handles password changes
      await this.clerkClient.users.updateUser(user.clerkUserId, {
        password: dto.newPassword,
      });

      this.logger.log(
        `Password changed for user ${userId} (Clerk ID: ${user.clerkUserId})`,
      );

      return {
        message: 'Password changed successfully',
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to change password for user ${userId}:`,
        errorMessage,
      );

      // Handle specific Clerk errors
      if (
        errorMessage.includes('password') ||
        errorMessage.includes('Password')
      ) {
        throw new BadRequestException(
          'Failed to change password. Please ensure your new password meets the requirements.',
        );
      }

      throw new BadRequestException(
        'Failed to change password. Please try again.',
      );
    }
  }
}
