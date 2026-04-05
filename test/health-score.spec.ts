import { HealthScoreService } from '../src/modules/health-score/health-score.service';
import { FindingCategory, Severity } from '@prisma/client';

describe('HealthScoreService', () => {
  const service = new HealthScoreService({} as never);

  it('retorna 100 quando não há findings', () => {
    const r = service.calculate([]);
    expect(r.scoreOverall).toBe(100);
    expect(r.classification).toBe('Saudável');
  });

  it('penaliza corretamente um finding crítico de governança', () => {
    const r = service.calculate([
      { category: FindingCategory.GOVERNANCE, severity: Severity.CRITICAL },
    ]);
    // GOVERNANCE: 100 - 20 = 80. Pesos: outros 5 * 100 + 80 * 0.2 = 96
    expect(r.scoreByDomain.GOVERNANCE).toBe(80);
    expect(r.scoreOverall).toBeCloseTo(96, 1);
    expect(r.classification).toBe('Saudável');
  });

  it('classifica como Atenção entre 75 e 91', () => {
    const findings = Array.from({ length: 4 }, () => ({
      category: FindingCategory.DATA,
      severity: Severity.HIGH,
    }));
    // DATA: 100 - 40 = 60. Overall = 5 * 100 * 0.15/0.2 + 60*0.2
    const r = service.calculate(findings);
    expect(r.scoreByDomain.DATA).toBe(60);
    expect(r.classification).toMatch(/Atenção|Saudável/);
  });

  it('não deixa score abaixo de 0', () => {
    const findings = Array.from({ length: 20 }, () => ({
      category: FindingCategory.AUTOMATION,
      severity: Severity.CRITICAL,
    }));
    const r = service.calculate(findings);
    expect(r.scoreByDomain.AUTOMATION).toBe(0);
  });

  it('conta findings por severidade corretamente', () => {
    const r = service.calculate([
      { category: FindingCategory.DATA, severity: Severity.CRITICAL },
      { category: FindingCategory.DATA, severity: Severity.HIGH },
      { category: FindingCategory.DATA, severity: Severity.MEDIUM },
      { category: FindingCategory.DATA, severity: Severity.LOW },
      { category: FindingCategory.DATA, severity: Severity.LOW },
    ]);
    expect(r.counts).toEqual({ total: 5, critical: 1, high: 1, medium: 1, low: 2 });
  });

  it('classifica como Crítico quando score < 50', () => {
    const categories: FindingCategory[] = [
      FindingCategory.GOVERNANCE,
      FindingCategory.DATA,
      FindingCategory.JOURNEY,
      FindingCategory.AUTOMATION,
      FindingCategory.EMAIL,
      FindingCategory.SECURITY,
    ];
    const findings: Array<{ category: FindingCategory; severity: Severity }> = [];
    for (const c of categories) {
      for (let i = 0; i < 5; i += 1) {
        findings.push({ category: c, severity: Severity.CRITICAL });
      }
    }
    const r = service.calculate(findings);
    expect(r.scoreOverall).toBe(0);
    expect(r.classification).toBe('Crítico');
  });
});
