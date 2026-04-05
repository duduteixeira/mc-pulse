import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConnectionStatus, SfmcConnection } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { encrypt } from '../../common/utils/encryption.util';
import { CreateConnectionDto } from './dto/create-connection.dto';
import { SfmcAuthService } from './sfmc-auth.service';
import { SfmcRestClient } from './sfmc-rest.client';

export interface PublicConnection {
  id: string;
  name: string;
  subdomain: string;
  accountId: string;
  clientId: string;
  integrationType: string;
  status: string;
  lastTestedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
}

function toPublic(c: SfmcConnection): PublicConnection {
  return {
    id: c.id,
    name: c.name,
    subdomain: c.subdomain,
    accountId: c.accountId,
    clientId: c.clientId,
    integrationType: c.integrationType,
    status: c.status,
    lastTestedAt: c.lastTestedAt,
    errorMessage: c.errorMessage,
    createdAt: c.createdAt,
  };
}

@Injectable()
export class SfmcConnectionService {
  private readonly logger = new Logger(SfmcConnectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: SfmcAuthService,
    private readonly rest: SfmcRestClient,
  ) {}

  async create(tenantId: string, dto: CreateConnectionDto): Promise<PublicConnection> {
    const clientSecretEnc = encrypt(dto.clientSecret);
    const conn = await this.prisma.sfmcConnection.create({
      data: {
        tenantId,
        name: dto.name,
        subdomain: dto.subdomain,
        accountId: dto.accountId,
        clientId: dto.clientId,
        clientSecretEnc,
        integrationType: dto.integrationType,
        status: ConnectionStatus.PENDING,
      },
    });
    return toPublic(conn);
  }

  async list(tenantId: string): Promise<PublicConnection[]> {
    const rows = await this.prisma.sfmcConnection.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toPublic);
  }

  async findOne(tenantId: string, id: string): Promise<PublicConnection> {
    const conn = await this.findOwned(tenantId, id);
    return toPublic(conn);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    await this.findOwned(tenantId, id);
    await this.auth.invalidateToken(id);
    await this.prisma.sfmcConnection.delete({ where: { id } });
  }

  /**
   * Testa conexão: obtém token e tenta listar BUs via REST.
   * Não persiste dados coletados — apenas atualiza status da conexão.
   */
  async test(
    tenantId: string,
    id: string,
  ): Promise<{ ok: boolean; scopes: string[]; message?: string }> {
    const conn = await this.findOwned(tenantId, id);
    try {
      const token = await this.auth.getToken(conn.id);
      await this.rest.get<{ items?: unknown[] }>(conn.id, '/platform/v1/accounts');
      await this.prisma.sfmcConnection.update({
        where: { id: conn.id },
        data: {
          status: ConnectionStatus.ACTIVE,
          lastTestedAt: new Date(),
          errorMessage: null,
        },
      });
      const scopes = token.scope ? token.scope.split(' ').filter(Boolean) : [];
      return { ok: true, scopes };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      await this.prisma.sfmcConnection.update({
        where: { id: conn.id },
        data: {
          status: ConnectionStatus.FAILED,
          lastTestedAt: new Date(),
          errorMessage: message,
        },
      });
      return { ok: false, scopes: [], message };
    }
  }

  /**
   * Busca a conexão garantindo isolamento por tenant.
   */
  async findOwned(tenantId: string, id: string): Promise<SfmcConnection> {
    const conn = await this.prisma.sfmcConnection.findUnique({ where: { id } });
    if (!conn) throw new NotFoundException('Conexão não encontrada');
    if (conn.tenantId !== tenantId) throw new ForbiddenException('Acesso negado');
    return conn;
  }
}
