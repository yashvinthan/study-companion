import { getServerConfig } from '@/lib/config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

/**
 * Production-grade structured logger with configurable log levels
 */
class Logger {
  private readonly levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  private getLogLevel(): LogLevel {
    const config = getServerConfig();
    const level = config.logLevel.toLowerCase();

    if (level === 'debug' || level === 'info' || level === 'warn' || level === 'error') {
      return level;
    }

    return 'info';
  }

  private shouldLog(level: LogLevel): boolean {
    const currentLevel = this.getLogLevel();
    return this.levels[level] >= this.levels[currentLevel];
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...context,
    };

    return JSON.stringify(logEntry);
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, context));
    }
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (this.shouldLog('error')) {
      const errorContext = error instanceof Error
        ? {
            error: {
              name: error.name,
              message: error.message,
              stack: error.stack,
            },
            ...context,
          }
        : {
            error: String(error),
            ...context,
          };

      console.error(this.formatMessage('error', message, errorContext));
    }
  }

  /**
   * Log API request with timing and metadata
   */
  logRequest(params: {
    method: string;
    path: string;
    userId?: string;
    studentId?: string;
    duration?: number;
    status?: number;
  }): void {
    this.info('API Request', {
      type: 'api_request',
      ...params,
    });
  }

  /**
   * Log AI operation with provider and model details
   */
  logAIOperation(params: {
    operation: string;
    provider: string;
    model?: string;
    duration?: number;
    tokens?: number;
    success: boolean;
    error?: string;
  }): void {
    this.info('AI Operation', {
      type: 'ai_operation',
      ...params,
    });
  }

  /**
   * Log memory operation (Hindsight)
   */
  logMemoryOperation(params: {
    operation: 'retain' | 'recall' | 'reflect' | 'list';
    studentId: string;
    duration?: number;
    success: boolean;
    error?: string;
  }): void {
    this.info('Memory Operation', {
      type: 'memory_operation',
      ...params,
    });
  }

  /**
   * Log database operation
   */
  logDatabaseOperation(params: {
    operation: string;
    table?: string;
    duration?: number;
    success: boolean;
    error?: string;
  }): void {
    this.debug('Database Operation', {
      type: 'database_operation',
      ...params,
    });
  }
}

export const logger = new Logger();
