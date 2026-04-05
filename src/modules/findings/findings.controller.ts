import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Finding, FindingCategory, FindingStatus, HealthScore, Severity } from '@prisma/client';
import { ClerkGuard } from '../../common/guards/clerk.guard';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { FindingsService } from './findings.service';
import { UpdateFindingDto } from './dto/update-finding.dto';

@Controller()
@UseGuards(ClerkGuard)
export class FindingsController {
  constructor(private readonly service: FindingsService) {}

  @Get('scans/:scanId/findings')
  list(
    @Tenant() tenantId: string,
    @Param('scanId') scanId: string,
    @Query('category') category?: FindingCategory,
    @Query('severity') severity?: Severity,
    @Query('status') status?: FindingStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<{ items: Finding[]; total: number; page: number; limit: number }> {
    return this.service.listForScan(tenantId, scanId, {
      category,
      severity,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('scans/:scanId/score')
  score(
    @Tenant() tenantId: string,
    @Param('scanId') scanId: string,
  ): Promise<HealthScore> {
    return this.service.getScanScore(tenantId, scanId);
  }

  @Patch('findings/:id')
  update(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFindingDto,
  ): Promise<Finding> {
    return this.service.updateStatus(tenantId, id, dto.status);
  }
}
