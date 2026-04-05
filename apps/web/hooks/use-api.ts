'use client';

import { useAuth } from '@clerk/nextjs';
import { useMemo } from 'react';
import { createApiClient } from '@/lib/api';
import { createMockApiClient, isDemoMode } from '@/lib/mock-client';
import type { AxiosInstance } from 'axios';

/**
 * Retorna um axios autenticado que busca o token do Clerk a cada request.
 * Em NEXT_PUBLIC_DEMO_MODE=true retorna um cliente mockado in-memory.
 */
export function useApi(): AxiosInstance {
  const { getToken } = useAuth();
  return useMemo(() => {
    if (isDemoMode()) {
      return createMockApiClient();
    }
    const client = createApiClient(null);
    client.interceptors.request.use(async (config) => {
      const token = await getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
    return client;
  }, [getToken]);
}
