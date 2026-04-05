import { AiReport, Finding, HealthScore, ScanRun, SfmcConnection, Tenant } from '@prisma/client';

export interface ReportPayload {
  scan: ScanRun;
  connection: SfmcConnection;
  tenant: Tenant;
  score: HealthScore;
  findings: Finding[];
  aiReport: AiReport | null;
}

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: '#dc2626',
  HIGH: '#ea580c',
  MEDIUM: '#ca8a04',
  LOW: '#2563eb',
  INFO: '#6b7280',
};

const CATEGORY_LABEL: Record<string, string> = {
  GOVERNANCE: 'Governança',
  DATA: 'Dados',
  JOURNEY: 'Jornadas',
  AUTOMATION: 'Automações',
  EMAIL: 'Email',
  SECURITY: 'Segurança',
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderExecutivePdf(p: ReportPayload): string {
  const classif = p.score.classification;
  const summary = p.aiReport?.executiveSummary ?? 'Relatório executivo ainda não gerado pela IA.';
  const topFindings = [...p.findings].sort((a, b) => b.priority - a.priority).slice(0, 10);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>MC Pulse — Relatório Executivo</title>
<style>
  @page { size: A4; margin: 2cm; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: #111827; line-height: 1.5; }
  .cover { height: 90vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; page-break-after: always; }
  .cover h1 { font-size: 48px; margin: 0 0 8px; color: #1e40af; }
  .cover .tenant { font-size: 24px; color: #4b5563; margin-bottom: 32px; }
  .cover .score { font-size: 120px; font-weight: bold; color: #1e40af; line-height: 1; }
  .cover .classification { font-size: 28px; color: #6b7280; margin-top: 8px; }
  .cover .date { position: absolute; bottom: 2cm; font-size: 14px; color: #9ca3af; }
  h2 { color: #1e40af; font-size: 22px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-top: 32px; }
  h3 { color: #374151; font-size: 16px; margin-top: 20px; }
  .domain-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 16px 0; }
  .domain-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
  .domain-card .label { font-size: 12px; color: #6b7280; text-transform: uppercase; }
  .domain-card .value { font-size: 28px; font-weight: bold; color: #111827; }
  .finding { border-left: 4px solid; padding: 12px 16px; margin: 12px 0; background: #f9fafb; border-radius: 0 8px 8px 0; }
  .finding .meta { font-size: 11px; color: #6b7280; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  .finding .object { font-weight: 600; font-size: 14px; margin-bottom: 4px; }
  .finding .evidence { font-size: 13px; color: #4b5563; }
  .finding .rec { font-size: 12px; color: #1e40af; margin-top: 6px; font-style: italic; }
  .executive-summary { font-size: 14px; line-height: 1.7; color: #374151; }
  .executive-summary p { margin: 0 0 12px; }
  footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
</style>
</head>
<body>

<div class="cover">
  <h1>MC Pulse</h1>
  <div class="tenant">${escapeHtml(p.connection.name)}</div>
  <div class="score">${p.score.scoreOverall.toFixed(0)}</div>
  <div class="classification">${escapeHtml(classif)}</div>
  <div class="date">${new Date(p.scan.createdAt).toLocaleString('pt-BR')}</div>
</div>

<h2>Resumo Executivo</h2>
<div class="executive-summary">
  ${summary
    .split('\n\n')
    .map((para) => `<p>${escapeHtml(para)}</p>`)
    .join('')}
</div>

<h2>Score por Domínio</h2>
<div class="domain-grid">
  ${[
    ['Governança', p.score.scoreGovernance],
    ['Dados', p.score.scoreData],
    ['Jornadas', p.score.scoreJourney],
    ['Automações', p.score.scoreAutomation],
    ['Email', p.score.scoreEmail],
    ['Segurança', p.score.scoreSecurity],
  ]
    .map(
      ([label, value]) => `
    <div class="domain-card">
      <div class="label">${label}</div>
      <div class="value">${value !== null && value !== undefined ? Number(value).toFixed(0) : '—'}</div>
    </div>`,
    )
    .join('')}
</div>

<h2>Top 10 Findings Críticos</h2>
${topFindings
  .map(
    (f) => `
  <div class="finding" style="border-left-color: ${SEVERITY_COLOR[f.severity]}">
    <div class="meta">${f.ruleId} · ${CATEGORY_LABEL[f.category]} · ${f.severity}</div>
    <div class="object">${escapeHtml(f.objectName ?? f.objectType)}</div>
    <div class="evidence">${escapeHtml(f.evidence)}</div>
    <div class="rec">→ ${escapeHtml(f.recommendation)}</div>
  </div>`,
  )
  .join('')}

<footer>
  Gerado por MC Pulse em ${new Date().toLocaleString('pt-BR')} · Relatório confidencial
</footer>

</body>
</html>`;
}

export function renderTechnicalPdf(p: ReportPayload): string {
  const groups = new Map<string, Finding[]>();
  for (const f of p.findings) {
    const list = groups.get(f.category) ?? [];
    list.push(f);
    groups.set(f.category, list);
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>MC Pulse — Relatório Técnico</title>
<style>
  @page { size: A4; margin: 2cm; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: #111827; line-height: 1.5; font-size: 12px; }
  h1 { color: #1e40af; font-size: 28px; }
  h2 { color: #1e40af; font-size: 18px; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; margin-top: 28px; }
  .finding { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 14px; margin: 8px 0; page-break-inside: avoid; }
  .finding .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .finding .rule-id { font-family: monospace; font-size: 11px; color: #6b7280; }
  .finding .severity { font-size: 10px; font-weight: bold; padding: 2px 8px; border-radius: 10px; color: white; }
  .finding .obj { font-weight: 600; margin-bottom: 4px; }
  .finding dl { margin: 8px 0 0; font-size: 11px; }
  .finding dt { font-weight: 600; color: #374151; margin-top: 6px; }
  .finding dd { margin: 2px 0 0 0; color: #4b5563; }
  .tech-analysis { font-size: 12px; color: #374151; white-space: pre-wrap; }
</style>
</head>
<body>

<h1>MC Pulse — Relatório Técnico</h1>
<p><strong>${escapeHtml(p.connection.name)}</strong> · ${new Date(p.scan.createdAt).toLocaleString('pt-BR')}</p>

${
  p.aiReport?.technicalAnalysis
    ? `<h2>Análise Técnica (IA)</h2><div class="tech-analysis">${escapeHtml(p.aiReport.technicalAnalysis)}</div>`
    : ''
}

${Array.from(groups.entries())
  .map(
    ([category, findings]) => `
<h2>${CATEGORY_LABEL[category]} (${findings.length})</h2>
${findings
  .sort((a, b) => b.priority - a.priority)
  .map(
    (f) => `
  <div class="finding">
    <div class="header">
      <span class="rule-id">${f.ruleId}</span>
      <span class="severity" style="background: ${SEVERITY_COLOR[f.severity]}">${f.severity}</span>
    </div>
    <div class="obj">${escapeHtml(f.objectName ?? f.objectType)}</div>
    <dl>
      <dt>Evidência</dt><dd>${escapeHtml(f.evidence)}</dd>
      <dt>Regra</dt><dd>${escapeHtml(f.ruleViolated)}</dd>
      <dt>Impacto</dt><dd>${escapeHtml(f.impact)}</dd>
      <dt>Recomendação</dt><dd>${escapeHtml(f.recommendation)}</dd>
      <dt>Esforço</dt><dd>${f.effort}</dd>
    </dl>
  </div>`,
  )
  .join('')}
`,
  )
  .join('')}

</body>
</html>`;
}
