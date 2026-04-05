import { Global, Module } from '@nestjs/common';
import { RulesEngineService } from './rules-engine.service';

@Global()
@Module({
  providers: [RulesEngineService],
  exports: [RulesEngineService],
})
export class RulesEngineModule {}
