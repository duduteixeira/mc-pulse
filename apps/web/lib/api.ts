import axios, { AxiosInstance } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/**
 * Cria uma instância axios com o token do Clerk injetado no header.
 * Deve ser usada a partir de componentes/hooks client-side via `useApi()`.
 */
export function createApiClient(token: string | null): AxiosInstance {
  return axios.create({
    baseURL: API_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    timeout: 30_000,
  });
}

export const SSE_URL = (scanId: string): string => `${API_URL}/scans/${scanId}/progress`;
