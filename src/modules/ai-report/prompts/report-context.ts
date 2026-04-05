import { Finding, HealthScore } from '@prisma/client';

export interface ReportContext {
  tenantName: string;
  connectionName: string;
  subdomain: string;
  score: HealthScore;
  findings: Finding[];
}

/**
 * Serializa o contexto do scan em JSON compacto, removendo qualquer credencial
 * ou campo sensível antes de enviar ao modelo.
 */
export function serializeContext(ctx: ReportContext): string {
  const topFindings = [...ctx.findings]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 60);

  return JSON.stringify(
    {
      tenant: ctx.tenantName,
      connection: ctx.connectionName,
      subdomain: ctx.subdomain,
      score: {
        overall: ctx.score.scoreOverall,
        classification: ctx.score.classification,
        byDomain: {
          governance: ctx.score.scoreGovernance,
          data: ctx.score.scoreData,
          journey: ctx.score.scoreJourney,
          automation: ctx.score.scoreAutomation,
          email: ctx.score.scoreEmail,
          security: ctx.score.scoreSecurity,
        },
        counts: {
          total: ctx.score.totalFindings,
          critical: ctx.score.criticalCount,
          high: ctx.score.highCount,
          medium: ctx.score.mediumCount,
          low: ctx.score.lowCount,
        },
      },
      findings: topFindings.map((f) => ({
        ruleId: f.ruleId,
        category: f.category,
        severity: f.severity,
        object: f.objectName ?? f.objectType,
        evidence: f.evidence,
        rule: f.ruleViolated,
        impact: f.impact,
        recommendation: f.recommendation,
        effort: f.effort,
        priority: f.priority,
      })),
    },
    null,
    2,
  );
}
