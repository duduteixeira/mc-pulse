import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface ScanCompletedNotification {
  scanRunId: string;
  tenantId: string;
  scoreOverall: number;
  classification: string;
}

/**
 * Serviço de notificações. Na Fase 2 registra apenas em log estruturado.
 * Plugar provider real (Resend, SES, Postmark) é trivial — trocar sendEmail().
 *
 * Gatilhos suportados:
 * - scan.completed: scan concluído
 * - score.deteriorated: queda de score >= DETERIORATION_THRESHOLD vs scan anterior
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly DETERIORATION_THRESHOLD = 10;

  constructor(private readonly prisma: PrismaService) {}

  async notifyScanCompleted(input: ScanCompletedNotification): Promise<void> {
    const users = await this.prisma.user.findMany({
      where: { tenantId: input.tenantId },
      select: { email: true, name: true },
    });
    const subject = `[MC Pulse] Scan concluído — Score ${input.scoreOverall.toFixed(1)} (${input.classification})`;
    for (const user of users) {
      await this.sendEmail(user.email, subject, this.renderScanCompletedBody(input, user.name));
    }

    await this.checkDeterioration(input);
  }

  private async checkDeterioration(input: ScanCompletedNotification): Promise<void> {
    const current = await this.prisma.scanRun.findUnique({
      where: { id: input.scanRunId },
      select: { connectionId: true, healthScore: true },
    });
    if (!current?.healthScore) return;

    const previous = await this.prisma.scanRun.findFirst({
      where: {
        connectionId: current.connectionId,
        id: { not: input.scanRunId },
        healthScore: { isNot: null },
      },
      orderBy: { createdAt: 'desc' },
      include: { healthScore: true },
    });
    if (!previous?.healthScore) return;

    const delta = current.healthScore.scoreOverall - previous.healthScore.scoreOverall;
    if (delta <= -this.DETERIORATION_THRESHOLD) {
      const users = await this.prisma.user.findMany({
        where: { tenantId: input.tenantId },
        select: { email: true, name: true },
      });
      const subject = `[MC Pulse] ⚠️ Queda de ${delta.toFixed(1)} pontos no health score`;
      for (const user of users) {
        await this.sendEmail(
          user.email,
          subject,
          `Olá ${user.name ?? ''},\n\nO score do último scan caiu ${Math.abs(delta).toFixed(1)} pontos em relação ao anterior. Acesse o MC Pulse para ver os novos findings.\n`,
        );
      }
    }
  }

  private renderScanCompletedBody(
    input: ScanCompletedNotification,
    name: string | null,
  ): string {
    return `Olá ${name ?? ''},

Um scan do seu ambiente Salesforce Marketing Cloud foi concluído.

Score geral: ${input.scoreOverall.toFixed(1)}/100
Classificação: ${input.classification}

Acesse o MC Pulse para ver os findings e o plano de ação gerado pela IA.
`;
  }

  /**
   * Stub — logs apenas. Para produção, substitua pelo SDK do provider.
   */
  private async sendEmail(to: string, subject: string, body: string): Promise<void> {
    this.logger.log(`[email stub] to=${to} subject="${subject}" bodyLen=${body.length}`);
  }
}
