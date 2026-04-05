import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ClerkGuard } from '../../common/guards/clerk.guard';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { CreateConnectionDto } from './dto/create-connection.dto';
import { PublicConnection, SfmcConnectionService } from './sfmc-connection.service';

@Controller('connections')
@UseGuards(ClerkGuard)
export class SfmcConnectionController {
  constructor(private readonly service: SfmcConnectionService) {}

  @Post()
  create(
    @Tenant() tenantId: string,
    @Body() dto: CreateConnectionDto,
  ): Promise<PublicConnection> {
    return this.service.create(tenantId, dto);
  }

  @Get()
  list(@Tenant() tenantId: string): Promise<PublicConnection[]> {
    return this.service.list(tenantId);
  }

  @Get(':id')
  detail(@Tenant() tenantId: string, @Param('id') id: string): Promise<PublicConnection> {
    return this.service.findOne(tenantId, id);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Tenant() tenantId: string, @Param('id') id: string): Promise<void> {
    await this.service.remove(tenantId, id);
  }

  @Post(':id/test')
  test(
    @Tenant() tenantId: string,
    @Param('id') id: string,
  ): Promise<{ ok: boolean; scopes: string[]; message?: string }> {
    return this.service.test(tenantId, id);
  }
}
