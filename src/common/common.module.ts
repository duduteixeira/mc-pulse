import { Global, Module } from '@nestjs/common';
import { SfmcRateLimiter } from './utils/sfmc-rate-limiter';
import { StructuredLogger } from './utils/structured-logger';

@Global()
@Module({
  providers: [SfmcRateLimiter, StructuredLogger],
  exports: [SfmcRateLimiter, StructuredLogger],
})
export class CommonModule {}
