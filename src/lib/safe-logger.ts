/**
 * PHI-Safe Logging Utility
 * 
 * GUARDRAIL: No PHI in logs
 * - No console logs, debug output, or error messages may contain PHI
 * - Audit logs store metadata only (IDs, counts, timestamps)
 * 
 * This utility provides safe logging methods that:
 * 1. Strip any potential PHI from log output
 * 2. Enforce structured logging with safe fields only
 * 3. Provide clear boundaries for what can/cannot be logged
 */

/**
 * Fields that are safe to log (metadata only).
 */
interface SafeLogFields {
  /** Unique identifiers (UUIDs, not names/emails) */
  id?: string;
  /** User ID (never user email or name) */
  userId?: string;
  /** Event type identifier */
  eventType?: string;
  /** ISO timestamp */
  timestamp?: string;
  /** Numeric counts */
  count?: number;
  /** Operation name */
  operation?: string;
  /** HTTP status code */
  statusCode?: number;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Resource type (e.g., 'document', 'timeline_event') */
  resourceType?: string;
  /** Safe error code (not error message with details) */
  errorCode?: string;
  /** Action being performed (e.g., 'timeline_fetch', 'auth_signin') */
  action?: string;
  /** Error type category (not the actual error message) */
  errorType?: string;
  /** Job ID for async operations */
  jobId?: string;
  /** Sync action type (connect, sync, retry) */
  syncAction?: string;
}

/**
 * Log levels for structured logging.
 */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Internal logging implementation.
 * In production, this would send to a log aggregation service.
 */
const logInternal = (level: LogLevel, message: string, fields: SafeLogFields): void => {
  // Only log in development
  if (!import.meta.env.DEV) {
    // TODO: Send to secure log aggregation service
    return;
  }

  const logEntry = {
    level,
    message,
    timestamp: fields.timestamp ?? new Date().toISOString(),
    ...fields,
  };

  switch (level) {
    case 'debug':
      console.debug('[MyBödy]', logEntry);
      break;
    case 'info':
      console.info('[MyBödy]', logEntry);
      break;
    case 'warn':
      console.warn('[MyBödy]', logEntry);
      break;
    case 'error':
      console.error('[MyBödy]', logEntry);
      break;
  }
};

/**
 * Safe logger object with methods for each log level.
 * 
 * Usage:
 * ```ts
 * safeLog.info('Document uploaded', { 
 *   userId: 'uuid-here',
 *   resourceType: 'document',
 *   count: 1 
 * });
 * ```
 * 
 * NEVER log:
 * - Names, emails, addresses
 * - Medical conditions, diagnoses
 * - Document contents
 * - Any freeform text from users
 */
export const safeLog = {
  debug: (message: string, fields: SafeLogFields = {}) => 
    logInternal('debug', message, fields),
  
  info: (message: string, fields: SafeLogFields = {}) => 
    logInternal('info', message, fields),
  
  warn: (message: string, fields: SafeLogFields = {}) => 
    logInternal('warn', message, fields),
  
  error: (message: string, fields: SafeLogFields = {}) => 
    logInternal('error', message, fields),
};

/**
 * Log an operation with timing.
 * 
 * Usage:
 * ```ts
 * const end = safeLog.startOperation('fetchTimeline', { userId });
 * // ... do work ...
 * end({ count: results.length });
 * ```
 */
export const startOperation = (
  operation: string, 
  fields: SafeLogFields = {}
): ((endFields?: SafeLogFields) => void) => {
  const startTime = performance.now();
  
  safeLog.debug(`${operation} started`, { ...fields, operation });
  
  return (endFields: SafeLogFields = {}) => {
    const durationMs = Math.round(performance.now() - startTime);
    safeLog.info(`${operation} completed`, { 
      ...fields, 
      ...endFields, 
      operation, 
      durationMs 
    });
  };
};

/**
 * Type guard to ensure only safe fields are passed.
 * Use this to validate dynamic objects before logging.
 */
export const asSafeFields = (obj: unknown): SafeLogFields => {
  if (typeof obj !== 'object' || obj === null) {
    return {};
  }

  const safe: SafeLogFields = {};
  const source = obj as Record<string, unknown>;

  // Whitelist only known safe fields
  if (typeof source.id === 'string') safe.id = source.id;
  if (typeof source.userId === 'string') safe.userId = source.userId;
  if (typeof source.eventType === 'string') safe.eventType = source.eventType;
  if (typeof source.timestamp === 'string') safe.timestamp = source.timestamp;
  if (typeof source.count === 'number') safe.count = source.count;
  if (typeof source.operation === 'string') safe.operation = source.operation;
  if (typeof source.statusCode === 'number') safe.statusCode = source.statusCode;
  if (typeof source.durationMs === 'number') safe.durationMs = source.durationMs;
  if (typeof source.resourceType === 'string') safe.resourceType = source.resourceType;
  if (typeof source.errorCode === 'string') safe.errorCode = source.errorCode;
  if (typeof source.action === 'string') safe.action = source.action;
  if (typeof source.errorType === 'string') safe.errorType = source.errorType;
  if (typeof source.jobId === 'string') safe.jobId = source.jobId;
  if (typeof source.syncAction === 'string') safe.syncAction = source.syncAction;

  return safe;
};
