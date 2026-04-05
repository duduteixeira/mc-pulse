export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type FindingCategory =
  | 'GOVERNANCE'
  | 'DATA'
  | 'JOURNEY'
  | 'AUTOMATION'
  | 'EMAIL'
  | 'SECURITY';
export type FindingStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'IGNORED';
export type ScanStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PARTIAL';
export type DomainStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
export type ScanDomain = FindingCategory;
export type IntegrationType = 'SINGLE_BU' | 'MULTI_BU' | 'ACCOUNT_LEVEL';
export type ConnectionStatus = 'PENDING' | 'ACTIVE' | 'FAILED' | 'EXPIRED';

export interface Connection {
  id: string;
  name: string;
  subdomain: string;
  accountId: string;
  clientId: string;
  integrationType: IntegrationType;
  status: ConnectionStatus;
  lastTestedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface Finding {
  id: string;
  ruleId: string;
  category: FindingCategory;
  severity: Severity;
  objectType: string;
  objectId: string | null;
  objectName: string | null;
  evidence: string;
  ruleViolated: string;
  impact: string;
  recommendation: string;
  effort: 'LOW' | 'MEDIUM' | 'HIGH';
  priority: number;
  status: FindingStatus;
  createdAt: string;
}

export interface HealthScore {
  id: string;
  scanRunId: string;
  scoreOverall: number;
  scoreGovernance: number | null;
  scoreData: number | null;
  scoreJourney: number | null;
  scoreAutomation: number | null;
  scoreEmail: number | null;
  scoreSecurity: number | null;
  classification: string;
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

export interface DomainScan {
  id: string;
  domain: ScanDomain;
  status: DomainStatus;
  itemsCollected: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface ScanRun {
  id: string;
  status: ScanStatus;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  connectionId: string;
  domainScans: DomainScan[];
  healthScore: HealthScore | null;
}

export interface ProgressEvent {
  scanRunId: string;
  domain?: ScanDomain;
  status: string;
  itemsCollected?: number;
  error?: string;
  overallScore?: number;
}

export interface AiReport {
  id: string;
  status: 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED';
  executiveSummary: string | null;
  technicalAnalysis: string | null;
  actionPlan30: string | null;
  actionPlan60: string | null;
  actionPlan90: string | null;
  operationalChecklist: string | null;
  generatedAt: string | null;
}
