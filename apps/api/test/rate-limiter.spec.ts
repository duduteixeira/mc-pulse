import { SfmcRateLimiter } from '../src/common/utils/sfmc-rate-limiter';

describe('SfmcRateLimiter', () => {
  let limiter: SfmcRateLimiter;

  beforeEach(() => {
    limiter = new SfmcRateLimiter();
  });

  it('executa a função e retorna o resultado', async () => {
    const result = await limiter.run('t1', 'rest', async () => 42);
    expect(result).toBe(42);
  });

  it('respeita o semáforo máximo por tenant+protocolo (SOAP=10)', async () => {
    let active = 0;
    let maxActive = 0;
    const tasks = Array.from({ length: 20 }, () =>
      limiter.run('t1', 'soap', async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 20));
        active -= 1;
      }),
    );
    await Promise.all(tasks);
    expect(maxActive).toBeLessThanOrEqual(10);
  });

  it('semáforo é isolado entre tenants', async () => {
    const started: Record<string, number> = { a: 0, b: 0 };
    await Promise.all([
      ...Array.from({ length: 5 }, () =>
        limiter.run('tenant-a', 'soap', async () => {
          started.a += 1;
          await new Promise((r) => setTimeout(r, 10));
        }),
      ),
      ...Array.from({ length: 5 }, () =>
        limiter.run('tenant-b', 'soap', async () => {
          started.b += 1;
          await new Promise((r) => setTimeout(r, 10));
        }),
      ),
    ]);
    expect(started).toEqual({ a: 5, b: 5 });
  });

  it('abre o circuit breaker após 5 falhas consecutivas', async () => {
    const fail = (): Promise<never> => Promise.reject(new Error('boom'));
    for (let i = 0; i < 5; i += 1) {
      await expect(limiter.run('t1', 'rest', fail)).rejects.toThrow('boom');
    }
    // Sexta chamada deve falhar rápido com erro de circuito aberto
    await expect(limiter.run('t1', 'rest', fail)).rejects.toThrow(/Circuit breaker/);
  });

  it('sucesso reseta o contador de falhas', async () => {
    const fail = (): Promise<never> => Promise.reject(new Error('boom'));
    for (let i = 0; i < 4; i += 1) {
      await expect(limiter.run('t1', 'rest', fail)).rejects.toThrow();
    }
    await limiter.run('t1', 'rest', async () => 'ok');
    // Contador resetou; 4 novas falhas ainda não devem abrir o circuito
    for (let i = 0; i < 4; i += 1) {
      await expect(limiter.run('t1', 'rest', fail)).rejects.toThrow('boom');
    }
    // A 5ª falha consecutiva pós-reset abre o circuito
    await expect(limiter.run('t1', 'rest', fail)).rejects.toThrow('boom');
    await expect(limiter.run('t1', 'rest', fail)).rejects.toThrow(/Circuit breaker/);
  });
});
