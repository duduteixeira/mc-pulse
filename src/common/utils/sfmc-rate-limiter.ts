import { Injectable, Logger } from '@nestjs/common';

interface Semaphore {
  active: number;
  queue: Array<() => void>;
  max: number;
}

interface CircuitState {
  failures: number;
  openedAt: number | null;
}

const SOAP_MAX_CONCURRENT = 10;
const REST_MAX_CONCURRENT = 20;
const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_COOLDOWN_MS = 60_000;
const INTER_CALL_DELAY_MS = 100;

type Protocol = 'rest' | 'soap';

/**
 * Rate limiter por tenant + circuit breaker por (tenant, protocolo).
 *
 * - Máximo de N chamadas simultâneas por tenant e protocolo
 * - Delay mínimo de 100ms entre chamadas em lote (do mesmo semáforo)
 * - Após 5 falhas consecutivas → circuito aberto por 60s (chamadas falham rápido)
 */
@Injectable()
export class SfmcRateLimiter {
  private readonly logger = new Logger(SfmcRateLimiter.name);
  private readonly semaphores = new Map<string, Semaphore>();
  private readonly circuits = new Map<string, CircuitState>();
  private readonly lastCallAt = new Map<string, number>();

  async run<T>(tenantId: string, protocol: Protocol, fn: () => Promise<T>): Promise<T> {
    const key = `${tenantId}:${protocol}`;

    if (this.isCircuitOpen(key)) {
      throw new Error(`Circuit breaker aberto para ${protocol} (tenant=${tenantId})`);
    }

    await this.acquire(key, protocol);
    try {
      await this.enforceDelay(key);
      const result = await fn();
      this.recordSuccess(key);
      return result;
    } catch (err) {
      this.recordFailure(key);
      throw err;
    } finally {
      this.release(key);
    }
  }

  private getSemaphore(key: string, protocol: Protocol): Semaphore {
    let sem = this.semaphores.get(key);
    if (!sem) {
      sem = {
        active: 0,
        queue: [],
        max: protocol === 'rest' ? REST_MAX_CONCURRENT : SOAP_MAX_CONCURRENT,
      };
      this.semaphores.set(key, sem);
    }
    return sem;
  }

  private acquire(key: string, protocol: Protocol): Promise<void> {
    const sem = this.getSemaphore(key, protocol);
    if (sem.active < sem.max) {
      sem.active += 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      sem.queue.push(() => {
        sem.active += 1;
        resolve();
      });
    });
  }

  private release(key: string): void {
    const sem = this.semaphores.get(key);
    if (!sem) return;
    sem.active -= 1;
    const next = sem.queue.shift();
    if (next) next();
  }

  private async enforceDelay(key: string): Promise<void> {
    const now = Date.now();
    const last = this.lastCallAt.get(key) ?? 0;
    const elapsed = now - last;
    if (elapsed < INTER_CALL_DELAY_MS) {
      await new Promise((r) => setTimeout(r, INTER_CALL_DELAY_MS - elapsed));
    }
    this.lastCallAt.set(key, Date.now());
  }

  private getCircuit(key: string): CircuitState {
    let c = this.circuits.get(key);
    if (!c) {
      c = { failures: 0, openedAt: null };
      this.circuits.set(key, c);
    }
    return c;
  }

  private isCircuitOpen(key: string): boolean {
    const c = this.getCircuit(key);
    if (c.openedAt === null) return false;
    if (Date.now() - c.openedAt > CIRCUIT_COOLDOWN_MS) {
      // meio-aberto: permite nova tentativa zerando contadores
      c.failures = 0;
      c.openedAt = null;
      return false;
    }
    return true;
  }

  private recordSuccess(key: string): void {
    const c = this.getCircuit(key);
    c.failures = 0;
    c.openedAt = null;
  }

  private recordFailure(key: string): void {
    const c = this.getCircuit(key);
    c.failures += 1;
    if (c.failures >= CIRCUIT_THRESHOLD) {
      c.openedAt = Date.now();
      this.logger.warn(`Circuit breaker aberto para ${key} após ${c.failures} falhas`);
    }
  }
}
