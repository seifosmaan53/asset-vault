// Copyright (c) 2025 Asset Vault. All rights reserved.

import { HttpException, HttpStatus } from '@nestjs/common';

export class SubscriptionRequiredException extends HttpException {
  constructor(message = 'Active subscription is required to access this feature') {
    super(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        message,
        error: 'Subscription Required',
        action: 'subscribe',
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}

export class QuotaExceededException extends HttpException {
  constructor(metric: string, limit: number, current: number) {
    super(
      {
        statusCode: HttpStatus.FORBIDDEN,
        message: `You have reached your plan limit for ${metric}. Current usage: ${current}/${limit}`,
        error: 'Quota Exceeded',
        metric,
        limit,
        current,
        action: 'upgrade',
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class TrialExpiredException extends HttpException {
  constructor(message = 'Your trial period has expired. Please subscribe to continue using the service.') {
    super(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        message,
        error: 'Trial Expired',
        action: 'subscribe',
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}

