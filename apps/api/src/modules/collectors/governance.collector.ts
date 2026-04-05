import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SfmcSoapClient } from '../sfmc-connection/sfmc-soap.client';

interface SoapBusinessUnit {
  ID?: string;
  Name?: string;
  ParentID?: string;
}

interface SoapUser {
  ID?: string;
  Name?: string;
  Email?: string;
  IsActive?: string;
  IsAPIUser?: string;
  UserPermissions?: unknown;
  Roles?: { Role?: { Name?: string } | Array<{ Name?: string }> };
  CreatedDate?: string;
}

interface SoapInstalledPackage {
  ID?: string;
  Name?: string;
  Scopes?: { Scope?: Array<{ Name?: string; Category?: string }> | { Name?: string } };
}

export interface GovernanceData {
  businessUnits: SoapBusinessUnit[];
  users: SoapUser[];
  packages: SoapInstalledPackage[];
}

@Injectable()
export class GovernanceCollector {
  private readonly logger = new Logger(GovernanceCollector.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly soap: SfmcSoapClient,
  ) {}

  async collect(connectionId: string, scanRunId: string): Promise<GovernanceData> {
    const [businessUnits, users, packages] = await Promise.all([
      this.soap
        .retrieve<SoapBusinessUnit>(connectionId, {
          objectType: 'BusinessUnit',
          properties: ['ID', 'Name', 'ParentID'],
        })
        .catch((e) => {
          this.logger.warn(`BU retrieve falhou: ${(e as Error).message}`);
          return [];
        }),
      this.soap
        .retrieve<SoapUser>(connectionId, {
          objectType: 'AccountUser',
          properties: ['ID', 'Name', 'Email', 'IsActive', 'IsAPIUser', 'CreatedDate'],
        })
        .catch((e) => {
          this.logger.warn(`User retrieve falhou: ${(e as Error).message}`);
          return [];
        }),
      this.soap
        .retrieve<SoapInstalledPackage>(connectionId, {
          objectType: 'InstalledPackage',
          properties: ['ID', 'Name'],
        })
        .catch((e) => {
          this.logger.warn(`InstalledPackage retrieve falhou: ${(e as Error).message}`);
          return [];
        }),
    ]);

    // Persiste usuários coletados para a regra GOV-002 consultar
    await this.prisma.sfmcUser.createMany({
      data: users
        .filter((u) => u.ID)
        .map((u) => ({
          scanRunId,
          sfmcId: String(u.ID),
          name: u.Name ?? 'Unknown',
          email: u.Email ?? null,
          isActive: u.IsActive === 'true',
          isAdmin: this.detectAdmin(u),
          roleNames: this.extractRoles(u),
        })),
    });

    // BUs e scopes são persistidos no nível da conexão (relação com SfmcConnection)
    if (businessUnits.length > 0) {
      await this.prisma.businessUnit.deleteMany({ where: { connectionId } });
      await this.prisma.businessUnit.createMany({
        data: businessUnits
          .filter((bu) => bu.ID)
          .map((bu) => ({
            connectionId,
            sfmcId: String(bu.ID),
            name: bu.Name ?? 'Unknown',
            parentId: bu.ParentID ?? null,
            isParent: !bu.ParentID || bu.ParentID === '0',
          })),
      });
    }

    return { businessUnits, users, packages };
  }

  private detectAdmin(u: SoapUser): boolean {
    const roles = this.extractRoles(u);
    return roles.some((r) => /admin/i.test(r));
  }

  private extractRoles(u: SoapUser): string[] {
    const roles = u.Roles?.Role;
    if (!roles) return [];
    if (Array.isArray(roles)) return roles.map((r) => r.Name ?? '').filter(Boolean);
    return roles.Name ? [roles.Name] : [];
  }
}
