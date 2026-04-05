import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AiReportStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CLAUDE_MODEL, MAX_TOKENS_PER_OUTPUT } from './ai-report.constants';
import { ReportContext } from './prompts/report-context';
import { executiveSummaryPrompt } from './prompts/executive-summary.prompt';
import { technicalAnalysisPrompt } from './prompts/technical-analysis.prompt';
import { actionPlanPrompt } from './prompts/action-plan.prompt';

interface ActionPlanResponse {
  plan30: string;
  plan60: string;
  plan90: string;
  checklist: string;
}

@Injectable()
export class AiReportService {
  private readonly logger = new Logger(AiReportService.name);
  private client: Anthropic | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private getClient(): Anthropic {
    if (!this.client) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error('ANTHROPIC_API_KEY não configurada');
      this.client = new Anthropic({ apiKey });
    }
    return this.client;
  }

  async generate(scanRunId: string): Promise<void> {
    const scan = await this.prisma.scanRun.findUnique({
      where: { id: scanRunId },
      include: {
        tenant: true,
        connection: true,
        healthScore: true,
        findings: true,
      },
    });
    if (!scan) throw new NotFoundException('Scan não encontrado');
    if (!scan.healthScore) throw new Error('Health score ausente — scan não finalizado');

    await this.prisma.aiReport.upsert({
      where: { scanRunId },
      create: { scanRunId, status: AiReportStatus.GENERATING },
      update: { status: AiReportStatus.GENERATING, errorMessage: null },
    });

    const ctx: ReportContext = {
      tenantName: scan.tenant.name,
      connectionName: scan.connection.name,
      subdomain: scan.connection.subdomain,
      score: scan.healthScore,
      findings: scan.findings,
    };

    try {
      const [executive, technical, plan] = await Promise.all([
        this.runPrompt(executiveSummaryPrompt(ctx)),
        this.runPrompt(technicalAnalysisPrompt(ctx)),
        this.runPrompt(actionPlanPrompt(ctx)),
      ]);

      const parsedPlan = this.parseActionPlan(plan);

      await this.prisma.aiReport.update({
        where: { scanRunId },
        data: {
          status: AiReportStatus.COMPLETED,
          executiveSummary: executive,
          technicalAnalysis: technical,
          actionPlan30: parsedPlan.plan30,
          actionPlan60: parsedPlan.plan60,
          actionPlan90: parsedPlan.plan90,
          operationalChecklist: parsedPlan.checklist,
          generatedAt: new Date(),
        },
      });
      this.logger.log(`AI report gerado para scan=${scanRunId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      await this.prisma.aiReport.update({
        where: { scanRunId },
        data: { status: AiReportStatus.FAILED, errorMessage: message },
      });
      this.logger.error(`Falha ao gerar AI report scan=${scanRunId}: ${message}`);
      throw err;
    }
  }

  private async runPrompt(prompt: string): Promise<string> {
    const response = await this.getClient().messages.create({
      model: CLAUDE_MODEL,
      max_tokens: MAX_TOKENS_PER_OUTPUT,
      messages: [{ role: 'user', content: prompt }],
    });
    const block = response.content[0];
    if (!block || block.type !== 'text') {
      throw new Error('Resposta do Claude sem bloco de texto');
    }
    return block.text.trim();
  }

  parseActionPlan(raw: string): ActionPlanResponse {
    // Remove code fences se o modelo escorregar
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    try {
      const parsed = JSON.parse(cleaned) as Partial<ActionPlanResponse>;
      if (
        typeof parsed.plan30 !== 'string' ||
        typeof parsed.plan60 !== 'string' ||
        typeof parsed.plan90 !== 'string' ||
        typeof parsed.checklist !== 'string'
      ) {
        throw new Error('JSON com campos inválidos');
      }
      return parsed as ActionPlanResponse;
    } catch (err) {
      throw new Error(`Falha ao parsear action plan: ${(err as Error).message}`);
    }
  }

  async getReport(tenantId: string, scanRunId: string): Promise<unknown> {
    const scan = await this.prisma.scanRun.findUnique({ where: { id: scanRunId } });
    if (!scan) throw new NotFoundException('Scan não encontrado');
    if (scan.tenantId !== tenantId) throw new ForbiddenException('Acesso negado');
    const report = await this.prisma.aiReport.findUnique({ where: { scanRunId } });
    if (!report) throw new NotFoundException('Relatório ainda não disponível');
    return report;
  }
}
