import { RedisOptions } from 'ioredis';

/**
 * Constrói as opções de conexão Redis a partir de REDIS_URL.
 * Usado tanto por BullMQ quanto pelo cliente ioredis compartilhado.
 */
export function redisConnectionFromEnv(): RedisOptions {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    password: parsed.password || undefined,
    username: parsed.username || undefined,
    // BullMQ exige maxRetriesPerRequest: null nas conexões de fila
    maxRetriesPerRequest: null,
  };
}
