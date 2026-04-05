import { Effort, FindingCategory, ScanDomain, Severity } from '@prisma/client';
import { computePriority, Rule, RuleFinding } from '../interfaces/rule.interface';
import { SecurityData } from '../../collectors/security.collector';

function finding(partial: Omit<RuleFinding, 'priority'>): RuleFinding {
  return { ...partial, priority: computePriority(partial.severity, partial.effort) };
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

// Scopes considerados de escrita — qualquer um destes em um package amplia
// risco se o package não precisar modificar o SFMC.
const WRITE_SCOPE_PATTERNS = [/write/i, /create/i, /update/i, /delete/i, /modify/i, /send/i];

function isWriteScope(scope: string): boolean {
  return WRITE_SCOPE_PATTERNS.some((re) => re.test(scope));
}

/**
 * SEC-001: Package com escopos de escrita desnecessários.
 * Heurística: package com mais da metade dos scopes marcados como escrita.
 */
export const SEC001: Rule<SecurityData> = {
  id: 'SEC-001',
  domain: ScanDomain.SECURITY,
  name: 'Package com escopos de escrita excessivos',
  evaluate: ({ data }) => {
    const findings: RuleFinding[] = [];
    for (const pkg of data.packages) {
      if (pkg.scopes.length === 0) continue;
      const writeScopes = pkg.scopes.filter((s) => isWriteScope(s.name));
      if (writeScopes.length >= Math.ceil(pkg.scopes.length / 2) && writeScopes.length > 0) {
        findings.push(
          finding({
            ruleId: 'SEC-001',
            category: FindingCategory.SECURITY,
            severity: Severity.CRITICAL,
            objectType: 'InstalledPackage',
            objectId: pkg.sfmcId,
            objectName: pkg.name,
            evidence: `${writeScopes.length}/${pkg.scopes.length} escopos são de escrita: ${writeScopes
              .map((s) => s.name)
              .join(', ')}`,
            ruleViolated: 'Packages devem ter apenas os escopos estritamente necessários',
            impact: 'Credencial comprometida pode alterar dados produtivos do SFMC',
            recommendation: 'Revisar escopos e remover os de escrita que não forem usados',
            effort: Effort.MEDIUM,
          }),
        );
      }
    }
    return findings;
  },
};

/**
 * SEC-002: Ausência de rotação de credenciais (> 365 dias).
 * Como o SFMC não expõe data do last rotation do secret, usamos a data de
 * criação do InstalledPackage (ou, como fallback, a data de criação da conexão
 * no MC Pulse) como proxy.
 */
export const SEC002: Rule<SecurityData> = {
  id: 'SEC-002',
  domain: ScanDomain.SECURITY,
  name: 'Credenciais sem rotação há mais de 365 dias',
  evaluate: ({ data }) => {
    const now = new Date();
    const findings: RuleFinding[] = [];
    for (const pkg of data.packages) {
      const reference = pkg.modifiedDate ?? pkg.createdDate;
      if (reference && daysBetween(now, reference) > 365) {
        findings.push(
          finding({
            ruleId: 'SEC-002',
            category: FindingCategory.SECURITY,
            severity: Severity.HIGH,
            objectType: 'InstalledPackage',
            objectId: pkg.sfmcId,
            objectName: pkg.name,
            evidence: `Package sem modificação há ${daysBetween(now, reference)} dias`,
            ruleViolated: 'Client secrets devem ser rotacionados ao menos uma vez por ano',
            impact: 'Aumenta janela de exposição caso o secret seja comprometido',
            recommendation: 'Rotacionar client secret e atualizar a conexão no MC Pulse',
            effort: Effort.LOW,
          }),
        );
      }
    }
    // Fallback: se não há packages mas a conexão é antiga
    if (data.packages.length === 0 && daysBetween(now, data.connectionCreatedAt) > 365) {
      findings.push(
        finding({
          ruleId: 'SEC-002',
          category: FindingCategory.SECURITY,
          severity: Severity.HIGH,
          objectType: 'SfmcConnection',
          evidence: `Conexão cadastrada há ${daysBetween(now, data.connectionCreatedAt)} dias sem rotação`,
          ruleViolated: 'Client secrets devem ser rotacionados ao menos uma vez por ano',
          impact: 'Aumenta janela de exposição caso o secret seja comprometido',
          recommendation: 'Rotacionar client secret e atualizar a conexão no MC Pulse',
          effort: Effort.LOW,
        }),
      );
    }
    return findings;
  },
};

/**
 * SEC-003: Package com escopos de Data Extensions + Journey + Admin simultaneamente.
 * Combinação perigosa: um único credential pode manipular dados, execução e governança.
 */
export const SEC003: Rule<SecurityData> = {
  id: 'SEC-003',
  domain: ScanDomain.SECURITY,
  name: 'Package com combinação crítica de escopos',
  evaluate: ({ data }) => {
    const findings: RuleFinding[] = [];
    for (const pkg of data.packages) {
      const names = pkg.scopes.map((s) => s.name.toLowerCase());
      const hasData = names.some((n) => /data.?extension|contacts/.test(n));
      const hasJourney = names.some((n) => /journey|interaction/.test(n));
      const hasAdmin = names.some((n) => /admin|account|users/.test(n));
      if (hasData && hasJourney && hasAdmin) {
        findings.push(
          finding({
            ruleId: 'SEC-003',
            category: FindingCategory.SECURITY,
            severity: Severity.CRITICAL,
            objectType: 'InstalledPackage',
            objectId: pkg.sfmcId,
            objectName: pkg.name,
            evidence: 'Package concentra escopos de Data Extensions, Journey e Admin',
            ruleViolated: 'Nenhum package deve concentrar escopos de dados + execução + admin',
            impact: 'Um comprometimento permite manipular dados, execução e governança',
            recommendation: 'Separar em múltiplos packages com responsabilidades isoladas',
            effort: Effort.HIGH,
          }),
        );
      }
    }
    return findings;
  },
};

export const SECURITY_RULES = [SEC001, SEC002, SEC003];
