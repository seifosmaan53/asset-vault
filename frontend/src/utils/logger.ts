/**
 * Logger utility for frontend application
 * Provides structured logging with different log levels
 * Only logs in development mode to avoid console pollution in production
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: unknown;
  timestamp: string;
}

class Logger {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = import.meta.env.DEV;
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (!this.isDevelopment) {
      // In production, you might want to send logs to a logging service
      // For now, we only log in development
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
    };

    switch (level) {
      case 'debug':
        console.debug(`[DEBUG] ${message}`, data || '');
        break;
      case 'info':
        console.info(`[INFO] ${message}`, data || '');
        break;
      case 'warn':
        console.warn(`[WARN] ${message}`, data || '');
        break;
      case 'error':
        console.error(`[ERROR] ${message}`, data || '');
        break;
    }
  }

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    // Always log errors, even in production (but could send to error tracking service)
    if (this.isDevelopment) {
      this.log('error', message, data);
    } else {
      // In production, you might want to send to Sentry or similar
      // For now, we still log errors in production for debugging
      console.error(`[ERROR] ${message}`, data || '');
    }
  }
}

// Export singleton instance
export const logger = new Logger();

