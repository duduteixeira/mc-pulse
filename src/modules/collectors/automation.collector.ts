import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SfmcRestClient } from '../sfmc-connection/sfmc-rest.client';

interface RestAutomation {
  id?: string;
  name?: string;
  description?: string;
  status?: string | number;
  typeId?: number;
  lastRunTime?: string;
  lastRunInstanceStatus?: string;
  scheduledTime?: string;
  schedule?: { scheduleStatus?: string; scheduleTypeId?: number } | null;
  steps?: unknown[];
}

interface RestAutomationList {
  items?: RestAutomation[];
  count?: number;
}

const STATUS_MAP: Record<number, string> = {
  [-1]: 'Error',
  0: 'BuildingError',
  1: 'Building',
  2: 'Ready',
  3: 'Running',
  4: 'Paused',
  5: 'Stopped',
  6: 'Scheduled',
  7: 'Awaiting',
  8: 'Processing',
  9: 'Inactive',
  10: 'Complete',
};

export interface CollectedAutomation {
  id: string;
  name: string;
  status: string;
  lastRunStatus: string | null;
  lastRunTime: Date | null;
  hasSchedule: boolean;
  description: string | null;
}

@Injectable()
export class AutomationCollector {
  private readonly logger = new Logger(AutomationCollector.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rest: SfmcRestClient,
  ) {}

  async collect(connectionId: string, scanRunId: string): Promise<CollectedAutomation[]> {
    const result: CollectedAutomation[] = [];
    let page = 1;
    const pageSize = 50;

    while (true) {
      const data = await this.rest
        .get<RestAutomationList>(connectionId, '/automation/v1/automations', {
          $page: page,
          $pageSize: pageSize,
        })
        .catch((e) => {
          this.logger.warn(`Automation GET falhou page=${page}: ${(e as Error).message}`);
          return null;
        });

      if (!data || !data.items || data.items.length === 0) break;

      for (const a of data.items) {
        if (!a.id || !a.name) continue;
        const status = this.normalizeStatus(a.status);
        const hasSchedule =
          !!a.schedule && a.schedule.scheduleStatus !== undefined && a.schedule.scheduleStatus !== 'inactive';

        const saved = await this.prisma.automation.create({
          data: {
            scanRunId,
            sfmcId: a.id,
            name: a.name,
            description: a.description ?? null,
            status,
            automationType: a.typeId ? String(a.typeId) : null,
            lastRunTime: a.lastRunTime ? new Date(a.lastRunTime) : null,
            lastRunStatus: a.lastRunInstanceStatus ?? null,
            nextRunTime: a.scheduledTime ? new Date(a.scheduledTime) : null,
            hasSchedule,
            stepCount: Array.isArray(a.steps) ? a.steps.length : 0,
          },
        });

        result.push({
          id: saved.id,
          name: saved.name,
          status: saved.status,
          lastRunStatus: saved.lastRunStatus,
          lastRunTime: saved.lastRunTime,
          hasSchedule: saved.hasSchedule,
          description: saved.description,
        });
      }

      if (data.items.length < pageSize) break;
      page += 1;
      if (page > 20) break;
    }

    return result;
  }

  private normalizeStatus(raw: string | number | undefined): string {
    if (raw === undefined || raw === null) return 'Unknown';
    if (typeof raw === 'string') return raw;
    return STATUS_MAP[raw] ?? `Status_${raw}`;
  }
}
