import config from '../../config/config.js';

/**
 * Logger
 * Logging and analytics utility
 */
export default class Logger {
  constructor() {
    this.enabled = config.logging.enabled;
    this.level = config.logging.level;
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
  }

  /**
   * Log debug message
   */
  debug(...args) {
    if (this.shouldLog('debug')) {
      console.log('[DEBUG]', new Date().toISOString(), ...args);
    }
  }

  /**
   * Log info message
   */
  info(...args) {
    if (this.shouldLog('info')) {
      console.log('[INFO]', new Date().toISOString(), ...args);
    }
  }

  /**
   * Log warning message
   */
  warn(...args) {
    if (this.shouldLog('warn')) {
      console.warn('[WARN]', new Date().toISOString(), ...args);
    }
  }

  /**
   * Log error message
   */
  error(...args) {
    if (this.shouldLog('error')) {
      console.error('[ERROR]', new Date().toISOString(), ...args);
    }
  }

  /**
   * Check if should log at this level
   */
  shouldLog(level) {
    if (!this.enabled) return false;
    return this.levels[level] >= this.levels[this.level];
  }

  /**
   * Log analytics event
   */
  analytics(event, data) {
    if (this.enabled) {
      console.log('[ANALYTICS]', event, data);
      // TODO: Send to analytics service
    }
  }
}
