import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { DomainStatus, ScanDomain, ScanStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../common/redis/redis.provider';
import {
  ACTIVE_DOMAINS,
  SCANNER_QUEUE,
  SCAN_PROGRESS_CHANNEL,
  ScanJobData,
} from './scanner.constants';
import { HealthScoreService } from '../health-score/health-score.service';
import { AI_REPORT_QUEUE, AiReportJobData } from '../ai-report/ai-report.constants';

export interface ProgressEvent {
  scanRunId: string;
  domain?: ScanDomain;
  status: string;
  itemsCollected?: number;
  error?: string;
  overallScore?: number;
}

@Injectable()
export class ScannerService {
  private readonly logger = new Logger(ScannerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(SCANNER_QUEUE) private readonly queue: Queue<ScanJobData>,
    @InjectQueue(AI_REPORT_QUEUE) private readonly aiReportQueue: Queue<AiReportJobData>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly healthScore: HealthScoreService,
  ) {}

  async startScan(tenantId: string, connectionId: string): Promise<{ scanRunId: string }> {
    const connection = await this.prisma.sfmcConnection.findUnique({
      where: { id: connectionId },
    });
    if (!connection) throw new NotFoundException('Conexão não encontrada');
    if (connection.tenantId !== tenantId) throw new ForbiddenException('Acesso negado');

    const scanRun = await this.prisma.scanRun.create({
      data: {
        tenantId,
        connectionId,
        status: ScanStatus.PENDING,
        domainScans: {
          create: ACTIVE_DOMAINS.map((domain) => ({
            domain,
            status: DomainStatus.PENDING,
          })),
        },
      },
    });

    // Enfileira um job por domínio
    await Promise.all(
      ACTIVE_DOMAINS.map((domain) =>
        this.queue.add(
          `scan-${domain.toLowerCase()}`,
          { scanRunId: scanRun.id, tenantId, connectionId, domain },
          {
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
            removeOnComplete: 100,
            removeOnFail: 50,
          },
        ),
      ),
    );

    await this.prisma.scanRun.update({
      where: { id: scanRun.id },
      data: { status: ScanStatus.RUNNING, startedAt: new Date() },
    });

    return { scanRunId: scanRun.id };
  }

  async list(tenantId: string): Promise<unknown[]> {
    return this.prisma.scanRun.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        healthScore: true,
        domainScans: true,
      },
    });
  }

  async findOne(tenantId: string, id: string): Promise<unknown> {
    const scan = await this.prisma.scanRun.findUnique({
      where: { id },
      include: { domainScans: true, healthScore: true },
    });
    if (!scan) throw new NotFoundException('Scan não encontrado');
    if (scan.tenantId !== tenantId) throw new ForbiddenException('Acesso negado');
    return scan;
  }

  /**
   * Publica um evento de progresso via Redis pub/sub para o SSE controller consumir.
   */
  async publishProgress(event: ProgressEvent): Promise<void> {
    await this.redis.publish(SCAN_PROGRESS_CHANNEL(event.scanRunId), JSON.stringify(event));
  }

  /**
   * Chamado por cada job ao final. Verifica se todos os domínios concluíram
   * e, se sim, calcula o health score final.
   */
  async checkAndFinalize(scanRunId: string): Promise<void> {
    const scan = await this.prisma.scanRun.findUnique({
      where: { id: scanRunId },
      include: { domainScans: true },
    });
    if (!scan) return;

    const finalStatuses: DomainStatus[] = [
      DomainStatus.COMPLETED,
      DomainStatus.FAILED,
      DomainStatus.SKIPPED,
    ];
    const allFinished = scan.domainScans.every((d) => finalStatuses.includes(d.status));
    if (!allFinished) return;

    const anyFailed = scan.domainScans.some((d) => d.status === DomainStatus.FAILED);
    const allFailed = scan.domainScans.every((d) => d.status === DomainStatus.FAILED);

    const result = await this.healthScore.computeAndPersist(scanRunId);

    await this.prisma.scanRun.update({
      where: { id: scanRunId },
      data: {
        status: allFailed ? ScanStatus.FAILED : anyFailed ? ScanStatus.PARTIAL : ScanStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    // Enfileira geração de AI report se houver ao menos um domínio concluído
    if (!allFailed) {
      await this.aiReportQueue.add(
        'ai-report',
        { scanRunId, tenantId: scan.tenantId },
        {
          attempts: 2,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      );
    }

    await this.publishProgress({
      scanRunId,
      status: 'finalized',
      overallScore: result.scoreOverall,
    });
    this.logger.log(`Scan ${scanRunId} finalizado com score ${result.scoreOverall}`);
  }
}
