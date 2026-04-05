import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ClerkGuard } from '../../common/guards/clerk.guard';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { ReportsService } from './reports.service';

@Controller('scans/:scanId/reports')
@UseGuards(ClerkGuard)
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('executive.pdf')
  async executive(
    @Tenant() tenantId: string,
    @Param('scanId') scanId: string,
    @Res() res: Response,
  ): Promise<void> {
    const pdf = await this.service.generatePdf(tenantId, scanId, 'executive');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="mc-pulse-executivo-${scanId}.pdf"`,
    );
    res.send(pdf);
  }

  @Get('technical.pdf')
  async technical(
    @Tenant() tenantId: string,
    @Param('scanId') scanId: string,
    @Res() res: Response,
  ): Promise<void> {
    const pdf = await this.service.generatePdf(tenantId, scanId, 'technical');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="mc-pulse-tecnico-${scanId}.pdf"`,
    );
    res.send(pdf);
  }
}
