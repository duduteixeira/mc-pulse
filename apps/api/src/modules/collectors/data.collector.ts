import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SfmcSoapClient } from '../sfmc-connection/sfmc-soap.client';

interface SoapDataExtension {
  ObjectID?: string;
  CustomerKey?: string;
  Name?: string;
  CategoryID?: string;
  IsSendable?: string;
  DataRetentionPeriodLength?: string;
  DataRetentionPeriodUnitOfMeasure?: string;
  RowBasedRetention?: string;
  CreatedDate?: string;
  ModifiedDate?: string;
}

interface SoapDataExtensionField {
  Name?: string;
  IsPrimaryKey?: string;
  DataExtension?: { CustomerKey?: string };
}

export interface CollectedDataExtension {
  id: string; // id do registro persistido
  sfmcId: string;
  name: string;
  customerKey: string | null;
  retentionPeriod: number | null;
  hasPrimaryKey: boolean;
  fieldCount: number;
}

@Injectable()
export class DataCollector {
  private readonly logger = new Logger(DataCollector.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly soap: SfmcSoapClient,
  ) {}

  async collect(connectionId: string, scanRunId: string): Promise<CollectedDataExtension[]> {
    const rawDes = await this.soap
      .retrieve<SoapDataExtension>(connectionId, {
        objectType: 'DataExtension',
        properties: [
          'ObjectID',
          'CustomerKey',
          'Name',
          'CategoryID',
          'IsSendable',
          'DataRetentionPeriodLength',
          'DataRetentionPeriodUnitOfMeasure',
          'RowBasedRetention',
          'CreatedDate',
          'ModifiedDate',
        ],
      })
      .catch((e) => {
        this.logger.warn(`DataExtension retrieve falhou: ${(e as Error).message}`);
        return [] as SoapDataExtension[];
      });

    const rawFields = await this.soap
      .retrieve<SoapDataExtensionField>(connectionId, {
        objectType: 'DataExtensionField',
        properties: ['Name', 'IsPrimaryKey', 'DataExtension.CustomerKey'],
      })
      .catch((e) => {
        this.logger.warn(`DataExtensionField retrieve falhou: ${(e as Error).message}`);
        return [] as SoapDataExtensionField[];
      });

    // Indexa fields por CustomerKey da DE
    const fieldsByKey = new Map<string, { total: number; hasPk: boolean }>();
    for (const f of rawFields) {
      const key = f.DataExtension?.CustomerKey;
      if (!key) continue;
      const entry = fieldsByKey.get(key) ?? { total: 0, hasPk: false };
      entry.total += 1;
      if (f.IsPrimaryKey === 'true') entry.hasPk = true;
      fieldsByKey.set(key, entry);
    }

    const result: CollectedDataExtension[] = [];
    for (const de of rawDes) {
      if (!de.ObjectID || !de.Name) continue;
      const key = de.CustomerKey ?? '';
      const fieldInfo = fieldsByKey.get(key) ?? { total: 0, hasPk: false };
      const retentionDays = this.normalizeRetentionDays(de);

      const saved = await this.prisma.dataExtension.create({
        data: {
          scanRunId,
          sfmcId: de.ObjectID,
          name: de.Name,
          customerKey: de.CustomerKey ?? null,
          categoryId: de.CategoryID ?? null,
          retentionPeriod: retentionDays,
          retentionType: de.DataRetentionPeriodUnitOfMeasure ?? null,
          hasPrimaryKey: fieldInfo.hasPk,
          fieldCount: fieldInfo.total,
          isSendable: de.IsSendable === 'true',
          createdDate: de.CreatedDate ? new Date(de.CreatedDate) : null,
          modifiedDate: de.ModifiedDate ? new Date(de.ModifiedDate) : null,
        },
      });

      result.push({
        id: saved.id,
        sfmcId: saved.sfmcId,
        name: saved.name,
        customerKey: saved.customerKey,
        retentionPeriod: saved.retentionPeriod,
        hasPrimaryKey: saved.hasPrimaryKey,
        fieldCount: saved.fieldCount,
      });
    }

    return result;
  }

  private normalizeRetentionDays(de: SoapDataExtension): number | null {
    if (!de.DataRetentionPeriodLength) return null;
    const length = Number(de.DataRetentionPeriodLength);
    if (Number.isNaN(length) || length === 0) return null;
    const unit = (de.DataRetentionPeriodUnitOfMeasure ?? '').toLowerCase();
    switch (unit) {
      case 'days':
        return length;
      case 'weeks':
        return length * 7;
      case 'months':
        return length * 30;
      case 'years':
        return length * 365;
      default:
        return length;
    }
  }
}
