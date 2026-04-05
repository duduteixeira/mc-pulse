import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  Sse,
  UseGuards,
  MessageEvent,
  Inject,
} from '@nestjs/common';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Response } from 'express';
import { Observable, fromEvent, map } from 'rxjs';
import Redis from 'ioredis';
import { ScanDomain } from '@prisma/client';
import { ClerkGuard } from '../../common/guards/clerk.guard';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { ScannerService } from './scanner.service';
import { REDIS_CLIENT } from '../../common/redis/redis.provider';
import { SCAN_PROGRESS_CHANNEL } from './scanner.constants';
import { DomainMetadata, listDomains } from './domain-metadata';

export class StartScanDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  /**
   * Domínios a escanear. Se omitido, usa a lista default do servidor.
   * O frontend sempre deve enviar a lista selecionada pelo usuário.
   */
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(ScanDomain, { each: true })
  domains?: ScanDomain[];
}

@Controller()
@UseGuards(ClerkGuard)
export class ScannerController {
  constructor(
    private readonly service: ScannerService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Lista os domínios disponíveis com metadados (label, descrição,
   * custo estimado, plano mínimo). Usado pelo frontend para montar
   * o seletor no início do scan.
   */
  @Get('scan-domains')
  domains(): DomainMetadata[] {
    return listDomains();
  }

  @Post('scans')
  start(
    @Tenant() tenantId: string,
    @Body() dto: StartScanDto,
  ): Promise<{ scanRunId: string; domains: ScanDomain[] }> {
    return this.service.startScan(tenantId, dto.connectionId, dto.domains);
  }

  @Get('scans')
  list(@Tenant() tenantId: string): Promise<unknown[]> {
    return this.service.list(tenantId);
  }

  @Get('scans/:id')
  detail(@Tenant() tenantId: string, @Param('id') id: string): Promise<unknown> {
    return this.service.findOne(tenantId, id);
  }

  /**
   * SSE: conecta ao canal Redis do scan e propaga cada mensagem como evento.
   */
  @Sse('scans/:id/progress')
  async progress(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Res() _res: Response,
  ): Promise<Observable<MessageEvent>> {
    await this.service.findOne(tenantId, id);
    const subscriber = this.redis.duplicate();
    await subscriber.subscribe(SCAN_PROGRESS_CHANNEL(id));
    return fromEvent<[string, string]>(subscriber, 'message').pipe(
      map(([, payload]) => ({ data: JSON.parse(payload) }) as MessageEvent),
    );
  }
}
