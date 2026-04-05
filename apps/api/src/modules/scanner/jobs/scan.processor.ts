import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DomainStatus, ScanDomain } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ScannerService } from '../scanner.service';
import { SCANNER_QUEUE, ScanJobData } from '../scanner.constants';
import { RulesEngineService } from '../../rules-engine/rules-engine.service';
import { GovernanceCollector } from '../../collectors/governance.collector';
import { DataCollector } from '../../collectors/data.collector';
import { JourneyCollector } from '../../collectors/journey.collector';
import { AutomationCollector } from '../../collectors/automation.collector';
import { EmailCollector } from '../../collectors/email.collector';
import { SecurityCollector } from '../../collectors/security.collector';

/**
 * Processor único que despacha por domínio.
 * Concorrência 2 = máximo 2 jobs simultâneos por worker (escalável horizontalmente).
 */
@Processor(SCANNER_QUEUE, { concurrency: 2 })
export class ScanProcessor extends WorkerHost {
  private readonly logger = new Logger(ScanProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scanner: ScannerService,
    private readonly rules: RulesEngineService,
    private readonly governance: GovernanceCollector,
    private readonly dataCollector: DataCollector,
    private readonly journey: JourneyCollector,
    private readonly automation: AutomationCollector,
    private readonly email: EmailCollector,
    private readonly security: SecurityCollector,
  ) {
    super();
  }

  async process(job: Job<ScanJobData>): Promise<void> {
    const { scanRunId, connectionId, domain } = job.data;
    this.logger.log(`▶️  Iniciando job ${domain} scan=${scanRunId}`);

    await this.updateDomainStatus(scanRunId, domain, DomainStatus.RUNNING, { startedAt: new Date() });
    await this.scanner.publishProgress({ scanRunId, domain, status: 'running' });

    try {
      const { itemsCollected } = await this.runDomain(domain, connectionId, scanRunId);

      await this.updateDomainStatus(scanRunId, domain, DomainStatus.COMPLETED, {
        completedAt: new Date(),
        itemsCollected,
      });
      await this.scanner.publishProgress({
        scanRunId,
        domain,
        status: 'completed',
        itemsCollected,
      });
      this.logger.log(`✅ ${domain} concluído (${itemsCollected} itens) scan=${scanRunId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      await this.updateDomainStatus(scanRunId, domain, DomainStatus.FAILED, {
        completedAt: new Date(),
        errorMessage: message,
      });
      await this.scanner.publishProgress({
        scanRunId,
        domain,
        status: 'failed',
        error: message,
      });
      this.logger.error(`❌ ${domain} falhou scan=${scanRunId}: ${message}`);
      throw err;
    } finally {
      await this.scanner.checkAndFinalize(scanRunId);
    }
  }

  private async runDomain(
    domain: ScanDomain,
    connectionId: string,
    scanRunId: string,
  ): Promise<{ itemsCollected: number }> {
    switch (domain) {
      case ScanDomain.GOVERNANCE: {
        const data = await this.governance.collect(connectionId, scanRunId);
        const findings = this.rules.evaluate(ScanDomain.GOVERNANCE, data);
        await this.rules.persist(scanRunId, findings);
        return {
          itemsCollected: data.businessUnits.length + data.users.length + data.packages.length,
        };
      }
      case ScanDomain.DATA: {
        const data = await this.dataCollector.collect(connectionId, scanRunId);
        const findings = this.rules.evaluate(ScanDomain.DATA, data);
        await this.rules.persist(scanRunId, findings);
        return { itemsCollected: data.length };
      }
      case ScanDomain.JOURNEY: {
        const data = await this.journey.collect(connectionId, scanRunId);
        const findings = this.rules.evaluate(ScanDomain.JOURNEY, data);
        await this.rules.persist(scanRunId, findings);
        return { itemsCollected: data.length };
      }
      case ScanDomain.AUTOMATION: {
        const data = await this.automation.collect(connectionId, scanRunId);
        const findings = this.rules.evaluate(ScanDomain.AUTOMATION, data);
        await this.rules.persist(scanRunId, findings);
        return { itemsCollected: data.length };
      }
      case ScanDomain.EMAIL: {
        const data = await this.email.collect(connectionId, scanRunId);
        const findings = this.rules.evaluate(ScanDomain.EMAIL, data);
        await this.rules.persist(scanRunId, findings);
        return {
          itemsCollected:
            data.sendClassifications.length +
            data.sendDefinitions.length +
            data.deliveryProfiles.length +
            data.triggeredSends.length,
        };
      }
      case ScanDomain.SECURITY: {
        const data = await this.security.collect(connectionId, scanRunId);
        const findings = this.rules.evaluate(ScanDomain.SECURITY, data);
        await this.rules.persist(scanRunId, findings);
        return { itemsCollected: data.packages.length };
      }
      default:
        throw new Error(`Domínio ${domain} não implementado`);
    }
  }

  private async updateDomainStatus(
    scanRunId: string,
    domain: ScanDomain,
    status: DomainStatus,
    extra: { startedAt?: Date; completedAt?: Date; errorMessage?: string; itemsCollected?: number } = {},
  ): Promise<void> {
    await this.prisma.domainScan.update({
      where: { scanRunId_domain: { scanRunId, domain } },
      data: { status, ...extra },
    });
  }
}
