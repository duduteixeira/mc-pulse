import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './common/redis/redis.provider';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { SfmcConnectionModule } from './modules/sfmc-connection/sfmc-connection.module';
import { ScannerModule } from './modules/scanner/scanner.module';
import { RulesEngineModule } from './modules/rules-engine/rules-engine.module';
import { HealthScoreModule } from './modules/health-score/health-score.module';
import { FindingsModule } from './modules/findings/findings.module';
import { HealthController } from './health.controller';
import { redisConnectionFromEnv } from './common/utils/redis.util';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRoot({
      connection: redisConnectionFromEnv(),
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    TenantsModule,
    SfmcConnectionModule,
    ScannerModule,
    RulesEngineModule,
    HealthScoreModule,
    FindingsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
