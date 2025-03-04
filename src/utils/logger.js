/**
 * Logger utility for consistent logging across the application
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

// Set this to control the minimum level that gets logged
// LOG_LEVELS.DEBUG for all logs, LOG_LEVELS.ERROR for only errors
const CURRENT_LOG_LEVEL = LOG_LEVELS.DEBUG;

// Enable to save logs to localStorage for debugging across sessions
const SAVE_LOGS = true;
const MAX_SAVED_LOGS = 500;
const LOGS_STORAGE_KEY = 'debug-logs';

// Internal log storage
let logHistory = [];

/**
 * Initialize logger, loading any saved logs
 */
const initLogger = () => {
  if (SAVE_LOGS) {
    try {
      const savedLogs = localStorage.getItem(LOGS_STORAGE_KEY);
      if (savedLogs) {
        logHistory = JSON.parse(savedLogs);
      }
    } catch (e) {
      console.error('Error loading saved logs:', e);
      logHistory = [];
    }
  }
};

/**
 * Save logs to localStorage
 */
const saveLogs = () => {
  if (SAVE_LOGS) {
    try {
      // Limit the number of logs to prevent excessive storage use
      if (logHistory.length > MAX_SAVED_LOGS) {
        logHistory = logHistory.slice(-MAX_SAVED_LOGS);
      }
      localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(logHistory));
    } catch (e) {
      console.error('Error saving logs:', e);
    }
  }
};

/**
 * Format and log a message
 * 
 * @param {string} level - Log level (DEBUG, INFO, WARN, ERROR)
 * @param {string} module - Module/component name
 * @param {string} message - Log message
 * @param {any} data - Optional data to log
 */
const logMessage = (level, module, message, data = null) => {
  // Check if we should log this level
  if (LOG_LEVELS[level] < CURRENT_LOG_LEVEL) {
    return;
  }

  const timestamp = new Date().toISOString();
  const formattedModule = module ? `[${module}]` : '';
  const formattedMessage = `${timestamp} ${level} ${formattedModule} ${message}`;
  
  // Create log entry
  const logEntry = {
    timestamp,
    level,
    module,
    message,
    data: data !== null ? data : undefined
  };
  
  // Add to history
  logHistory.push(logEntry);
  
  // Save logs periodically (throttled)
  if (SAVE_LOGS && logHistory.length % 10 === 0) {
    saveLogs();
  }

  // Log to console with appropriate method and styling
  switch (level) {
    case 'DEBUG':
      console.debug(`%c${formattedMessage}`, 'color: #6c757d', data !== null ? data : '');
      break;
    case 'INFO':
      console.info(`%c${formattedMessage}`, 'color: #0d6efd', data !== null ? data : '');
      break;
    case 'WARN':
      console.warn(`%c${formattedMessage}`, 'color: #fd7e14', data !== null ? data : '');
      break;
    case 'ERROR':
      console.error(`%c${formattedMessage}`, 'color: #dc3545', data !== null ? data : '');
      break;
    default:
      console.log(formattedMessage, data !== null ? data : '');
  }
};

// Convenience functions for different log levels
const debug = (module, message, data) => logMessage('DEBUG', module, message, data);
const info = (module, message, data) => logMessage('INFO', module, message, data);
const warn = (module, message, data) => logMessage('WARN', module, message, data);
const error = (module, message, data) => logMessage('ERROR', module, message, data);

/**
 * Get all saved logs
 * @returns {Array} Array of log entries
 */
const getLogs = () => {
  return [...logHistory];
};

/**
 * Clear all saved logs
 */
const clearLogs = () => {
  logHistory = [];
  if (SAVE_LOGS) {
    localStorage.removeItem(LOGS_STORAGE_KEY);
  }
};

// Initialize logger
initLogger();

export default {
  debug,
  info,
  warn, 
  error,
  getLogs,
  clearLogs
}; 