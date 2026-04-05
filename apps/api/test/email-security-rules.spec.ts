import { ScanDomain } from '@prisma/client';
import { RulesEngineService } from '../src/modules/rules-engine/rules-engine.service';
import { CollectedEmailAssets } from '../src/modules/collectors/email.collector';
import { SecurityData } from '../src/modules/collectors/security.collector';

const engine = new RulesEngineService({} as never);

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function emptyEmail(): CollectedEmailAssets {
  return {
    sendClassifications: [],
    sendDefinitions: [],
    deliveryProfiles: [],
    triggeredSends: [],
  };
}

describe('RulesEngineService — Email', () => {
  it('EML-001: dispara para triggered send sem atividade > 90 dias', () => {
    const data = emptyEmail();
    data.triggeredSends.push({
      id: '1',
      sfmcId: 't1',
      name: 'Welcome',
      status: 'Active',
      lastActivity: daysAgo(120),
    });
    const findings = engine.evaluate(ScanDomain.EMAIL, data);
    expect(findings.some((f) => f.ruleId === 'EML-001')).toBe(true);
  });

  it('EML-001: não dispara para triggered send recente', () => {
    const data = emptyEmail();
    data.triggeredSends.push({
      id: '1',
      sfmcId: 't1',
      name: 'Welcome',
      status: 'Active',
      lastActivity: daysAgo(30),
    });
    const findings = engine.evaluate(ScanDomain.EMAIL, data);
    expect(findings.some((f) => f.ruleId === 'EML-001')).toBe(false);
  });

  it('EML-002: dispara para send classification sem delivery profile', () => {
    const data = emptyEmail();
    data.sendClassifications.push({
      id: '1',
      sfmcId: 'sc1',
      name: 'Default',
      hasDeliveryProfile: false,
    });
    const findings = engine.evaluate(ScanDomain.EMAIL, data);
    expect(findings.some((f) => f.ruleId === 'EML-002')).toBe(true);
  });

  it('EML-002: não dispara quando há delivery profile', () => {
    const data = emptyEmail();
    data.sendClassifications.push({
      id: '1',
      sfmcId: 'sc1',
      name: 'Default',
      hasDeliveryProfile: true,
    });
    const findings = engine.evaluate(ScanDomain.EMAIL, data);
    expect(findings.some((f) => f.ruleId === 'EML-002')).toBe(false);
  });

  it('EML-003: dispara quando send definition está incompleta', () => {
    const data = emptyEmail();
    data.sendDefinitions.push({
      id: '1',
      sfmcId: 'sd1',
      name: 'Newsletter',
      hasClassification: false,
      hasDeliveryProfile: true,
      hasEmail: true,
      isActive: true,
    });
    const findings = engine.evaluate(ScanDomain.EMAIL, data);
    expect(findings.some((f) => f.ruleId === 'EML-003')).toBe(true);
  });

  it('EML-003: não dispara quando send definition está completa', () => {
    const data = emptyEmail();
    data.sendDefinitions.push({
      id: '1',
      sfmcId: 'sd1',
      name: 'Newsletter',
      hasClassification: true,
      hasDeliveryProfile: true,
      hasEmail: true,
      isActive: true,
    });
    const findings = engine.evaluate(ScanDomain.EMAIL, data);
    expect(findings.some((f) => f.ruleId === 'EML-003')).toBe(false);
  });
});

describe('RulesEngineService — Security', () => {
  const baseData = (): SecurityData => ({
    packages: [],
    connectionCreatedAt: daysAgo(30),
  });

  it('SEC-001: dispara quando package concentra escopos de escrita', () => {
    const data = baseData();
    data.packages.push({
      sfmcId: 'p1',
      name: 'BadPkg',
      createdDate: daysAgo(10),
      modifiedDate: daysAgo(10),
      scopes: [
        { name: 'data_extensions_write', category: null },
        { name: 'data_extensions_create', category: null },
        { name: 'data_extensions_delete', category: null },
        { name: 'data_extensions_read', category: null },
      ],
    });
    const findings = engine.evaluate(ScanDomain.SECURITY, data);
    expect(findings.some((f) => f.ruleId === 'SEC-001')).toBe(true);
  });

  it('SEC-001: não dispara quando package é majoritariamente leitura', () => {
    const data = baseData();
    data.packages.push({
      sfmcId: 'p1',
      name: 'ReadOnlyPkg',
      createdDate: daysAgo(10),
      modifiedDate: daysAgo(10),
      scopes: [
        { name: 'data_extensions_read', category: null },
        { name: 'journeys_read', category: null },
        { name: 'email_read', category: null },
      ],
    });
    const findings = engine.evaluate(ScanDomain.SECURITY, data);
    expect(findings.some((f) => f.ruleId === 'SEC-001')).toBe(false);
  });

  it('SEC-002: dispara para package com modificação > 365 dias', () => {
    const data = baseData();
    data.packages.push({
      sfmcId: 'p1',
      name: 'OldPkg',
      createdDate: daysAgo(400),
      modifiedDate: daysAgo(400),
      scopes: [{ name: 'data_extensions_read', category: null }],
    });
    const findings = engine.evaluate(ScanDomain.SECURITY, data);
    expect(findings.some((f) => f.ruleId === 'SEC-002')).toBe(true);
  });

  it('SEC-002: não dispara para package recente', () => {
    const data = baseData();
    data.packages.push({
      sfmcId: 'p1',
      name: 'NewPkg',
      createdDate: daysAgo(30),
      modifiedDate: daysAgo(30),
      scopes: [],
    });
    const findings = engine.evaluate(ScanDomain.SECURITY, data);
    expect(findings.some((f) => f.ruleId === 'SEC-002')).toBe(false);
  });

  it('SEC-002: fallback com conexão antiga sem packages', () => {
    const data: SecurityData = {
      packages: [],
      connectionCreatedAt: daysAgo(500),
    };
    const findings = engine.evaluate(ScanDomain.SECURITY, data);
    expect(findings.some((f) => f.ruleId === 'SEC-002')).toBe(true);
  });

  it('SEC-003: dispara para package com data + journey + admin', () => {
    const data = baseData();
    data.packages.push({
      sfmcId: 'p1',
      name: 'GodPkg',
      createdDate: daysAgo(10),
      modifiedDate: daysAgo(10),
      scopes: [
        { name: 'data_extensions_read', category: null },
        { name: 'journeys_read', category: null },
        { name: 'accounts_read', category: null },
      ],
    });
    const findings = engine.evaluate(ScanDomain.SECURITY, data);
    expect(findings.some((f) => f.ruleId === 'SEC-003')).toBe(true);
  });

  it('SEC-003: não dispara sem a tríade', () => {
    const data = baseData();
    data.packages.push({
      sfmcId: 'p1',
      name: 'ScopedPkg',
      createdDate: daysAgo(10),
      modifiedDate: daysAgo(10),
      scopes: [
        { name: 'data_extensions_read', category: null },
        { name: 'journeys_read', category: null },
      ],
    });
    const findings = engine.evaluate(ScanDomain.SECURITY, data);
    expect(findings.some((f) => f.ruleId === 'SEC-003')).toBe(false);
  });
});
