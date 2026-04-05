import { Effort, FindingCategory, ScanDomain, Severity } from '@prisma/client';
import { computePriority, Rule, RuleFinding } from '../interfaces/rule.interface';
import { CollectedEmailAssets } from '../../collectors/email.collector';

function finding(partial: Omit<RuleFinding, 'priority'>): RuleFinding {
  return { ...partial, priority: computePriority(partial.severity, partial.effort) };
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * EML-001: Triggered Send sem atividade há mais de 90 dias.
 */
export const EML001: Rule<CollectedEmailAssets> = {
  id: 'EML-001',
  domain: ScanDomain.EMAIL,
  name: 'Triggered Send inativo',
  evaluate: ({ data }) => {
    const now = new Date();
    return data.triggeredSends
      .filter((ts) => ts.lastActivity && daysBetween(now, ts.lastActivity) > 90)
      .map((ts) =>
        finding({
          ruleId: 'EML-001',
          category: FindingCategory.EMAIL,
          severity: Severity.MEDIUM,
          objectType: 'TriggeredSend',
          objectId: ts.sfmcId,
          objectName: ts.name,
          evidence: `Última atividade há ${daysBetween(now, ts.lastActivity!)} dias`,
          ruleViolated: 'Triggered Sends devem ter atividade regular ou ser desativados',
          impact: 'Acúmulo de artefatos e risco de envios acidentais',
          recommendation: 'Desativar ou remover triggered sends não utilizados',
          effort: Effort.LOW,
        }),
      );
  },
};

/**
 * EML-002: Send Classification sem Delivery Profile associado.
 */
export const EML002: Rule<CollectedEmailAssets> = {
  id: 'EML-002',
  domain: ScanDomain.EMAIL,
  name: 'Send Classification sem Delivery Profile',
  evaluate: ({ data }) =>
    data.sendClassifications
      .filter((sc) => !sc.hasDeliveryProfile)
      .map((sc) =>
        finding({
          ruleId: 'EML-002',
          category: FindingCategory.EMAIL,
          severity: Severity.HIGH,
          objectType: 'SendClassification',
          objectId: sc.sfmcId,
          objectName: sc.name,
          evidence: 'Send Classification sem Delivery Profile vinculado',
          ruleViolated: 'Send Classifications devem ter Delivery Profile associado',
          impact: 'Envios podem usar configuração incorreta de header/footer/IP',
          recommendation: 'Associar Delivery Profile apropriado à Send Classification',
          effort: Effort.LOW,
        }),
      ),
};

/**
 * EML-003: Send Definition com configuração incompleta.
 * Incompleta = sem classification, sem delivery profile ou sem email associado.
 */
export const EML003: Rule<CollectedEmailAssets> = {
  id: 'EML-003',
  domain: ScanDomain.EMAIL,
  name: 'Send Definition com configuração incompleta',
  evaluate: ({ data }) =>
    data.sendDefinitions
      .filter((sd) => !sd.hasClassification || !sd.hasDeliveryProfile || !sd.hasEmail)
      .map((sd) => {
        const missing: string[] = [];
        if (!sd.hasClassification) missing.push('SendClassification');
        if (!sd.hasDeliveryProfile) missing.push('DeliveryProfile');
        if (!sd.hasEmail) missing.push('Email');
        return finding({
          ruleId: 'EML-003',
          category: FindingCategory.EMAIL,
          severity: Severity.HIGH,
          objectType: 'SendDefinition',
          objectId: sd.sfmcId,
          objectName: sd.name,
          evidence: `Campos ausentes: ${missing.join(', ')}`,
          ruleViolated: 'Send Definitions devem ter classification, delivery profile e email',
          impact: 'Envios falharão ou entregarão conteúdo errado',
          recommendation: 'Completar configuração antes de ativar a Send Definition',
          effort: Effort.MEDIUM,
        });
      }),
};

export const EMAIL_RULES = [EML001, EML002, EML003];
