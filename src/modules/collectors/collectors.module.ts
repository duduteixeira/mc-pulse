import { Global, Module } from '@nestjs/common';
import { GovernanceCollector } from './governance.collector';
import { DataCollector } from './data.collector';
import { JourneyCollector } from './journey.collector';
import { AutomationCollector } from './automation.collector';

@Global()
@Module({
  providers: [GovernanceCollector, DataCollector, JourneyCollector, AutomationCollector],
  exports: [GovernanceCollector, DataCollector, JourneyCollector, AutomationCollector],
})
export class CollectorsModule {}
