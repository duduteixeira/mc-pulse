export const AI_REPORT_QUEUE = 'ai-report-queue';

export interface AiReportJobData {
  scanRunId: string;
  tenantId: string;
}

export const CLAUDE_MODEL = 'claude-sonnet-4-5';
export const MAX_TOKENS_PER_OUTPUT = 4000;
