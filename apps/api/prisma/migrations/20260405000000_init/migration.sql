-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'AGENCY', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('SINGLE_BU', 'MULTI_BU', 'ACCOUNT_LEVEL');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('PENDING', 'ACTIVE', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "TriggerType" AS ENUM ('MANUAL', 'SCHEDULED', 'API');

-- CreateEnum
CREATE TYPE "ScanDomain" AS ENUM ('GOVERNANCE', 'DATA', 'JOURNEY', 'AUTOMATION', 'EMAIL', 'SECURITY');

-- CreateEnum
CREATE TYPE "DomainStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "EmailAssetType" AS ENUM ('SEND_CLASSIFICATION', 'SEND_DEFINITION', 'DELIVERY_PROFILE', 'TRIGGERED_SEND');

-- CreateEnum
CREATE TYPE "FindingCategory" AS ENUM ('GOVERNANCE', 'DATA', 'JOURNEY', 'AUTOMATION', 'EMAIL', 'SECURITY');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');

-- CreateEnum
CREATE TYPE "Effort" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "FindingStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'IGNORED');

-- CreateEnum
CREATE TYPE "AiReportStatus" AS ENUM ('PENDING', 'GENERATING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('EXECUTIVE_PDF', 'TECHNICAL_PDF', 'CHECKLIST_PDF');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sfmc_connections" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecretEnc" TEXT NOT NULL,
    "integrationType" "IntegrationType" NOT NULL DEFAULT 'SINGLE_BU',
    "status" "ConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "lastTestedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "sfmc_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_units" (
    "id" TEXT NOT NULL,
    "sfmcId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "isParent" BOOLEAN NOT NULL DEFAULT false,
    "userCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "connectionId" TEXT NOT NULL,

    CONSTRAINT "business_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_scopes" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "category" TEXT,
    "connectionId" TEXT NOT NULL,

    CONSTRAINT "package_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_runs" (
    "id" TEXT NOT NULL,
    "status" "ScanStatus" NOT NULL DEFAULT 'PENDING',
    "triggeredBy" "TriggerType" NOT NULL DEFAULT 'MANUAL',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,

    CONSTRAINT "scan_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domain_scans" (
    "id" TEXT NOT NULL,
    "domain" "ScanDomain" NOT NULL,
    "status" "DomainStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "itemsCollected" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scanRunId" TEXT NOT NULL,

    CONSTRAINT "domain_scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_extensions" (
    "id" TEXT NOT NULL,
    "sfmcId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customerKey" TEXT,
    "categoryId" TEXT,
    "rowCount" INTEGER,
    "retentionPeriod" INTEGER,
    "retentionType" TEXT,
    "hasPrimaryKey" BOOLEAN NOT NULL DEFAULT false,
    "fieldCount" INTEGER NOT NULL DEFAULT 0,
    "isSendable" BOOLEAN NOT NULL DEFAULT false,
    "createdDate" TIMESTAMP(3),
    "modifiedDate" TIMESTAMP(3),
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scanRunId" TEXT NOT NULL,

    CONSTRAINT "data_extensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journeys" (
    "id" TEXT NOT NULL,
    "sfmcId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "definitionType" TEXT,
    "channel" TEXT,
    "entryCount" INTEGER,
    "createdDate" TIMESTAMP(3),
    "modifiedDate" TIMESTAMP(3),
    "lastPublishedAt" TIMESTAMP(3),
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scanRunId" TEXT NOT NULL,

    CONSTRAINT "journeys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automations" (
    "id" TEXT NOT NULL,
    "sfmcId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL,
    "automationType" TEXT,
    "lastRunTime" TIMESTAMP(3),
    "lastRunStatus" TEXT,
    "nextRunTime" TIMESTAMP(3),
    "hasSchedule" BOOLEAN NOT NULL DEFAULT false,
    "scheduleInterval" TEXT,
    "stepCount" INTEGER NOT NULL DEFAULT 0,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scanRunId" TEXT NOT NULL,

    CONSTRAINT "automations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_assets" (
    "id" TEXT NOT NULL,
    "sfmcId" TEXT NOT NULL,
    "assetType" "EmailAssetType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastActivity" TIMESTAMP(3),
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scanRunId" TEXT NOT NULL,

    CONSTRAINT "email_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sfmc_users" (
    "id" TEXT NOT NULL,
    "sfmcId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "roleNames" TEXT[],
    "businessUnit" TEXT,
    "createdDate" TIMESTAMP(3),
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scanRunId" TEXT NOT NULL,

    CONSTRAINT "sfmc_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "findings" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "category" "FindingCategory" NOT NULL,
    "severity" "Severity" NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectId" TEXT,
    "objectName" TEXT,
    "evidence" TEXT NOT NULL,
    "ruleViolated" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "effort" "Effort" NOT NULL DEFAULT 'MEDIUM',
    "priority" INTEGER NOT NULL,
    "status" "FindingStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scanRunId" TEXT NOT NULL,

    CONSTRAINT "findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_scores" (
    "id" TEXT NOT NULL,
    "scoreOverall" DOUBLE PRECISION NOT NULL,
    "scoreGovernance" DOUBLE PRECISION,
    "scoreData" DOUBLE PRECISION,
    "scoreJourney" DOUBLE PRECISION,
    "scoreAutomation" DOUBLE PRECISION,
    "scoreEmail" DOUBLE PRECISION,
    "scoreSecurity" DOUBLE PRECISION,
    "classification" TEXT NOT NULL,
    "totalFindings" INTEGER NOT NULL DEFAULT 0,
    "criticalCount" INTEGER NOT NULL DEFAULT 0,
    "highCount" INTEGER NOT NULL DEFAULT 0,
    "mediumCount" INTEGER NOT NULL DEFAULT 0,
    "lowCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scanRunId" TEXT NOT NULL,

    CONSTRAINT "health_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_reports" (
    "id" TEXT NOT NULL,
    "executiveSummary" TEXT,
    "technicalAnalysis" TEXT,
    "actionPlan30" TEXT,
    "actionPlan60" TEXT,
    "actionPlan90" TEXT,
    "operationalChecklist" TEXT,
    "status" "AiReportStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scanRunId" TEXT NOT NULL,

    CONSTRAINT "ai_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "type" "ReportType" NOT NULL,
    "filePath" TEXT,
    "fileSize" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scanRunId" TEXT NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_clerkId_key" ON "users"("clerkId");

-- CreateIndex
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");

-- CreateIndex
CREATE INDEX "users_clerkId_idx" ON "users"("clerkId");

-- CreateIndex
CREATE INDEX "sfmc_connections_tenantId_idx" ON "sfmc_connections"("tenantId");

-- CreateIndex
CREATE INDEX "business_units_connectionId_idx" ON "business_units"("connectionId");

-- CreateIndex
CREATE INDEX "package_scopes_connectionId_idx" ON "package_scopes"("connectionId");

-- CreateIndex
CREATE INDEX "scan_runs_tenantId_idx" ON "scan_runs"("tenantId");

-- CreateIndex
CREATE INDEX "scan_runs_connectionId_idx" ON "scan_runs"("connectionId");

-- CreateIndex
CREATE INDEX "domain_scans_scanRunId_idx" ON "domain_scans"("scanRunId");

-- CreateIndex
CREATE UNIQUE INDEX "domain_scans_scanRunId_domain_key" ON "domain_scans"("scanRunId", "domain");

-- CreateIndex
CREATE INDEX "data_extensions_scanRunId_idx" ON "data_extensions"("scanRunId");

-- CreateIndex
CREATE INDEX "journeys_scanRunId_idx" ON "journeys"("scanRunId");

-- CreateIndex
CREATE INDEX "automations_scanRunId_idx" ON "automations"("scanRunId");

-- CreateIndex
CREATE INDEX "email_assets_scanRunId_idx" ON "email_assets"("scanRunId");

-- CreateIndex
CREATE INDEX "sfmc_users_scanRunId_idx" ON "sfmc_users"("scanRunId");

-- CreateIndex
CREATE INDEX "findings_scanRunId_idx" ON "findings"("scanRunId");

-- CreateIndex
CREATE INDEX "findings_category_idx" ON "findings"("category");

-- CreateIndex
CREATE INDEX "findings_severity_idx" ON "findings"("severity");

-- CreateIndex
CREATE INDEX "findings_status_idx" ON "findings"("status");

-- CreateIndex
CREATE UNIQUE INDEX "health_scores_scanRunId_key" ON "health_scores"("scanRunId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_reports_scanRunId_key" ON "ai_reports"("scanRunId");

-- CreateIndex
CREATE INDEX "reports_scanRunId_idx" ON "reports"("scanRunId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sfmc_connections" ADD CONSTRAINT "sfmc_connections_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_units" ADD CONSTRAINT "business_units_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "sfmc_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_scopes" ADD CONSTRAINT "package_scopes_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "sfmc_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_runs" ADD CONSTRAINT "scan_runs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_runs" ADD CONSTRAINT "scan_runs_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "sfmc_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domain_scans" ADD CONSTRAINT "domain_scans_scanRunId_fkey" FOREIGN KEY ("scanRunId") REFERENCES "scan_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_extensions" ADD CONSTRAINT "data_extensions_scanRunId_fkey" FOREIGN KEY ("scanRunId") REFERENCES "scan_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journeys" ADD CONSTRAINT "journeys_scanRunId_fkey" FOREIGN KEY ("scanRunId") REFERENCES "scan_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automations" ADD CONSTRAINT "automations_scanRunId_fkey" FOREIGN KEY ("scanRunId") REFERENCES "scan_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_assets" ADD CONSTRAINT "email_assets_scanRunId_fkey" FOREIGN KEY ("scanRunId") REFERENCES "scan_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sfmc_users" ADD CONSTRAINT "sfmc_users_scanRunId_fkey" FOREIGN KEY ("scanRunId") REFERENCES "scan_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_scanRunId_fkey" FOREIGN KEY ("scanRunId") REFERENCES "scan_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_scores" ADD CONSTRAINT "health_scores_scanRunId_fkey" FOREIGN KEY ("scanRunId") REFERENCES "scan_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_reports" ADD CONSTRAINT "ai_reports_scanRunId_fkey" FOREIGN KEY ("scanRunId") REFERENCES "scan_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_scanRunId_fkey" FOREIGN KEY ("scanRunId") REFERENCES "scan_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

