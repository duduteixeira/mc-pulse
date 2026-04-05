import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiReportService } from './ai-report.service';
import { AiReportController } from './ai-report.controller';
import { AiReportProcessor } from './ai-report.processor';
import { AI_REPORT_QUEUE } from './ai-report.constants';

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: AI_REPORT_QUEUE })],
  controllers: [AiReportController],
  providers: [AiReportService, AiReportProcessor],
  exports: [AiReportService, BullModule],
})
export class AiReportModule {}
