'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Card, Title, Text } from '@tremor/react';
import { useApi } from '@/hooks/use-api';
import type { Connection, IntegrationType } from '@/lib/types';

interface FormState {
  name: string;
  subdomain: string;
  accountId: string;
  clientId: string;
  clientSecret: string;
  integrationType: IntegrationType;
}

export default function NewConnectionPage(): JSX.Element {
  const api = useApi();
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    name: '',
    subdomain: '',
    accountId: '',
    clientId: '',
    clientSecret: '',
    integrationType: 'SINGLE_BU',
  });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (payload: FormState) =>
      (await api.post<Connection>('/connections', payload)).data,
    onSuccess: async (created) => {
      // Testa automaticamente após criar
      await api.post(`/connections/${created.id}/test`).catch(() => null);
      router.push('/connections');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Erro ao criar conexão';
      setError(msg);
    },
  });

  const update = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Nova conexão SFMC</h1>
      <p className="text-gray-600 mb-6">
        Cadastre as credenciais OAuth2 do seu Installed Package no Marketing Cloud.
      </p>

      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            mutation.mutate(form);
          }}
          className="space-y-4"
        >
          <Field label="Nome" hint="Nome amigável para identificar esta conexão">
            <input
              required
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="Produção"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>

          <Field
            label="Subdomínio"
            hint="Prefixo antes de .marketingcloudapis.com (ex: mc6xxxxxxxxxxxxxxxxxx)"
          >
            <input
              required
              pattern="^[a-z0-9-]+$"
              value={form.subdomain}
              onChange={(e) => update('subdomain', e.target.value.toLowerCase())}
              placeholder="mc6xxxxxxxxxxxxxxxxxx"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
            />
          </Field>

          <Field label="Account ID (MID)">
            <input
              required
              value={form.accountId}
              onChange={(e) => update('accountId', e.target.value)}
              placeholder="1234567"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Client ID">
            <input
              required
              value={form.clientId}
              onChange={(e) => update('clientId', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
            />
          </Field>

          <Field
            label="Client Secret"
            hint="Será criptografado com AES-256-GCM e nunca exibido novamente"
          >
            <input
              required
              type="password"
              value={form.clientSecret}
              onChange={(e) => update('clientSecret', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
            />
          </Field>

          <Field label="Tipo de integração">
            <select
              value={form.integrationType}
              onChange={(e) => update('integrationType', e.target.value as IntegrationType)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="SINGLE_BU">Single BU</option>
              <option value="MULTI_BU">Multi BU</option>
              <option value="ACCOUNT_LEVEL">Account Level</option>
            </select>
          </Field>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:bg-gray-300"
            >
              {mutation.isPending ? 'Salvando…' : 'Criar e testar'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-900 mb-1">{label}</label>
      {children}
      {hint && <Text className="mt-1 text-xs">{hint}</Text>}
    </div>
  );
}
