import { AiReportService } from '../src/modules/ai-report/ai-report.service';

describe('AiReportService.parseActionPlan', () => {
  const service = new AiReportService({} as never);

  it('parseia JSON válido', () => {
    const raw = JSON.stringify({
      plan30: '## 30d',
      plan60: '## 60d',
      plan90: '## 90d',
      checklist: '- item',
    });
    const parsed = service.parseActionPlan(raw);
    expect(parsed.plan30).toBe('## 30d');
    expect(parsed.checklist).toBe('- item');
  });

  it('tolera code fences', () => {
    const raw = '```json\n{"plan30":"a","plan60":"b","plan90":"c","checklist":"d"}\n```';
    const parsed = service.parseActionPlan(raw);
    expect(parsed.plan30).toBe('a');
  });

  it('lança erro se campos faltarem', () => {
    const raw = JSON.stringify({ plan30: 'a', plan60: 'b' });
    expect(() => service.parseActionPlan(raw)).toThrow(/Falha ao parsear/);
  });

  it('lança erro em JSON inválido', () => {
    expect(() => service.parseActionPlan('not json')).toThrow(/Falha ao parsear/);
  });
});
