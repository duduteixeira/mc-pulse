import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScannerController } from './scanner.controller';
import { ScannerService } from './scanner.service';
import { ScanProcessor } from './jobs/scan.processor';
import { SCANNER_QUEUE } from './scanner.constants';
import { CollectorsModule } from '../collectors/collectors.module';
import { AiReportModule } from '../ai-report/ai-report.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: SCANNER_QUEUE }),
    CollectorsModule,
    AiReportModule,
  ],
  controllers: [ScannerController],
  providers: [ScannerService, ScanProcessor],
  exports: [ScannerService],
})
export class ScannerModule {}
