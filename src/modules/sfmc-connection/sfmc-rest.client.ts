import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { SfmcAuthService } from './sfmc-auth.service';

/**
 * Cliente REST read-only do SFMC.
 * Apenas métodos GET são expostos para evitar qualquer escrita acidental.
 */
@Injectable()
export class SfmcRestClient {
  private readonly logger = new Logger(SfmcRestClient.name);

  constructor(private readonly auth: SfmcAuthService) {}

  private async buildClient(connectionId: string): Promise<AxiosInstance> {
    const token = await this.auth.getToken(connectionId);
    return axios.create({
      baseURL: token.restBaseUrl,
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    });
  }

  async get<T>(connectionId: string, path: string, params?: Record<string, unknown>): Promise<T> {
    const client = await this.buildClient(connectionId);
    try {
      const { data } = await client.get<T>(path, { params });
      return data;
    } catch (err) {
      if (axios.isAxiosError(err)) {
        this.logger.warn(
          `REST GET ${path} falhou: ${err.response?.status} ${err.response?.statusText}`,
        );
      }
      throw err;
    }
  }
}
