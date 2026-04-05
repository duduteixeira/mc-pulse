import { FindingCategory, ScanDomain, Severity, Effort } from '@prisma/client';
import { computePriority, Rule, RuleFinding } from '../interfaces/rule.interface';
import { GovernanceData } from '../../collectors/governance.collector';

function finding(partial: Omit<RuleFinding, 'priority'>): RuleFinding {
  return { ...partial, priority: computePriority(partial.severity, partial.effort) };
}

/**
 * GOV-001: Installed Package com mais de 10 escopos ativos.
 */
export const GOV001: Rule<GovernanceData> = {
  id: 'GOV-001',
  domain: ScanDomain.GOVERNANCE,
  name: 'Package com escopos excessivos',
  evaluate: ({ data }) => {
    const findings: RuleFinding[] = [];
    for (const pkg of data.packages) {
      const raw = pkg.Scopes?.Scope;
      const scopes = Array.isArray(raw) ? raw : raw ? [raw] : [];
      if (scopes.length > 10) {
        findings.push(
          finding({
            ruleId: 'GOV-001',
            category: FindingCategory.GOVERNANCE,
            severity: Severity.HIGH,
            objectType: 'InstalledPackage',
            objectId: pkg.ID ?? null,
            objectName: pkg.Name ?? null,
            evidence: `Package possui ${scopes.length} escopos ativos`,
            ruleViolated: 'Installed Package não deve ter mais de 10 escopos',
            impact: 'Superfície de ataque ampliada; violação do princípio de menor privilégio',
            recommendation: 'Revisar e reduzir escopos ao mínimo necessário',
            effort: Effort.MEDIUM,
          }),
        );
      }
    }
    return findings;
  },
};

/**
 * GOV-002: Usuários com role Admin > 20% do total de usuários ativos.
 */
export const GOV002: Rule<GovernanceData> = {
  id: 'GOV-002',
  domain: ScanDomain.GOVERNANCE,
  name: 'Excesso de usuários admin',
  evaluate: ({ data }) => {
    const active = data.users.filter((u) => u.IsActive === 'true');
    if (active.length === 0) return [];
    const admins = active.filter((u) => {
      const roles = u.Roles?.Role;
      const list = Array.isArray(roles) ? roles : roles ? [roles] : [];
      return list.some((r) => /admin/i.test(r.Name ?? ''));
    });
    const ratio = admins.length / active.length;
    if (ratio > 0.2) {
      return [
        finding({
          ruleId: 'GOV-002',
          category: FindingCategory.GOVERNANCE,
          severity: Severity.HIGH,
          objectType: 'Account',
          evidence: `${admins.length}/${active.length} usuários ativos são admin (${Math.round(
            ratio * 100,
          )}%)`,
          ruleViolated: 'Admins não devem ultrapassar 20% dos usuários ativos',
          impact: 'Risco de alterações não autorizadas e dificuldade de auditoria',
          recommendation: 'Revogar role Admin de usuários que não precisam; usar roles customizadas',
          effort: Effort.MEDIUM,
        }),
      ];
    }
    return [];
  },
};

/**
 * GOV-003: Package sem uso nos últimos 90 dias.
 * NOTA: SFMC não expõe diretamente "last used" por Installed Package.
 * Como proxy: quando a coleta detecta packages sem escopos ou marcados como inativos.
 */
export const GOV003: Rule<GovernanceData> = {
  id: 'GOV-003',
  domain: ScanDomain.GOVERNANCE,
  name: 'Package possivelmente não utilizado',
  evaluate: ({ data }) => {
    const findings: RuleFinding[] = [];
    for (const pkg of data.packages) {
      const raw = pkg.Scopes?.Scope;
      const scopes = Array.isArray(raw) ? raw : raw ? [raw] : [];
      if (scopes.length === 0) {
        findings.push(
          finding({
            ruleId: 'GOV-003',
            category: FindingCategory.GOVERNANCE,
            severity: Severity.MEDIUM,
            objectType: 'InstalledPackage',
            objectId: pkg.ID ?? null,
            objectName: pkg.Name ?? null,
            evidence: 'Package sem escopos detectados — possivelmente não utilizado',
            ruleViolated: 'Packages sem uso devem ser removidos',
            impact: 'Acúmulo de credenciais potencialmente comprometidas',
            recommendation: 'Revisar auditoria de uso e remover o package se não for mais necessário',
            effort: Effort.LOW,
          }),
        );
      }
    }
    return findings;
  },
};

/**
 * GOV-004: BU sem usuários ativos.
 */
export const GOV004: Rule<GovernanceData> = {
  id: 'GOV-004',
  domain: ScanDomain.GOVERNANCE,
  name: 'Business Unit sem usuários ativos',
  evaluate: ({ data }) => {
    if (data.businessUnits.length === 0) return [];
    // Aproximação: se há BUs mas nenhum user ativo, alerta geral.
    const activeUsers = data.users.filter((u) => u.IsActive === 'true');
    if (activeUsers.length === 0 && data.businessUnits.length > 0) {
      return [
        finding({
          ruleId: 'GOV-004',
          category: FindingCategory.GOVERNANCE,
          severity: Severity.MEDIUM,
          objectType: 'BusinessUnit',
          evidence: `${data.businessUnits.length} BUs detectadas sem usuários ativos vinculados`,
          ruleViolated: 'Toda BU deve ter pelo menos um usuário ativo responsável',
          impact: 'Falta de ownership e possível esquecimento operacional',
          recommendation: 'Atribuir owner a cada BU ou arquivar BUs não utilizadas',
          effort: Effort.MEDIUM,
        }),
      ];
    }
    return [];
  },
};

export const GOVERNANCE_RULES = [GOV001, GOV002, GOV003, GOV004];
