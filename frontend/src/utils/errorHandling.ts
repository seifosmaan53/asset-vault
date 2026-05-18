/**
 * Utility functions for safe error handling
 * Prevents unsafe type casting and provides type-safe error message extraction
 */

/**
 * Type guard to check if an object has a response property
 */
function hasResponse(error: unknown): error is { response?: { data?: { message?: string } } } {
  return typeof error === 'object' && error !== null && 'response' in error;
}

/**
 * Type guard to check if an object has a message property
 */
function hasMessage(error: unknown): error is { message?: string } {
  return typeof error === 'object' && error !== null && 'message' in error;
}

/**
 * Safely extract error response data from unknown error type
 */
export function getErrorResponseData(error: unknown): unknown {
  if (hasResponse(error)) {
    return error.response?.data;
  }
  return null;
}

/**
 * Context for error messages to provide more specific information
 */
export interface ErrorContext {
  operation?: string; // e.g., 'export', 'delete', 'save', 'create', 'update'
  resource?: string; // e.g., 'client', 'inventory item', 'invoice'
  context?: Record<string, unknown>; // Additional context like itemCount, itemId, etc.
}

/**
 * Safely extract error message from unknown error type
 * Enhanced to provide more specific error messages with context
 * @param error - The error object (unknown type)
 * @param fallback - Fallback message if error message cannot be extracted
 * @param errorContext - Optional context to provide more specific error messages
 * @returns Error message string
 */
export function getErrorMessage(
  error: unknown,
  fallback: string = 'An error occurred',
  errorContext?: ErrorContext
): string {
  // Helper function to build contextual error message
  const buildContextualMessage = (baseMessage: string): string => {
    if (!errorContext) return baseMessage;
    
    const parts: string[] = [];
    if (errorContext.operation && errorContext.resource) {
      parts.push(`Failed to ${errorContext.operation} ${errorContext.resource}`);
    } else if (errorContext.operation) {
      parts.push(`Failed to ${errorContext.operation}`);
    } else if (errorContext.resource) {
      parts.push(`Error with ${errorContext.resource}`);
    }
    
    if (parts.length > 0) {
      return `${parts.join(' ')}: ${baseMessage}`;
    }
    return baseMessage;
  };

  // Check for response.data with detailed error information
  if (hasResponse(error) && error.response?.data) {
    const data = error.response.data;
    
    // Check for detailed error object with multiple messages
    if (typeof data === 'object' && data !== null) {
      // Check for errors object (validation errors)
      if ('errors' in data && typeof data.errors === 'object' && data.errors !== null) {
        const errors = data.errors as Record<string, unknown>;
        const errorMessages: string[] = [];
        
        Object.entries(errors).forEach(([field, messages]) => {
          if (Array.isArray(messages)) {
            messages.forEach((msg: unknown) => {
              if (typeof msg === 'string') {
                errorMessages.push(`${field}: ${msg}`);
              }
            });
          } else if (typeof messages === 'string') {
            errorMessages.push(`${field}: ${messages}`);
          }
        });
        
        if (errorMessages.length > 0) {
          const validationMessage = errorMessages.join('; ');
          return buildContextualMessage(validationMessage);
        }
      }
      
      // Check for error property (single error message)
      if ('error' in data && typeof data.error === 'string' && data.error.trim()) {
        return buildContextualMessage(data.error);
      }
      
      // Check for message property
      if ('message' in data) {
        const message = (data as { message?: unknown }).message;
        if (typeof message === 'string' && message.trim()) {
          return buildContextualMessage(message);
        }
      }
      
      // Check for statusCode and provide context
      if ('statusCode' in data && typeof data.statusCode === 'number') {
        const statusCode = data.statusCode;
        let statusMessage = '';
        
        if (statusCode === 400) {
          statusMessage = 'Invalid request. Please check your input and try again.';
        } else if (statusCode === 401) {
          statusMessage = 'You are not authorized to perform this action. Please log in again.';
        } else if (statusCode === 403) {
          statusMessage = 'You do not have permission to perform this action.';
        } else if (statusCode === 404) {
          const resourceName = errorContext?.resource || 'resource';
          statusMessage = `The requested ${resourceName} was not found.`;
        } else if (statusCode === 409) {
          if (errorContext?.operation === 'delete' && errorContext?.resource) {
            statusMessage = `Cannot delete ${errorContext.resource} as it is linked to existing records.`;
          } else {
            statusMessage = 'This action conflicts with existing data. Please check and try again.';
          }
        } else if (statusCode === 422) {
          statusMessage = 'Validation failed. Please check your input and try again.';
        } else if (statusCode === 429) {
          statusMessage = 'Too many requests. Please wait a moment and try again.';
        } else if (statusCode >= 500) {
          statusMessage = 'Server error. Please try again later or contact support if the problem persists.';
        }
        
        if (statusMessage) {
          return buildContextualMessage(statusMessage);
        }
      }
    }
  }

  // Check for response status and statusText
  if (hasResponse(error) && error.response) {
    const status = error.response.status;
    const statusText = error.response.statusText;
    
    if (status && statusText) {
      return buildContextualMessage(`${statusText} (${status})`);
    } else if (status) {
      let statusMessage = '';
      
      if (status === 400) {
        statusMessage = 'Invalid request. Please check your input and try again.';
      } else if (status === 401) {
        statusMessage = 'You are not authorized. Please log in again.';
      } else if (status === 403) {
        statusMessage = 'You do not have permission to perform this action.';
      } else if (status === 404) {
        const resourceName = errorContext?.resource || 'resource';
        statusMessage = `The requested ${resourceName} was not found.`;
      } else if (status === 409) {
        if (errorContext?.operation === 'delete' && errorContext?.resource) {
          statusMessage = `Cannot delete ${errorContext.resource} as it is linked to existing records.`;
        } else {
          statusMessage = 'This action conflicts with existing data.';
        }
      } else if (status === 422) {
        statusMessage = 'Validation failed. Please check your input.';
      } else if (status === 429) {
        statusMessage = 'Too many requests. Please wait and try again.';
      } else if (status >= 500) {
        statusMessage = 'Server error. Please try again later.';
      }
      
      if (statusMessage) {
        return buildContextualMessage(statusMessage);
      }
    }
  }

  // Check for direct message property
  if (hasMessage(error) && typeof error.message === 'string' && error.message.trim()) {
    return buildContextualMessage(error.message);
  }

  // Check if error is a string
  if (typeof error === 'string' && error.trim()) {
    return buildContextualMessage(error);
  }

  // Check for network errors
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: string }).code;
    if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
      return buildContextualMessage('Request timed out. Please check your connection and try again.');
    } else if (code === 'ERR_NETWORK') {
      return buildContextualMessage('Network error. Please check your internet connection and try again.');
    }
  }

  // Fallback to provided message or default
  return buildContextualMessage(fallback);
}

