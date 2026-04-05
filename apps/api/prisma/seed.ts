/**
 * Seed script — popula o banco com dados de demonstração realistas.
 *
 * Cria:
 * - 1 tenant "Demo Workspace"
 * - 1 usuário OWNER (tem que ser reconciliado depois pelo Clerk ao logar)
 * - 2 conexões SFMC (1 ACTIVE, 1 FAILED)
 * - 8 scan runs históricos na conexão ativa com score crescente
 * - Findings realistas no último scan em todas as categorias
 * - Health score calculado
 * - AI report de amostra
 *
 * Uso:
 *   npm run seed --workspace=apps/api
 *
 * IMPORTANTE: O clerkId do usuário é um placeholder. Ao logar pela primeira
 * vez via Clerk, o ClerkGuard vai criar um novo usuário + tenant — o seed
 * serve apenas como dados de exemplo para navegar no banco/admin.
 */
import {
  PrismaClient,
  Plan,
  UserRole,
  IntegrationType,
  ConnectionStatus,
  ScanStatus,
  DomainStatus,
  ScanDomain,
  FindingCategory,
  Severity,
  Effort,
  FindingStatus,
  AiReportStatus,
} from '@prisma/client';
import { encrypt } from '../src/common/utils/encryption.util';

const prisma = new PrismaClient();

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function main(): Promise<void> {
  console.log('🌱 Seed: limpando dados existentes…');
  // Limpa em ordem de dependência
  await prisma.finding.deleteMany();
  await prisma.healthScore.deleteMany();
  await prisma.aiReport.deleteMany();
  await prisma.dataExtension.deleteMany();
  await prisma.journey.deleteMany();
  await prisma.automation.deleteMany();
  await prisma.emailAsset.deleteMany();
  await prisma.sfmcUser.deleteMany();
  await prisma.report.deleteMany();
  await prisma.domainScan.deleteMany();
  await prisma.scanRun.deleteMany();
  await prisma.businessUnit.deleteMany();
  await prisma.packageScope.deleteMany();
  await prisma.sfmcConnection.deleteMany();
  await prisma.user.deleteMany({ where: { clerkId: { startsWith: 'seed_' } } });
  await prisma.tenant.deleteMany({ where: { name: { startsWith: 'Demo Workspace' } } });

  console.log('🌱 Seed: criando tenant e usuário…');
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Demo Workspace',
      plan: Plan.PRO,
    },
  });

  await prisma.user.create({
    data: {
      clerkId: 'seed_placeholder_user',
      email: 'demo@mc-pulse.local',
      name: 'Demo User',
      role: UserRole.OWNER,
      tenantId: tenant.id,
    },
  });

  console.log('🌱 Seed: criando conexões SFMC…');
  const connActive = await prisma.sfmcConnection.create({
    data: {
      tenantId: tenant.id,
      name: 'Produção — Acme Corp',
      subdomain: 'mc6xxxxxxxxxxxxxxxxxx',
      accountId: '7891234',
      clientId: 'abc123def456ghi789',
      clientSecretEnc: encrypt('seed-fake-secret-will-not-authenticate'),
      integrationType: IntegrationType.MULTI_BU,
      status: ConnectionStatus.ACTIVE,
      lastTestedAt: new Date(),
      createdAt: daysAgo(45),
    },
  });

  await prisma.sfmcConnection.create({
    data: {
      tenantId: tenant.id,
      name: 'Sandbox',
      subdomain: 'mc7yyyyyyyyyyyyyyyyyy',
      accountId: '7891235',
      clientId: 'xyz789uvw456rst123',
      clientSecretEnc: encrypt('seed-fake-secret-sandbox'),
      integrationType: IntegrationType.SINGLE_BU,
      status: ConnectionStatus.FAILED,
      lastTestedAt: daysAgo(2),
      errorMessage: 'Falha ao autenticar com o SFMC',
      createdAt: daysAgo(10),
    },
  });

  console.log('🌱 Seed: criando scan runs históricos…');
  // 7 scans antigos com score crescente
  for (let i = 0; i < 7; i += 1) {
    const days = (7 - i) * 7;
    const createdAt = daysAgo(days);
    const base = 58 + i * 2.1;
    const scan = await prisma.scanRun.create({
      data: {
        tenantId: tenant.id,
        connectionId: connActive.id,
        status: ScanStatus.COMPLETED,
        startedAt: createdAt,
        completedAt: createdAt,
        createdAt,
        domainScans: {
          create: [
            ScanDomain.GOVERNANCE,
            ScanDomain.DATA,
            ScanDomain.JOURNEY,
            ScanDomain.AUTOMATION,
          ].map((domain) => ({
            domain,
            status: DomainStatus.COMPLETED,
            itemsCollected: Math.floor(Math.random() * 80) + 20,
            startedAt: createdAt,
            completedAt: createdAt,
          })),
        },
      },
    });
    await prisma.healthScore.create({
      data: {
        scanRunId: scan.id,
        scoreOverall: Math.round(base * 10) / 10,
        scoreGovernance: Math.round((base + 10) * 10) / 10,
        scoreData: Math.round((base - 8) * 10) / 10,
        scoreJourney: Math.round((base + 4) * 10) / 10,
        scoreAutomation: Math.round((base - 5) * 10) / 10,
        classification: base >= 75 ? 'Atenção' : base >= 50 ? 'Risco' : 'Crítico',
        totalFindings: 35 - i,
        criticalCount: 4 - Math.floor(i / 2),
        highCount: 9 - i,
        mediumCount: 14,
        lowCount: 8,
      },
    });
  }

  console.log('🌱 Seed: criando scan mais recente com findings completos…');
  const latestScan = await prisma.scanRun.create({
    data: {
      tenantId: tenant.id,
      connectionId: connActive.id,
      status: ScanStatus.COMPLETED,
      startedAt: daysAgo(1),
      completedAt: daysAgo(1),
      createdAt: daysAgo(1),
      domainScans: {
        create: [
          ScanDomain.GOVERNANCE,
          ScanDomain.DATA,
          ScanDomain.JOURNEY,
          ScanDomain.AUTOMATION,
          ScanDomain.EMAIL,
          ScanDomain.SECURITY,
        ].map((domain) => ({
          domain,
          status: DomainStatus.COMPLETED,
          itemsCollected: Math.floor(Math.random() * 80) + 20,
          startedAt: daysAgo(1),
          completedAt: daysAgo(1),
        })),
      },
    },
  });

  const findings = [
    {
      ruleId: 'AUT-001',
      category: FindingCategory.AUTOMATION,
      severity: Severity.CRITICAL,
      objectType: 'Automation',
      objectName: 'Nightly_Customer_Sync',
      evidence: 'Última execução terminou em estado: Error',
      ruleViolated: 'Automations não devem terminar em estado de erro',
      impact: 'Processos de negócio interrompidos silenciosamente',
      recommendation: 'Investigar logs e corrigir a causa raiz da falha',
      effort: Effort.MEDIUM,
      priority: 200,
    },
    {
      ruleId: 'SEC-001',
      category: FindingCategory.SECURITY,
      severity: Severity.CRITICAL,
      objectType: 'InstalledPackage',
      objectName: 'Legacy_API_Integration',
      evidence: '6/8 escopos são de escrita',
      ruleViolated: 'Packages devem ter apenas os escopos estritamente necessários',
      impact: 'Credencial comprometida pode alterar dados produtivos do SFMC',
      recommendation: 'Revisar escopos e remover os de escrita que não forem usados',
      effort: Effort.MEDIUM,
      priority: 200,
    },
    {
      ruleId: 'DATA-001',
      category: FindingCategory.DATA,
      severity: Severity.HIGH,
      objectType: 'DataExtension',
      objectName: 'Newsletter_Subscribers_2023',
      evidence: 'Data Extension sem retention policy configurada',
      ruleViolated: 'Toda DE deve ter política de retenção de dados',
      impact: 'Armazenamento crescente indefinido, risco de LGPD/GDPR',
      recommendation: 'Configurar retention policy adequada',
      effort: Effort.LOW,
      priority: 210,
    },
    {
      ruleId: 'DATA-002',
      category: FindingCategory.DATA,
      severity: Severity.HIGH,
      objectType: 'DataExtension',
      objectName: 'Product_Catalog_Extended',
      evidence: 'Data Extension sem primary key definida',
      ruleViolated: 'Data Extensions devem ter primary key para evitar duplicidade',
      impact: 'Registros duplicados, inconsistência em lookups e jornadas',
      recommendation: 'Definir primary key apropriada',
      effort: Effort.MEDIUM,
      priority: 140,
    },
    {
      ruleId: 'JRN-001',
      category: FindingCategory.JOURNEY,
      severity: Severity.HIGH,
      objectType: 'Journey',
      objectName: 'Welcome Series — BR',
      evidence: 'Journey ativa há 223 dias sem modificação',
      ruleViolated: 'Journeys ativas devem ser revisadas ao menos a cada 180 dias',
      impact: 'Conteúdo obsoleto entregue aos contatos',
      recommendation: 'Revisar conteúdo, entradas e saídas',
      effort: Effort.MEDIUM,
      priority: 140,
    },
    {
      ruleId: 'EML-002',
      category: FindingCategory.EMAIL,
      severity: Severity.HIGH,
      objectType: 'SendClassification',
      objectName: 'Default Commercial',
      evidence: 'Send Classification sem Delivery Profile vinculado',
      ruleViolated: 'Send Classifications devem ter Delivery Profile associado',
      impact: 'Envios podem usar configuração incorreta',
      recommendation: 'Associar Delivery Profile apropriado',
      effort: Effort.LOW,
      priority: 210,
    },
    {
      ruleId: 'GOV-002',
      category: FindingCategory.GOVERNANCE,
      severity: Severity.HIGH,
      objectType: 'Account',
      objectName: 'Account-level',
      evidence: '8/22 usuários ativos são admin (36%)',
      ruleViolated: 'Admins não devem ultrapassar 20% dos usuários ativos',
      impact: 'Risco de alterações não autorizadas',
      recommendation: 'Revogar role Admin de usuários desnecessários',
      effort: Effort.MEDIUM,
      priority: 140,
    },
    {
      ruleId: 'DATA-003',
      category: FindingCategory.DATA,
      severity: Severity.MEDIUM,
      objectType: 'DataExtension',
      objectName: 'temp_testing_de',
      evidence: 'Nome fora do padrão de nomenclatura',
      ruleViolated: 'Data Extensions devem seguir convenção de nomenclatura',
      impact: 'Dificuldade de governança e busca',
      recommendation: 'Padronizar nomes com prefixos por tipo/ambiente',
      effort: Effort.MEDIUM,
      priority: 80,
    },
    {
      ruleId: 'AUT-002',
      category: FindingCategory.AUTOMATION,
      severity: Severity.MEDIUM,
      objectType: 'Automation',
      objectName: 'Data_Enrichment_Manual',
      evidence: 'Automation ativa sem schedule configurado',
      ruleViolated: 'Automations recorrentes devem ter schedule',
      impact: 'Execução manual causa falhas operacionais',
      recommendation: 'Definir schedule ou documentar motivo',
      effort: Effort.LOW,
      priority: 120,
    },
    {
      ruleId: 'AUT-003',
      category: FindingCategory.AUTOMATION,
      severity: Severity.LOW,
      objectType: 'Automation',
      objectName: 'Old_Import_Routine',
      evidence: 'Automation sem descrição/documentação',
      ruleViolated: 'Automations devem ter descrição clara',
      impact: 'Dificuldade de manutenção',
      recommendation: 'Adicionar descrição',
      effort: Effort.LOW,
      priority: 60,
    },
  ];

  await prisma.finding.createMany({
    data: findings.map((f) => ({
      ...f,
      scanRunId: latestScan.id,
      status: FindingStatus.OPEN,
    })),
  });

  await prisma.healthScore.create({
    data: {
      scanRunId: latestScan.id,
      scoreOverall: 72.4,
      scoreGovernance: 85,
      scoreData: 55,
      scoreJourney: 78,
      scoreAutomation: 62,
      scoreEmail: 80,
      scoreSecurity: 75,
      classification: 'Risco',
      totalFindings: findings.length,
      criticalCount: findings.filter((f) => f.severity === Severity.CRITICAL).length,
      highCount: findings.filter((f) => f.severity === Severity.HIGH).length,
      mediumCount: findings.filter((f) => f.severity === Severity.MEDIUM).length,
      lowCount: findings.filter((f) => f.severity === Severity.LOW).length,
    },
  });

  console.log('🌱 Seed: criando AI report de amostra…');
  await prisma.aiReport.create({
    data: {
      scanRunId: latestScan.id,
      status: AiReportStatus.COMPLETED,
      generatedAt: daysAgo(1),
      executiveSummary:
        'O ambiente Salesforce Marketing Cloud apresenta sinais claros de envelhecimento técnico sem uma rotina de higienização proporcional ao seu volume de uso. O score geral de 72 — classificado como "Risco" — é puxado principalmente pela ausência de políticas de retenção em Data Extensions críticas e por escopos excessivamente amplos em pacotes de integração legados.\n\nOs dois riscos mais urgentes são a automação Nightly_Customer_Sync falhando silenciosamente e o pacote Legacy_API_Integration concentrando escopos de escrita e leitura simultâneos.',
      technicalAnalysis:
        '### Governança\n22 usuários ativos e 8 admins — proporção acima do recomendado.\n\n### Dados\nO domínio mais penalizado. 9 DEs sem retention policy e 4 sem primary key.\n\n### Automações\nFalha crítica em Nightly_Customer_Sync.',
      actionPlan30:
        '## 30 dias — Urgências\n\n1. **Investigar falha em Nightly_Customer_Sync** [AUT-001]\n2. **Rotacionar client secret** do Legacy_API_Integration [SEC-002]\n3. **Associar Delivery Profile** à SendClassification "Default Commercial" [EML-002]',
      actionPlan60:
        '## 31–60 dias — Estruturação\n\n1. **Reduzir escopos** do pacote Legacy_API_Integration [SEC-001]\n2. **Revisar Welcome Series — BR** [JRN-001]\n3. **Plano de redução de admins** [GOV-002]',
      actionPlan90:
        '## 61–90 dias — Higienização\n\n1. **Padronizar nomenclatura** [DATA-003]\n2. **Documentar automations** [AUT-003]',
      operationalChecklist:
        '- [ ] [AUT-001] Nightly_Customer_Sync — Ops — Médio — 2 dias\n- [ ] [SEC-002] Rotação de client secret — Security — Baixo — 7 dias\n- [ ] [EML-002] Associar Delivery Profile — Marketing Ops — Baixo — 3 dias',
    },
  });

  console.log('✅ Seed concluído!');
  console.log(`   · Tenant: ${tenant.id}`);
  console.log(`   · Conexão ativa: ${connActive.id}`);
  console.log(`   · Último scan: ${latestScan.id} (score 72.4)`);
  console.log(`   · Findings: ${findings.length}`);
}

main()
  .catch((err) => {
    console.error('❌ Seed falhou:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
