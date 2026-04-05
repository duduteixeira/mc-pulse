import { Effort, FindingCategory, ScanDomain, Severity } from '@prisma/client';
import { computePriority, Rule, RuleFinding } from '../interfaces/rule.interface';
import { CollectedAutomation } from '../../collectors/automation.collector';

function finding(partial: Omit<RuleFinding, 'priority'>): RuleFinding {
  return { ...partial, priority: computePriority(partial.severity, partial.effort) };
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * AUT-001: Automation com falha na última execução.
 */
export const AUT001: Rule<CollectedAutomation[]> = {
  id: 'AUT-001',
  domain: ScanDomain.AUTOMATION,
  name: 'Automation com falha na última execução',
  evaluate: ({ data }) =>
    data
      .filter((a) => a.lastRunStatus && /error|failed/i.test(a.lastRunStatus))
      .map((a) =>
        finding({
          ruleId: 'AUT-001',
          category: FindingCategory.AUTOMATION,
          severity: Severity.CRITICAL,
          objectType: 'Automation',
          objectName: a.name,
          evidence: `Última execução terminou em estado: ${a.lastRunStatus}`,
          ruleViolated: 'Automations não devem terminar em estado de erro',
          impact: 'Processos de negócio interrompidos silenciosamente',
          recommendation: 'Investigar logs e corrigir a causa raiz da falha',
          effort: Effort.MEDIUM,
        }),
      ),
};

/**
 * AUT-002: Automation sem schedule definido.
 */
export const AUT002: Rule<CollectedAutomation[]> = {
  id: 'AUT-002',
  domain: ScanDomain.AUTOMATION,
  name: 'Automation sem schedule',
  evaluate: ({ data }) =>
    data
      .filter((a) => !a.hasSchedule && !/inactive|paused/i.test(a.status))
      .map((a) =>
        finding({
          ruleId: 'AUT-002',
          category: FindingCategory.AUTOMATION,
          severity: Severity.MEDIUM,
          objectType: 'Automation',
          objectName: a.name,
          evidence: 'Automation ativa sem schedule configurado',
          ruleViolated: 'Automations recorrentes devem ter schedule ou trigger definido',
          impact: 'Execução manual ou ausência de execução causa falhas operacionais',
          recommendation: 'Definir schedule ou documentar motivo de execução manual',
          effort: Effort.LOW,
        }),
      ),
};

/**
 * AUT-003: Automation sem descrição.
 */
export const AUT003: Rule<CollectedAutomation[]> = {
  id: 'AUT-003',
  domain: ScanDomain.AUTOMATION,
  name: 'Automation sem descrição',
  evaluate: ({ data }) =>
    data
      .filter((a) => !a.description || a.description.trim().length === 0)
      .map((a) =>
        finding({
          ruleId: 'AUT-003',
          category: FindingCategory.AUTOMATION,
          severity: Severity.LOW,
          objectType: 'Automation',
          objectName: a.name,
          evidence: 'Automation sem descrição/documentação',
          ruleViolated: 'Automations devem ter descrição clara do propósito',
          impact: 'Dificuldade de manutenção e onboarding de novos membros',
          recommendation: 'Adicionar descrição explicando propósito e dependências',
          effort: Effort.LOW,
        }),
      ),
};

/**
 * AUT-004: Automation sem execução nos últimos 60 dias.
 */
export const AUT004: Rule<CollectedAutomation[]> = {
  id: 'AUT-004',
  domain: ScanDomain.AUTOMATION,
  name: 'Automation sem execução recente',
  evaluate: ({ data }) => {
    const now = new Date();
    return data
      .filter((a) => a.lastRunTime && daysBetween(now, a.lastRunTime) > 60)
      .map((a) =>
        finding({
          ruleId: 'AUT-004',
          category: FindingCategory.AUTOMATION,
          severity: Severity.MEDIUM,
          objectType: 'Automation',
          objectName: a.name,
          evidence: `Última execução há ${daysBetween(now, a.lastRunTime!)} dias`,
          ruleViolated: 'Automations ativas devem rodar regularmente',
          impact: 'Possível automation órfã consumindo recursos',
          recommendation: 'Validar necessidade e arquivar se não for mais usada',
          effort: Effort.LOW,
        }),
      );
  },
};

export const AUTOMATION_RULES = [AUT001, AUT002, AUT003, AUT004];
