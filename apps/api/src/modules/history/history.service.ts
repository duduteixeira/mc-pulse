import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface ScoreHistoryPoint {
  scanRunId: string;
  createdAt: Date;
  scoreOverall: number;
  scoreByDomain: Record<string, number | null>;
  totalFindings: number;
}

export interface ScanComparison {
  a: { scanRunId: string; createdAt: Date; scoreOverall: number };
  b: { scanRunId: string; createdAt: Date; scoreOverall: number };
  delta: {
    overall: number;
    byDomain: Record<string, number | null>;
  };
  findingsDiff: {
    new: Array<{ ruleId: string; objectName: string | null; severity: string }>;
    resolved: Array<{ ruleId: string; objectName: string | null; severity: string }>;
    persistent: number;
  };
}

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async timeline(tenantId: string, connectionId: string): Promise<ScoreHistoryPoint[]> {
    await this.assertConnectionOwned(tenantId, connectionId);
    const scans = await this.prisma.scanRun.findMany({
      where: { connectionId, healthScore: { isNot: null } },
      include: { healthScore: true },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    return scans
      .filter((s) => s.healthScore)
      .map((s) => ({
        scanRunId: s.id,
        createdAt: s.createdAt,
        scoreOverall: s.healthScore!.scoreOverall,
        scoreByDomain: {
          governance: s.healthScore!.scoreGovernance,
          data: s.healthScore!.scoreData,
          journey: s.healthScore!.scoreJourney,
          automation: s.healthScore!.scoreAutomation,
          email: s.healthScore!.scoreEmail,
          security: s.healthScore!.scoreSecurity,
        },
        totalFindings: s.healthScore!.totalFindings,
      }));
  }

  async compare(
    tenantId: string,
    scanAId: string,
    scanBId: string,
  ): Promise<ScanComparison> {
    const [a, b] = await Promise.all([
      this.prisma.scanRun.findUnique({
        where: { id: scanAId },
        include: { healthScore: true, findings: true },
      }),
      this.prisma.scanRun.findUnique({
        where: { id: scanBId },
        include: { healthScore: true, findings: true },
      }),
    ]);
    if (!a || !b) throw new NotFoundException('Scan não encontrado');
    if (a.tenantId !== tenantId || b.tenantId !== tenantId) {
      throw new ForbiddenException('Acesso negado');
    }
    if (!a.healthScore || !b.healthScore) {
      throw new NotFoundException('Health score ausente em um dos scans');
    }

    const keyOf = (f: { ruleId: string; objectId: string | null; objectType: string }): string =>
      `${f.ruleId}::${f.objectId ?? f.objectType}`;
    const aKeys = new Set(a.findings.map(keyOf));
    const bKeys = new Set(b.findings.map(keyOf));

    const newFindings = b.findings.filter((f) => !aKeys.has(keyOf(f)));
    const resolvedFindings = a.findings.filter((f) => !bKeys.has(keyOf(f)));
    const persistent = a.findings.filter((f) => bKeys.has(keyOf(f))).length;

    const deltaDomain = (x: number | null, y: number | null): number | null =>
      x === null || y === null ? null : Number((y - x).toFixed(1));

    return {
      a: {
        scanRunId: a.id,
        createdAt: a.createdAt,
        scoreOverall: a.healthScore.scoreOverall,
      },
      b: {
        scanRunId: b.id,
        createdAt: b.createdAt,
        scoreOverall: b.healthScore.scoreOverall,
      },
      delta: {
        overall: Number((b.healthScore.scoreOverall - a.healthScore.scoreOverall).toFixed(1)),
        byDomain: {
          governance: deltaDomain(a.healthScore.scoreGovernance, b.healthScore.scoreGovernance),
          data: deltaDomain(a.healthScore.scoreData, b.healthScore.scoreData),
          journey: deltaDomain(a.healthScore.scoreJourney, b.healthScore.scoreJourney),
          automation: deltaDomain(a.healthScore.scoreAutomation, b.healthScore.scoreAutomation),
          email: deltaDomain(a.healthScore.scoreEmail, b.healthScore.scoreEmail),
          security: deltaDomain(a.healthScore.scoreSecurity, b.healthScore.scoreSecurity),
        },
      },
      findingsDiff: {
        new: newFindings.map((f) => ({
          ruleId: f.ruleId,
          objectName: f.objectName,
          severity: f.severity,
        })),
        resolved: resolvedFindings.map((f) => ({
          ruleId: f.ruleId,
          objectName: f.objectName,
          severity: f.severity,
        })),
        persistent,
      },
    };
  }

  private async assertConnectionOwned(tenantId: string, connectionId: string): Promise<void> {
    const conn = await this.prisma.sfmcConnection.findUnique({ where: { id: connectionId } });
    if (!conn) throw new NotFoundException('Conexão não encontrada');
    if (conn.tenantId !== tenantId) throw new ForbiddenException('Acesso negado');
  }
}
