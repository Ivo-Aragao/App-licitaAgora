import express from 'express';
import {
  mkdir,
  readFile,
  rename,
  writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const PORT = Number(process.env.API_PORT || 8787);
const PNCP_BASE = 'https://pncp.gov.br/api/consulta';

// O armazenamento fica dentro da pasta do servidor,
// independentemente da pasta usada para iniciar o comando.
const SERVER_DIR = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(SERVER_DIR, 'data');
const DATA_FILE = join(DATA_DIR, 'licita360-data.json');

app.use(express.json({ limit: '2mb' }));

// Garante que gravações simultâneas sejam processadas em sequência.
let writeQueue = Promise.resolve();

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    name: 'Licita360 API',
    time: new Date().toISOString(),
  });
});

// Lê o arquivo salvo. Se ainda não existir, retorna null.
async function readSavedData() {
  try {
    const contents = await readFile(DATA_FILE, 'utf8');
    return JSON.parse(contents);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

// Grava primeiro em um arquivo temporário e depois o substitui.
// A fila ajuda a evitar que duas alterações se sobrescrevam.
function persistData(record) {
  const operation = writeQueue
    .catch(() => {})
    .then(async () => {
      await mkdir(DATA_DIR, { recursive: true });

      const temporaryFile = `${DATA_FILE}.tmp`;

      await writeFile(
        temporaryFile,
        JSON.stringify(record, null, 2),
        'utf8'
      );

      await rename(temporaryFile, DATA_FILE);
    });

  writeQueue = operation;
  return operation;
}

// Recupera os dados persistidos.
app.get('/api/data', async (_req, res) => {
  try {
    const record = await readSavedData();

    res.json({
      ok: true,
      data: record?.data ?? null,
      updatedAt: record?.updatedAt ?? null,
    });
  } catch (error) {
    console.error('Erro ao ler dados do Licita360:', error);

    res.status(500).json({
      error: 'Não foi possível ler os dados salvos do Licita360.',
    });
  }
});

// Salva os cadastros recebidos da interface.
app.put('/api/data', async (req, res) => {
  const body = req.body;

  if (
    !body ||
    typeof body !== 'object' ||
    !Array.isArray(body.opportunities) ||
    !Array.isArray(body.tasks) ||
    !Array.isArray(body.documents) ||
    !body.profile ||
    typeof body.profile !== 'object' ||
    Array.isArray(body.profile)
  ) {
    return res.status(400).json({
      error:
        'Dados inválidos. São esperados oportunidades, tarefas, documentos e perfil.',
    });
  }

  const record = {
    updatedAt: new Date().toISOString(),
    data: {
      opportunities: body.opportunities,
      tasks: body.tasks,
      documents: body.documents,
      profile: body.profile,
    },
  };

  try {
    await persistData(record);

    res.json({
      ok: true,
      updatedAt: record.updatedAt,
      message: 'Dados salvos com sucesso.',
    });
  } catch (error) {
    console.error('Erro ao salvar dados do Licita360:', error);

    res.status(500).json({
      error: 'Não foi possível salvar os dados no servidor.',
    });
  }
});

function firstDefined(...values) {
  return values.find(
    (value) => value !== undefined && value !== null && value !== ''
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
    if (Array.isArray(payload?.[key])) return payload[key];
  }

  return [];
}

function cryptoRandomId() {
  return `pncp-${Math.random().toString(36).slice(2, 12)}`;
}

function normalizeContract(row) {
  const orgao = row?.orgaoEntidade || row?.orgao || {};
  const unidade = row?.unidadeOrgao || row?.unidadeAdministrativa || {};

  const id = firstDefined(
    row?.numeroControlePNCP,
    row?.id,
    row?.sequencialCompra,
    cryptoRandomId()
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
    unit: String(
      firstDefined(
        unidade?.nomeUnidade,
        unidade?.nomeUnidadeAdministrativa,
        ''
      )
    ),
    uf: String(firstDefined(unidade?.uf, row?.uf, '')),
    modality: String(
      firstDefined(
        row?.modalidadeNome,
        row?.modalidade,
        'Modalidade não informada'
      )
    ),
    amount: amount === null ? null : Number(amount),
    deadline: firstDefined(
      row?.dataEncerramentoProposta,
      row?.dataFimRecebimentoPropostas,
      row?.dataFinalProposta,
      null
    ),
    url: String(url),
    pncpId: String(firstDefined(row?.numeroControlePNCP, id)),
    raw: row,
  };
}

// Consulta oficial ao PNCP. Mantida para preservar o Radar existente.
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
      error: 'O parâmetro pagina precisa ser um inteiro maior ou igual a 1.',
    });
  }

  if (!Number.isInteger(pageSize) || pageSize < 10 || pageSize > 50) {
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
  const timeout = setTimeout(() => controller.abort(), 18000);

  try {
    const response = await fetch(
      `${PNCP_BASE}/v1/contratacoes/proposta?${params.toString()}`,
      {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      }
    );

    const bodyText = await response.text();
    let payload;

    try {
      payload = bodyText ? JSON.parse(bodyText) : {};
    } catch {
      payload = { message: bodyText.slice(0, 500) };
    }

    if (!response.ok) {
      return res.status(502).json({
        error: `O PNCP respondeu com status ${response.status}. Tente novamente ou consulte o portal oficial.`,
        details: payload?.message || payload?.mensagem || null,
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
        : 'A consulta não retornou registros para esses filtros. Isso não significa necessariamente que não existam oportunidades em outras modalidades.',
    });
  } catch (error) {
    const aborted = error?.name === 'AbortError';

    return res.status(502).json({
      error: aborted
        ? 'A consulta ao PNCP demorou demais e foi interrompida.'
        : 'Não foi possível acessar a API do PNCP agora.',
      details:
        'Verifique sua conexão e tente novamente. A consulta oficial pode ficar indisponível temporariamente.',
    });
  } finally {
    clearTimeout(timeout);
  }
});

app.listen(PORT, () => {
  console.log(`Licita360 API disponível em http://localhost:${PORT}`);
});