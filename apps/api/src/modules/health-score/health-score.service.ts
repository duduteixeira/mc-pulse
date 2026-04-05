import { Injectable } from '@nestjs/common';
import { FindingCategory, Severity } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const PENALTY: Record<Severity, number> = {
  CRITICAL: 20,
  HIGH: 10,
  MEDIUM: 5,
  LOW: 2,
  INFO: 0,
};

const DOMAIN_WEIGHTS: Record<FindingCategory, number> = {
  GOVERNANCE: 0.2,
  DATA: 0.2,
  JOURNEY: 0.15,
  AUTOMATION: 0.15,
  EMAIL: 0.15,
  SECURITY: 0.15,
};

export interface FindingLike {
  category: FindingCategory;
  severity: Severity;
}

export interface HealthScoreResult {
  scoreOverall: number;
  scoreByDomain: Partial<Record<FindingCategory, number>>;
  classification: string;
  counts: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

@Injectable()
export class HealthScoreService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calcula score puro a partir de findings — função determinística, testável sem DB.
   */
  calculate(findings: FindingLike[]): HealthScoreResult {
    const domains: FindingCategory[] = [
      'GOVERNANCE',
      'DATA',
      'JOURNEY',
      'AUTOMATION',
      'EMAIL',
      'SECURITY',
    ];

    const scoreByDomain: Partial<Record<FindingCategory, number>> = {};
    for (const d of domains) {
      const penalties = findings
        .filter((f) => f.category === d)
        .reduce((acc, f) => acc + PENALTY[f.severity], 0);
      const score = Math.max(0, Math.min(100, 100 - penalties));
      scoreByDomain[d] = score;
    }

    // Média ponderada
    const overall = domains.reduce((acc, d) => {
      const s = scoreByDomain[d] ?? 100;
      return acc + s * DOMAIN_WEIGHTS[d];
    }, 0);

    const counts = {
      total: findings.length,
      critical: findings.filter((f) => f.severity === 'CRITICAL').length,
      high: findings.filter((f) => f.severity === 'HIGH').length,
      medium: findings.filter((f) => f.severity === 'MEDIUM').length,
      low: findings.filter((f) => f.severity === 'LOW').length,
    };

    return {
      scoreOverall: Math.round(overall * 10) / 10,
      scoreByDomain,
      classification: this.classify(overall),
      counts,
    };
  }

  classify(score: number): string {
    if (score >= 92) return 'Saudável';
    if (score >= 75) return 'Atenção';
    if (score >= 50) return 'Risco';
    return 'Crítico';
  }

  /**
   * Carrega findings do scan_run, calcula score e persiste.
   */
  async computeAndPersist(scanRunId: string): Promise<HealthScoreResult> {
    const findings = await this.prisma.finding.findMany({
      where: { scanRunId },
      select: { category: true, severity: true },
    });
    const result = this.calculate(findings);

    await this.prisma.healthScore.upsert({
      where: { scanRunId },
      create: {
        scanRunId,
        scoreOverall: result.scoreOverall,
        scoreGovernance: result.scoreByDomain.GOVERNANCE,
        scoreData: result.scoreByDomain.DATA,
        scoreJourney: result.scoreByDomain.JOURNEY,
        scoreAutomation: result.scoreByDomain.AUTOMATION,
        scoreEmail: result.scoreByDomain.EMAIL,
        scoreSecurity: result.scoreByDomain.SECURITY,
        classification: result.classification,
        totalFindings: result.counts.total,
        criticalCount: result.counts.critical,
        highCount: result.counts.high,
        mediumCount: result.counts.medium,
        lowCount: result.counts.low,
      },
      update: {
        scoreOverall: result.scoreOverall,
        scoreGovernance: result.scoreByDomain.GOVERNANCE,
        scoreData: result.scoreByDomain.DATA,
        scoreJourney: result.scoreByDomain.JOURNEY,
        scoreAutomation: result.scoreByDomain.AUTOMATION,
        scoreEmail: result.scoreByDomain.EMAIL,
        scoreSecurity: result.scoreByDomain.SECURITY,
        classification: result.classification,
        totalFindings: result.counts.total,
        criticalCount: result.counts.critical,
        highCount: result.counts.high,
        mediumCount: result.counts.medium,
        lowCount: result.counts.low,
      },
    });

    return result;
  }
}
