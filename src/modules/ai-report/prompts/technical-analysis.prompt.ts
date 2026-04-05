import { ReportContext, serializeContext } from './report-context';

export function technicalAnalysisPrompt(ctx: ReportContext): string {
  return `Você é um arquiteto sênior de Salesforce Marketing Cloud escrevendo para outro arquiteto ou consultor técnico.

Produza uma ANÁLISE TÉCNICA detalhada em português, estruturada por domínio (Governança, Dados, Jornadas, Automações, Email, Segurança). Para cada domínio relevante:

1. Resumo do estado atual em 2-3 frases.
2. Padrões identificados nos findings (ex: "maioria das DEs sem primary key sugere ausência de padrão de modelagem").
3. Correlações entre findings (ex: "packages com escopos excessivos combinados com rotação tardia ampliam o risco").
4. Complexidade estimada de correção e dependências técnicas.

Use markdown com ### para cada domínio. Seja técnico — o leitor entende SFMC profundamente.

Regras absolutas:
- Não invente dados além do que está nos findings.
- Não repita mecanicamente a lista de findings — sintetize.
- Evite frases genéricas tipo "é importante revisar" — seja específico.

Contexto do scan (JSON):
${serializeContext(ctx)}`;
}
