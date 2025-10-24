/**
 * Centralized logging system for RadiantCare application
 *
 * Features:
 * - Configurable log levels (DEBUG, INFO, WARN, ERROR, NONE)
 * - Component-based namespaces for fine-grained control
 * - Environment-aware (auto-disable verbose logs in production)
 * - Zero performance overhead when disabled
 * - Structured logging with timestamps and context
 *
 * Usage:
 *   logger.info('QBO_SYNC', 'Sync started')
 *   logger.debug('COMPENSATION', 'Pool calculated', { pool: 12345 })
 *   logger.error('AUTH', 'Login failed', error)
 *
 * Configuration:
 *   logger.setLevel('DEBUG')
 *   logger.enableOnly(['QBO_SYNC', 'COMPENSATION'])
 *   localStorage.setItem('LOG_LEVEL', 'DEBUG')
 *   localStorage.setItem('LOG_NAMESPACES', 'QBO_SYNC,AUTH')
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'NONE'

export type LogNamespace =
  | 'AUTH'              // Authentication, login, session
  | 'QBO_SYNC'          // QuickBooks sync operations
  | 'QBO_CACHE'         // Cache loading/management
  | 'SESSION'           // Session loading/management
  | 'SHARE_LINK'        // Shareable link creation/loading
  | 'COMPENSATION'      // Compensation calculations
  | 'GRID'              // Yearly grid calculations/sync
  | 'SCENARIO'          // Scenario save/load/management
  | 'STORE'             // Dashboard store state changes
  | 'DATA_TRANSFORM'    // Data parsing/transformation
  | 'SNAPSHOT'          // Snapshot save/restore
  | 'PHYSICIAN'         // Physician CRUD operations
  | 'MD_HOURS'          // Medical director hours redistribution
  | 'API'               // API calls/responses
  | 'CHART'             // Chart rendering/updates
  | 'UI'                // UI interactions

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 999
}

class Logger {
  private globalLevel: LogLevel
  private namespaceLevels: Map<LogNamespace, LogLevel> = new Map()
  private enabledNamespaces: Set<LogNamespace> | null = null
  private isProduction: boolean

  constructor() {
    this.isProduction = import.meta.env.PROD

    // Default levels
    this.globalLevel = this.isProduction ? 'WARN' : 'INFO'

    // Load configuration from localStorage
    this.loadConfiguration()
  }

  private loadConfiguration() {
    try {
      const storedLevel = localStorage.getItem('LOG_LEVEL') as LogLevel
      if (storedLevel && LOG_LEVEL_PRIORITY[storedLevel] !== undefined) {
        this.globalLevel = storedLevel
      }

      const storedNamespaces = localStorage.getItem('LOG_NAMESPACES')
      if (storedNamespaces) {
        if (storedNamespaces === '*' || storedNamespaces === 'ALL') {
          this.enabledNamespaces = null // All enabled
        } else {
          const namespaces = storedNamespaces.split(',').map(n => n.trim()) as LogNamespace[]
          this.enabledNamespaces = new Set(namespaces)
        }
      }
    } catch (e) {
      // localStorage might not be available
    }
  }

  private shouldLog(namespace: LogNamespace, level: LogLevel): boolean {
    // Check if namespace is enabled
    if (this.enabledNamespaces !== null && !this.enabledNamespaces.has(namespace)) {
      return false
    }

    // Check namespace-specific level first
    const namespaceLevel = this.namespaceLevels.get(namespace)
    const effectiveLevel = namespaceLevel || this.globalLevel

    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[effectiveLevel]
  }

  private formatMessage(
    namespace: LogNamespace,
    level: LogLevel,
    message: string,
    data?: any
  ): void {
    const timestamp = new Date().toISOString()
    const prefix = `[${timestamp}] [${level}] [${namespace}]`

    if (data !== undefined) {
      console.log(`${prefix} ${message}`, data)
    } else {
      console.log(`${prefix} ${message}`)
    }
  }

  debug(namespace: LogNamespace, message: string, data?: any): void {
    if (this.shouldLog(namespace, 'DEBUG')) {
      this.formatMessage(namespace, 'DEBUG', message, data)
    }
  }

  info(namespace: LogNamespace, message: string, data?: any): void {
    if (this.shouldLog(namespace, 'INFO')) {
      this.formatMessage(namespace, 'INFO', message, data)
    }
  }

  warn(namespace: LogNamespace, message: string, data?: any): void {
    if (this.shouldLog(namespace, 'WARN')) {
      this.formatMessage(namespace, 'WARN', message, data)
    }
  }

  error(namespace: LogNamespace, message: string, error?: any): void {
    if (this.shouldLog(namespace, 'ERROR')) {
      const timestamp = new Date().toISOString()
      const prefix = `[${timestamp}] [ERROR] [${namespace}]`

      if (error !== undefined) {
        console.error(`${prefix} ${message}`, error)
      } else {
        console.error(`${prefix} ${message}`)
      }
    }
  }

  // Configuration methods
  setLevel(level: LogLevel): void {
    this.globalLevel = level
    try {
      localStorage.setItem('LOG_LEVEL', level)
    } catch (e) {
      // Ignore localStorage errors
    }
  }

  setNamespaceLevel(namespace: LogNamespace, level: LogLevel): void {
    this.namespaceLevels.set(namespace, level)
  }

  enableOnly(namespaces: LogNamespace[]): void {
    this.enabledNamespaces = new Set(namespaces)
    try {
      localStorage.setItem('LOG_NAMESPACES', namespaces.join(','))
    } catch (e) {
      // Ignore localStorage errors
    }
  }

  enableAll(): void {
    this.enabledNamespaces = null
    try {
      localStorage.setItem('LOG_NAMESPACES', 'ALL')
    } catch (e) {
      // Ignore localStorage errors
    }
  }

  disableAll(): void {
    this.setLevel('NONE')
  }

  getConfiguration(): {
    globalLevel: LogLevel
    isProduction: boolean
    enabledNamespaces: LogNamespace[] | 'ALL'
    namespaceLevels: Record<string, LogLevel>
  } {
    return {
      globalLevel: this.globalLevel,
      isProduction: this.isProduction,
      enabledNamespaces: this.enabledNamespaces === null ? 'ALL' : Array.from(this.enabledNamespaces),
      namespaceLevels: Object.fromEntries(this.namespaceLevels.entries())
    }
  }
}

// Export singleton instance
export const logger = new Logger()

// Export for debugging in console
if (typeof window !== 'undefined') {
  (window as any).logger = logger
}
