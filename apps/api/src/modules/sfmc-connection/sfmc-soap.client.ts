import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import { SfmcAuthService } from './sfmc-auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SfmcRateLimiter } from '../../common/utils/sfmc-rate-limiter';

export interface SoapRetrieveOptions {
  objectType: string;
  properties: string[];
  filter?: SoapFilter;
}

export interface SoapFilter {
  property: string;
  operator: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'IN';
  value: string | string[];
}

/**
 * Cliente SOAP read-only do SFMC.
 * Apenas operação Retrieve é implementada — nunca Create/Update/Delete.
 * Todas as chamadas passam pelo rate limiter por tenant.
 */
@Injectable()
export class SfmcSoapClient {
  private readonly logger = new Logger(SfmcSoapClient.name);

  constructor(
    private readonly auth: SfmcAuthService,
    private readonly prisma: PrismaService,
    private readonly limiter: SfmcRateLimiter,
  ) {}

  async retrieve<T>(connectionId: string, opts: SoapRetrieveOptions): Promise<T[]> {
    const conn = await this.prisma.sfmcConnection.findUnique({
      where: { id: connectionId },
      select: { tenantId: true },
    });
    if (!conn) throw new Error(`Connection ${connectionId} não encontrada`);

    return this.limiter.run(conn.tenantId, 'soap', async () => {
      const token = await this.auth.getToken(connectionId);
      const endpoint = `${token.soapBaseUrl.replace(/\/$/, '')}/Service.asmx`;
      const envelope = this.buildRetrieveEnvelope(token.accessToken, opts);

      try {
        const { data } = await axios.post<string>(endpoint, envelope, {
          headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            SOAPAction: 'Retrieve',
          },
          timeout: 60_000,
        });

        const parsed = await parseStringPromise(data, { explicitArray: false, ignoreAttrs: true });
        const body = parsed['soap:Envelope']?.['soap:Body']?.RetrieveResponseMsg;
        if (!body) return [];
        const results = body.Results;
        if (!results) return [];
        return Array.isArray(results) ? (results as T[]) : [results as T];
      } catch (err) {
        if (axios.isAxiosError(err)) {
          this.logger.warn(`SOAP Retrieve ${opts.objectType} falhou: ${err.response?.status}`);
        }
        throw err;
      }
    });
  }

  private buildRetrieveEnvelope(accessToken: string, opts: SoapRetrieveOptions): string {
    const properties = opts.properties.map((p) => `<Properties>${p}</Properties>`).join('');
    const filter = opts.filter ? this.buildFilter(opts.filter) : '';
    return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Header>
    <fueloauth xmlns="http://exacttarget.com">${accessToken}</fueloauth>
  </soap:Header>
  <soap:Body>
    <RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI">
      <RetrieveRequest>
        <ObjectType>${opts.objectType}</ObjectType>
        ${properties}
        ${filter}
      </RetrieveRequest>
    </RetrieveRequestMsg>
  </soap:Body>
</soap:Envelope>`;
  }

  private buildFilter(filter: SoapFilter): string {
    const values = Array.isArray(filter.value)
      ? filter.value.map((v) => `<Value>${v}</Value>`).join('')
      : `<Value>${filter.value}</Value>`;
    return `<Filter xsi:type="SimpleFilterPart">
      <Property>${filter.property}</Property>
      <SimpleOperator>${filter.operator}</SimpleOperator>
      ${values}
    </Filter>`;
  }
}
