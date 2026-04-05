import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import axios from 'axios';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../common/redis/redis.provider';
import { decrypt } from '../../common/utils/encryption.util';

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  soap_instance_url?: string;
  rest_instance_url?: string;
}

export interface SfmcTokenBundle {
  accessToken: string;
  restBaseUrl: string;
  soapBaseUrl: string;
  scope: string;
}

const TOKEN_TTL_SECONDS = 60 * 18; // 18 min — SFMC expira em 20 min

@Injectable()
export class SfmcAuthService {
  private readonly logger = new Logger(SfmcAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Obtém token SFMC, preferencialmente do cache Redis.
   * clientSecret é descriptografado apenas em memória e nunca logado.
   */
  async getToken(connectionId: string): Promise<SfmcTokenBundle> {
    const cacheKey = `sfmc:token:${connectionId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as SfmcTokenBundle;
    }

    const conn = await this.prisma.sfmcConnection.findUnique({ where: { id: connectionId } });
    if (!conn) throw new UnauthorizedException('Conexão SFMC não encontrada');

    const clientSecret = decrypt(conn.clientSecretEnc);
    const tokenUrl = `https://${conn.subdomain}.auth.marketingcloudapis.com/v2/token`;

    try {
      const { data } = await axios.post<TokenResponse>(
        tokenUrl,
        {
          grant_type: 'client_credentials',
          client_id: conn.clientId,
          client_secret: clientSecret,
          account_id: conn.accountId,
        },
        { timeout: 10_000 },
      );

      const bundle: SfmcTokenBundle = {
        accessToken: data.access_token,
        restBaseUrl: data.rest_instance_url ?? `https://${conn.subdomain}.rest.marketingcloudapis.com/`,
        soapBaseUrl:
          data.soap_instance_url ?? `https://${conn.subdomain}.soap.marketingcloudapis.com/`,
        scope: data.scope ?? '',
      };
      await this.redis.set(cacheKey, JSON.stringify(bundle), 'EX', TOKEN_TTL_SECONDS);
      return bundle;
    } catch (err) {
      // NÃO logar clientSecret. Apenas metadados.
      this.logger.error(
        `Falha ao obter token SFMC para connection=${connectionId}: ${
          axios.isAxiosError(err) ? err.response?.status : 'unknown'
        }`,
      );
      throw new UnauthorizedException('Falha ao autenticar com o SFMC');
    }
  }

  async invalidateToken(connectionId: string): Promise<void> {
    await this.redis.del(`sfmc:token:${connectionId}`);
  }
}
