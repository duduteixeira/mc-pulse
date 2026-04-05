'use client';

import { useAuth } from '@clerk/nextjs';
import { useMemo } from 'react';
import { createApiClient } from '@/lib/api';
import type { AxiosInstance } from 'axios';

/**
 * Retorna um axios autenticado que busca o token do Clerk a cada request.
 * O token é obtido via interceptor para sempre estar fresco.
 */
export function useApi(): AxiosInstance {
  const { getToken } = useAuth();
  return useMemo(() => {
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
