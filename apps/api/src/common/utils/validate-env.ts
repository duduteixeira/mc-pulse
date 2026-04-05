/**
 * Valida as variáveis de ambiente obrigatórias no boot da aplicação.
 * Falha rápido com mensagem clara se alguma estiver faltando ou inválida,
 * em vez de quebrar em runtime no primeiro request que depende delas.
 */

interface EnvSpec {
  name: string;
  required: boolean;
  description: string;
  validate?: (value: string) => string | null; // retorna erro ou null
}

const SPECS: EnvSpec[] = [
  {
    name: 'DATABASE_URL',
    required: true,
    description: 'Connection string do PostgreSQL',
    validate: (v) =>
      v.startsWith('postgresql://') || v.startsWith('postgres://')
        ? null
        : 'deve começar com postgresql:// ou postgres://',
  },
  {
    name: 'REDIS_URL',
    required: true,
    description: 'Connection string do Redis',
    validate: (v) =>
      v.startsWith('redis://') || v.startsWith('rediss://')
        ? null
        : 'deve começar com redis:// ou rediss://',
  },
  {
    name: 'ENCRYPTION_KEY',
    required: true,
    description: 'Chave AES-256-GCM para criptografar credenciais SFMC (32 bytes em hex)',
    validate: (v) =>
      /^[0-9a-fA-F]{64}$/.test(v)
        ? null
        : 'deve ter exatamente 64 caracteres hexadecimais (32 bytes)',
  },
  {
    name: 'CLERK_SECRET_KEY',
    required: true,
    description: 'Secret key do Clerk para validação de JWT e auto-sync',
    validate: (v) =>
      v.startsWith('sk_test_') || v.startsWith('sk_live_')
        ? null
        : 'deve começar com sk_test_ ou sk_live_',
  },
  {
    name: 'CLERK_WEBHOOK_SECRET',
    required: false,
    description: 'Secret do webhook Clerk (opcional em dev — auto-sync via ClerkGuard supre)',
  },
  {
    name: 'ANTHROPIC_API_KEY',
    required: false,
    description: 'API key da Anthropic para geração de relatório IA (opcional — jobs falham sem ela)',
    validate: (v) => (v.startsWith('sk-ant-') ? null : 'deve começar com sk-ant-'),
  },
];

export interface EnvValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function validateEnv(env: NodeJS.ProcessEnv = process.env): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const spec of SPECS) {
    const value = env[spec.name];
    if (!value || value.trim() === '') {
      if (spec.required) {
        errors.push(`[${spec.name}] ausente — ${spec.description}`);
      } else {
        warnings.push(`[${spec.name}] ausente — ${spec.description}`);
      }
      continue;
    }
    if (spec.validate) {
      const validationError = spec.validate(value);
      if (validationError) {
        errors.push(`[${spec.name}] inválida: ${validationError}`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Valida e imprime o resultado. Se houver erros, encerra o processo com código 1.
 */
export function assertEnvOrExit(): void {
  const result = validateEnv();
  if (result.warnings.length > 0) {
    console.warn('⚠️  Variáveis de ambiente opcionais ausentes:');
    for (const w of result.warnings) {
      console.warn(`   · ${w}`);
    }
  }
  if (!result.ok) {
    console.error('❌ Validação de ambiente falhou:');
    for (const e of result.errors) {
      console.error(`   · ${e}`);
    }
    console.error('');
    console.error('Veja apps/api/.env.example para o formato esperado.');
    process.exit(1);
  }
  console.log('✅ Variáveis de ambiente validadas');
}
