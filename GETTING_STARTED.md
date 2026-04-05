# Rodando o MC Pulse localmente

Guia curto para ter backend + frontend rodando em ~10 minutos.

## Pré-requisitos

- **Node.js 20+**
- **Docker** (para Postgres + Redis)
- Conta **Clerk** (gratuita — https://dashboard.clerk.com)
- (Opcional) `ANTHROPIC_API_KEY` se quiser que os relatórios de IA sejam gerados

## 1. Subir Postgres e Redis

```bash
docker compose up -d
```

Verifique:

```bash
docker compose ps
```

## 2. Criar conta Clerk e pegar as chaves

1. Acesse https://dashboard.clerk.com e crie uma conta
2. Crie uma aplicação nova (Email + Password basta)
3. Em **API Keys**, copie:
   - `Publishable key` (começa com `pk_test_...`)
   - `Secret key` (começa com `sk_test_...`)

> Webhook não é necessário em dev — o backend faz auto-sync de usuário via Clerk API no primeiro login.

## 3. Criar os `.env`

### Backend: `apps/api/.env`

```env
DATABASE_URL=postgresql://mcpulse:mcpulse@localhost:5432/mcpulse?schema=public
REDIS_URL=redis://localhost:6379
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_dev_placeholder
ANTHROPIC_API_KEY=sk-ant-...
ENCRYPTION_KEY=COLE_AQUI_O_OUTPUT_DO_COMANDO_ABAIXO
PORT=3001
NODE_ENV=development
```

Gere a `ENCRYPTION_KEY`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Frontend: `apps/web/.env.local`

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

## 4. Instalar dependências e rodar migration

```bash
PUPPETEER_SKIP_DOWNLOAD=true npm install
npm run prisma:migrate --workspace=apps/api -- --name init
```

A migration cria todas as tabelas no Postgres.

## 5. Subir backend e frontend

Em dois terminais separados:

**Terminal 1 — backend:**

```bash
npm run api:dev
```

Backend em `http://localhost:3001`.
- `GET /health` — status
- `GET /docs` — Swagger
- `GET /admin/queues` — BullBoard (filas)

**Terminal 2 — frontend:**

```bash
npm run web:dev
```

Frontend em `http://localhost:3000`.

## 6. Testar

1. Abra `http://localhost:3000`
2. Clique em **"Começar grátis"** e crie conta via Clerk
3. Você será redirecionado para `/overview` (vazio — nenhum scan ainda)
4. Vá em **Conexões → Nova conexão** e cadastre um ambiente SFMC:
   - Nome: qualquer
   - Subdomínio: o `mcXXXXX` do seu Installed Package
   - Account ID, Client ID, Client Secret: do seu Installed Package
5. Ao criar, a API já testa a conexão
6. Se `Active`, clique em **"Iniciar scan"**
7. Você será redirecionado para `/scans/:id` e vê o progresso em tempo real (SSE)
8. Quando concluir, volte em **Overview** para ver score, ou **Findings** para a lista

## Testando sem um SFMC real

Você ainda pode ver a interface completa sem conectar no SFMC:

1. Faça sign-up normalmente
2. Navegue pelas telas vazias (/overview, /connections, /findings)
3. Cadastre uma conexão com dados fictícios — o teste vai falhar, mas o cadastro persiste e você vê o fluxo

## Problemas comuns

- **"Falha ao autenticar com o SFMC"**: normal se as credenciais são fictícias; é o comportamento esperado.
- **"ENCRYPTION_KEY deve ter 32 bytes"**: rode o comando do passo 3 de novo e cole o output exato.
- **Webhook Clerk não configurado**: tudo bem em dev, o backend faz auto-sync via Clerk API.
- **Puppeteer baixando Chrome**: os PDFs precisam do Chrome — se quiser testar PDFs, rode `npx puppeteer browsers install chrome --path apps/api/node_modules/puppeteer/.local-chromium` uma vez.
- **Postgres não conecta**: verifique `docker compose ps`. Se a porta 5432 estiver ocupada, altere no `docker-compose.yml` e ajuste a `DATABASE_URL`.
