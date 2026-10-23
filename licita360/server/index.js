
import 'dotenv/config';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { getCurrentAuthUser, registerAuthRoutes } from './auth.js';
import { registerAutomation } from './automation.js';

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL não configurada. Confira o arquivo .env.'
  );
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const app = express();
const PORT = Number(process.env.API_PORT || 8787);
const PNCP_BASE = 'https://pncp.gov.br/api/consulta';

const SERVER_DIR = dirname(fileURLToPath(import.meta.url));
const LEGACY_FILE = join(
  SERVER_DIR,
  'data',
  'licita360-data.json'
);

// MVP local: uma empresa padrão até implementarmos login e
// seleção de empresa por usuário.
const DEFAULT_COMPANY_ID = 'licita360-default-company';

app.use(express.json({ limit: '2mb' }));
// Registra login, cadastro, sessão e recuperação de senha.
const requireAuth = registerAuthRoutes(app, prisma);

// Protege os dados privados das empresas autenticadas.
app.use('/api/data', requireAuth);
app.use('/api/partners', requireAuth);
app.use('/api/automation', requireAuth);

function toNullableDate(value) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function toNullableNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function toText(value, fallback = '') {
  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value).trim();
}

function toDateTimeString(value) {
  return value ? value.toISOString() : '';
}

function toDateOnlyString(value) {
  return value ? value.toISOString().slice(0, 10) : '';
}

function isValidSnapshot(body) {
  return Boolean(
    body &&
    typeof body === 'object' &&
    Array.isArray(body.opportunities) &&
    Array.isArray(body.tasks) &&
    Array.isArray(body.documents) &&
    body.profile &&
    typeof body.profile === 'object' &&
    !Array.isArray(body.profile)
  );
}

async function getDefaultCompany(req) {
  const authenticatedUser = req?.user || getCurrentAuthUser();

  // Usuário autenticado: usa a empresa vinculada à conta.
  if (authenticatedUser?.companyId) {
    return prisma.company.findUniqueOrThrow({
      where: {
        id: authenticatedUser.companyId,
      },
    });
  }

  // Mantém compatibilidade com tarefas automáticas antigas
  // que ainda não recebem uma requisição de usuário.
  return prisma.company.upsert({
    where: {
      id: DEFAULT_COMPANY_ID,
    },
    update: {},
    create: {
      id: DEFAULT_COMPANY_ID,
      name: 'Minha empresa',
      uf: 'CE',
    },
  });
}

// Substitui o snapshot completo dentro de uma transação.
// Se uma operação falhar, a transação não será confirmada.
async function replaceCompanySnapshot(companyId, body) {
  if (!isValidSnapshot(body)) {
    throw new Error('O formato dos dados recebidos é inválido.');
  }

  const profile = body.profile;

  const branches = [
    ...new Set(
      (Array.isArray(profile.branches) ? profile.branches : [])
        .map((branch) => toText(branch))
        .filter(Boolean)
    ),
  ];

  const opportunityIds = new Set(
    body.opportunities
      .map((item) => toText(item.id))
      .filter(Boolean)
  );

  await prisma.$transaction(async (tx) => {
    await tx.task.deleteMany({
      where: { companyId },
    });

    await tx.document.deleteMany({
      where: { companyId },
    });

    await tx.opportunity.deleteMany({
      where: { companyId },
    });

    await tx.companyBranch.deleteMany({
      where: { companyId },
    });

    await tx.company.update({
      where: { id: companyId },
      data: {
        name: toText(profile.company, 'Minha empresa') ||
          'Minha empresa',
        uf: toText(profile.uf, 'CE') || 'CE',
      },
    });

    if (branches.length) {
      await tx.companyBranch.createMany({
        data: branches.map((name) => ({
          name,
          companyId,
        })),
      });
    }

    for (const item of body.opportunities) {
      const checklist = Array.isArray(item.tasks)
        ? item.tasks
        : [];

      const checklistTasks = checklist.map((task) => ({
        id: toText(task.id) || randomUUID(),
        title: toText(task.title, 'Tarefa sem título'),
        done: Boolean(task.done),
      }));

      await tx.opportunity.create({
        data: {
          id: toText(item.id) || randomUUID(),
          companyId,
          sourceId: toText(item.sourceId) || null,
          title: toText(item.title, 'Sem título'),
          category: toText(item.category, 'Sem categoria'),
          agency: toText(item.agency, 'Órgão não informado'),
          location: toText(item.location) || null,
          modality: toText(
            item.modality,
            'Modalidade não informada'
          ),
          amount: Math.max(0, toNumber(item.amount)),
          expectedRevenue: toNullableNumber(item.expectedRevenue),
          estimatedCost: toNullableNumber(item.estimatedCost),
          taxPercent: Math.max(0, toNumber(item.taxPercent)),
          deadline: toNullableDate(item.deadline),
          status: toText(item.status, 'Em análise'),
          source: toText(item.source, 'Manual'),
          url: toText(item.url) || null,

          checklistTasks: {
            create: checklistTasks,
          },
        },
      });
    }

    for (const item of body.tasks) {
      const linkedId = toText(item.linked);

      await tx.task.create({
        data: {
          id: toText(item.id) || randomUUID(),
          companyId,
          title: toText(item.title, 'Tarefa sem título'),
          date: toNullableDate(item.date),
          priority: toText(item.priority, 'Média'),
          done: Boolean(item.done),
          opportunityId: opportunityIds.has(linkedId)
            ? linkedId
            : null,
        },
      });
    }

    for (const item of body.documents) {
      await tx.document.create({
        data: {
          id: toText(item.id) || randomUUID(),
          companyId,
          name: toText(item.name, 'Documento sem nome'),
          type: toText(item.type, 'Outro'),
          expires: toNullableDate(item.expires),
          status: toText(item.status, 'Em dia'),
          fileName: toText(item.fileName) || null,
        },
      });
    }
  });
}

async function readCompanySnapshot(companyId) {
  const [company, branches, opportunities, tasks, documents] =
    await Promise.all([
      prisma.company.findUniqueOrThrow({
        where: { id: companyId },
      }),

      prisma.companyBranch.findMany({
        where: { companyId },
        orderBy: { name: 'asc' },
      }),

      prisma.opportunity.findMany({
        where: { companyId },
        include: { checklistTasks: true },
        orderBy: { createdAt: 'desc' },
      }),

      prisma.task.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
      }),

      prisma.document.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

  const data = {
    opportunities: opportunities.map((item) => ({
      id: item.id,
      sourceId: item.sourceId,
      title: item.title,
      category: item.category,
      agency: item.agency,
      location: item.location || '',
      modality: item.modality,
      amount: Number(item.amount),
      expectedRevenue: item.expectedRevenue === null
        ? ''
        : Number(item.expectedRevenue),
      estimatedCost: item.estimatedCost === null
        ? ''
        : Number(item.estimatedCost),
      taxPercent: Number(item.taxPercent),
      deadline: toDateTimeString(item.deadline),
      status: item.status,
      source: item.source,
      url: item.url || '',
      tasks: item.checklistTasks.map((task) => ({
        id: task.id,
        title: task.title,
        done: task.done,
      })),
    })),

    tasks: tasks.map((item) => ({
      id: item.id,
      title: item.title,
      date: toDateOnlyString(item.date),
      priority: item.priority,
      done: item.done,
      linked: item.opportunityId || '',
    })),

    documents: documents.map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      expires: toDateOnlyString(item.expires),
      status: item.status,
      fileName: item.fileName || '',
    })),

    profile: {
      company: company.name,
      branches: branches.map((branch) => branch.name),
      uf: company.uf,
    },
  };

  const hasRecords =
    opportunities.length > 0 ||
    tasks.length > 0 ||
    documents.length > 0 ||
    branches.length > 0;

  const customProfile =
    company.name !== 'Minha empresa' ||
    company.uf !== 'CE';

  const timestamps = [
    company.updatedAt.getTime(),
    ...opportunities.map((item) => item.updatedAt.getTime()),
    ...tasks.map((item) => item.updatedAt.getTime()),
    ...documents.map((item) => item.updatedAt.getTime()),
  ];

  const updatedAt = new Date(
    Math.max(...timestamps)
  ).toISOString();

  return {
    data: hasRecords || customProfile ? data : null,
    updatedAt,
  };
}

// Importação de segurança de um snapshot JSON antigo.
// O arquivo original não será apagado.
let legacyImportPromise;

async function importLegacyIfAvailable(companyId) {
  if (!legacyImportPromise) {
    legacyImportPromise = (async () => {
      try {
        const contents = await readFile(LEGACY_FILE, 'utf8');
        const parsed = JSON.parse(contents);
        const legacyData = parsed.data ?? parsed;

        if (!isValidSnapshot(legacyData)) {
          console.warn(
            'Arquivo JSON antigo encontrado, mas o formato não é compatível.'
          );
          return false;
        }

        await replaceCompanySnapshot(companyId, legacyData);

        console.log(
          'Dados antigos importados do JSON para o PostgreSQL.'
        );

        return true;
      } catch (error) {
        if (error.code === 'ENOENT') {
          return false;
        }

        console.error('Falha na importação do JSON antigo:', error);
        throw error;
      }
    })();
  }

  return legacyImportPromise;
}

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      ok: true,
      name: 'Licita360 API',
      database: 'connected',
      time: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Banco indisponível:', error);

    res.status(503).json({
      ok: false,
      name: 'Licita360 API',
      database: 'disconnected',
      error: 'Não foi possível acessar o PostgreSQL.',
    });
  }
});

// Busca os dados salvos no PostgreSQL.
app.get('/api/data', async (req, res) => {
  try {
    const company = await getDefaultCompany(req);
    let result = await readCompanySnapshot(company.id);

    if (!result.data) {
      await importLegacyIfAvailable(company.id);
      result = await readCompanySnapshot(company.id);
    }

    res.json({
      ok: true,
      data: result.data,
      updatedAt: result.updatedAt,
    });
  } catch (error) {
    console.error('Erro ao ler dados do Prisma:', error);

    res.status(500).json({
      error: 'Não foi possível carregar os dados do Licita360.',
    });
  }
});

// Salva o snapshot completo usando Prisma.
app.put('/api/data', async (req, res) => {
  if (!isValidSnapshot(req.body)) {
    return res.status(400).json({
      error:
        'Dados inválidos. São esperados opportunities, tasks, documents e profile.',
    });
  }

  try {
    const company = await getDefaultCompany(req);

    await replaceCompanySnapshot(company.id, req.body);

    res.json({
      ok: true,
      message: 'Dados salvos no PostgreSQL.',
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Erro ao salvar dados pelo Prisma:', error);

    res.status(500).json({
      error: 'Não foi possível salvar os dados no PostgreSQL.',
    });
  }
});

function firstDefined(...values) {
  return values.find(
    (value) =>
      value !== undefined &&
      value !== null &&
      value !== ''
  );
}

function toArray(payload) {
  if (Array.isArray(payload)) return payload;

  for (const key of [
    'data',
    'content',
    'items',
    'resultado',
    'resultados',
    'contratacoes',
    'lista',
  ]) {
    if (Array.isArray(payload?.[key])) {
      return payload[key];
    }
  }

  return [];
}

// Normaliza os dados retornados pelo PNCP.
function normalizeContract(row) {
  const orgao = row?.orgaoEntidade || row?.orgao || {};

  const unidade =
    row?.unidadeOrgao ||
    row?.unidadeAdministrativa ||
    {};

  const id = firstDefined(
    row?.numeroControlePNCP,
    row?.id,
    row?.sequencialCompra,
    randomUUID()
  );

  const title = firstDefined(
    row?.objetoCompra,
    row?.objeto,
    row?.descricaoObjeto,
    row?.informacaoComplementar,
    'Objeto não informado'
  );

  const amount = firstDefined(
    row?.valorTotalEstimado,
    row?.valorEstimado,
    row?.valorTotalHomologado,
    null
  );

  const url = firstDefined(
    row?.linkSistemaOrigem,
    row?.linkProcessoEletronico,
    row?.url,
    'https://pncp.gov.br/app/editais'
  );

  // O PNCP geralmente informa o município dentro de unidadeOrgao.
  // Os campos alternativos ajudam com variações dos registros.
  const cityValue = firstDefined(
    unidade?.municipioNome,
    unidade?.nomeMunicipio,
    row?.municipioNome,
    row?.nomeMunicipio,
    row?.municipio?.nome,
    row?.municipio?.descricao,
    ''
  );

  const ufValue = firstDefined(
    unidade?.ufSigla,
    unidade?.uf,
    row?.ufSigla,
    row?.uf,
    ''
  );

  const city = String(cityValue || '').trim();
  const uf = String(ufValue || '').trim().toUpperCase();

  // O campo location é utilizado para exibir a localização
  // no cartão da oportunidade e para salvar no Prisma.
  const location = city
    ? (uf ? `${city}/${uf}` : city)
    : (uf ? `Município não informado/${uf}` : 'Município não informado');

  const unitName = firstDefined(
    unidade?.nomeUnidade,
    unidade?.nomeUnidadeAdministrativa,
    ''
  );

  const modality = firstDefined(
    row?.modalidadeNome,
    row?.modalidade,
    'Modalidade não informada'
  );

  const numericAmount =
    amount === null ? null : Number(amount);

  return {
    id: String(id),
    title: String(title),

    agency: String(
      firstDefined(
        orgao?.razaoSocial,
        orgao?.nomeOrgao,
        row?.nomeOrgao,
        'Órgão não informado'
      )
    ),

    // Nome da unidade administrativa, preservado.
    unit: String(unitName),

    // Município em campo próprio.
    city,

    // Localização pronta para exibição: "Fortaleza/CE".
    location,

    // UF normalizada, quando disponível.
    uf,

    modality: String(modality),

    amount:
      numericAmount !== null && Number.isFinite(numericAmount)
        ? numericAmount
        : null,

    deadline: firstDefined(
      row?.dataEncerramentoProposta,
      row?.dataFimRecebimentoPropostas,
      row?.dataFinalProposta,
      null
    ),

    url: String(url),
    pncpId: String(
      firstDefined(row?.numeroControlePNCP, id)
    ),

    // Preserva os dados originais para diagnóstico.
    raw: row,
  };
}

// Consulta as contratações com recebimento de propostas
// no Portal Nacional de Contratações Públicas.
app.get('/api/pncp/propostas', async (req, res) => {
  const {
    dataFinal,
    pagina = '1',
    tamanhoPagina = '20',
    modalidade = '6',
    uf = '',
  } = req.query;

  const validDate = /^\d{8}$/.test(String(dataFinal || ''));
  const page = Number(pagina);
  const pageSize = Number(tamanhoPagina);
  const modality = Number(modalidade);

  if (!validDate) {
    return res.status(400).json({
      error:
        'Informe dataFinal no formato AAAAMMDD, por exemplo 20261231.',
    });
  }

  if (!Number.isInteger(page) || page < 1) {
    return res.status(400).json({
      error:
        'O parâmetro pagina precisa ser um inteiro maior ou igual a 1.',
    });
  }

  if (
    !Number.isInteger(pageSize) ||
    pageSize < 10 ||
    pageSize > 50
  ) {
    return res.status(400).json({
      error: 'tamanhoPagina deve estar entre 10 e 50.',
    });
  }

  if (!Number.isInteger(modality) || modality < 1) {
    return res.status(400).json({
      error: 'Selecione um código de modalidade válido.',
    });
  }

  const params = new URLSearchParams({
    dataFinal: String(dataFinal),
    pagina: String(page),
    tamanhoPagina: String(pageSize),
    codigoModalidadeContratacao: String(modality),
  });

  if (String(uf).trim()) {
    params.set('uf', String(uf).trim().toUpperCase());
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    18000
  );

  try {
    const response = await fetch(
      `${PNCP_BASE}/v1/contratacoes/proposta?${params.toString()}`,
      {
        headers: {
          accept: 'application/json',
        },
        signal: controller.signal,
      }
    );

    const bodyText = await response.text();
    let payload;

    try {
      payload = bodyText ? JSON.parse(bodyText) : {};
    } catch {
      payload = {
        message: bodyText.slice(0, 500),
      };
    }

    if (!response.ok) {
      return res.status(502).json({
        error:
          `O PNCP respondeu com status ${response.status}. ` +
          'Tente novamente ou consulte o portal oficial.',
        details:
          payload?.message ||
          payload?.mensagem ||
          null,
      });
    }

    const rawRows = toArray(payload);
    const records = rawRows.map(normalizeContract);

    return res.json({
      source: 'PNCP',
      fetchedAt: new Date().toISOString(),
      page,
      pageSize,

      total: firstDefined(
        payload?.totalRegistros,
        payload?.totalElements,
        payload?.total,
        records.length
      ),

      records,

      message: records.length
        ? null
        : 'A consulta não retornou registros para esses filtros. ' +
          'Isso não significa necessariamente que não existam ' +
          'oportunidades em outras modalidades.',
    });
  } catch (error) {
    const aborted = error?.name === 'AbortError';

    console.error(
      'Erro na consulta ao PNCP:',
      error
    );

    return res.status(502).json({
      error: aborted
        ? 'A consulta ao PNCP demorou demais e foi interrompida.'
        : 'Não foi possível acessar a API do PNCP agora.',

      details:
        'Verifique sua conexão e tente novamente. ' +
        'A consulta oficial pode ficar indisponível temporariamente.',
    });
  } finally {
    clearTimeout(timeout);
  }
});

const automation = registerAutomation({
  app,
  prisma,
  getDefaultCompany,
});

if (process.env.VERCEL !== '1') {
  const server = app.listen(PORT, () => {
    console.log(
      `Licita360 API disponível em http://localhost:${PORT}`
    );
  });

  async function shutdown() {
    automation.stop();

    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export default app;
