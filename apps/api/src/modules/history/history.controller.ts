import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ClerkGuard } from '../../common/guards/clerk.guard';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { HistoryService, ScanComparison, ScoreHistoryPoint } from './history.service';

@Controller()
@UseGuards(ClerkGuard)
export class HistoryController {
  constructor(private readonly service: HistoryService) {}

  @Get('connections/:id/history')
  timeline(
    @Tenant() tenantId: string,
    @Param('id') id: string,
  ): Promise<ScoreHistoryPoint[]> {
    return this.service.timeline(tenantId, id);
  }

  @Get('scans/compare')
  compare(
    @Tenant() tenantId: string,
    @Query('a') a: string,
    @Query('b') b: string,
  ): Promise<ScanComparison> {
    return this.service.compare(tenantId, a, b);
  }
}
