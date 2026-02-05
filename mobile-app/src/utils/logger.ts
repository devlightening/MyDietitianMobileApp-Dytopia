/**
 * Safe logging utility
 * Automatically disabled in production, redacts sensitive fields
 */

const SENSITIVE_FIELDS = ['token', 'password', 'email', 'accessToken', 'refreshToken', 'authorization'];

/**
 * Check if a key contains sensitive information
 */
function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return SENSITIVE_FIELDS.some(field => lowerKey.includes(field));
}

/**
 * Redact sensitive data from objects
 */
function redactSensitiveData(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => redactSensitiveData(item));
  }

  const redacted: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (isSensitiveKey(key)) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      redacted[key] = redactSensitiveData(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * Safe logger that auto-disables in production and redacts sensitive data
 */
class Logger {
  private enabled: boolean;

  constructor() {
    this.enabled = __DEV__;
  }

  private log(level: LogLevel, message: string, data?: any) {
    if (!this.enabled) return;

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}]`;

    if (data) {
      const safeData = redactSensitiveData(data);
      console.log(`${prefix} ${message}`, safeData);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  debug(message: string, data?: any) {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: any) {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: any) {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, data?: any) {
    this.log(LogLevel.ERROR, message, data);
  }
}

export const logger = new Logger();
