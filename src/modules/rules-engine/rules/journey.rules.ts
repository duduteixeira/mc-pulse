import { Effort, FindingCategory, ScanDomain, Severity } from '@prisma/client';
import { computePriority, Rule, RuleFinding } from '../interfaces/rule.interface';
import { CollectedJourney } from '../../collectors/journey.collector';

function finding(partial: Omit<RuleFinding, 'priority'>): RuleFinding {
  return { ...partial, priority: computePriority(partial.severity, partial.effort) };
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * JRN-001: Journey ativa sem modificação há mais de 180 dias.
 */
export const JRN001: Rule<CollectedJourney[]> = {
  id: 'JRN-001',
  domain: ScanDomain.JOURNEY,
  name: 'Journey ativa desatualizada',
  evaluate: ({ data }) => {
    const now = new Date();
    return data
      .filter(
        (j) =>
          /published|active|running/i.test(j.status) &&
          j.modifiedDate &&
          daysBetween(now, j.modifiedDate) > 180,
      )
      .map((j) =>
        finding({
          ruleId: 'JRN-001',
          category: FindingCategory.JOURNEY,
          severity: Severity.HIGH,
          objectType: 'Journey',
          objectName: j.name,
          evidence: `Journey ativa há ${daysBetween(now, j.modifiedDate!)} dias sem modificação`,
          ruleViolated: 'Journeys ativas devem ser revisadas ao menos a cada 180 dias',
          impact: 'Conteúdo obsoleto entregue aos contatos, ROI decrescente',
          recommendation: 'Revisar conteúdo, entradas e saídas da journey',
          effort: Effort.MEDIUM,
        }),
      );
  },
};

/**
 * JRN-002: Journey pausada há mais de 30 dias.
 */
export const JRN002: Rule<CollectedJourney[]> = {
  id: 'JRN-002',
  domain: ScanDomain.JOURNEY,
  name: 'Journey pausada há muito tempo',
  evaluate: ({ data }) => {
    const now = new Date();
    return data
      .filter(
        (j) =>
          /stopped|paused/i.test(j.status) &&
          j.modifiedDate &&
          daysBetween(now, j.modifiedDate) > 30,
      )
      .map((j) =>
        finding({
          ruleId: 'JRN-002',
          category: FindingCategory.JOURNEY,
          severity: Severity.MEDIUM,
          objectType: 'Journey',
          objectName: j.name,
          evidence: `Journey pausada há ${daysBetween(now, j.modifiedDate!)} dias`,
          ruleViolated: 'Journeys pausadas devem ser retomadas, arquivadas ou excluídas',
          impact: 'Acúmulo de artefatos sem propósito claro',
          recommendation: 'Decidir pelo arquivamento ou reativação da journey',
          effort: Effort.LOW,
        }),
      );
  },
};

/**
 * JRN-003: Journey em versão draft nunca publicada.
 */
export const JRN003: Rule<CollectedJourney[]> = {
  id: 'JRN-003',
  domain: ScanDomain.JOURNEY,
  name: 'Journey draft nunca publicada',
  evaluate: ({ data }) =>
    data
      .filter((j) => /draft/i.test(j.status) && !j.lastPublishedAt)
      .map((j) =>
        finding({
          ruleId: 'JRN-003',
          category: FindingCategory.JOURNEY,
          severity: Severity.LOW,
          objectType: 'Journey',
          objectName: j.name,
          evidence: 'Journey em draft sem nenhuma publicação histórica',
          ruleViolated: 'Drafts antigos devem ser publicados ou removidos',
          impact: 'Poluição do workspace, confusão para o time',
          recommendation: 'Publicar ou excluir a journey',
          effort: Effort.LOW,
        }),
      ),
};

export const JOURNEY_RULES = [JRN001, JRN002, JRN003];
