# MC Pulse

Health check SaaS para Salesforce Marketing Cloud — conecta no seu ambiente SFMC, varre configurações, aplica motor de regras e entrega score de saúde + findings priorizados + plano de ação gerado por IA.

## Deploy rápido (modo demo)

Testar só o frontend com dados fictícios, sem backend:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fduduteixeira%2Fmc-pulse&project-name=mc-pulse&repository-name=mc-pulse&root-directory=apps%2Fweb&env=NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,CLERK_SECRET_KEY,NEXT_PUBLIC_DEMO_MODE,NEXT_PUBLIC_API_URL&envDescription=Clerk+keys+de+https%3A%2F%2Fdashboard.clerk.com.+Use+NEXT_PUBLIC_DEMO_MODE%3Dtrue+e+NEXT_PUBLIC_API_URL%3Dhttp%3A%2F%2Funused-in-demo)

Passo a passo detalhado: [`DEPLOY_VERCEL_DEMO.md`](./DEPLOY_VERCEL_DEMO.md)

## Rodando tudo localmente (frontend + backend real)

Guia passo a passo: [`GETTING_STARTED.md`](./GETTING_STARTED.md)

## Estrutura do repo

```
mc-pulse/
├── apps/
│   ├── api/          # Backend NestJS (Prisma + BullMQ + Redis + Clerk)
│   └── web/          # Frontend Next.js 14 (Clerk + Tailwind + Tremor)
├── docker-compose.yml   # Postgres + Redis para dev local
├── GETTING_STARTED.md
├── DEPLOY_VERCEL_DEMO.md
└── README.md
```

## Stack

- **Backend**: NestJS · Prisma · PostgreSQL · BullMQ · Redis · Clerk · Anthropic SDK · Puppeteer
- **Frontend**: Next.js 14 (App Router) · Clerk · Tailwind · Tremor · TanStack Query
- **Infra**: Docker Compose (dev) · Vercel (frontend) · Railway/Fly (backend)

## Funcionalidades implementadas

- Autenticação da plataforma via Clerk (com auto-sync de usuário)
- Conexão OAuth2 ao SFMC com credenciais criptografadas em AES-256-GCM
- Scanner paralelo de 6 domínios (Governança, Dados, Jornadas, Automações, Email, Segurança)
- 22 regras técnicas implementadas (todas do PRD)
- Motor de regras desacoplado e testável
- Health score ponderado com classificação (Saudável/Atenção/Risco/Crítico)
- Progresso de scan em tempo real via Server-Sent Events
- Relatório executivo, análise técnica e plano 30/60/90 gerados por Claude (Anthropic)
- Export de PDF executivo e técnico via Puppeteer
- Histórico de scans e comparação entre scans (delta de findings)
- Notificações de deterioração de score
- Rate limiter por tenant com circuit breaker
- Dashboard completo com filtros, ações e visualizações
