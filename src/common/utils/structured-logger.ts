import { Injectable, LoggerService } from '@nestjs/common';

export interface LogContext {
  tenantId?: string;
  scanRunId?: string;
  connectionId?: string;
  jobId?: string;
  domain?: string;
  [key: string]: unknown;
}

/**
 * Logger JSON estruturado. Cada linha é um JSON parsable com timestamp,
 * level, message e contexto. Facilita ingest em ELK/Datadog/Loki.
 *
 * Uso:
 *   logger.info('scan started', { tenantId, scanRunId });
 */
@Injectable()
export class StructuredLogger implements LoggerService {
  log(message: string, context: LogContext = {}): void {
    this.emit('log', message, context);
  }

  info(message: string, context: LogContext = {}): void {
    this.emit('info', message, context);
  }

  warn(message: string, context: LogContext = {}): void {
    this.emit('warn', message, context);
  }

  error(message: string, context: LogContext = {}): void {
    this.emit('error', message, context);
  }

  debug(message: string, context: LogContext = {}): void {
    this.emit('debug', message, context);
  }

  verbose(message: string, context: LogContext = {}): void {
    this.emit('verbose', message, context);
  }

  private emit(level: string, message: string, context: LogContext): void {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      msg: message,
      ...context,
    });
    if (level === 'error') {
      process.stderr.write(`${line}\n`);
    } else {
      process.stdout.write(`${line}\n`);
    }
  }
}
