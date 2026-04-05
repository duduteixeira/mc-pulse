import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SfmcSoapClient } from '../sfmc-connection/sfmc-soap.client';

interface SoapInstalledPackage {
  ID?: string;
  Name?: string;
  CreatedDate?: string;
  ModifiedDate?: string;
  Scopes?: { Scope?: Array<{ Name?: string; Category?: string }> | { Name?: string; Category?: string } };
}

export interface CollectedPackage {
  sfmcId: string;
  name: string;
  createdDate: Date | null;
  modifiedDate: Date | null;
  scopes: Array<{ name: string; category: string | null }>;
}

export interface SecurityData {
  packages: CollectedPackage[];
  connectionCreatedAt: Date;
}

/**
 * Coleta pacotes instalados + metadados de segurança.
 * Persiste scopes em PackageScope (nível da conexão, não do scan — conforme schema).
 */
@Injectable()
export class SecurityCollector {
  private readonly logger = new Logger(SecurityCollector.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly soap: SfmcSoapClient,
  ) {}

  async collect(connectionId: string, _scanRunId: string): Promise<SecurityData> {
    const conn = await this.prisma.sfmcConnection.findUnique({ where: { id: connectionId } });
    if (!conn) throw new Error('Connection não encontrada');

    const raw = await this.soap
      .retrieve<SoapInstalledPackage>(connectionId, {
        objectType: 'InstalledPackage',
        properties: ['ID', 'Name', 'CreatedDate', 'ModifiedDate'],
      })
      .catch((e) => {
        this.logger.warn(`InstalledPackage retrieve falhou: ${(e as Error).message}`);
        return [] as SoapInstalledPackage[];
      });

    const packages: CollectedPackage[] = raw
      .filter((p) => p.ID && p.Name)
      .map((p) => {
        const scopeRaw = p.Scopes?.Scope;
        const scopeList = Array.isArray(scopeRaw) ? scopeRaw : scopeRaw ? [scopeRaw] : [];
        return {
          sfmcId: String(p.ID),
          name: String(p.Name),
          createdDate: p.CreatedDate ? new Date(p.CreatedDate) : null,
          modifiedDate: p.ModifiedDate ? new Date(p.ModifiedDate) : null,
          scopes: scopeList
            .filter((s) => s.Name)
            .map((s) => ({ name: String(s.Name), category: s.Category ?? null })),
        };
      });

    // Atualiza tabela de scopes da conexão (refresh completo)
    await this.prisma.packageScope.deleteMany({ where: { connectionId } });
    const scopeRows = packages.flatMap((pkg) =>
      pkg.scopes.map((s) => ({
        connectionId,
        packageId: pkg.sfmcId,
        name: pkg.name,
        scope: s.name,
        category: s.category,
      })),
    );
    if (scopeRows.length > 0) {
      await this.prisma.packageScope.createMany({ data: scopeRows });
    }

    return {
      packages,
      connectionCreatedAt: conn.createdAt,
    };
  }
}
