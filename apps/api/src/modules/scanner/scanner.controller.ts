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
} from '@nestjs/common';
import { IsString, IsNotEmpty } from 'class-validator';
import { Response } from 'express';
import { Observable, fromEvent, map } from 'rxjs';
import Redis from 'ioredis';
import { Inject } from '@nestjs/common';
import { ClerkGuard } from '../../common/guards/clerk.guard';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { ScannerService } from './scanner.service';
import { REDIS_CLIENT } from '../../common/redis/redis.provider';
import { SCAN_PROGRESS_CHANNEL } from './scanner.constants';

export class StartScanDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;
}

@Controller('scans')
@UseGuards(ClerkGuard)
export class ScannerController {
  constructor(
    private readonly service: ScannerService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Post()
  start(
    @Tenant() tenantId: string,
    @Body() dto: StartScanDto,
  ): Promise<{ scanRunId: string }> {
    return this.service.startScan(tenantId, dto.connectionId);
  }

  @Get()
  list(@Tenant() tenantId: string): Promise<unknown[]> {
    return this.service.list(tenantId);
  }

  @Get(':id')
  detail(@Tenant() tenantId: string, @Param('id') id: string): Promise<unknown> {
    return this.service.findOne(tenantId, id);
  }

  /**
   * SSE: conecta ao canal Redis do scan e propaga cada mensagem como evento.
   * Usa um subscriber dedicado (clone) para não contaminar o client global.
   */
  @Sse(':id/progress')
  async progress(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Res() _res: Response,
  ): Promise<Observable<MessageEvent>> {
    // Valida acesso antes de abrir o stream
    await this.service.findOne(tenantId, id);

    const subscriber = this.redis.duplicate();
    await subscriber.subscribe(SCAN_PROGRESS_CHANNEL(id));

    return fromEvent<[string, string]>(subscriber, 'message').pipe(
      map(([, payload]) => ({ data: JSON.parse(payload) }) as MessageEvent),
    );
  }
}
