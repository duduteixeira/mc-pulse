import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import puppeteer, { Browser } from 'puppeteer';
import { PrismaService } from '../../prisma/prisma.service';
import { renderExecutivePdf, renderTechnicalPdf, ReportPayload } from './report-template';

export type ReportType = 'executive' | 'technical';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private browser: Browser | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async generatePdf(
    tenantId: string,
    scanRunId: string,
    type: ReportType,
  ): Promise<Buffer> {
    const payload = await this.loadPayload(tenantId, scanRunId);
    const html = type === 'executive' ? renderExecutivePdf(payload) : renderTechnicalPdf(payload);

    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '1.5cm', bottom: '1.5cm', left: '1.5cm', right: '1.5cm' },
      });
      return Buffer.from(pdf);
    } finally {
      await page.close();
    }
  }

  private async loadPayload(tenantId: string, scanRunId: string): Promise<ReportPayload> {
    const scan = await this.prisma.scanRun.findUnique({
      where: { id: scanRunId },
      include: {
        tenant: true,
        connection: true,
        healthScore: true,
        findings: true,
        aiReport: true,
      },
    });
    if (!scan) throw new NotFoundException('Scan não encontrado');
    if (scan.tenantId !== tenantId) throw new ForbiddenException('Acesso negado');
    if (!scan.healthScore) throw new NotFoundException('Health score ausente');
    return {
      scan,
      connection: scan.connection,
      tenant: scan.tenant,
      score: scan.healthScore,
      findings: scan.findings,
      aiReport: scan.aiReport,
    };
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) return this.browser;
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    return this.browser;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
