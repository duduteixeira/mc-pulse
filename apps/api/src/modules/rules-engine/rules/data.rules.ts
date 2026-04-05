import { Effort, FindingCategory, ScanDomain, Severity } from '@prisma/client';
import { computePriority, Rule, RuleFinding } from '../interfaces/rule.interface';
import { CollectedDataExtension } from '../../collectors/data.collector';

function finding(partial: Omit<RuleFinding, 'priority'>): RuleFinding {
  return { ...partial, priority: computePriority(partial.severity, partial.effort) };
}

export const DATA001: Rule<CollectedDataExtension[]> = {
  id: 'DATA-001',
  domain: ScanDomain.DATA,
  name: 'Data Extension sem retention policy',
  evaluate: ({ data }) =>
    data
      .filter((de) => de.retentionPeriod === null)
      .map((de) =>
        finding({
          ruleId: 'DATA-001',
          category: FindingCategory.DATA,
          severity: Severity.HIGH,
          objectType: 'DataExtension',
          objectId: de.sfmcId,
          objectName: de.name,
          evidence: 'Data Extension sem retention policy configurada',
          ruleViolated: 'Toda DE deve ter política de retenção de dados',
          impact: 'Armazenamento crescente indefinido, risco de LGPD/GDPR',
          recommendation: 'Configurar retention policy adequada ao caso de uso',
          effort: Effort.LOW,
        }),
      ),
};

export const DATA002: Rule<CollectedDataExtension[]> = {
  id: 'DATA-002',
  domain: ScanDomain.DATA,
  name: 'Data Extension sem primary key',
  evaluate: ({ data }) =>
    data
      .filter((de) => !de.hasPrimaryKey && de.fieldCount > 0)
      .map((de) =>
        finding({
          ruleId: 'DATA-002',
          category: FindingCategory.DATA,
          severity: Severity.HIGH,
          objectType: 'DataExtension',
          objectId: de.sfmcId,
          objectName: de.name,
          evidence: 'Data Extension sem primary key definida',
          ruleViolated: 'Data Extensions devem ter primary key para evitar duplicidade',
          impact: 'Registros duplicados, inconsistência em lookups e jornadas',
          recommendation: 'Definir primary key apropriada na DE',
          effort: Effort.MEDIUM,
        }),
      ),
};

/**
 * DATA-003: naming inconsistente (sem prefixo/sufixo padrão).
 * Heurística: DEs cujo nome não começa com letra seguida de separador (_ ou -).
 */
export const DATA003: Rule<CollectedDataExtension[]> = {
  id: 'DATA-003',
  domain: ScanDomain.DATA,
  name: 'Naming inconsistente',
  evaluate: ({ data }) => {
    const pattern = /^[A-Za-z]{2,}[_-]/;
    return data
      .filter((de) => !pattern.test(de.name))
      .map((de) =>
        finding({
          ruleId: 'DATA-003',
          category: FindingCategory.DATA,
          severity: Severity.MEDIUM,
          objectType: 'DataExtension',
          objectId: de.sfmcId,
          objectName: de.name,
          evidence: `Nome "${de.name}" não segue convenção de prefixo (ex: DE_, STG_)`,
          ruleViolated: 'Data Extensions devem seguir convenção de nomenclatura',
          impact: 'Dificuldade de governança e busca',
          recommendation: 'Padronizar nomes com prefixos por tipo/ambiente',
          effort: Effort.MEDIUM,
        }),
      );
  },
};

/**
 * DATA-004: DEs com nomes similares (possível duplicidade).
 * Heurística: normaliza nome e detecta grupos com >1.
 */
export const DATA004: Rule<CollectedDataExtension[]> = {
  id: 'DATA-004',
  domain: ScanDomain.DATA,
  name: 'Data Extensions com nomes similares',
  evaluate: ({ data }) => {
    const groups = new Map<string, CollectedDataExtension[]>();
    for (const de of data) {
      const key = de.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!key) continue;
      const arr = groups.get(key) ?? [];
      arr.push(de);
      groups.set(key, arr);
    }
    const findings: RuleFinding[] = [];
    for (const [, group] of groups) {
      if (group.length > 1) {
        const names = group.map((g) => g.name).join(', ');
        findings.push(
          finding({
            ruleId: 'DATA-004',
            category: FindingCategory.DATA,
            severity: Severity.MEDIUM,
            objectType: 'DataExtension',
            objectId: group[0].sfmcId,
            objectName: group[0].name,
            evidence: `DEs similares detectadas: ${names}`,
            ruleViolated: 'Evitar duplicidade de Data Extensions com propósito similar',
            impact: 'Dispersão de dados, inconsistências, custo de storage duplicado',
            recommendation: 'Consolidar ou diferenciar claramente o propósito das DEs',
            effort: Effort.HIGH,
          }),
        );
      }
    }
    return findings;
  },
};

export const DATA005: Rule<CollectedDataExtension[]> = {
  id: 'DATA-005',
  domain: ScanDomain.DATA,
  name: 'Data Extension com mais de 50 campos',
  evaluate: ({ data }) =>
    data
      .filter((de) => de.fieldCount > 50)
      .map((de) =>
        finding({
          ruleId: 'DATA-005',
          category: FindingCategory.DATA,
          severity: Severity.LOW,
          objectType: 'DataExtension',
          objectId: de.sfmcId,
          objectName: de.name,
          evidence: `DE possui ${de.fieldCount} campos`,
          ruleViolated: 'DEs devem ser granulares — máximo recomendado 50 campos',
          impact: 'Performance degradada em queries e SSJS',
          recommendation: 'Normalizar: dividir em DEs menores e relacioná-las',
          effort: Effort.HIGH,
        }),
      ),
};

export const DATA_RULES = [DATA001, DATA002, DATA003, DATA004, DATA005];
