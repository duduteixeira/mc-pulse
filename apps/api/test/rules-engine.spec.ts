import { ScanDomain } from '@prisma/client';
import { RulesEngineService } from '../src/modules/rules-engine/rules-engine.service';
import { GovernanceData } from '../src/modules/collectors/governance.collector';
import { CollectedDataExtension } from '../src/modules/collectors/data.collector';
import { CollectedJourney } from '../src/modules/collectors/journey.collector';
import { CollectedAutomation } from '../src/modules/collectors/automation.collector';

const engine = new RulesEngineService({} as never);

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

describe('RulesEngineService — Governance', () => {
  it('GOV-001: dispara para package com mais de 10 escopos', () => {
    const data: GovernanceData = {
      businessUnits: [],
      users: [],
      packages: [
        {
          ID: 'pkg-1',
          Name: 'BigPackage',
          Scopes: {
            Scope: Array.from({ length: 12 }, (_, i) => ({ Name: `scope${i}` })),
          },
        },
      ],
    };
    const findings = engine.evaluate(ScanDomain.GOVERNANCE, data);
    expect(findings.some((f) => f.ruleId === 'GOV-001')).toBe(true);
  });

  it('GOV-001: não dispara com <= 10 escopos', () => {
    const data: GovernanceData = {
      businessUnits: [],
      users: [],
      packages: [
        {
          ID: 'pkg-1',
          Name: 'Small',
          Scopes: { Scope: [{ Name: 'a' }, { Name: 'b' }] },
        },
      ],
    };
    const findings = engine.evaluate(ScanDomain.GOVERNANCE, data);
    expect(findings.some((f) => f.ruleId === 'GOV-001')).toBe(false);
  });

  it('GOV-002: dispara quando admins > 20%', () => {
    const data: GovernanceData = {
      businessUnits: [],
      users: [
        { ID: '1', IsActive: 'true', Roles: { Role: { Name: 'Administrator' } } },
        { ID: '2', IsActive: 'true', Roles: { Role: { Name: 'Administrator' } } },
        { ID: '3', IsActive: 'true', Roles: { Role: { Name: 'Marketing' } } },
        { ID: '4', IsActive: 'true', Roles: { Role: { Name: 'Marketing' } } },
      ],
      packages: [],
    };
    const findings = engine.evaluate(ScanDomain.GOVERNANCE, data);
    expect(findings.some((f) => f.ruleId === 'GOV-002')).toBe(true);
  });

  it('GOV-002: não dispara quando admins <= 20%', () => {
    const users = Array.from({ length: 10 }, (_, i) => ({
      ID: String(i),
      IsActive: 'true',
      Roles: { Role: { Name: i === 0 ? 'Admin' : 'Marketing' } },
    }));
    const findings = engine.evaluate(ScanDomain.GOVERNANCE, {
      businessUnits: [],
      users,
      packages: [],
    });
    expect(findings.some((f) => f.ruleId === 'GOV-002')).toBe(false);
  });

  it('GOV-003: dispara para package sem escopos', () => {
    const data: GovernanceData = {
      businessUnits: [],
      users: [],
      packages: [{ ID: 'p', Name: 'Ghost', Scopes: undefined }],
    };
    const findings = engine.evaluate(ScanDomain.GOVERNANCE, data);
    expect(findings.some((f) => f.ruleId === 'GOV-003')).toBe(true);
  });

  it('GOV-004: dispara quando há BUs mas nenhum user ativo', () => {
    const data: GovernanceData = {
      businessUnits: [{ ID: '1', Name: 'BU1' }],
      users: [{ ID: '1', IsActive: 'false' }],
      packages: [],
    };
    const findings = engine.evaluate(ScanDomain.GOVERNANCE, data);
    expect(findings.some((f) => f.ruleId === 'GOV-004')).toBe(true);
  });
});

describe('RulesEngineService — Data', () => {
  const base = (overrides: Partial<CollectedDataExtension>): CollectedDataExtension => ({
    id: 'x',
    sfmcId: 'x',
    name: 'DE_Test',
    customerKey: 'DE_Test',
    retentionPeriod: 30,
    hasPrimaryKey: true,
    fieldCount: 5,
    ...overrides,
  });

  it('DATA-001: dispara quando retentionPeriod é null', () => {
    const findings = engine.evaluate(ScanDomain.DATA, [base({ retentionPeriod: null })]);
    expect(findings.some((f) => f.ruleId === 'DATA-001')).toBe(true);
  });

  it('DATA-001: não dispara com retention definida', () => {
    const findings = engine.evaluate(ScanDomain.DATA, [base({ retentionPeriod: 90 })]);
    expect(findings.some((f) => f.ruleId === 'DATA-001')).toBe(false);
  });

  it('DATA-002: dispara quando não há primary key', () => {
    const findings = engine.evaluate(ScanDomain.DATA, [
      base({ hasPrimaryKey: false, fieldCount: 3 }),
    ]);
    expect(findings.some((f) => f.ruleId === 'DATA-002')).toBe(true);
  });

  it('DATA-003: dispara quando nome não segue prefixo', () => {
    const findings = engine.evaluate(ScanDomain.DATA, [base({ name: 'randomname' })]);
    expect(findings.some((f) => f.ruleId === 'DATA-003')).toBe(true);
  });

  it('DATA-003: não dispara com nome bem formado', () => {
    const findings = engine.evaluate(ScanDomain.DATA, [base({ name: 'STG_Contacts' })]);
    expect(findings.some((f) => f.ruleId === 'DATA-003')).toBe(false);
  });

  it('DATA-004: dispara para DEs similares', () => {
    const findings = engine.evaluate(ScanDomain.DATA, [
      base({ sfmcId: '1', name: 'DE_Contacts' }),
      base({ sfmcId: '2', name: 'DE-Contacts' }),
    ]);
    expect(findings.some((f) => f.ruleId === 'DATA-004')).toBe(true);
  });

  it('DATA-005: dispara para DE com > 50 campos', () => {
    const findings = engine.evaluate(ScanDomain.DATA, [base({ fieldCount: 60 })]);
    expect(findings.some((f) => f.ruleId === 'DATA-005')).toBe(true);
  });

  it('DATA-005: não dispara com <= 50 campos', () => {
    const findings = engine.evaluate(ScanDomain.DATA, [base({ fieldCount: 40 })]);
    expect(findings.some((f) => f.ruleId === 'DATA-005')).toBe(false);
  });
});

describe('RulesEngineService — Journey', () => {
  const base = (overrides: Partial<CollectedJourney>): CollectedJourney => ({
    id: 'j',
    name: 'Test Journey',
    status: 'Published',
    modifiedDate: daysAgo(10),
    lastPublishedAt: daysAgo(5),
    ...overrides,
  });

  it('JRN-001: dispara para journey ativa > 180 dias sem modificação', () => {
    const findings = engine.evaluate(ScanDomain.JOURNEY, [
      base({ status: 'Published', modifiedDate: daysAgo(200) }),
    ]);
    expect(findings.some((f) => f.ruleId === 'JRN-001')).toBe(true);
  });

  it('JRN-001: não dispara para journey recente', () => {
    const findings = engine.evaluate(ScanDomain.JOURNEY, [
      base({ status: 'Published', modifiedDate: daysAgo(30) }),
    ]);
    expect(findings.some((f) => f.ruleId === 'JRN-001')).toBe(false);
  });

  it('JRN-002: dispara para journey pausada > 30 dias', () => {
    const findings = engine.evaluate(ScanDomain.JOURNEY, [
      base({ status: 'Stopped', modifiedDate: daysAgo(60) }),
    ]);
    expect(findings.some((f) => f.ruleId === 'JRN-002')).toBe(true);
  });

  it('JRN-003: dispara para draft nunca publicada', () => {
    const findings = engine.evaluate(ScanDomain.JOURNEY, [
      base({ status: 'Draft', lastPublishedAt: null }),
    ]);
    expect(findings.some((f) => f.ruleId === 'JRN-003')).toBe(true);
  });

  it('JRN-003: não dispara para draft já publicada anteriormente', () => {
    const findings = engine.evaluate(ScanDomain.JOURNEY, [
      base({ status: 'Draft', lastPublishedAt: daysAgo(10) }),
    ]);
    expect(findings.some((f) => f.ruleId === 'JRN-003')).toBe(false);
  });
});

describe('RulesEngineService — Automation', () => {
  const base = (overrides: Partial<CollectedAutomation>): CollectedAutomation => ({
    id: 'a',
    name: 'Nightly Job',
    status: 'Ready',
    lastRunStatus: 'Complete',
    lastRunTime: daysAgo(1),
    hasSchedule: true,
    description: 'Processa dados de vendas',
    ...overrides,
  });

  it('AUT-001: dispara quando última execução falhou', () => {
    const findings = engine.evaluate(ScanDomain.AUTOMATION, [
      base({ lastRunStatus: 'Error' }),
    ]);
    expect(findings.some((f) => f.ruleId === 'AUT-001')).toBe(true);
  });

  it('AUT-001: não dispara quando última execução foi OK', () => {
    const findings = engine.evaluate(ScanDomain.AUTOMATION, [
      base({ lastRunStatus: 'Complete' }),
    ]);
    expect(findings.some((f) => f.ruleId === 'AUT-001')).toBe(false);
  });

  it('AUT-002: dispara sem schedule e ativa', () => {
    const findings = engine.evaluate(ScanDomain.AUTOMATION, [
      base({ hasSchedule: false, status: 'Ready' }),
    ]);
    expect(findings.some((f) => f.ruleId === 'AUT-002')).toBe(true);
  });

  it('AUT-003: dispara sem descrição', () => {
    const findings = engine.evaluate(ScanDomain.AUTOMATION, [base({ description: null })]);
    expect(findings.some((f) => f.ruleId === 'AUT-003')).toBe(true);
  });

  it('AUT-004: dispara sem execução há > 60 dias', () => {
    const findings = engine.evaluate(ScanDomain.AUTOMATION, [
      base({ lastRunTime: daysAgo(80) }),
    ]);
    expect(findings.some((f) => f.ruleId === 'AUT-004')).toBe(true);
  });

  it('AUT-004: não dispara com execução recente', () => {
    const findings = engine.evaluate(ScanDomain.AUTOMATION, [
      base({ lastRunTime: daysAgo(10) }),
    ]);
    expect(findings.some((f) => f.ruleId === 'AUT-004')).toBe(false);
  });
});
