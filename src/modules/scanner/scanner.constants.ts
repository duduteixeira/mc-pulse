import { ScanDomain } from '@prisma/client';

export const SCANNER_QUEUE = 'scanner-queue';

/**
 * Domínios ativos no scanner. Fase 1 implementou GOV/DATA/JRN/AUT;
 * Fase 2 adiciona EMAIL e SECURITY.
 */
export const ACTIVE_DOMAINS: ScanDomain[] = [
  ScanDomain.GOVERNANCE,
  ScanDomain.DATA,
  ScanDomain.JOURNEY,
  ScanDomain.AUTOMATION,
  ScanDomain.EMAIL,
  ScanDomain.SECURITY,
];

/** @deprecated use ACTIVE_DOMAINS */
export const PHASE_ONE_DOMAINS = ACTIVE_DOMAINS;

export interface ScanJobData {
  scanRunId: string;
  tenantId: string;
  connectionId: string;
  domain: ScanDomain;
}

export const SCAN_PROGRESS_CHANNEL = (scanRunId: string): string =>
  `scan:progress:${scanRunId}`;
