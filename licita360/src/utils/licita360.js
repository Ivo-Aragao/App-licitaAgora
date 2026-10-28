import {
  LayoutDashboard,
  Radar,
  BriefcaseBusiness,
  ListTodo,
  FolderOpen,
  Wallet,
  Users,
  BellRing,
  Sparkles,
  FileSearch,

} from 'lucide-react';

export const STORAGE_KEY = 'licita360-v1';

export const storageKeyForUser = (userId) => `${STORAGE_KEY}:${userId || 'guest'}`;

export const todayISO = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const fmtBRL = (value) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 2,
}).format(Number(value || 0));

export const parseDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const text = String(value);
  const match = text.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );

  if (match) {
    const date = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4] || 0),
      Number(match[5] || 0),
      Number(match[6] || 0),
    );

    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDate = (value) => {
  const date = parseDate(value);
  if (!date) return 'A definir';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

export const toDateTimeLocalValue = (value) => {
  const date = parseDate(value);
  if (!date) return '';

  const adjusted = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );

  return adjusted.toISOString().slice(0, 16);
};

export const initialData = {
  opportunities: [
    {
      id: 'op-101',
      title: 'Aquisição de materiais de expediente',
      category: 'Material de escritório',
      agency: 'Prefeitura Municipal de Fortaleza',
      location: 'CE',
      modality: 'Pregão eletrônico',
      amount: 84500,
      expectedRevenue: null,
      estimatedCost: null,
      taxPercent: 0,
      deadline: '2026-10-22T14:00:00',
      status: 'Em análise',
      source: 'Demonstração',
      url: '',
      tasks: [
        { id: 't1', title: 'Revisar exigências técnicas', done: true },
        { id: 't2', title: 'Solicitar cotação a fornecedores', done: false },
        { id: 't3', title: 'Conferir certidões', done: false },
      ],
    },
    {
      id: 'op-102',
      title: 'Serviços de manutenção predial',
      category: 'Prestação de serviços',
      agency: 'Secretaria de Administração',
      location: 'CE',
      modality: 'Concorrência eletrônica',
      amount: 275000,
      expectedRevenue: null,
      estimatedCost: null,
      taxPercent: 0,
      deadline: '2026-10-25T09:00:00',
      status: 'Documentação',
      source: 'Demonstração',
      url: '',
      tasks: [
        { id: 't4', title: 'Conferir atestado técnico', done: false },
        { id: 't5', title: 'Analisar planilha de custos', done: true },
      ],
    },
    {
      id: 'op-103',
      title: 'Equipamentos de informática',
      category: 'Tecnologia',
      agency: 'Instituto Federal — unidade regional',
      location: 'PE',
      modality: 'Pregão eletrônico',
      amount: 132800,
      expectedRevenue: null,
      estimatedCost: null,
      taxPercent: 0,
      deadline: '2026-10-28T10:00:00',
      status: 'Preparar proposta',
      source: 'Demonstração',
      url: '',
      tasks: [
        { id: 't6', title: 'Cotação de equipamentos', done: true },
        { id: 't7', title: 'Validar garantia mínima', done: false },
      ],
    },
    {
      id: 'op-104',
      title: 'Fornecimento de gêneros alimentícios',
      category: 'Alimentos',
      agency: 'Consórcio Público Regional',
      location: 'PB',
      modality: 'Pregão eletrônico',
      amount: 196400,
      expectedRevenue: null,
      estimatedCost: null,
      taxPercent: 0,
      deadline: '2026-11-03T08:30:00',
      status: 'Monitorar',
      source: 'Demonstração',
      url: '',
      tasks: [
        { id: 't8', title: 'Verificar locais de entrega', done: false },
      ],
    },
  ],

  tasks: [
    {
      id: 'task-1',
      title: 'Revisar edital de materiais de expediente',
      date: '2026-10-16',
      priority: 'Alta',
      done: false,
      linked: 'op-101',
    },
    {
      id: 'task-2',
      title: 'Pedir nova cotação de frete',
      date: '2026-10-16',
      priority: 'Média',
      done: false,
      linked: 'op-102',
    },
    {
      id: 'task-3',
      title: 'Atualizar certidão estadual',
      date: '2026-10-19',
      priority: 'Alta',
      done: false,
      linked: '',
    },
    {
      id: 'task-4',
      title: 'Conferir documentação da proposta de TI',
      date: '2026-10-20',
      priority: 'Baixa',
      done: true,
      linked: 'op-103',
    },
  ],

  documents: [
    {
      id: 'doc-1',
      name: 'Contrato social consolidado',
      type: 'Societário',
      expires: '2027-05-30',
      status: 'Em dia',
      fileName: '',
    },
    {
      id: 'doc-2',
      name: 'Certidão conjunta federal',
      type: 'Certidão',
      expires: '2026-11-12',
      status: 'Atenção',
      fileName: '',
    },
    {
      id: 'doc-3',
      name: 'Certidão estadual',
      type: 'Certidão',
      expires: '2026-10-19',
      status: 'Vence em breve',
      fileName: '',
    },
    {
      id: 'doc-4',
      name: 'Balanço patrimonial',
      type: 'Contábil',
      expires: '2027-04-30',
      status: 'Em dia',
      fileName: '',
    },
  ],

  profile: {
    company: 'Minha empresa',
    branches: [
      'Material de escritório',
      'Tecnologia',
      'Prestação de serviços',
      'Alimentos',
    ],
    uf: 'CE',
  },
};

export function loadData(storageKey = STORAGE_KEY) {
  try {
    const saved = localStorage.getItem(storageKey);

    if (!saved) return initialData;

    const parsed = JSON.parse(saved);

    return {
      opportunities: Array.isArray(parsed.opportunities)
        ? parsed.opportunities
        : initialData.opportunities,
      tasks: Array.isArray(parsed.tasks)
        ? parsed.tasks
        : initialData.tasks,
      documents: Array.isArray(parsed.documents)
        ? parsed.documents
        : initialData.documents,
      profile: parsed.profile || initialData.profile,
    };
  } catch {
    return initialData;
  }
}

export const nav = [
  {
    id: 'overview',
    label: 'Visão geral',
    icon: LayoutDashboard,
    group: 'WORKSPACE',
  },
  {
    id: 'radar',
    label: 'Radar de licitações',
    icon: Radar,
    group: 'WORKSPACE',
  },
  {
  id: 'assistant',
  label: 'Assistente de decisão',
  icon: Sparkles,
  group: 'WORKSPACE',
},
{
  id: 'edict-analysis',
  label: 'Análise de editais',
  icon: FileSearch,
  group: 'WORKSPACE',
},
  {
    id: 'processes',
    label: 'Meus processos',
    icon: BriefcaseBusiness,
    group: 'WORKSPACE',
  },
  {
    id: 'tasks',
    label: 'Tarefas e prazos',
    icon: ListTodo,
    group: 'GESTÃO',
  },
  {
    id: 'documents',
    label: 'Documentos',
    icon: FolderOpen,
    group: 'GESTÃO',
  },
  {
    id: 'calculator',
    label: 'Calculadora de preço',
    icon: Wallet,
    group: 'FERRAMENTAS',
  },
  {
  id: 'partners',
  label: 'Carteira de clientes',
  icon: Users,
  group: 'COMERCIAL',
},
{
  id: 'alerts',
  label: 'Alertas e automação',
  icon: BellRing,
  group: 'GESTÃO',
},
];

export const statusOptions = [
  'Em análise',
  'Documentação',
  'Preparar proposta',
  'Disputa agendada',
  'Enviada',
  'Vencida',
  'Perdida',
  'Monitorar',
];

export const normalizeSearchText = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const BRANCH_SYNONYMS = [
  {
    aliases: [
      'tecnologia',
      'informatica',
      'equipamentos de informatica',
      'computacao',
    ],
    terms: [
      'computador', 'computadores', 'notebook', 'laptop', 'desktop',
      'microcomputador', 'servidor', 'monitor', 'impressora', 'scanner',
      'roteador', 'switch', 'rede de computadores', 'software', 'hardware',
      'tablet', 'projetor', 'periferico', 'toner',
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
      'papel', 'caneta', 'lapis', 'caderno', 'pasta arquivo',
      'grampeador', 'clips', 'envelope', 'toner', 'cartucho',
      'material de expediente', 'material de consumo',
      'material de escritorio',
    ],
  },
  {
    aliases: [
      'alimentos',
      'generos alimenticios',
      'generos alimentares',
      'alimentacao',
    ],
    terms: [
      'generos alimenticios', 'alimento', 'merenda escolar',
      'carne', 'frango', 'arroz', 'feijao', 'leite', 'hortifruti',
      'cesta basica', 'produto alimenticio',
    ],
  },
  {
    aliases: [
      'limpeza e conservacao',
      'limpeza',
      'higiene',
      'saneantes',
    ],
    terms: [
      'detergente', 'desinfetante', 'sabonete', 'papel higienico',
      'material de limpeza', 'higienizacao', 'saneante',
      'servicos de limpeza', 'conservacao predial',
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
      'cimento', 'areia', 'brita', 'tijolo', 'material de construcao',
      'obra', 'reforma', 'engenharia civil', 'tinta', 'tubulacao',
    ],
  },
  {
    aliases: [
      'medicamentos',
      'farmacia',
      'material hospitalar',
      'saude',
    ],
    terms: [
      'medicamento', 'farmaceutico', 'hospitalar', 'seringa',
      'luva descartavel', 'material medico', 'equipamento medico',
      'insumo hospitalar', 'produto para saude',
    ],
  },
  {
    aliases: ['veiculos', 'automotivo', 'frota'],
    terms: [
      'veiculo', 'automovel', 'caminhao', 'onibus', 'ambulancia',
      'motocicleta', 'pneu', 'pecas automotivas', 'manutencao veicular',
    ],
  },
  {
    aliases: ['mobiliario escolar', 'mobiliario', 'moveis'],
    terms: [
      'mesa', 'cadeira', 'armario', 'estante', 'carteira escolar',
      'mobiliario', 'moveis',
    ],
  },
  {
    aliases: [
      'uniformes',
      'vestuario',
      'roupas',
      'equipamentos de protecao individual',
    ],
    terms: [
      'uniforme', 'camisa', 'calca', 'vestuario', 'calcado',
      'bota', 'epi', 'equipamento de protecao individual',
    ],
  },
  {
    aliases: ['servicos de vigilancia', 'seguranca patrimonial'],
    terms: [
      'vigilancia', 'seguranca patrimonial', 'portaria',
      'monitoramento patrimonial',
    ],
  },
  {
    aliases: [
      'prestacao de servicos',
      'servicos gerais',
      'terceirizacao',
    ],
    terms: [
      'prestacao de servicos', 'servicos continuados', 'mao de obra',
      'servicos gerais', 'terceirizacao', 'apoio administrativo',
    ],
  },
];

export function getBranchSearchTerms(branch) {
  const normalizedBranch = normalizeSearchText(branch);
  const terms = new Set();

  if (normalizedBranch.length >= 3) {
    terms.add(normalizedBranch);
  }

  for (const group of BRANCH_SYNONYMS) {
    const matchesGroup = group.aliases.some((alias) => {
      const normalizedAlias = normalizeSearchText(alias);

      return normalizedBranch === normalizedAlias ||
        (
          normalizedAlias.length >= 4 &&
          normalizedBranch.includes(normalizedAlias)
        );
    });

    if (matchesGroup) {
      group.terms.forEach((term) => {
        terms.add(normalizeSearchText(term));
      });
    }
  }

  return [...terms].filter((term) => term.length >= 3);
}

export function findMatchingBranches(record, branches) {
  const searchableText = normalizeSearchText([
    record.title,
    record.raw?.objetoCompra,
    record.raw?.descricaoObjeto,
    record.raw?.informacaoComplementar,
  ].filter(Boolean).join(' '));

  return branches.filter((branch) =>
    getBranchSearchTerms(branch).some((term) =>
      searchableText.includes(term)
    )
  );
}

export function calculateProjectedProfit(item) {
  if (
    item.expectedRevenue === '' ||
    item.expectedRevenue == null ||
    item.estimatedCost === '' ||
    item.estimatedCost == null
  ) {
    return null;
  }

  const revenue = Number(item.expectedRevenue);
  const cost = Number(item.estimatedCost);
  const taxPercent = Number(item.taxPercent ?? 0);

  if (
    !Number.isFinite(revenue) ||
    !Number.isFinite(cost) ||
    !Number.isFinite(taxPercent) ||
    revenue <= 0 ||
    cost < 0 ||
    taxPercent < 0 ||
    taxPercent > 100
  ) {
    return null;
  }

  return revenue - cost - (revenue * taxPercent) / 100;
}

export const UF_OPTIONS =
  'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

export function csvValues(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function emptyPartnerDraft() {
  return {
    name: '',
    cnpj: '',
    contactName: '',
    email: '',
    phone: '',
    uf: 'CE',
    cities: '',
    branches: '',
    minimumAmount: '',
    maximumAmount: '',
    active: true,
    notifyOpportunities: true,
  };
}
