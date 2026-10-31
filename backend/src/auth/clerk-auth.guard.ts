// Copyright (c) 2025 Asset Vault. All rights reserved.

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { IS_PUBLIC_KEY } from './public.decorator';
import { UsersService } from '../users/users.service';
import { OrganizationsService } from '../organizations/organizations.service';
import type {
  GuardRequest,
  RequestUser,
} from './interfaces/request-user.interface';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly logger = new Logger(ClerkAuthGuard.name);
  private clerkClient: ReturnType<typeof createClerkClient>;
  private readonly secretKey: string;
  /** Optional PEM public key (CLERK_JWT_KEY); lets verification run without a JWKS network call. */
  private readonly jwtKey?: string;

  constructor(
    private reflector: Reflector,
    private usersService: UsersService,
    private organizationsService: OrganizationsService,
    private configService: ConfigService,
  ) {
    // Initialize Clerk with secret key
    const secretKey = this.configService.get<string>('CLERK_SECRET_KEY');
    if (!secretKey) {
      throw new Error(
        'CLERK_SECRET_KEY is not defined in environment variables',
      );
    }
    this.secretKey = secretKey;
    this.jwtKey = this.configService.get<string>('CLERK_JWT_KEY') || undefined;
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

    const request = context.switchToHttp().getRequest<GuardRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid authorization header',
      );
    }

    const token = authHeader.substring(7);

    try {
      // Verify the token's SIGNATURE (and expiry/not-before) against the Clerk instance's keys before
      // trusting any claim in it. The previous version used jwt.decode(), which does not verify
      // anything, then looked the user up by the unverified `sub`: anyone able to craft a JWT with a
      // known Clerk user id was authenticated as that user. verifyToken() fetches and caches the
      // instance JWKS (or uses CLERK_JWT_KEY if set, which makes it networkless).
      const verified = await verifyToken(token, {
        secretKey: this.secretKey,
        ...(this.jwtKey ? { jwtKey: this.jwtKey } : {}),
      });

      // Result shape depends on the SDK major version: @clerk/backend 3.x resolves the verified claims
      // directly and THROWS on any failure (caught below, so it is a rejection); 2.x resolved
      // { data } or { errors } without throwing. Accept either, and treat anything that is not a clean
      // claims object with a subject as a rejection. (Reading only `.data` rejected every valid token
      // on 3.x; this is covered by clerk-auth.guard.spec.ts, which runs the real SDK.)
      const result = verified as unknown as {
        errors?: unknown;
        data?: unknown;
        sub?: unknown;
      } | null;
      const claims = (
        result && !result.errors
          ? 'data' in result && result.data
            ? result.data
            : result
          : undefined
      ) as { sub?: unknown } | undefined;
      const sub =
        typeof claims?.sub === 'string' && claims.sub.length > 0
          ? claims.sub
          : undefined;
      if (!sub) {
        this.logger.warn(
          'Rejected token: signature or claims failed verification',
        );
        throw new UnauthorizedException('Invalid or expired token');
      }
      const decoded = { sub };

      // Verify with Clerk's API on every request. Signature verification proves the token was issued
      // by Clerk; this additionally ensures the user still exists, is not banned or locked, and that a
      // deleted or suspended account cannot keep using an unexpired token.
      const clerkUser = await this.clerkClient.users.getUser(decoded.sub);

      if (!clerkUser) {
        this.logger.warn(`User ${decoded.sub} not found in Clerk`);
        throw new UnauthorizedException('Invalid token - user not found');
      }

      // FIX Issue #169: Additional validation - check if user is banned or deleted
      // `locked` is the SDK's lockout flag (the previous `lockoutExpiresIn` is not a field of
      // the User resource, so locked accounts were never refused).
      if (clerkUser.banned || clerkUser.locked) {
        this.logger.warn(`User ${decoded.sub} is banned or locked out`);
        throw new UnauthorizedException('User account is not active');
      }

      // Find or create user in our database
      let user = await this.usersService.findByClerkId(clerkUser.id);

      if (!user) {
        // User doesn't exist in our DB yet - check by email first
        // This can happen if webhook hasn't fired yet or user was created directly in Clerk
        const primaryEmail = clerkUser.emailAddresses.find(
          (e) => e.id === clerkUser.primaryEmailAddressId,
        );
        const email = primaryEmail?.emailAddress || '';

        if (email) {
          // Check if user with this email already exists
          const existingUser = await this.usersService.findByEmail(email);
          if (existingUser) {
            // Link existing user to Clerk if not already linked
            if (!existingUser.clerkUserId) {
              user = await this.usersService.linkToClerk(
                existingUser.id,
                clerkUser.id,
              );
            } else if (existingUser.clerkUserId !== clerkUser.id) {
              // User exists with different Clerk ID - this is an error
              throw new UnauthorizedException(
                'User email already associated with different account',
              );
            } else {
              // User already linked, use it
              user = existingUser;
            }
          } else {
            // Create new user
            user = await this.usersService.createFromClerk({
              clerkUserId: clerkUser.id,
              email,
              name:
                `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() ||
                clerkUser.username ||
                'User',
            });
          }
        } else {
          throw new UnauthorizedException('User has no email address');
        }
      }

      // Ensure user has an organization (create if missing)
      // This handles cases where user was created before webhook fired or webhook failed
      const userOrganizations = await this.organizationsService.findAll(
        user.id,
      );
      if (!userOrganizations || userOrganizations.length === 0) {
        this.logger.log(
          `No organization found for user ${user.id}, creating one...`,
        );
        const orgName =
          user.companyName || user.name || user.email.split('@')[0];
        await this.organizationsService.create(
          orgName,
          user.id,
          user.companyName,
        );
        this.logger.log(`Organization created for user ${user.id}`);
      }

      // Attach user to request
      const requestUser: RequestUser = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      // DIAGNOSTIC: Log the user being attached to request
      this.logger.log(
        `[DIAGNOSTIC] ClerkAuthGuard - Attaching user to request: userId=${user.id}, email=${user.email}, clerkUserId=${clerkUser.id}`,
      );

      request.user = requestUser;
      request.clerkUserId = clerkUser.id;

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
