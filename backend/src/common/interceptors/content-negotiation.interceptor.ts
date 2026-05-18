// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Injectable, NestInterceptor, ExecutionContext, CallHandler, NotAcceptableException, BadRequestException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request, Response } from 'express';

/**
 * Content Negotiation Interceptor
 * Fixes Issue #47: Missing API Response Content Negotiation
 * Fixes Issue #74: Missing API Response Content Type Validation
 */
@Injectable()
export class ContentNegotiationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    
    // Issue #74: Validate Content-Type for POST/PUT/PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      const contentType = request.headers['content-type'];
      if (!contentType || !contentType.includes('application/json')) {
        throw new BadRequestException(
          'Content-Type must be application/json for this request'
        );
      }
    }
    
    // Get Accept header
    const acceptHeader = request.headers.accept || 'application/json';
    const acceptedTypes = acceptHeader.split(',').map(type => type.split(';')[0].trim());
    
    // Check if JSON is acceptable (default)
    const acceptsJson = acceptedTypes.some(type => 
      type === 'application/json' || 
      type === '*/*' || 
      type === 'application/*'
    );
    
    if (!acceptsJson && !acceptedTypes.includes('*/*')) {
      // In the future, we can support XML, CSV, etc.
      // For now, we only support JSON
      throw new NotAcceptableException(
        'Only application/json is supported. Please set Accept header to application/json.'
      );
    }
    
    // Set Content-Type header
    response.setHeader('Content-Type', 'application/json');
    
    return next.handle();
  }
}

