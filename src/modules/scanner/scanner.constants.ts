import { ScanDomain } from '@prisma/client';

export const SCANNER_QUEUE = 'scanner-queue';

/**
 * Domínios que rodam na Fase 1 do MVP.
 */
export const PHASE_ONE_DOMAINS: ScanDomain[] = [
  ScanDomain.GOVERNANCE,
  ScanDomain.DATA,
  ScanDomain.JOURNEY,
  ScanDomain.AUTOMATION,
];

export interface ScanJobData {
  scanRunId: string;
  tenantId: string;
  connectionId: string;
  domain: ScanDomain;
}

export const SCAN_PROGRESS_CHANNEL = (scanRunId: string): string =>
  `scan:progress:${scanRunId}`;
