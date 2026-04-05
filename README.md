# MC Pulse — Backend API

Health check SaaS para Salesforce Marketing Cloud.

## Setup local

### 1. Pré-requisitos
- Node.js 20+
- PostgreSQL (local, Neon, Railway)
- Redis (local, Upstash, Railway)

### 2. Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/mcpulse?schema=public
REDIS_URL=redis://localhost:6379
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
ANTHROPIC_API_KEY=sk-ant-...
ENCRYPTION_KEY=<64 chars hex>   # ver seção abaixo
```

Gere uma `ENCRYPTION_KEY` válida:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Instalação

```bash
PUPPETEER_SKIP_DOWNLOAD=true npm install
npm run prisma:generate
```

### 4. Banco de dados

Primeira migration (só rodar uma vez, localmente ou no CI com `DATABASE_URL` apontando para uma base vazia):

```bash
npm run prisma:migrate -- --name init
```

Em produção:
```bash
npm run prisma:deploy
```

### 5. Rodar

```bash
npm run start:dev
```

A API sobe em `http://localhost:3001`:
- `GET /health` — healthcheck
- `GET /docs` — Swagger
- `GET /admin/queues` — BullBoard (apenas quando `NODE_ENV !== production`)

## Testes

```bash
npm test
```

## Arquitetura

- **NestJS** (Clean Architecture por módulo)
- **Prisma** + PostgreSQL (row-level isolation por `tenantId`)
- **BullMQ** + Redis (um job por domínio de scanner)
- **Clerk** (autenticação da plataforma, webhook sync)
- **Claude API** (relatórios executivos via `ai-report` job)
- **AES-256-GCM** (credenciais SFMC criptografadas)
- **Read-only no SFMC** — apenas `GET` (REST) e `Retrieve` (SOAP)

Veja `CLAUDE.md`, `PRD.md`, `ARCH.md`, `SCHEMA.md` para a especificação completa.

## Rate limiting SFMC

Todas as chamadas às APIs do SFMC passam por `SfmcRateLimiter`:
- Máx 10 chamadas SOAP simultâneas por tenant
- Máx 20 chamadas REST simultâneas por tenant
- Delay mínimo de 100ms entre chamadas do mesmo semáforo
- Circuit breaker: 5 falhas consecutivas → pausa por 60s
