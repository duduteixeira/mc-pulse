import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Finding,
  FindingCategory,
  FindingStatus,
  HealthScore,
  Prisma,
  Severity,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface ListFindingsFilter {
  category?: FindingCategory;
  severity?: Severity;
  status?: FindingStatus;
  page?: number;
  limit?: number;
}

@Injectable()
export class FindingsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForScan(
    tenantId: string,
    scanId: string,
    filter: ListFindingsFilter,
  ): Promise<{ items: Finding[]; total: number; page: number; limit: number }> {
    await this.assertScanOwned(tenantId, scanId);

    const page = filter.page ?? 1;
    const limit = Math.min(filter.limit ?? 50, 200);

    const where: Prisma.FindingWhereInput = {
      scanRunId: scanId,
      ...(filter.category ? { category: filter.category } : {}),
      ...(filter.severity ? { severity: filter.severity } : {}),
      ...(filter.status ? { status: filter.status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.finding.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.finding.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getScanScore(tenantId: string, scanId: string): Promise<HealthScore> {
    await this.assertScanOwned(tenantId, scanId);
    const score = await this.prisma.healthScore.findUnique({ where: { scanRunId: scanId } });
    if (!score) throw new NotFoundException('Health score ainda não disponível');
    return score;
  }

  async updateStatus(
    tenantId: string,
    findingId: string,
    status: FindingStatus,
  ): Promise<Finding> {
    const existing = await this.prisma.finding.findUnique({
      where: { id: findingId },
      include: { scanRun: true },
    });
    if (!existing) throw new NotFoundException('Finding não encontrado');
    if (existing.scanRun.tenantId !== tenantId) throw new ForbiddenException('Acesso negado');

    return this.prisma.finding.update({
      where: { id: findingId },
      data: {
        status,
        resolvedAt: status === FindingStatus.RESOLVED ? new Date() : null,
      },
    });
  }

  private async assertScanOwned(tenantId: string, scanId: string): Promise<void> {
    const scan = await this.prisma.scanRun.findUnique({ where: { id: scanId } });
    if (!scan) throw new NotFoundException('Scan não encontrado');
    if (scan.tenantId !== tenantId) throw new ForbiddenException('Acesso negado');
  }
}
