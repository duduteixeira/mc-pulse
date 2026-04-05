import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { redisConnectionFromEnv } from '../utils/redis.util';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (): Redis => new Redis(redisConnectionFromEnv()),
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
