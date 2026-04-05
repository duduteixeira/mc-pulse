import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AI_REPORT_QUEUE, AiReportJobData } from './ai-report.constants';
import { AiReportService } from './ai-report.service';

@Processor(AI_REPORT_QUEUE, { concurrency: 3 })
export class AiReportProcessor extends WorkerHost {
  private readonly logger = new Logger(AiReportProcessor.name);

  constructor(private readonly service: AiReportService) {
    super();
  }

  async process(job: Job<AiReportJobData>): Promise<void> {
    this.logger.log(`▶️  Gerando AI report scan=${job.data.scanRunId}`);
    await this.service.generate(job.data.scanRunId);
  }
}
