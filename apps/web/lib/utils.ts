import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return '—';
  return score.toFixed(1);
}

export function classifyScore(score: number): {
  label: string;
  color: 'emerald' | 'yellow' | 'orange' | 'red';
} {
  if (score >= 92) return { label: 'Saudável', color: 'emerald' };
  if (score >= 75) return { label: 'Atenção', color: 'yellow' };
  if (score >= 50) return { label: 'Risco', color: 'orange' };
  return { label: 'Crítico', color: 'red' };
}

export const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800 border-red-200',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-200',
  MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  LOW: 'bg-blue-100 text-blue-800 border-blue-200',
  INFO: 'bg-gray-100 text-gray-800 border-gray-200',
};

export const CATEGORY_LABELS: Record<string, string> = {
  GOVERNANCE: 'Governança',
  DATA: 'Dados',
  JOURNEY: 'Jornadas',
  AUTOMATION: 'Automações',
  EMAIL: 'Email',
  SECURITY: 'Segurança',
};
