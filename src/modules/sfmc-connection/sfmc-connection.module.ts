import { Global, Module } from '@nestjs/common';
import { SfmcConnectionController } from './sfmc-connection.controller';
import { SfmcConnectionService } from './sfmc-connection.service';
import { SfmcAuthService } from './sfmc-auth.service';
import { SfmcRestClient } from './sfmc-rest.client';
import { SfmcSoapClient } from './sfmc-soap.client';

@Global()
@Module({
  controllers: [SfmcConnectionController],
  providers: [SfmcConnectionService, SfmcAuthService, SfmcRestClient, SfmcSoapClient],
  exports: [SfmcConnectionService, SfmcAuthService, SfmcRestClient, SfmcSoapClient],
})
export class SfmcConnectionModule {}
