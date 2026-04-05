import { HistoryService } from '../src/modules/history/history.service';

describe('HistoryService.compare', () => {
  function makeService(scanA: unknown, scanB: unknown): HistoryService {
    const prismaMock = {
      scanRun: {
        findUnique: jest.fn(({ where }: { where: { id: string } }) =>
          Promise.resolve(where.id === 'a' ? scanA : scanB),
        ),
      },
    };
    return new HistoryService(prismaMock as never);
  }

  const baseScore = {
    scoreGovernance: 90,
    scoreData: 80,
    scoreJourney: 70,
    scoreAutomation: 60,
    scoreEmail: 85,
    scoreSecurity: 95,
  };

  it('calcula delta e findings novos/resolvidos', async () => {
    const scanA = {
      id: 'a',
      tenantId: 't1',
      createdAt: new Date('2026-01-01'),
      healthScore: { scoreOverall: 80, ...baseScore },
      findings: [
        { ruleId: 'DATA-001', objectId: '1', objectType: 'DE', objectName: 'DE1', severity: 'HIGH' },
        { ruleId: 'DATA-002', objectId: '2', objectType: 'DE', objectName: 'DE2', severity: 'HIGH' },
      ],
    };
    const scanB = {
      id: 'b',
      tenantId: 't1',
      createdAt: new Date('2026-02-01'),
      healthScore: { scoreOverall: 85, ...baseScore, scoreData: 90 },
      findings: [
        { ruleId: 'DATA-001', objectId: '1', objectType: 'DE', objectName: 'DE1', severity: 'HIGH' },
        { ruleId: 'DATA-003', objectId: '3', objectType: 'DE', objectName: 'DE3', severity: 'MEDIUM' },
      ],
    };
    const service = makeService(scanA, scanB);
    const cmp = await service.compare('t1', 'a', 'b');

    expect(cmp.delta.overall).toBeCloseTo(5, 1);
    expect(cmp.delta.byDomain.data).toBeCloseTo(10, 1);
    expect(cmp.findingsDiff.new).toHaveLength(1);
    expect(cmp.findingsDiff.new[0].ruleId).toBe('DATA-003');
    expect(cmp.findingsDiff.resolved).toHaveLength(1);
    expect(cmp.findingsDiff.resolved[0].ruleId).toBe('DATA-002');
    expect(cmp.findingsDiff.persistent).toBe(1);
  });

  it('bloqueia acesso cross-tenant', async () => {
    const scanA = { id: 'a', tenantId: 'other', healthScore: {}, findings: [] };
    const scanB = { id: 'b', tenantId: 't1', healthScore: {}, findings: [] };
    const service = makeService(scanA, scanB);
    await expect(service.compare('t1', 'a', 'b')).rejects.toThrow(/Acesso negado/);
  });
});
