import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './common/redis/redis.provider';
import { CommonModule } from './common/common.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { SfmcConnectionModule } from './modules/sfmc-connection/sfmc-connection.module';
import { ScannerModule } from './modules/scanner/scanner.module';
import { RulesEngineModule } from './modules/rules-engine/rules-engine.module';
import { HealthScoreModule } from './modules/health-score/health-score.module';
import { FindingsModule } from './modules/findings/findings.module';
import { AiReportModule } from './modules/ai-report/ai-report.module';
import { HistoryModule } from './modules/history/history.module';
import { ReportsModule } from './modules/reports/reports.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { HealthController } from './health.controller';
import { redisConnectionFromEnv } from './common/utils/redis.util';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRoot({
      connection: redisConnectionFromEnv(),
    }),
    CommonModule,
    PrismaModule,
    RedisModule,
    AuthModule,
    TenantsModule,
    SfmcConnectionModule,
    ScannerModule,
    RulesEngineModule,
    HealthScoreModule,
    FindingsModule,
    AiReportModule,
    HistoryModule,
    ReportsModule,
    NotificationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
