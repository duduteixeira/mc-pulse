# Deploy do MC Pulse na Vercel (modo demo)

Esse guia faz deploy **apenas do frontend** (`apps/web`) em modo demo, com dados fictícios — sem precisar de backend, Postgres, Redis ou credenciais SFMC.

O que você vai conseguir testar:
- Fluxo completo de autenticação via Clerk
- Landing page
- Dashboard com score, findings, filtros
- CRUD de conexões (in-memory, reseta ao reload)
- Iniciar scan e ver o progresso animado em tempo real (SSE simulado)
- Navegação entre todas as telas

O que **não** vai funcionar em modo demo:
- Conectar de verdade num SFMC
- Relatórios PDF (dependem do backend)
- Persistência entre reloads
- AI report dinâmico (mostra um de amostra fixo)

---

## Pré-requisitos

- Conta **Clerk** (gratuita) — https://dashboard.clerk.com
- Conta **Vercel** (gratuita) — https://vercel.com
- Este repo em algum GitHub seu (ou fork)

## Passo 1 — Criar aplicação no Clerk

1. Acesse https://dashboard.clerk.com e faça login
2. Crie uma nova aplicação
3. Escolha os métodos de login (Email + Password é suficiente)
4. Em **API Keys**, anote:
   - `Publishable key` — começa com `pk_test_...`
   - `Secret key` — começa com `sk_test_...`

## Passo 2 — Criar projeto na Vercel

1. Vá em https://vercel.com/new
2. Importe o repositório `mc-pulse`
3. **IMPORTANTE** — em "Configure Project":
   - **Root Directory**: clique em "Edit" e selecione `apps/web`
   - **Framework Preset**: Next.js (detectado automaticamente)
   - Install Command, Build Command, Output Directory: deixar os padrões

## Passo 3 — Configurar variáveis de ambiente

Na tela de criação do projeto (ou depois em Settings → Environment Variables), adicione:

| Nome | Valor |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_...` (do Clerk) |
| `CLERK_SECRET_KEY` | `sk_test_...` (do Clerk) |
| `NEXT_PUBLIC_DEMO_MODE` | `true` |
| `NEXT_PUBLIC_API_URL` | `http://unused-in-demo` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | `/overview` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | `/overview` |

## Passo 4 — Configurar o Clerk para aceitar o domínio Vercel

Depois do primeiro deploy, a Vercel dá um domínio tipo `mc-pulse-xxx.vercel.app`.

1. Volte no Clerk Dashboard → sua aplicação → **Domains**
2. Adicione o domínio da Vercel (ou use o satellite domains / development instance que já aceita qualquer origem `*.vercel.app` em dev)

## Passo 5 — Deploy

Clique em **Deploy**. Em ~2 min o site estará no ar.

## Testando

1. Acesse a URL que a Vercel deu
2. Clique em **"Começar grátis"** e crie uma conta no Clerk
3. Você será redirecionado para `/overview`
4. Um **banner amarelo no topo** indica que está em modo demo
5. Explore:
   - **Overview** — score de 72 (Risco), breakdown por domínio, findings críticos
   - **Conexões** — 2 conexões pré-populadas (1 ativa, 1 falhou), teste o botão "Nova conexão"
   - **Findings** — 15 findings pré-populados, teste os filtros por categoria/severidade/status e os botões de ação (Reconhecer/Resolver/Ignorar)
   - **Iniciar scan** — clique numa conexão ativa e em "Iniciar scan". Você será levado para `/scans/:id` e verá o progresso animado dos 6 domínios ao longo de ~12s
6. Os dados mockados ficam in-memory por aba — fazer reload reseta tudo

## Alternar entre modo demo e modo real

- **Modo demo**: `NEXT_PUBLIC_DEMO_MODE=true` (deployado na Vercel)
- **Modo real**: `NEXT_PUBLIC_DEMO_MODE=false` + `NEXT_PUBLIC_API_URL` apontando pro backend real (ver `GETTING_STARTED.md`)

## Problemas comuns

- **"Invalid publishable key"** no build: confira se copiou a `pk_test_` exata do Clerk e se está como env var na Vercel.
- **Dashboard tela branca**: abra o devtools, provavelmente é erro de auth com Clerk. Verifique os domínios habilitados no Clerk Dashboard.
- **"npm ERR! workspace not found"** no build: confirme que o Root Directory na Vercel está como `apps/web`.
