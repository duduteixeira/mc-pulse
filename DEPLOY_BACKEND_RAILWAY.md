# Deploy do backend no Railway

Guia para subir o backend MC Pulse em produção no Railway, com Postgres + Redis managed, e conectar no frontend da Vercel em modo real (não-demo).

## Pré-requisitos

- Conta no [Railway](https://railway.app) (tier Hobby $5/mês grátis no trial)
- Repo `mc-pulse` no GitHub (ou fork)
- Backend já tem `Dockerfile` + `railway.json` na raiz do repo
- Migration inicial do Prisma versionada em `apps/api/prisma/migrations/`
- Keys do Clerk, Anthropic

## 1. Criar projeto no Railway

1. Acesse https://railway.app/new
2. Clique **Deploy from GitHub repo**
3. Selecione o repo `mc-pulse`
4. Railway detecta o `railway.json` e o `Dockerfile` automaticamente

## 2. Adicionar Postgres e Redis

No painel do projeto:

1. **+ New** → **Database** → **Add PostgreSQL** (cria banco managed)
2. **+ New** → **Database** → **Add Redis** (cria cache managed)

## 3. Configurar variáveis de ambiente do backend

No serviço do backend, aba **Variables**, adicione:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (referência ao serviço do Postgres) |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` (referência ao serviço do Redis) |
| `ENCRYPTION_KEY` | Gere com: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `CLERK_SECRET_KEY` | Sua `sk_test_...` ou `sk_live_...` do Clerk |
| `CLERK_WEBHOOK_SECRET` | Da tela Webhooks no Clerk (após criar webhook — ver passo 6) |
| `ANTHROPIC_API_KEY` | Sua `sk-ant-...` da Anthropic |
| `NODE_ENV` | `production` |
| `PORT` | `3001` |

> ⚠️ **IMPORTANTE**: `ENCRYPTION_KEY` criptografa as credenciais SFMC no banco. Se você perdê-la, todas as conexões cadastradas ficam inacessíveis. Guarde em um secret manager (1Password, Bitwarden, Doppler).

## 4. Deploy

Ao salvar as variáveis, o Railway já inicia o build automaticamente.
O Dockerfile multi-stage:

1. Instala dependências (com cache de layer)
2. Gera Prisma client e compila TypeScript
3. Instala Chromium para Puppeteer (PDFs)
4. Roda como usuário não-root com `tini` como init
5. Executa `prisma migrate deploy` antes de subir o servidor

Logs em tempo real no painel. O healthcheck bate em `/health` a cada 30s.

## 5. Pegar a URL pública

No serviço do backend → aba **Settings** → **Networking** → **Generate Domain**.
A URL será algo como `mc-pulse-api-production.up.railway.app`.

Teste rapidamente:

```bash
curl https://seu-backend.up.railway.app/health
# {"status":"ok","db":true,"timestamp":"..."}
```

## 6. Configurar webhook do Clerk (recomendado em produção)

Para sincronizar usuários automaticamente em vez de depender do auto-sync no primeiro login:

1. Clerk Dashboard → **Webhooks** → **Add Endpoint**
2. Endpoint URL: `https://seu-backend.up.railway.app/webhooks/clerk`
3. Events: marque `user.created`, `user.updated`, `user.deleted`
4. Copie o **Signing Secret** (whsec_...) e cole na variável `CLERK_WEBHOOK_SECRET` no Railway
5. Redeploy do backend

## 7. Conectar o frontend da Vercel ao backend

Na Vercel, projeto do `mc-pulse` (apps/web):

1. **Settings** → **Environment Variables**
2. Edite `NEXT_PUBLIC_DEMO_MODE` → `false`
3. Edite `NEXT_PUBLIC_API_URL` → `https://seu-backend.up.railway.app`
4. Redeploy (Deployments → último → Redeploy)

Agora o frontend chama o backend real. O banner amarelo de "modo demo" some.

## 8. (Opcional) Seed de dados de demonstração

Para popular o banco com dados de amostra realistas:

```bash
# Localmente com DATABASE_URL apontando para o Railway
DATABASE_URL="<URL do Railway>" npm run seed --workspace=apps/api
```

Cria 1 tenant, 2 conexões, 8 scan runs históricos, findings completos e 1 AI report de amostra. Útil para dar walkthrough do produto sem precisar de um SFMC real.

> ⚠️ O seed limpa os dados antes. Não rode em produção com dados reais.

## 9. Testar ponta a ponta

1. Abra o frontend na Vercel
2. Faça sign-up via Clerk
3. Cadastre uma conexão SFMC real (ou fake para testar o fluxo)
4. Clique em **Novo scan** → selecione os domínios → dispara
5. Acompanhe o progresso em tempo real via SSE
6. Quando terminar, veja findings, score e o relatório IA gerado pelo Claude

## Custos estimados (Railway Hobby)

| Serviço | Custo |
|---|---|
| Backend (1 replica, 512MB RAM) | ~$2-4/mês |
| Postgres (1GB) | ~$5/mês |
| Redis (256MB) | ~$3/mês |
| **Total** | **~$10-12/mês** |

Para começar e testar, o trial de $5 cobre ~1 semana completa.

## Alternativas ao Railway

- **Fly.io**: Dockerfile funciona igual, configure `fly.toml` separado
- **Render**: também suporta Dockerfile + PG/Redis managed
- **AWS ECS / GCP Cloud Run**: viável mas trabalho de setup maior

O único requisito do backend é: Docker + Postgres + Redis. Roda em qualquer lugar que suporte os três.

## Troubleshooting

### "ENCRYPTION_KEY inválida"
Confira: 64 caracteres hexadecimais. Gere novamente com o comando do passo 3.

### "relation does not exist"
Migration não rodou. Confira os logs do deploy: a última linha antes do `main.js` deve ser `X migrations have been applied`. Se não apareceu, rode manualmente via Railway CLI:
```bash
railway run npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
```

### "Cannot find Chromium"
O Dockerfile instala o Chromium em `/usr/bin/chromium` e setamos `PUPPETEER_EXECUTABLE_PATH`. Se o PDF ainda falhar, confira os logs do Puppeteer e aumente a memória do serviço (Chromium precisa de ~256MB livres).

### SSE não funciona
Railway suporta SSE nativamente, mas alguns proxies intermediários não. Se o progresso não aparecer em tempo real no frontend mas os scans terminarem normalmente, é provável que seja buffering de proxy — o scan funciona, só o live-update falha. O frontend tem fallback de polling em caso de desconexão.
