// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Injectable, NestMiddleware, ForbiddenException, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';

/**
 * IP Whitelisting/Blacklisting Middleware
 * Fixes Issue #14: Missing IP Whitelisting/Blacklisting
 */
@Injectable()
export class IpFilterMiddleware implements NestMiddleware {
  private readonly logger = new Logger(IpFilterMiddleware.name);
  private readonly whitelist: string[] = [];
  private readonly blacklist: string[] = [];

  constructor(private configService: ConfigService) {
    // Load IP whitelist/blacklist from environment variables
    const whitelistEnv = this.configService.get<string>('IP_WHITELIST');
    const blacklistEnv = this.configService.get<string>('IP_BLACKLIST');

    if (whitelistEnv) {
      this.whitelist.push(...whitelistEnv.split(',').map(ip => ip.trim()));
    }

    if (blacklistEnv) {
      this.blacklist.push(...blacklistEnv.split(',').map(ip => ip.trim()));
    }
  }

  use(req: Request, res: Response, next: NextFunction) {
    const clientIp = this.getClientIp(req);

    // Check blacklist first
    if (this.blacklist.length > 0 && this.isIpInList(clientIp, this.blacklist)) {
      this.logger.warn(`Blocked request from blacklisted IP: ${clientIp}`);
      throw new ForbiddenException('Access denied');
    }

    // Check whitelist if configured
    if (this.whitelist.length > 0 && !this.isIpInList(clientIp, this.whitelist)) {
      this.logger.warn(`Blocked request from non-whitelisted IP: ${clientIp}`);
      throw new ForbiddenException('Access denied');
    }

    next();
  }

  private getClientIp(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      'unknown'
    );
  }

  private isIpInList(ip: string, list: string[]): boolean {
    return list.some(listedIp => {
      // Support CIDR notation (e.g., 192.168.1.0/24)
      if (listedIp.includes('/')) {
        return this.isIpInCidr(ip, listedIp);
      }
      // Exact match
      return ip === listedIp;
    });
  }

  private isIpInCidr(ip: string, cidr: string): boolean {
    try {
      const [network, prefixLength] = cidr.split('/');
      const mask = parseInt(prefixLength, 10);
      const ipNum = this.ipToNumber(ip);
      const networkNum = this.ipToNumber(network);
      const maskNum = (0xffffffff << (32 - mask)) >>> 0;
      return (ipNum & maskNum) === (networkNum & maskNum);
    } catch {
      return false;
    }
  }

  private ipToNumber(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  }
}

