import { Effort, FindingCategory, ScanDomain, Severity } from '@prisma/client';

/**
 * Dados agregados disponíveis para as regras de cada domínio.
 * Cada tipo é genérico propositalmente — a rule decide o shape que precisa.
 */
export interface DomainContext<T = unknown> {
  data: T;
}

/**
 * Representação de um finding gerado por uma regra, ainda sem scanRunId (injetado depois).
 */
export interface RuleFinding {
  ruleId: string;
  category: FindingCategory;
  severity: Severity;
  objectType: string;
  objectId?: string | null;
  objectName?: string | null;
  evidence: string;
  ruleViolated: string;
  impact: string;
  recommendation: string;
  effort: Effort;
  priority: number;
}

export interface Rule<T = unknown> {
  id: string;
  domain: ScanDomain;
  name: string;
  evaluate(ctx: DomainContext<T>): RuleFinding[];
}

/**
 * Pesos de severidade para cálculo de priority.
 */
export const SEVERITY_WEIGHT: Record<Severity, number> = {
  CRITICAL: 100,
  HIGH: 70,
  MEDIUM: 40,
  LOW: 20,
  INFO: 5,
};

export function computePriority(severity: Severity, effort: Effort): number {
  const effortWeight: Record<Effort, number> = { LOW: 3, MEDIUM: 2, HIGH: 1 };
  return SEVERITY_WEIGHT[severity] * effortWeight[effort];
}
