import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SfmcRestClient } from '../sfmc-connection/sfmc-rest.client';

interface RestJourney {
  id?: string;
  key?: string;
  name?: string;
  status?: string;
  version?: number;
  definitionType?: string;
  channel?: string;
  stats?: { currentPopulation?: number };
  createdDate?: string;
  modifiedDate?: string;
  lastPublishedDate?: string;
}

interface RestJourneyList {
  items?: RestJourney[];
  count?: number;
}

export interface CollectedJourney {
  id: string;
  name: string;
  status: string;
  modifiedDate: Date | null;
  lastPublishedAt: Date | null;
}

@Injectable()
export class JourneyCollector {
  private readonly logger = new Logger(JourneyCollector.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rest: SfmcRestClient,
  ) {}

  async collect(connectionId: string, scanRunId: string): Promise<CollectedJourney[]> {
    const result: CollectedJourney[] = [];
    let page = 1;
    const pageSize = 50;

    while (true) {
      const data = await this.rest
        .get<RestJourneyList>(connectionId, '/interaction/v1/interactions', {
          $page: page,
          $pageSize: pageSize,
          mostRecentVersionOnly: true,
        })
        .catch((e) => {
          this.logger.warn(`Journey GET falhou page=${page}: ${(e as Error).message}`);
          return null;
        });

      if (!data || !data.items || data.items.length === 0) break;

      for (const j of data.items) {
        if (!j.id || !j.name) continue;
        const saved = await this.prisma.journey.create({
          data: {
            scanRunId,
            sfmcId: j.id,
            name: j.name,
            status: j.status ?? 'Unknown',
            version: j.version ?? 1,
            definitionType: j.definitionType ?? null,
            channel: j.channel ?? null,
            entryCount: j.stats?.currentPopulation ?? null,
            createdDate: j.createdDate ? new Date(j.createdDate) : null,
            modifiedDate: j.modifiedDate ? new Date(j.modifiedDate) : null,
            lastPublishedAt: j.lastPublishedDate ? new Date(j.lastPublishedDate) : null,
          },
        });
        result.push({
          id: saved.id,
          name: saved.name,
          status: saved.status,
          modifiedDate: saved.modifiedDate,
          lastPublishedAt: saved.lastPublishedAt,
        });
      }

      if (data.items.length < pageSize) break;
      page += 1;
      if (page > 20) break; // safety
    }

    return result;
  }
}
