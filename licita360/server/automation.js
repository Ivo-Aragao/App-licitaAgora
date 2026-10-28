import cron from 'node-cron';
import { createHash } from 'node:crypto';
import nodemailer from 'nodemailer';

const PNCP_BASE = 'https://pncp.gov.br/api/consulta';
const TIME_ZONE = process.env.TZ || 'America/Fortaleza';
const PAGE_SIZE = 50;
const MAX_PAGES = 5;
const DEFAULT_MODALITIES = ['8'];
const DEFAULT_UFS = ['CE'];
const DEFAULT_DOCUMENT_DAYS = [30, 15, 7, 1, 0];

const UF_CODES = new Set(
  'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')
);

/* =========================================================
   FUNÇÕES AUXILIARES
========================================================= */

function text(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

function uniqueStrings(values, { upper = false } = {}) {
  const input = Array.isArray(values)
    ? values
    : typeof values === 'string'
      ? values.split(',')
      : [];

  return [...new Set(
    input
      .map((value) => text(value))
      .filter(Boolean)
      .map((value) => upper ? value.toUpperCase() : value)
  )];
}

function uniqueNumbers(values, fallback = []) {
  const input = Array.isArray(values)
    ? values
    : typeof values === 'string'
      ? values.split(',')
      : [];

  const numbers = [...new Set(
    input
      .map(Number)
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 365)
  )];

  return numbers.length ? numbers : fallback;
}

function nullableAmount(value) {
  if (value === '' || value === undefined || value === null) {
    return null;
  }

  const amount = Number(value);

  return Number.isFinite(amount) && amount >= 0
    ? amount
    : null;
}

function parseDate(value) {
  if (!value) return null;

  const date = value instanceof Date
    ? value
    : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(value) {
  const date = parseDate(value);

  return date ? date.toISOString().slice(0, 10) : '';
}

function dateKeyInZone(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);

  const fields = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${fields.year}-${fields.month}-${fields.day}`;
}

function datePlusDaysKey(days) {
  const today = dateKeyInZone();
  const [year, month, day] = today.split('-').map(Number);

  const result = new Date(
    Date.UTC(year, month - 1, day + Number(days || 0))
  );

  return result.toISOString().slice(0, 10);
}

function dayDifference(fromKey, toKey) {
  const from = Date.parse(`${fromKey}T00:00:00Z`);
  const to = Date.parse(`${toKey}T00:00:00Z`);

  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    return null;
  }

  return Math.round((to - from) / 86400000);
}

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

function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeHttpUrl(value) {
  try {
    const url = new URL(String(value || ''));

    if (
      url.protocol === 'https:' ||
      url.protocol === 'http:'
    ) {
      return url.toString();
    }
  } catch {
    // Usa a página oficial do PNCP se a URL for inválida.
  }

  return 'https://pncp.gov.br/app/editais';
}

function formatDateBR(value) {
  const date = parseDate(value);

  if (!date) return 'Não informado';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeZone: TIME_ZONE,
  }).format(date);
}

/* =========================================================
   CORRESPONDÊNCIA POR RAMOS DE ATIVIDADE
========================================================= */

function branchTerms(branch) {
  const value = normalizeSearchText(branch);
  const terms = new Set();

  if (value.length >= 3) {
    terms.add(value);
  }

  const synonymGroups = [
    {
      aliases: [
        'limpeza',
        'limpeza e conservacao',
        'higiene',
        'higienizacao',
      ],
      terms: [
        'limpeza',
        'conservacao',
        'higienizacao',
        'material de limpeza',
        'servicos de limpeza',
        'limpeza e conservacao',
      ],
    },
    {
      aliases: [
        'dedetizacao',
        'detetizacao',
        'controle de pragas',
        'desinsetizacao',
        'desratizacao',
      ],
      terms: [
        'dedetizacao',
        'detetizacao',
        'desinsetizacao',
        'desratizacao',
        'controle de pragas',
        'pragas urbanas',
        'controle de vetores',
      ],
    },
    {
      aliases: [
        'servico administrativo',
        'servicos administrativos',
        'apoio administrativo',
        'servicos gerais',
      ],
      terms: [
        'apoio administrativo',
        'servicos administrativos',
        'servico administrativo',
        'servicos gerais',
        'mao de obra administrativa',
        'recepcionista',
        'auxiliar administrativo',
      ],
    },
    {
      aliases: [
        'tecnologia',
        'informatica',
        'equipamentos de informatica',
      ],
      terms: [
        'informatica',
        'computador',
        'notebook',
        'microcomputador',
        'impressora',
        'hardware',
        'software',
        'equipamentos de informatica',
      ],
    },
    {
      aliases: [
        'material de escritorio',
        'material de expediente',
        'papelaria',
      ],
      terms: [
        'material de escritorio',
        'material de expediente',
        'papelaria',
        'papel',
        'caneta',
        'caderno',
        'envelope',
      ],
    },
    {
      aliases: [
        'alimentos',
        'generos alimenticios',
        'alimentacao',
      ],
      terms: [
        'alimentos',
        'generos alimenticios',
        'merenda escolar',
        'cesta basica',
        'hortifruti',
        'generos alimentares',
      ],
    },
    {
      aliases: [
        'construcao',
        'obras',
        'engenharia',
        'material de construcao',
      ],
      terms: [
        'construcao',
        'obra',
        'reforma',
        'engenharia civil',
        'cimento',
        'material de construcao',
      ],
    },
  ];

  for (const group of synonymGroups) {
    const matched = group.aliases.some((alias) => {
      const normalized = normalizeSearchText(alias);

      return value === normalized ||
        (
          value.length >= 4 &&
          normalized.includes(value)
        ) ||
        (
          normalized.length >= 4 &&
          value.includes(normalized)
        );
    });

    if (matched) {
      group.terms.forEach((term) => {
        terms.add(normalizeSearchText(term));
      });
    }
  }

  return [...terms].filter((term) => term.length >= 3);
}

function matchedBranches(record, branches) {
  const raw = record.raw || {};

  const searchableText = normalizeSearchText([
    record.title,
    record.agency,
    raw.objetoCompra,
    raw.objeto,
    raw.descricaoObjeto,
    raw.informacaoComplementar,
  ].filter(Boolean).join(' '));

  return branches.filter((branch) =>
    branchTerms(branch).some((term) =>
      searchableText.includes(term)
    )
  );
}

/* =========================================================
   NORMALIZAÇÃO DOS DADOS DO PNCP
========================================================= */

function normalizeContract(row) {
  const orgao = row?.orgaoEntidade || row?.orgao || {};

  const unidade =
    row?.unidadeOrgao ||
    row?.unidadeAdministrativa ||
    {};

  const title = String(firstDefined(
    row?.objetoCompra,
    row?.objeto,
    row?.descricaoObjeto,
    row?.informacaoComplementar,
    'Objeto não informado'
  ));

  const agency = String(firstDefined(
    orgao?.razaoSocial,
    orgao?.nomeOrgao,
    row?.nomeOrgao,
    'Órgão não informado'
  ));

  const pncpId = firstDefined(
    row?.numeroControlePNCP,
    row?.id,
    row?.sequencialCompra,
    createHash('sha1')
      .update([
        title,
        agency,
        row?.dataEncerramentoProposta || '',
      ].join('|'))
      .digest('hex')
  );

  const city = String(firstDefined(
    unidade?.municipioNome,
    unidade?.nomeMunicipio,
    row?.municipioNome,
    row?.nomeMunicipio,
    ''
  )).trim();

  const uf = String(firstDefined(
    unidade?.ufSigla,
    unidade?.uf,
    row?.ufSigla,
    row?.uf,
    ''
  )).trim().toUpperCase();

  const rawAmount = firstDefined(
    row?.valorTotalEstimado,
    row?.valorEstimado,
    row?.valorTotalHomologado,
    null
  );

  const amount = rawAmount === null
    ? null
    : Number(rawAmount);

  const rawDeadline = firstDefined(
    row?.dataEncerramentoProposta,
    row?.dataFimRecebimentoPropostas,
    row?.dataFinalProposta,
    null
  );

  const url = firstDefined(
    row?.linkSistemaOrigem,
    row?.linkProcessoEletronico,
    row?.url,
    'https://pncp.gov.br/app/editais'
  );

  return {
    pncpId: String(pncpId),
    title,
    agency,

    unit: String(firstDefined(
      unidade?.nomeUnidade,
      unidade?.nomeUnidadeAdministrativa,
      ''
    )),

    city,
    uf,

    location: city
      ? [city, uf].filter(Boolean).join('/')
      : (
          uf
            ? `Município não informado/${uf}`
            : 'Município não informado'
        ),

    modality: String(firstDefined(
      row?.modalidadeNome,
      row?.modalidade,
      'Modalidade não informada'
    )),

    amount:
      amount !== null &&
      Number.isFinite(amount) &&
      amount >= 0
        ? amount
        : null,

    deadline: parseDate(rawDeadline),
    url: safeHttpUrl(url),
    raw: row,
  };
}

/* =========================================================
   CONSULTA À API DO PNCP
========================================================= */

async function fetchPncpRecords({
  uf,
  modality,
  daysAhead,
}) {
  const dataFinal = datePlusDaysKey(daysAhead)
    .replace(/-/g, '');

  const records = [];

  for (
    let page = 1;
    page <= MAX_PAGES;
    page += 1
  ) {
    const params = new URLSearchParams({
      dataFinal,
      pagina: String(page),
      tamanhoPagina: String(PAGE_SIZE),
      codigoModalidadeContratacao: String(modality),
    });

    if (uf) {
      params.set('uf', uf);
    }

    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      18000
    );

    let response;

    try {
      response = await fetch(
        `${PNCP_BASE}/v1/contratacoes/proposta?${params.toString()}`,
        {
          headers: {
            accept: 'application/json',
          },
          signal: controller.signal,
        }
      );
    } finally {
      clearTimeout(timeout);
    }

    const bodyText = await response.text();

    let payload = {};

    try {
      payload = bodyText
        ? JSON.parse(bodyText)
        : {};
    } catch {
      throw new Error(
        'O PNCP respondeu com conteúdo inválido.'
      );
    }

    if (!response.ok) {
      throw new Error(
        `Consulta ao PNCP falhou (HTTP ${response.status}).`
      );
    }

    const pageRows = toArray(payload);

    records.push(
      ...pageRows.map(normalizeContract)
    );

    if (pageRows.length < PAGE_SIZE) {
      break;
    }
  }

  return records;
}

/* =========================================================
   ENVIO DE E-MAIL
========================================================= */

async function sendEmail({
  to,
  subject,
  html,
}) {
  const user = process.env.GOOGLE_EMAIL;
  const password = process.env.GOOGLE_APP_PASSWORD;

  if (!user || !password) {
    throw new Error(
      'Configure GOOGLE_EMAIL e GOOGLE_APP_PASSWORD no arquivo .env do backend.'
    );
  }

  if (!to) {
    throw new Error(
      'Informe um e-mail destinatário.'
    );
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user,
      pass: password.replace(/\s/g, ''),
    },
  });

  const info = await transporter.sendMail({
    from:
      process.env.ALERT_FROM_EMAIL ||
      `Licita360 <${user}>`,
    to,
    subject,
    html,
  });

  return {
    messageId: info.messageId,
  };
}

async function sendTrackedEmail(
  prisma,
  {
    companyId,
    type,
    dedupeKey,
    to,
    subject,
    html,
    metadata = {},
  }
) {
  if (!to) {
    return {
      sent: false,
      error:
        'Cadastre um e-mail destinatário nas configurações.',
    };
  }

  const where = {
    companyId_dedupeKey: {
      companyId,
      dedupeKey,
    },
  };

  const existing =
    await prisma.notificationLog.findUnique({
      where,
    });

  if (existing?.status === 'sent') {
    return {
      sent: true,
      alreadySent: true,
    };
  }

  await prisma.notificationLog.upsert({
    where,

    create: {
      companyId,
      type,
      dedupeKey,
      recipientEmail: to,
      subject,
      status: 'pending',
      metadata,
    },

    update: {
      type,
      recipientEmail: to,
      subject,
      status: 'pending',
      error: null,
      metadata,
    },
  });

  try {
    await sendEmail({
      to,
      subject,
      html,
    });

    await prisma.notificationLog.update({
      where,
      data: {
        status: 'sent',
        sentAt: new Date(),
        error: null,
      },
    });

    return {
      sent: true,
    };
  } catch (error) {
    await prisma.notificationLog.update({
      where,
      data: {
        status: 'failed',
        error: text(
          error?.message,
          'Erro desconhecido'
        ).slice(0, 1000),
      },
    });

    console.error(
      `Falha no e-mail ${type}:`,
      error
    );

    return {
      sent: false,
      error: text(
        error?.message,
        'Falha ao enviar e-mail'
      ),
    };
  }
}

/* =========================================================
   CONFIGURAÇÕES PADRÃO
========================================================= */

async function ensureSettings(prisma, company) {
  return prisma.prospectingSettings.upsert({
    where: {
      companyId: company.id,
    },

    create: {
      companyId: company.id,

      recipientEmail:
        text(process.env.ALERT_DEFAULT_EMAIL) ||
        null,

      enabled: false,
      dailyEmailEnabled: true,
      documentAlertsEnabled: true,
      partnerAlertsEnabled: true,

      ufs: DEFAULT_UFS,
      modalities: DEFAULT_MODALITIES,
      daysAhead: 30,

      documentAlertDays: DEFAULT_DOCUMENT_DAYS,
    },

    update: {},
  });
}

function amountWithinLimits(
  amount,
  minimum,
  maximum
) {
  if (
    minimum !== null &&
    minimum !== undefined
  ) {
    if (
      amount === null ||
      amount === undefined ||
      Number(amount) < Number(minimum)
    ) {
      return false;
    }
  }

  if (
    maximum !== null &&
    maximum !== undefined
  ) {
    if (
      amount === null ||
      amount === undefined ||
      Number(amount) > Number(maximum)
    ) {
      return false;
    }
  }

  return true;
}

function matchesUserFilters(
  record,
  settings,
  branches
) {
  const ufs = settings.ufs || [];
  const modalities = settings.modalities || [];

  if (
    ufs.length &&
    !ufs.includes(record.uf)
  ) {
    return false;
  }

  const code = String(
    record.modalityCode || ''
  );

  if (
    modalities.length &&
    code &&
    !modalities.includes(code)
  ) {
    return false;
  }

  if (
    !amountWithinLimits(
      record.amount,
      settings.minAmount,
      settings.maxAmount
    )
  ) {
    return false;
  }

  if (
    branches.length &&
    matchedBranches(record, branches).length === 0
  ) {
    return false;
  }

  return true;
}

function modalityCodeForRecord(record) {
  const value =
    record?.raw?.codigoModalidadeContratacao;

  return value === null || value === undefined
    ? ''
    : String(value);
}

/* =========================================================
   PROSPECÇÃO DE OPORTUNIDADES
========================================================= */

async function prospectCompany(
  prisma,
  company,
  settings
) {
  const partners =
    await prisma.partnerCompany.findMany({
      where: {
        ownerCompanyId: company.id,
        active: true,
      },
      include: {
        branches: true,
      },
    });

  const configuredUfs = uniqueStrings(
    settings.ufs,
    { upper: true }
  ).filter((uf) => UF_CODES.has(uf));

  const partnerUfs = partners
    .map((partner) =>
      text(partner.uf).toUpperCase()
    )
    .filter((uf) => UF_CODES.has(uf));

  const ufs = [...new Set([
    ...(
      configuredUfs.length
        ? configuredUfs
        : [company.uf || 'CE']
    ),
    ...partnerUfs,
  ])];

  const modalities = uniqueStrings(
    settings.modalities
  ).filter((modality) =>
    /^\d+$/.test(modality)
  );

  const activeModalities = modalities.length
    ? modalities
    : DEFAULT_MODALITIES;

  const today = dateKeyInZone();

  let newDiscoveries = 0;
  let failures = 0;

  for (const uf of ufs) {
    for (const modality of activeModalities) {
      let records;

      try {
        records = await fetchPncpRecords({
          uf,
          modality,
          daysAhead: settings.daysAhead,
        });
      } catch (error) {
        failures += 1;

        console.error(
          `Falha ao consultar PNCP para UF ${uf} e modalidade ${modality}:`,
          error
        );

        continue;
      }

      for (const record of records) {
        if (
          record.deadline &&
          dateKey(record.deadline) < today
        ) {
          continue;
        }

        const uniqueWhere = {
          companyId_pncpId: {
            companyId: company.id,
            pncpId: record.pncpId,
          },
        };

        const existing =
          await prisma.discoveredOpportunity.findUnique({
            where: uniqueWhere,
          });

        const data = {
          title: record.title,
          agency: record.agency,
          unit: record.unit || null,
          city: record.city || null,
          uf: record.uf || uf,
          modality: record.modality,
          amount: record.amount,
          deadline: record.deadline,
          url: record.url,
          raw: record.raw,
          lastSeenAt: new Date(),
        };

        await prisma.discoveredOpportunity.upsert({
          where: uniqueWhere,

          create: {
            companyId: company.id,
            pncpId: record.pncpId,
            ...data,
            firstSeenAt: new Date(),
          },

          update: data,
        });

        if (!existing) {
          newDiscoveries += 1;
        }
      }
    }
  }

  const partnerMatches =
    await matchPartnerOpportunities(
      prisma,
      company,
      settings,
      partners
    );

  return {
    newDiscoveries,
    partnerMatches,
    queryFailures: failures,
  };
}

/* =========================================================
   CORRESPONDÊNCIA COM EMPRESAS PARCEIRAS
========================================================= */

function partnerFitsOpportunity(
  partner,
  opportunity
) {
  if (
    partner.uf &&
    opportunity.uf &&
    partner.uf.toUpperCase() !==
      opportunity.uf.toUpperCase()
  ) {
    return false;
  }

  if (partner.cities?.length) {
    if (!opportunity.city) {
      return false;
    }

    const partnerCities =
      partner.cities.map(normalizeSearchText);

    if (
      !partnerCities.includes(
        normalizeSearchText(opportunity.city)
      )
    ) {
      return false;
    }
  }

  return amountWithinLimits(
    opportunity.amount === null
      ? null
      : Number(opportunity.amount),
    partner.minimumAmount,
    partner.maximumAmount
  );
}

async function matchPartnerOpportunities(
  prisma,
  company,
  settings,
  partners
) {
  const since = new Date(
    Date.now() - 45 * 86400000
  );

  const today = dateKeyInZone();

  const discoveries =
    await prisma.discoveredOpportunity.findMany({
      where: {
        companyId: company.id,
        firstSeenAt: {
          gte: since,
        },
      },

      orderBy: {
        firstSeenAt: 'desc',
      },

      take: 500,
    });

  let newMatches = 0;

  for (const partner of partners) {
    if (
      !partner.notifyOpportunities ||
      !partner.branches.length
    ) {
      continue;
    }

    const branches =
      partner.branches.map(
        (branch) => branch.name
      );

    for (const opportunity of discoveries) {
      if (
        opportunity.deadline &&
        dateKey(opportunity.deadline) < today
      ) {
        continue;
      }

      if (
        !partnerFitsOpportunity(
          partner,
          opportunity
        )
      ) {
        continue;
      }

      const matched = matchedBranches(
        opportunity,
        branches
      );

      if (!matched.length) {
        continue;
      }

      const uniqueWhere = {
        partnerId_discoveryId: {
          partnerId: partner.id,
          discoveryId: opportunity.id,
        },
      };

      let match =
        await prisma.partnerOpportunityMatch.findUnique({
          where: uniqueWhere,
        });

      if (!match) {
        try {
          match =
            await prisma.partnerOpportunityMatch.create({
              data: {
                companyId: company.id,
                partnerId: partner.id,
                discoveryId: opportunity.id,
                matchedBranches: matched,
                reason:
                  `Correspondência por ramo: ${matched.join(', ')}`,
              },
            });

          newMatches += 1;
        } catch (error) {
          // Evita duplicação em caso de execução simultânea.
          if (error?.code !== 'P2002') {
            throw error;
          }

          match =
            await prisma.partnerOpportunityMatch.findUnique({
              where: uniqueWhere,
            });
        }
      }

      if (
        !match ||
        match.notifiedAt ||
        !settings.partnerAlertsEnabled ||
        !settings.recipientEmail
      ) {
        continue;
      }

      const url = safeHttpUrl(opportunity.url);

      const subject =
        `Licita360: oportunidade para ${partner.name}`;

      const cityAndUf = opportunity.city
        ? [
            opportunity.city,
            opportunity.uf,
          ].filter(Boolean).join('/')
        : (
            opportunity.uf ||
            'Não informado'
          );

      const formattedAmount =
        opportunity.amount === null
          ? 'Não informado'
          : new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            }).format(
              Number(opportunity.amount)
            );

      const html = `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#182230">
          <h2>Possível oportunidade para uma empresa parceira</h2>

          <p>
            A prospecção do Licita360 encontrou uma contratação que pode
            corresponder aos segmentos cadastrados para
            <strong>${escapeHtml(partner.name)}</strong>.
          </p>

          <hr>

          <h3>${escapeHtml(opportunity.title)}</h3>

          <p>
            <strong>Órgão:</strong>
            ${escapeHtml(opportunity.agency)}
          </p>

          <p>
            <strong>Município:</strong>
            ${escapeHtml(cityAndUf)}
          </p>

          <p>
            <strong>Modalidade:</strong>
            ${escapeHtml(opportunity.modality)}
          </p>

          <p>
            <strong>Valor estimado:</strong>
            ${escapeHtml(formattedAmount)}
          </p>

          <p>
            <strong>Prazo:</strong>
            ${escapeHtml(formatDateBR(opportunity.deadline))}
          </p>

          <p>
            <strong>Ramos correspondentes:</strong>
            ${escapeHtml(matched.join(', '))}
          </p>

          <p>
            <a href="${escapeHtml(url)}">
              Consultar a fonte da contratação
            </a>
          </p>

          <p style="font-size:12px;color:#667085">
            Correspondência automática indicativa. Confira o edital,
            a área de execução, as exigências de habilitação e o
            interesse da empresa.
          </p>
        </div>
      `;

      const result = await sendTrackedEmail(
        prisma,
        {
          companyId: company.id,
          type: 'partner_opportunity',
          dedupeKey: `partner-match:${match.id}`,
          to: settings.recipientEmail,
          subject,
          html,

          metadata: {
            matchId: match.id,
            partnerId: partner.id,
            discoveryId: opportunity.id,
            matchedBranches: matched,
          },
        }
      );

      if (result.sent) {
        await prisma.partnerOpportunityMatch.update({
          where: {
            id: match.id,
          },

          data: {
            notifiedAt: new Date(),
          },
        });
      }
    }
  }

  return newMatches;
}

/* =========================================================
   ALERTAS DE VENCIMENTO DE DOCUMENTOS
========================================================= */

async function checkDocumentAlerts(
  prisma,
  company,
  settings
) {
  if (
    !settings.documentAlertsEnabled ||
    !settings.recipientEmail
  ) {
    return 0;
  }

  const documents =
    await prisma.document.findMany({
      where: {
        companyId: company.id,
        expires: {
          not: null,
        },
      },
    });

  const today = dateKeyInZone();

  const configuredDays =
    settings.documentAlertDays?.length
      ? settings.documentAlertDays
      : DEFAULT_DOCUMENT_DAYS;

  let attempted = 0;

  for (const document of documents) {
    const expiryKey = dateKey(document.expires);

    if (!expiryKey) {
      continue;
    }

    const daysLeft = dayDifference(
      today,
      expiryKey
    );

    if (daysLeft === null) {
      continue;
    }

    let thresholdKey;
    let subject;
    let message;

    if (daysLeft < 0) {
      thresholdKey = 'expired';

      subject =
        `Licita360: documento vencido — ${document.name}`;

      message =
        `O documento venceu em ${formatDateBR(document.expires)}.`;
    } else if (configuredDays.includes(daysLeft)) {
      thresholdKey = `days-${daysLeft}`;

      subject = daysLeft === 0
        ? `Licita360: documento vence hoje — ${document.name}`
        : `Licita360: documento vence em ${daysLeft} dia(s) — ${document.name}`;

      message = daysLeft === 0
        ? 'O documento vence hoje.'
        : `Faltam ${daysLeft} dia(s) para o vencimento.`;
    } else {
      continue;
    }

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#182230">
        <h2>Alerta de validade documental</h2>

        <p>
          <strong>Documento:</strong>
          ${escapeHtml(document.name)}
        </p>

        <p>
          <strong>Categoria:</strong>
          ${escapeHtml(document.type)}
        </p>

        <p>
          <strong>Validade:</strong>
          ${escapeHtml(formatDateBR(document.expires))}
        </p>

        <p>${escapeHtml(message)}</p>

        <p>
          Confira o documento e providencie a renovação quando necessário.
        </p>

        <p style="font-size:12px;color:#667085">
          O alerta utiliza a data cadastrada no Licita360. Confirme
          a validade no documento original antes de tomar decisões.
        </p>
      </div>
    `;

    const result = await sendTrackedEmail(
      prisma,
      {
        companyId: company.id,
        type: 'document_expiration',

        dedupeKey:
          `document:${document.id}:${thresholdKey}:${expiryKey}`,

        to: settings.recipientEmail,
        subject,
        html,

        metadata: {
          documentId: document.id,
          expiryKey,
          daysLeft,
        },
      }
    );

    if (result.sent) {
      attempted += 1;
    }
  }

  return attempted;
}

/* =========================================================
   RESUMO DIÁRIO POR E-MAIL
========================================================= */

async function sendDailyDigest(
  prisma,
  company,
  settings
) {
  if (
    !settings.dailyEmailEnabled ||
    !settings.recipientEmail
  ) {
    return {
      sent: false,
      reason:
        'Resumo diário desativado ou sem destinatário.',
    };
  }

  const since = new Date(
    Date.now() - 24 * 60 * 60 * 1000
  );

  const discoveries =
    await prisma.discoveredOpportunity.findMany({
      where: {
        companyId: company.id,
        firstSeenAt: {
          gte: since,
        },
      },

      orderBy: {
        firstSeenAt: 'desc',
      },

      take: 500,
    });

  const branchesRows =
    await prisma.companyBranch.findMany({
      where: {
        companyId: company.id,
      },
    });

  const branches = branchesRows.map(
    (branch) => branch.name
  );

  const relevant = discoveries.filter((item) => {
    const record = {
      ...item,
      modalityCode: modalityCodeForRecord(item),
    };

    return matchesUserFilters(
      record,
      settings,
      branches
    );
  });

  const listHtml = relevant.length
    ? relevant.slice(0, 40).map((item) => {
        const url = safeHttpUrl(item.url);

        const location = item.city
          ? [
              item.city,
              item.uf,
            ].filter(Boolean).join('/')
          : (
              item.uf ||
              'Não informado'
            );

        const amount =
          item.amount === null ||
          item.amount === undefined
            ? 'Não informado'
            : new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              }).format(
                Number(item.amount)
              );

        return `
          <li style="margin-bottom:16px">
            <strong>${escapeHtml(item.title)}</strong><br>

            Órgão:
            ${escapeHtml(item.agency)}<br>

            Local:
            ${escapeHtml(location)}<br>

            Valor:
            ${escapeHtml(amount)}<br>

            Prazo:
            ${escapeHtml(formatDateBR(item.deadline))}<br>

            <a href="${escapeHtml(url)}">
              Abrir fonte oficial
            </a>
          </li>
        `;
      }).join('')
    : '<li>Nenhuma nova oportunidade correspondeu aos filtros no último período.</li>';

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#182230">
      <h2>Resumo diário do Licita360</h2>

      <p>
        Olá! Estas são as oportunidades identificadas nas últimas
        24 horas para ${escapeHtml(company.name)}.
      </p>

      <p>
        <strong>Oportunidades correspondentes:</strong>
        ${relevant.length}
      </p>

      <ul>${listHtml}</ul>

      ${
        relevant.length > 40
          ? '<p>O e-mail mostra as primeiras 40 oportunidades. Consulte o Radar para ver os demais resultados.</p>'
          : ''
      }

      <p style="font-size:12px;color:#667085">
        Os resultados são indicações automáticas. Confira os editais,
        os prazos e as exigências na fonte oficial antes de decidir participar.
      </p>
    </div>
  `;

  return sendTrackedEmail(
    prisma,
    {
      companyId: company.id,
      type: 'daily_digest',

      dedupeKey:
        `daily-digest:${dateKeyInZone()}`,

      to: settings.recipientEmail,

      subject:
        `Licita360 — resumo diário de oportunidades (${relevant.length})`,

      html,

      metadata: {
        count: relevant.length,
        discoveryIds: relevant.map(
          (item) => item.id
        ),
      },
    }
  );
}

/* =========================================================
   PROCESSAMENTO DA AUTOMAÇÃO POR EMPRESA
========================================================= */

async function processCompany(
  prisma,
  company,
  {
    forceProspecting = false,
    dailyDigest = false,
  } = {}
) {
  const settings = await ensureSettings(
    prisma,
    company
  );

  const result = {
    companyId: company.id,
    documentAlerts: 0,
    newDiscoveries: 0,
    partnerMatches: 0,
    queryFailures: 0,
    dailyEmail: null,
  };

  try {
    result.documentAlerts =
      await checkDocumentAlerts(
        prisma,
        company,
        settings
      );

    if (
      settings.enabled ||
      forceProspecting
    ) {
      const prospecting =
        await prospectCompany(
          prisma,
          company,
          settings
        );

      result.newDiscoveries =
        prospecting.newDiscoveries;

      result.partnerMatches =
        prospecting.partnerMatches;

      result.queryFailures =
        prospecting.queryFailures;
    }

    if (dailyDigest) {
      result.dailyEmail =
        await sendDailyDigest(
          prisma,
          company,
          settings
        );
    }
  } catch (error) {
    console.error(
      `Erro na automação da empresa ${company.name}:`,
      error
    );

    result.error = text(
      error?.message,
      'Erro desconhecido'
    );
  }

  return result;
}

/* =========================================================
   VALIDAÇÃO DE EMPRESAS PARCEIRAS
========================================================= */

function stringsFromBody(
  value,
  fallback = []
) {
  const result = uniqueStrings(value);

  return result.length
    ? result
    : fallback;
}

function normalizePartnerBody(body) {
  const name = text(body?.name);

  if (!name) {
    throw new Error(
      'Informe o nome da empresa parceira.'
    );
  }

  const branches = uniqueStrings(
    (
      Array.isArray(body.branches)
        ? body.branches
        : []
    ).map((branch) =>
      typeof branch === 'object'
        ? branch?.name
        : branch
    )
  );

  const cities = uniqueStrings(body.cities);

  const email = text(body.email) || null;

  if (
    email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error(
      'O e-mail da empresa parceira parece inválido.'
    );
  }

  const uf = text(
    body.uf,
    'CE'
  ).toUpperCase();

  if (!UF_CODES.has(uf)) {
    throw new Error(
      'Selecione uma UF válida para a empresa parceira.'
    );
  }

  const minimumAmount =
    nullableAmount(body.minimumAmount);

  const maximumAmount =
    nullableAmount(body.maximumAmount);

  if (
    minimumAmount !== null &&
    maximumAmount !== null &&
    maximumAmount < minimumAmount
  ) {
    throw new Error(
      'O valor máximo não pode ser menor que o mínimo.'
    );
  }

  return {
    name,
    cnpj: text(body.cnpj) || null,
    contactName: text(body.contactName) || null,
    email,
    phone: text(body.phone) || null,
    uf,
    cities,
    minimumAmount,
    maximumAmount,
    active: body.active !== false,
    notifyOpportunities:
      body.notifyOpportunities !== false,
    branches,
  };
}

/* =========================================================
   VALIDAÇÃO DAS CONFIGURAÇÕES
========================================================= */

function splitAndValidateUfs(value) {
  const ufs = uniqueStrings(
    value,
    { upper: true }
  );

  for (const uf of ufs) {
    if (!UF_CODES.has(uf)) {
      throw new Error(
        `UF inválida: ${uf}`
      );
    }
  }

  return ufs;
}

function parseSettingsUpdate(body, current) {
  const next = {};

  if ('recipientEmail' in body) {
    const email =
      text(body.recipientEmail) || null;

    if (
      email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      throw new Error(
        'Informe um e-mail destinatário válido.'
      );
    }

    next.recipientEmail = email;
  }

  for (const field of [
    'enabled',
    'dailyEmailEnabled',
    'documentAlertsEnabled',
    'partnerAlertsEnabled',
  ]) {
    if (field in body) {
      next[field] = Boolean(body[field]);
    }
  }

  if ('ufs' in body) {
    next.ufs = splitAndValidateUfs(body.ufs);
  }

  if ('modalities' in body) {
    const modalities = stringsFromBody(
      body.modalities,
      []
    );

    if (
      modalities.some(
        (value) => !/^\d+$/.test(value)
      )
    ) {
      throw new Error(
        'As modalidades devem ser informadas por códigos numéricos.'
      );
    }

    next.modalities = modalities;
  }

  if ('daysAhead' in body) {
    const days = Number(body.daysAhead);

    if (
      !Number.isInteger(days) ||
      days < 1 ||
      days > 90
    ) {
      throw new Error(
        'O período de prospecção deve ficar entre 1 e 90 dias.'
      );
    }

    next.daysAhead = days;
  }

  if ('minAmount' in body) {
    next.minAmount =
      nullableAmount(body.minAmount);
  }

  if ('maxAmount' in body) {
    next.maxAmount =
      nullableAmount(body.maxAmount);
  }

  if ('documentAlertDays' in body) {
    next.documentAlertDays = uniqueNumbers(
      body.documentAlertDays,
      DEFAULT_DOCUMENT_DAYS
    );
  }

  const minimum = 'minAmount' in next
    ? next.minAmount
    : current.minAmount === null
      ? null
      : Number(current.minAmount);

  const maximum = 'maxAmount' in next
    ? next.maxAmount
    : current.maxAmount === null
      ? null
      : Number(current.maxAmount);

  if (
    minimum !== null &&
    maximum !== null &&
    maximum < minimum
  ) {
    throw new Error(
      'O valor máximo não pode ser menor que o mínimo.'
    );
  }

  return next;
}

/* =========================================================
   REGISTRO DAS ROTAS E AGENDADORES
========================================================= */

export function registerAutomation({
  app,
  prisma,
  getDefaultCompany,
}) {
  /*
   * Fila por processo.
   * Evita sobreposição entre a execução manual e o cron local
   * neste processo Node.js.
   */
  let queue = Promise.resolve();

  function enqueue(operation) {
    const current = queue.then(operation);

    queue = current.catch((error) => {
      console.error(
        'Erro no agendador do Licita360:',
        error
      );
    });

    return current;
  }

  /*
   * Executa as rotinas para todas as empresas cadastradas.
   */
  async function runAllCompanies({
    dailyDigest = false,
  } = {}) {
    const companies =
      await prisma.company.findMany();

    const results = [];

    for (const company of companies) {
      try {
        results.push(
          await processCompany(
            prisma,
            company,
            { dailyDigest }
          )
        );
      } catch (error) {
        console.error(
          `Falha de automação em ${company.name}:`,
          error
        );

        results.push({
          companyId: company.id,
          error: text(
            error?.message,
            'Erro desconhecido'
          ),
        });
      }
    }

    return results;
  }

  /*
   * IMPORTANTE:
   * Esta função e as duas rotas seguintes ficam dentro
   * de registerAutomation(), pois dependem de app,
   * enqueue() e runAllCompanies().
   *
   * Não declarar uma segunda cópia delas fora daqui.
   */
  async function handleCronRequest(
    req,
    res,
    dailyDigest = false
  ) {
    const secret = process.env.CRON_SECRET;

    const authorization =
      req.get('authorization');

    if (
      !secret ||
      authorization !== `Bearer ${secret}`
    ) {
      return res.status(401).json({
        ok: false,
        error: 'Não autorizado.',
      });
    }

    try {
      const results = await enqueue(() =>
        runAllCompanies({ dailyDigest })
      );

      const failures = results.filter(
        (item) =>
          item.error ||
          Number(item.queryFailures || 0) > 0 ||
          Boolean(item.dailyEmail?.error)
      );

      return res
        .status(failures.length ? 500 : 200)
        .json({
          ok: failures.length === 0,
          task: dailyDigest
            ? 'daily'
            : 'prospecting',
          executedAt: new Date().toISOString(),
          companyCount: results.length,
          results,
        });
    } catch (error) {
      console.error(
        'Erro na execução agendada:',
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          'Falha ao executar a rotina agendada.',
      });
    }
  }

  /*
   * Rotas utilizadas pelo serviço externo de agendamento.
   */
  app.get(
    '/api/cron/prospecting',
    (req, res) =>
      handleCronRequest(req, res, false)
  );

  app.get(
    '/api/cron/daily',
    (req, res) =>
      handleCronRequest(req, res, true)
  );

  /* =======================================================
     CONFIGURAÇÕES DA AUTOMAÇÃO
  ======================================================= */

  app.get(
    '/api/automation/settings',
    async (_req, res) => {
      try {
        const company =
          await getDefaultCompany();

        const settings =
          await ensureSettings(
            prisma,
            company
          );

        return res.json({ settings });
      } catch (error) {
        console.error(
          'Erro ao carregar preferências:',
          error
        );

        return res.status(500).json({
          error:
            'Não foi possível carregar as configurações de automação.',
        });
      }
    }
  );

  app.put(
    '/api/automation/settings',
    async (req, res) => {
      try {
        const company =
          await getDefaultCompany();

        const current =
          await ensureSettings(
            prisma,
            company
          );

        const data = parseSettingsUpdate(
          req.body || {},
          current
        );

        const settings =
          await prisma.prospectingSettings.update({
            where: {
              companyId: company.id,
            },
            data,
          });

        return res.json({
          ok: true,
          settings,
        });
      } catch (error) {
        console.error(
          'Erro ao salvar preferências:',
          error
        );

        return res.status(400).json({
          error: text(
            error?.message,
            'Não foi possível salvar as configurações.'
          ),
        });
      }
    }
  );

  /* =======================================================
     CARTEIRA DE EMPRESAS PARCEIRAS
  ======================================================= */

  app.get(
    '/api/partners',
    async (_req, res) => {
      try {
        const company =
          await getDefaultCompany();

        const partners =
          await prisma.partnerCompany.findMany({
            where: {
              ownerCompanyId: company.id,
            },

            include: {
              branches: true,
            },

            orderBy: {
              createdAt: 'desc',
            },
          });

        return res.json({ partners });
      } catch (error) {
        console.error(
          'Erro ao listar parceiros:',
          error
        );

        return res.status(500).json({
          error:
            'Não foi possível carregar as empresas parceiras.',
        });
      }
    }
  );

  app.post(
    '/api/partners',
    async (req, res) => {
      try {
        const company =
          await getDefaultCompany();

        const partnerData =
          normalizePartnerBody(
            req.body || {}
          );

        const {
          branches,
          ...fields
        } = partnerData;

        const partner =
          await prisma.partnerCompany.create({
            data: {
              ...fields,

              ownerCompanyId: company.id,

              branches: {
                create: branches.map(
                  (name) => ({ name })
                ),
              },
            },

            include: {
              branches: true,
            },
          });

        return res
          .status(201)
          .json({
            ok: true,
            partner,
          });
      } catch (error) {
        console.error(
          'Erro ao cadastrar parceiro:',
          error
        );

        return res.status(400).json({
          error: text(
            error?.message,
            'Não foi possível cadastrar a empresa parceira.'
          ),
        });
      }
    }
  );

  app.put(
    '/api/partners/:id',
    async (req, res) => {
      try {
        const company =
          await getDefaultCompany();

        const existing =
          await prisma.partnerCompany.findFirst({
            where: {
              id: req.params.id,
              ownerCompanyId: company.id,
            },
          });

        if (!existing) {
          return res.status(404).json({
            error:
              'Empresa parceira não encontrada.',
          });
        }

        const partnerData =
          normalizePartnerBody(
            req.body || {}
          );

        const {
          branches,
          ...fields
        } = partnerData;

        const partner =
          await prisma.$transaction(
            async (tx) => {
              await tx.partnerBranch.deleteMany({
                where: {
                  partnerId: existing.id,
                },
              });

              return tx.partnerCompany.update({
                where: {
                  id: existing.id,
                },

                data: {
                  ...fields,

                  ...(branches.length
                    ? {
                        branches: {
                          create: branches.map(
                            (name) => ({ name })
                          ),
                        },
                      }
                    : {}),
                },

                include: {
                  branches: true,
                },
              });
            }
          );

        return res.json({
          ok: true,
          partner,
        });
      } catch (error) {
        console.error(
          'Erro ao atualizar parceiro:',
          error
        );

        return res.status(400).json({
          error: text(
            error?.message,
            'Não foi possível atualizar a empresa parceira.'
          ),
        });
      }
    }
  );

  app.delete(
    '/api/partners/:id',
    async (req, res) => {
      try {
        const company =
          await getDefaultCompany();

        const result =
          await prisma.partnerCompany.deleteMany({
            where: {
              id: req.params.id,
              ownerCompanyId: company.id,
            },
          });

        if (!result.count) {
          return res.status(404).json({
            error:
              'Empresa parceira não encontrada.',
          });
        }

        return res.json({
          ok: true,
        });
      } catch (error) {
        console.error(
          'Erro ao excluir parceiro:',
          error
        );

        return res.status(500).json({
          error:
            'Não foi possível excluir a empresa parceira.',
        });
      }
    }
  );

  /* =======================================================
     TESTE DE ENVIO DE E-MAIL
  ======================================================= */

  app.post(
    '/api/automation/test-email',
    async (_req, res) => {
      try {
        const company =
          await getDefaultCompany();

        const settings =
          await ensureSettings(
            prisma,
            company
          );

        if (!settings.recipientEmail) {
          return res.status(400).json({
            error:
              'Cadastre e salve o e-mail destinatário antes de testar.',
          });
        }

        await sendEmail({
          to: settings.recipientEmail,

          subject:
            'Licita360 — teste de envio de alertas',

          html: `
            <div style="font-family:Arial,sans-serif;line-height:1.5">
              <h2>Teste de e-mail do Licita360</h2>

              <p>
                O provedor aceitou esta mensagem de teste.
              </p>

              <p>
                Os alertas automáticos dependem das suas
                preferências e da execução do servidor.
              </p>
            </div>
          `,
        });

        return res.json({
          ok: true,
          message:
            'O provedor aceitou o e-mail de teste.',
        });
      } catch (error) {
        console.error(
          'Erro no teste de e-mail:',
          error
        );

        return res.status(502).json({
          error: text(
            error?.message,
            'Não foi possível enviar o e-mail de teste.'
          ),
        });
      }
    }
  );

  /* =======================================================
     EXECUÇÃO MANUAL DA PROSPECÇÃO
  ======================================================= */

  app.post(
    '/api/automation/run',
    async (_req, res) => {
      try {
        const company =
          await getDefaultCompany();

        const result = await enqueue(() =>
          processCompany(
            prisma,
            company,
            {
              forceProspecting: true,
            }
          )
        );

        return res.json({
          ok: true,
          message:
            'Execução manual concluída.',
          result,
        });
      } catch (error) {
        console.error(
          'Erro na execução manual:',
          error
        );

        return res.status(500).json({
          error: text(
            error?.message,
            'Não foi possível executar a prospecção.'
          ),
        });
      }
    }
  );

  /* =======================================================
     AGENDAMENTO LOCAL
  ======================================================= */

  const scheduleLocalCron = (...args) => {
    /*
     * O agendamento interno é desativado quando:
     * - a aplicação está rodando na Vercel; ou
     * - DISABLE_LOCAL_CRON=true.
     *
     * Isso evita que o cron interno concorra com o
     * agendador externo configurado para chamar as rotas.
     */
    if (
      process.env.VERCEL === '1' ||
      process.env.DISABLE_LOCAL_CRON === 'true'
    ) {
      return null;
    }

    return cron.schedule(...args);
  };

  /*
   * Prospecção automática a cada 30 minutos.
   */
  const routineTask = scheduleLocalCron(
    '*/30 * * * *',
    () => {
      enqueue(() => runAllCompanies())
        .catch((error) => {
          console.error(
            'Erro na prospecção agendada:',
            error
          );
        });
    },
    {
      timezone: TIME_ZONE,
    }
  );

  /*
   * Resumo diário às 08h, no fuso configurado.
   */
  const dailyTask = scheduleLocalCron(
    '0 8 * * *',
    () => {
      enqueue(() =>
        runAllCompanies({
          dailyDigest: true,
        })
      ).catch((error) => {
        console.error(
          'Erro no resumo diário:',
          error
        );
      });
    },
    {
      timezone: TIME_ZONE,
    }
  );

  /* =======================================================
     INICIALIZAÇÃO
  ======================================================= */

  /*
   * Cria as preferências da empresa padrão caso ainda
   * não existam, sem apagar as configurações existentes.
   */
  void (async () => {
    try {
      const company =
        await getDefaultCompany();

      await ensureSettings(
        prisma,
        company
      );

      console.log(
        'Automação do Licita360 preparada; ' +
        'prospecção a cada 30 minutos e ' +
        'resumo diário às 08:00.'
      );
    } catch (error) {
      console.error(
        'Falha ao inicializar automação:',
        error
      );
    }
  })();

  /*
   * Permite interromper os agendadores locais quando
   * a aplicação for encerrada.
   */
  return {
    stop() {
      routineTask?.stop();
      dailyTask?.stop();
    },
  };
}