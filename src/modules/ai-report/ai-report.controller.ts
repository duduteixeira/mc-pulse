import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ClerkGuard } from '../../common/guards/clerk.guard';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { AiReportService } from './ai-report.service';

@Controller('scans/:scanId/report')
@UseGuards(ClerkGuard)
export class AiReportController {
  constructor(private readonly service: AiReportService) {}

  @Get()
  get(@Tenant() tenantId: string, @Param('scanId') scanId: string): Promise<unknown> {
    return this.service.getReport(tenantId, scanId);
  }
}
