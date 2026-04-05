import { Injectable, Logger } from '@nestjs/common';
import { EmailAssetType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SfmcSoapClient } from '../sfmc-connection/sfmc-soap.client';

interface SoapSendClassification {
  ObjectID?: string;
  CustomerKey?: string;
  Name?: string;
  Description?: string;
  SendClassificationType?: string;
  DeliveryProfile?: { CustomerKey?: string } | null;
  SenderProfile?: { CustomerKey?: string } | null;
  ModifiedDate?: string;
}

interface SoapSendDefinition {
  ObjectID?: string;
  Name?: string;
  Description?: string;
  IsActive?: string;
  SendClassification?: { CustomerKey?: string } | null;
  DeliveryProfile?: { CustomerKey?: string } | null;
  Email?: { ID?: string } | null;
  ModifiedDate?: string;
}

interface SoapDeliveryProfile {
  ObjectID?: string;
  CustomerKey?: string;
  Name?: string;
  Description?: string;
  ModifiedDate?: string;
}

interface SoapTriggeredSendDefinition {
  ObjectID?: string;
  CustomerKey?: string;
  Name?: string;
  Description?: string;
  TriggeredSendStatus?: string;
  IsMultipart?: string;
  CreatedDate?: string;
  ModifiedDate?: string;
}

export interface CollectedEmailAssets {
  sendClassifications: Array<{
    id: string;
    sfmcId: string;
    name: string;
    hasDeliveryProfile: boolean;
  }>;
  sendDefinitions: Array<{
    id: string;
    sfmcId: string;
    name: string;
    hasClassification: boolean;
    hasDeliveryProfile: boolean;
    hasEmail: boolean;
    isActive: boolean;
  }>;
  deliveryProfiles: Array<{ id: string; sfmcId: string; name: string }>;
  triggeredSends: Array<{
    id: string;
    sfmcId: string;
    name: string;
    status: string | null;
    lastActivity: Date | null;
  }>;
}

@Injectable()
export class EmailCollector {
  private readonly logger = new Logger(EmailCollector.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly soap: SfmcSoapClient,
  ) {}

  async collect(connectionId: string, scanRunId: string): Promise<CollectedEmailAssets> {
    const [classifications, definitions, profiles, triggeredSends] = await Promise.all([
      this.soap
        .retrieve<SoapSendClassification>(connectionId, {
          objectType: 'SendClassification',
          properties: [
            'ObjectID',
            'CustomerKey',
            'Name',
            'Description',
            'SendClassificationType',
            'DeliveryProfile.CustomerKey',
            'SenderProfile.CustomerKey',
            'ModifiedDate',
          ],
        })
        .catch((e) => {
          this.logger.warn(`SendClassification retrieve falhou: ${(e as Error).message}`);
          return [] as SoapSendClassification[];
        }),
      this.soap
        .retrieve<SoapSendDefinition>(connectionId, {
          objectType: 'EmailSendDefinition',
          properties: [
            'ObjectID',
            'Name',
            'Description',
            'IsActive',
            'SendClassification.CustomerKey',
            'DeliveryProfile.CustomerKey',
            'Email.ID',
            'ModifiedDate',
          ],
        })
        .catch((e) => {
          this.logger.warn(`EmailSendDefinition retrieve falhou: ${(e as Error).message}`);
          return [] as SoapSendDefinition[];
        }),
      this.soap
        .retrieve<SoapDeliveryProfile>(connectionId, {
          objectType: 'DeliveryProfile',
          properties: ['ObjectID', 'CustomerKey', 'Name', 'Description', 'ModifiedDate'],
        })
        .catch((e) => {
          this.logger.warn(`DeliveryProfile retrieve falhou: ${(e as Error).message}`);
          return [] as SoapDeliveryProfile[];
        }),
      this.soap
        .retrieve<SoapTriggeredSendDefinition>(connectionId, {
          objectType: 'TriggeredSendDefinition',
          properties: [
            'ObjectID',
            'CustomerKey',
            'Name',
            'Description',
            'TriggeredSendStatus',
            'IsMultipart',
            'CreatedDate',
            'ModifiedDate',
          ],
        })
        .catch((e) => {
          this.logger.warn(`TriggeredSendDefinition retrieve falhou: ${(e as Error).message}`);
          return [] as SoapTriggeredSendDefinition[];
        }),
    ]);

    const result: CollectedEmailAssets = {
      sendClassifications: [],
      sendDefinitions: [],
      deliveryProfiles: [],
      triggeredSends: [],
    };

    for (const sc of classifications) {
      if (!sc.ObjectID || !sc.Name) continue;
      const saved = await this.prisma.emailAsset.create({
        data: {
          scanRunId,
          sfmcId: sc.ObjectID,
          assetType: EmailAssetType.SEND_CLASSIFICATION,
          name: sc.Name,
          description: sc.Description ?? null,
          status: sc.SendClassificationType ?? null,
          isActive: true,
          lastActivity: sc.ModifiedDate ? new Date(sc.ModifiedDate) : null,
        },
      });
      result.sendClassifications.push({
        id: saved.id,
        sfmcId: saved.sfmcId,
        name: saved.name,
        hasDeliveryProfile: !!sc.DeliveryProfile?.CustomerKey,
      });
    }

    for (const sd of definitions) {
      if (!sd.ObjectID || !sd.Name) continue;
      const saved = await this.prisma.emailAsset.create({
        data: {
          scanRunId,
          sfmcId: sd.ObjectID,
          assetType: EmailAssetType.SEND_DEFINITION,
          name: sd.Name,
          description: sd.Description ?? null,
          isActive: sd.IsActive === 'true',
          lastActivity: sd.ModifiedDate ? new Date(sd.ModifiedDate) : null,
        },
      });
      result.sendDefinitions.push({
        id: saved.id,
        sfmcId: saved.sfmcId,
        name: saved.name,
        hasClassification: !!sd.SendClassification?.CustomerKey,
        hasDeliveryProfile: !!sd.DeliveryProfile?.CustomerKey,
        hasEmail: !!sd.Email?.ID,
        isActive: sd.IsActive === 'true',
      });
    }

    for (const dp of profiles) {
      if (!dp.ObjectID || !dp.Name) continue;
      const saved = await this.prisma.emailAsset.create({
        data: {
          scanRunId,
          sfmcId: dp.ObjectID,
          assetType: EmailAssetType.DELIVERY_PROFILE,
          name: dp.Name,
          description: dp.Description ?? null,
          isActive: true,
          lastActivity: dp.ModifiedDate ? new Date(dp.ModifiedDate) : null,
        },
      });
      result.deliveryProfiles.push({
        id: saved.id,
        sfmcId: saved.sfmcId,
        name: saved.name,
      });
    }

    for (const ts of triggeredSends) {
      if (!ts.ObjectID || !ts.Name) continue;
      const saved = await this.prisma.emailAsset.create({
        data: {
          scanRunId,
          sfmcId: ts.ObjectID,
          assetType: EmailAssetType.TRIGGERED_SEND,
          name: ts.Name,
          description: ts.Description ?? null,
          status: ts.TriggeredSendStatus ?? null,
          isActive: ts.TriggeredSendStatus === 'Active',
          lastActivity: ts.ModifiedDate ? new Date(ts.ModifiedDate) : null,
        },
      });
      result.triggeredSends.push({
        id: saved.id,
        sfmcId: saved.sfmcId,
        name: saved.name,
        status: saved.status,
        lastActivity: saved.lastActivity,
      });
    }

    return result;
  }
}
