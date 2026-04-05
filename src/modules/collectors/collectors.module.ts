import { Global, Module } from '@nestjs/common';
import { GovernanceCollector } from './governance.collector';
import { DataCollector } from './data.collector';
import { JourneyCollector } from './journey.collector';
import { AutomationCollector } from './automation.collector';
import { EmailCollector } from './email.collector';
import { SecurityCollector } from './security.collector';

@Global()
@Module({
  providers: [
    GovernanceCollector,
    DataCollector,
    JourneyCollector,
    AutomationCollector,
    EmailCollector,
    SecurityCollector,
  ],
  exports: [
    GovernanceCollector,
    DataCollector,
    JourneyCollector,
    AutomationCollector,
    EmailCollector,
    SecurityCollector,
  ],
})
export class CollectorsModule {}
