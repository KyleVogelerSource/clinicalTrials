/**
 * Logger Utility for Node.js Backend
 * Structured logging for debugging and monitoring
 * Can be piped to CloudWatch, Datadog, or other services
 */

import * as fs from 'fs';
import * as path from 'path';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  context?: Record<string, any>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  duration?: number; // milliseconds
  statusCode?: number;
  userId?: string;
  requestId?: string;
}

class Logger {
  private service: string;
  private logDir: string;
  private enableFileLogging: boolean;
  private enableConsoleLogging: boolean;
  private minLogLevel: LogLevel;

  constructor(
    service: string,
    options: {
      logDir?: string;
      enableFileLogging?: boolean;
      enableConsoleLogging?: boolean;
      minLogLevel?: LogLevel;
    } = {}
  ) {
    this.service = service;
    this.logDir = options.logDir || path.join(process.cwd(), 'logs');
    this.enableFileLogging = options.enableFileLogging ?? true;
    this.enableConsoleLogging = options.enableConsoleLogging ?? true;
    this.minLogLevel = options.minLogLevel ?? LogLevel.DEBUG;

    // Create logs directory if not exists
    if (this.enableFileLogging && !fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentIndex = levels.indexOf(this.minLogLevel);
    const levelIndex = levels.indexOf(level);
    return levelIndex >= currentIndex;
  }

  private formatLog(entry: LogEntry): string {
    return JSON.stringify(entry);
  }

  private formatConsoleLog(entry: LogEntry): string {
    const { timestamp, level, service, message, context, error, duration, statusCode } = entry;
    let output = `[${timestamp}] ${level} [${service}] ${message}`;

    if (duration !== undefined) {
      output += ` (${duration}ms)`;
    }

    if (statusCode !== undefined) {
      output += ` [${statusCode}]`;
    }

    if (context && Object.keys(context).length > 0) {
      output += `\n  Context: ${JSON.stringify(context, null, 2)}`;
    }

    if (error) {
      output += `\n  Error: ${error.message}`;
      if (error.code) {
        output += ` [${error.code}]`;
      }
      if (error.stack && process.env.NODE_ENV === 'development') {
        output += `\n  Stack: ${error.stack}`;
      }
    }

    return output;
  }

  private writeToFile(entry: LogEntry): void {
    if (!this.enableFileLogging) return;

    try {
      const logFile = path.join(
        this.logDir,
        `${entry.level.toLowerCase()}-${new Date().toISOString().split('T')[0]}.log`
      );

      fs.appendFileSync(logFile, this.formatLog(entry) + '\n', 'utf-8');
    } catch (error) {
      console.error('Failed to write log file:', error);
    }
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: any): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      message,
      context,
      requestId: context?.requestId,
      userId: context?.userId,
    };

    if (error) {
      entry.error = {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        code: error.code,
      };
    }

    if (context?.duration !== undefined) {
      entry.duration = context.duration;
    }

    if (context?.statusCode !== undefined) {
      entry.statusCode = context.statusCode;
    }

    // Write to file
    this.writeToFile(entry);

    // Log to console
    if (this.enableConsoleLogging) {
      const formattedMessage = this.formatConsoleLog(entry);
      
      if (level === LogLevel.ERROR) {
        console.error(formattedMessage);
      } else if (level === LogLevel.WARN) {
        console.warn(formattedMessage);
      } else if (level === LogLevel.INFO) {
        console.log(formattedMessage);
      } else {
        console.debug(formattedMessage);
      }
    }
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: any, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  /**
   * Log API request/response
   */
  logApiCall(details: {
    method: string;
    url: string;
    requestBody?: any;
    requestHeaders?: Record<string, string>;
    responseStatus: number;
    responseBody?: any;
    duration: number;
    success: boolean;
    error?: any;
  }): void {
    const { method, url, responseStatus, duration, success, error } = details;
    const context: Record<string, any> = {
      method,
      url,
      statusCode: responseStatus,
      duration,
    };

    if (details.requestBody) {
      context.requestBody = details.requestBody;
    }

    if (process.env.NODE_ENV === 'development' && details.requestHeaders) {
      context.requestHeaders = details.requestHeaders;
    }

    if (details.responseBody && process.env.NODE_ENV === 'development') {
      context.responseBody = typeof details.responseBody === 'string' 
        ? details.responseBody.substring(0, 500) 
        : details.responseBody;
    }

    const message = `API ${method} ${url.substring(0, 100)}`;
    
    if (success) {
      this.info(message, context);
    } else {
      this.error(message, error, context);
    }
  }

  /**
   * Log API call timing for performance monitoring
   */
  startTimer(): () => number {
    const start = Date.now();
    return () => Date.now() - start;
  }
}

export default Logger;
