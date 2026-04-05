import { Global, Module } from '@nestjs/common';
import { HealthScoreService } from './health-score.service';

@Global()
@Module({
  providers: [HealthScoreService],
  exports: [HealthScoreService],
})
export class HealthScoreModule {}
