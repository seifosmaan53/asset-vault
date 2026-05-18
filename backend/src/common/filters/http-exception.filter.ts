import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { getErrorCode } from '../utils/error-codes.util';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private configService?: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const isProduction = this.configService?.get('NODE_ENV') === 'production';

    // Log error details
    if (status >= 500) {
      this.logger.error(
        `Internal Server Error: ${exception instanceof Error ? exception.message : 'Unknown error'}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `HTTP ${status}: ${exception instanceof HttpException ? exception.message : 'Unknown error'}`,
      );
    }

    // Handle validation errors specifically
    if (exception instanceof BadRequestException) {
      const exceptionResponse = exception.getResponse();
      
      // Check if this is a validation error from class-validator
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as { message?: string | string[]; errors?: Record<string, string[]> };
        
        // class-validator returns errors in this format
        if (Array.isArray(responseObj.message) && responseObj.message.length > 0) {
          // Format validation errors for better UX
          const validationErrors = this.formatValidationErrors(responseObj.message);
          const errorCode = getErrorCode('Validation failed');
          
          return response.status(status).json({
            statusCode: status,
            errorCode,
            timestamp: new Date().toISOString(),
            path: request.url,
            message: 'Validation failed',
            errors: validationErrors,
          });
        }
      }
    }

    // Sanitize error message in production
    let message: string | string[];
    let errors: any = undefined;
    
    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as { message?: string | string[]; errors?: Record<string, string[]> };
        message = responseObj.message || 'An error occurred';
        errors = responseObj.errors;
      } else {
        message = 'An error occurred';
      }
    } else if (exception instanceof Error) {
      message = isProduction
        ? 'Internal server error'
        : exception.message;
    } else {
      message = 'Internal server error';
    }

    // Normalize message to a single string
    const normalizedMessage = Array.isArray(message) ? message.join(', ') : message;

    // Issue #65: Standardized error codes
    const errorCode = getErrorCode(exception instanceof Error ? exception : normalizedMessage);

    // CRITICAL FIX: Check if response headers were already sent (e.g., by webhook controller using @Res())
    // This prevents "Cannot set headers after they are sent to the client" errors
    if (response.headersSent) {
      this.logger.warn(`Response headers already sent for ${request.url}, skipping exception filter response`);
      return; // Don't try to send another response
    }
    
    // FIX #166: Include request ID in error response for correlation
    const requestId = request['requestId'] || request.headers['x-request-id'] || 'unknown';
    
    response.status(status).json({
      statusCode: status,
      errorCode, // Issue #65: Include error code
      requestId, // FIX #166: Include request ID for error correlation
      timestamp: new Date().toISOString(),
      path: request.url,
      message: normalizedMessage,
      ...(errors ? { errors } : {}),
      ...(isProduction ? {} : { error: exception instanceof Error ? exception.stack : undefined }),
    });
  }

  private formatValidationErrors(messages: string[]): Record<string, string[]> {
    const errors: Record<string, string[]> = {};
    
    messages.forEach((message: string) => {
      // Extract field name from validation message
      // Format: "propertyName: error message" (from our custom exceptionFactory)
      // Or: "propertyName should not be empty" (from class-validator default)
      const colonMatch = message.match(/^(\w+):\s*(.+)$/);
      const spaceMatch = message.match(/^(\w+)\s+(.+)$/);
      
      if (colonMatch) {
        // Custom format: "field: error message"
        const field = colonMatch[1];
        const errorMsg = colonMatch[2];
        
        if (!errors[field]) {
          errors[field] = [];
        }
        errors[field].push(errorMsg);
      } else if (spaceMatch) {
        // Default format: "field should not be empty"
        const field = spaceMatch[1];
        const errorMsg = spaceMatch[2];
        
        if (!errors[field]) {
          errors[field] = [];
        }
        errors[field].push(errorMsg);
      } else {
        // If we can't parse, add to a general errors array
        if (!errors['_general']) {
          errors['_general'] = [];
        }
        errors['_general'].push(message);
      }
    });
    
    return errors;
  }
}

