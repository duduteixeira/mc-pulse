import { Injectable } from '@nestjs/common';
import { ScanDomain } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { Rule, RuleFinding } from './interfaces/rule.interface';
import { GOVERNANCE_RULES } from './rules/governance.rules';
import { DATA_RULES } from './rules/data.rules';
import { JOURNEY_RULES } from './rules/journey.rules';
import { AUTOMATION_RULES } from './rules/automation.rules';
import { EMAIL_RULES } from './rules/email.rules';
import { SECURITY_RULES } from './rules/security.rules';

const RULES_BY_DOMAIN: Record<ScanDomain, Rule<unknown>[]> = {
  GOVERNANCE: GOVERNANCE_RULES as Rule<unknown>[],
  DATA: DATA_RULES as Rule<unknown>[],
  JOURNEY: JOURNEY_RULES as Rule<unknown>[],
  AUTOMATION: AUTOMATION_RULES as Rule<unknown>[],
  EMAIL: EMAIL_RULES as Rule<unknown>[],
  SECURITY: SECURITY_RULES as Rule<unknown>[],
};

@Injectable()
export class RulesEngineService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Avalia todas as regras de um domínio contra os dados coletados.
   * Retorna o array de findings gerados (ainda não persistidos).
   */
  evaluate<T>(domain: ScanDomain, data: T): RuleFinding[] {
    const rules = RULES_BY_DOMAIN[domain] ?? [];
    const results: RuleFinding[] = [];
    for (const rule of rules) {
      const produced = rule.evaluate({ data });
      results.push(...produced);
    }
    return results;
  }

  /**
   * Persiste findings gerados associando-os ao scan_run.
   */
  async persist(scanRunId: string, findings: RuleFinding[]): Promise<void> {
    if (findings.length === 0) return;
    await this.prisma.finding.createMany({
      data: findings.map((f) => ({
        scanRunId,
        ruleId: f.ruleId,
        category: f.category,
        severity: f.severity,
        objectType: f.objectType,
        objectId: f.objectId ?? null,
        objectName: f.objectName ?? null,
        evidence: f.evidence,
        ruleViolated: f.ruleViolated,
        impact: f.impact,
        recommendation: f.recommendation,
        effort: f.effort,
        priority: f.priority,
      })),
    });
  }
}
