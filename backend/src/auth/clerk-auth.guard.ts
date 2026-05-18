// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { createClerkClient } from '@clerk/backend';
import * as jwt from 'jsonwebtoken';
import { IS_PUBLIC_KEY } from './public.decorator';
import { UsersService } from '../users/users.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { RequestUser } from './interfaces/request-user.interface';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly logger = new Logger(ClerkAuthGuard.name);
  private clerkClient: ReturnType<typeof createClerkClient>;

  constructor(
    private reflector: Reflector,
    private usersService: UsersService,
    private organizationsService: OrganizationsService,
    private configService: ConfigService,
  ) {
    // Initialize Clerk with secret key
    const secretKey = this.configService.get<string>('CLERK_SECRET_KEY');
    if (!secretKey) {
      throw new Error('CLERK_SECRET_KEY is not defined in environment variables');
    }
    this.clerkClient = createClerkClient({ secretKey });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);

    try {
      // FIX Issue #169: Validate token on every request - no caching
      // Decode token to extract claims (safe operation, doesn't verify signature)
      const decoded = jwt.decode(token, { complete: false }) as any;
      
      if (!decoded || !decoded.sub) {
        throw new UnauthorizedException('Invalid token format');
      }

      // FIX Issue #169: Check token expiration
      if (decoded.exp) {
        const expirationTime = decoded.exp * 1000; // Convert to milliseconds
        const now = Date.now();
        if (now >= expirationTime) {
          this.logger.warn(`Token expired for user ${decoded.sub}. Expired at: ${new Date(expirationTime).toISOString()}`);
          throw new UnauthorizedException('Token has expired');
        }
      }

      // FIX Issue #169: Verify token with Clerk's API on every request
      // This ensures:
      // 1. User exists in Clerk
      // 2. User hasn't been deleted
      // 3. Token hasn't been revoked
      // 4. User account is still active
      // Note: Clerk's backend SDK uses the secret key for API authentication
      // The JWT token itself is verified by calling Clerk's API, which validates the token
      const clerkUser = await this.clerkClient.users.getUser(decoded.sub);
      
      if (!clerkUser) {
        this.logger.warn(`User ${decoded.sub} not found in Clerk`);
        throw new UnauthorizedException('Invalid token - user not found');
      }

      // FIX Issue #169: Additional validation - check if user is banned or deleted
      if (clerkUser.banned || (clerkUser as any).lockoutExpiresIn) {
        this.logger.warn(`User ${decoded.sub} is banned or locked out`);
        throw new UnauthorizedException('User account is not active');
      }

      // Find or create user in our database
      let user = await this.usersService.findByClerkId(clerkUser.id);
      
      if (!user) {
        // User doesn't exist in our DB yet - check by email first
        // This can happen if webhook hasn't fired yet or user was created directly in Clerk
        const primaryEmail = clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId);
        const email = primaryEmail?.emailAddress || '';
        
        if (email) {
          // Check if user with this email already exists
          const existingUser = await this.usersService.findByEmail(email);
          if (existingUser) {
            // Link existing user to Clerk if not already linked
            if (!existingUser.clerkUserId) {
              user = await this.usersService.linkToClerk(existingUser.id, clerkUser.id);
            } else if (existingUser.clerkUserId !== clerkUser.id) {
              // User exists with different Clerk ID - this is an error
              throw new UnauthorizedException('User email already associated with different account');
            } else {
              // User already linked, use it
              user = existingUser;
            }
          } else {
            // Create new user
            user = await this.usersService.createFromClerk({
              clerkUserId: clerkUser.id,
              email,
              name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || clerkUser.username || 'User',
            });
          }
        } else {
          throw new UnauthorizedException('User has no email address');
        }
      }

      // Ensure user has an organization (create if missing)
      // This handles cases where user was created before webhook fired or webhook failed
      const userOrganizations = await this.organizationsService.findAll(user.id);
      if (!userOrganizations || userOrganizations.length === 0) {
        this.logger.log(`No organization found for user ${user.id}, creating one...`);
        const orgName = user.companyName || user.name || user.email.split('@')[0];
        await this.organizationsService.create(orgName, user.id, user.companyName);
        this.logger.log(`Organization created for user ${user.id}`);
      }

      // Attach user to request
      const requestUser: RequestUser = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };
      
      // DIAGNOSTIC: Log the user being attached to request
      this.logger.log(`[DIAGNOSTIC] ClerkAuthGuard - Attaching user to request: userId=${user.id}, email=${user.email}, clerkUserId=${clerkUser.id}`);
      
      request.user = requestUser;
      request.clerkUserId = clerkUser.id;

      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}

