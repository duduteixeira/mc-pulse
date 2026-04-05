import { ReportContext, serializeContext } from './report-context';

export function actionPlanPrompt(ctx: ReportContext): string {
  return `Você é um arquiteto de Salesforce Marketing Cloud produzindo um plano de ação 30/60/90 dias.

Com base nos findings do scan, agrupe as correções em três horizontes temporais e retorne um JSON estritamente válido com o seguinte formato:

{
  "plan30": "markdown do plano para os próximos 30 dias",
  "plan60": "markdown do plano para 31-60 dias",
  "plan90": "markdown do plano para 61-90 dias",
  "checklist": "markdown com checklist operacional concreto (ações específicas, responsável sugerido, esforço estimado)"
}

Critérios de priorização:
- 30 dias: tudo CRITICAL + HIGH que desbloqueia outras correções. Quick wins.
- 60 dias: HIGH restantes + MEDIUM com maior impacto. Refactors médios.
- 90 dias: MEDIUM restantes + LOW + trabalho estrutural.

Cada plano deve ser em markdown com sections (##) por tema, listas ordenadas de ações, e sempre citar o ruleId dos findings tratados entre colchetes, ex: [DATA-001].

Regras absolutas:
- Retorne APENAS o JSON, sem texto antes ou depois, sem fences \`\`\`.
- Todos os 4 campos devem existir e ser strings não vazias.
- Não invente findings — só use os que estão no contexto.

Contexto do scan (JSON):
${serializeContext(ctx)}`;
}
