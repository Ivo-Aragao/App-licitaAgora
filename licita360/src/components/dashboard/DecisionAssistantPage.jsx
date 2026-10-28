import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BrainCircuit,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  Download,
  ExternalLink,
  FileSearch,
  Gauge,
  Info,
  ListChecks,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
  XCircle,
} from 'lucide-react';
import {
  calculateProjectedProfit,
  findMatchingBranches,
  fmtBRL,
  formatDate,
  normalizeSearchText,
  parseDate,
  todayISO,
} from '../../utils/licita360.js';
import './DecisionAssistantPage.css';

const CLOSED_STATUSES = new Set(['Vencida', 'Perdida']);

function daysUntil(value) {
  const date = parseDate(value);
  if (!date) return null;
  const due = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

function safeHttpUrl(value) {
  try {
    const parsed = new URL(String(value || ''));
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : '';
  } catch {
    return '';
  }
}

function analyzeOpportunity(item, profile) {
  const branches = Array.isArray(profile?.branches) ? profile.branches : [];
  const matchedBranches = findMatchingBranches(
    {
      ...item,
      title: [item.title, item.category].filter(Boolean).join(' '),
      raw: item.raw || {},
    },
    branches,
  );

  const deadlineDays = daysUntil(item.deadline);
  const profit = calculateProjectedProfit(item);
  const revenue = Number(item.expectedRevenue);
  const margin = profit !== null && revenue > 0 ? (profit / revenue) * 100 : null;
  const hasFinancialInputs =
    item.expectedRevenue !== '' && item.expectedRevenue != null &&
    item.estimatedCost !== '' && item.estimatedCost != null &&
    Number.isFinite(revenue) && revenue > 0 && profit !== null;
  const sourceUrl = safeHttpUrl(item.url);
  const isClosed = CLOSED_STATUSES.has(item.status);

  const breakdown = [
    {
      key: 'segment',
      label: 'Compatibilidade com os ramos',
      points: branches.length === 0 ? 15 : matchedBranches.length ? 30 : 0,
      max: 30,
      detail: branches.length === 0
        ? 'Cadastre os segmentos da empresa para avaliar a compatibilidade.'
        : matchedBranches.length
          ? `Correspondência: ${matchedBranches.join(', ')}`
          : 'Nenhuma correspondência automática encontrada nos segmentos cadastrados.',
      state: branches.length === 0 ? 'unknown' : matchedBranches.length ? 'good' : 'bad',
    },
    {
      key: 'deadline',
      label: 'Prazo para participar',
      points: deadlineDays === null ? 0 : deadlineDays < 0 ? 0 : deadlineDays <= 2 ? 5 : deadlineDays <= 7 ? 12 : 20,
      max: 20,
      detail: deadlineDays === null
        ? 'Data de encerramento não informada.'
        : deadlineDays < 0
          ? `Prazo passou há ${Math.abs(deadlineDays)} dia(s).`
          : deadlineDays === 0
            ? 'O prazo termina hoje.'
            : `Restam ${deadlineDays} dia(s) até o encerramento.`,
      state: deadlineDays === null ? 'unknown' : deadlineDays < 0 || deadlineDays <= 2 ? 'bad' : deadlineDays <= 7 ? 'warn' : 'good',
    },
    {
      key: 'finance',
      label: 'Viabilidade financeira',
      points: !hasFinancialInputs ? 0 : margin >= 15 ? 25 : margin >= 8 ? 18 : margin > 0 ? 10 : 0,
      max: 25,
      detail: !hasFinancialInputs
        ? 'Informe receita prevista e custo estimado para calcular a margem.'
        : `Lucro estimado de ${fmtBRL(profit)} e margem de ${margin.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%.`,
      state: !hasFinancialInputs ? 'unknown' : margin >= 15 ? 'good' : margin > 0 ? 'warn' : 'bad',
    },
    {
      key: 'source',
      label: 'Fonte para conferência',
      points: sourceUrl ? 10 : 0,
      max: 10,
      detail: sourceUrl ? 'Há um link disponível para conferir o processo.' : 'Cadastre o link oficial do edital ou da contratação.',
      state: sourceUrl ? 'good' : 'bad',
    },
    {
      key: 'details',
      label: 'Informações comerciais',
      points: (Number(item.amount) > 0 ? 5 : 0) + (item.agency && item.modality ? 5 : 0),
      max: 10,
      detail: [Number(item.amount) > 0 ? 'Valor informado' : 'Valor não informado', item.agency && item.modality ? 'órgão e modalidade informados' : 'faltam órgão ou modalidade'].join(' · '),
      state: Number(item.amount) > 0 && item.agency && item.modality ? 'good' : 'warn',
    },
    {
      key: 'status',
      label: 'Situação do processo',
      points: isClosed ? 0 : 5,
      max: 5,
      detail: isClosed ? `O processo está marcado como ${item.status}.` : `Situação atual: ${item.status || 'não informada'}.`,
      state: isClosed ? 'bad' : 'good',
    },
  ];

  const score = breakdown.reduce((total, factor) => total + factor.points, 0);
  const risks = [];

  if (isClosed) {
    risks.push({ level: 'high', title: `Processo ${item.status.toLowerCase()}`, detail: 'Confirme se faz sentido manter esta oportunidade no radar.' });
  }
  if (deadlineDays !== null && deadlineDays < 0 && !isClosed) {
    risks.push({ level: 'critical', title: 'Prazo aparentemente vencido', detail: 'A data cadastrada já passou, mas o processo não está marcado como vencido.' });
  } else if (deadlineDays !== null && deadlineDays <= 2 && deadlineDays >= 0) {
    risks.push({ level: 'high', title: 'Prazo muito próximo', detail: 'Priorize a conferência do encerramento e dos horários no portal oficial.' });
  } else if (deadlineDays === null) {
    risks.push({ level: 'medium', title: 'Prazo não identificado', detail: 'Localize a data e o horário de encerramento no edital.' });
  }
  if (branches.length && matchedBranches.length === 0) {
    risks.push({ level: 'medium', title: 'Compatibilidade não confirmada', detail: 'Confira o objeto e os requisitos técnicos; a busca automática pode não reconhecer sinônimos.' });
  }
  if (!hasFinancialInputs) {
    risks.push({ level: 'medium', title: 'Margem ainda não calculada', detail: 'Preencha receita e custo estimados antes de decidir o preço.' });
  } else if (margin <= 0) {
    risks.push({ level: 'critical', title: 'Margem não positiva', detail: 'Os números cadastrados indicam empate ou prejuízo antes de outras despesas não informadas.' });
  } else if (margin < 8) {
    risks.push({ level: 'high', title: 'Margem estreita', detail: 'Revise impostos, frete, mão de obra, garantias e possíveis custos indiretos.' });
  }
  if (!sourceUrl) {
    risks.push({ level: 'high', title: 'Link de origem ausente', detail: 'Não foi possível validar a oportunidade em uma fonte a partir do registro atual.' });
  }
  if (!(Number(item.amount) > 0)) {
    risks.push({ level: 'low', title: 'Valor de referência ausente', detail: 'O valor não está preenchido. Confirme se existe estimativa no aviso ou edital.' });
  }

  const recommendation = isClosed || (deadlineDays !== null && deadlineDays < 0)
    ? { label: 'Revisar situação', className: 'review', detail: 'Confirme o prazo e o status antes de investir tempo nesta oportunidade.' }
    : score >= 75 && !risks.some((risk) => risk.level === 'critical')
      ? { label: 'Priorizar análise', className: 'positive', detail: 'Os dados cadastrados indicam bom potencial. Ainda é necessário conferir o edital.' }
      : score >= 50
        ? { label: 'Analisar com cautela', className: 'review', detail: 'Existem pontos importantes a confirmar antes de decidir participar.' }
        : { label: 'Baixa prioridade', className: 'negative', detail: 'Faltam informações ou há riscos que precisam ser resolvidos primeiro.' };

  return {
    ...item,
    score,
    matchedBranches,
    deadlineDays,
    profit,
    margin,
    hasFinancialInputs,
    sourceUrl,
    breakdown,
    risks,
    recommendation,
  };
}

function escapeCsv(value) {
  const string = String(value ?? '');
  return `"${string.replace(/"/g, '""')}"`;
}

function exportCsv(items) {
  const header = ['Oportunidade', 'Órgão', 'Local', 'Modalidade', 'Valor informado', 'Prazo', 'Pontuação', 'Recomendação', 'Ramos correspondentes', 'Lucro estimado', 'Margem estimada', 'Riscos identificados'];
  const rows = items.map((item) => [
    item.title,
    item.agency,
    item.location,
    item.modality,
    item.amount,
    item.deadline ? formatDate(item.deadline) : 'Não informado',
    item.score,
    item.recommendation.label,
    item.matchedBranches.join(', '),
    item.profit === null ? 'Não calculado' : fmtBRL(item.profit),
    item.margin === null ? 'Não calculada' : `${item.margin.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`,
    item.risks.map((risk) => risk.title).join('; '),
  ]);
  const content = [header, ...rows].map((row) => row.map(escapeCsv).join(';')).join('\r\n');
  const blob = new Blob(['\ufeff', content], { type: 'text/csv;charset=utf-8;' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = `licita360-analise-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

const CHECKLIST = [
  'Conferir o edital completo e todos os anexos na fonte oficial.',
  'Validar os requisitos de habilitação e a validade das certidões.',
  'Confirmar especificações técnicas, quantidades e critérios de aceitação.',
  'Conferir município, local, prazo e condições de entrega ou execução.',
  'Calcular custo total, incluindo tributos, frete e despesas indiretas.',
  'Definir preço mínimo aceitável e margem desejada.',
  'Confirmar data, horário, plataforma e regras de envio da proposta.',
  'Registrar responsáveis e prazos de preparação dentro do Licita360.',
];

function scoreLabel(score) {
  if (score >= 75) return 'Boa indicação';
  if (score >= 50) return 'Revisar pontos';
  return 'Atenção necessária';
}

export default function DecisionAssistantPage({ data, profile, onEdit, onCreateTask }) {
  const opportunities = Array.isArray(data?.opportunities) ? data.opportunities : [];
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState('');
  const [createdTasks, setCreatedTasks] = useState({});

  const analyses = useMemo(() => opportunities
    .map((item) => analyzeOpportunity(item, profile))
    .sort((a, b) => b.score - a.score), [opportunities, profile]);

  const filtered = useMemo(() => analyses.filter((item) => {
    const searchable = normalizeSearchText([item.title, item.agency, item.category, item.location, item.modality].join(' '));
    if (query && !searchable.includes(normalizeSearchText(query))) return false;
    if (filter === 'recommended' && item.score < 75) return false;
    if (filter === 'risks' && item.risks.length === 0) return false;
    if (filter === 'financial' && item.hasFinancialInputs) return false;
    return true;
  }), [analyses, query, filter]);

  const selected = filtered.find((item) => item.id === selectedId) || filtered[0] || null;
  const highPotential = analyses.filter((item) => item.score >= 75 && !CLOSED_STATUSES.has(item.status)).length;
  const withRisks = analyses.filter((item) => item.risks.length > 0).length;
  const missingFinance = analyses.filter((item) => !item.hasFinancialInputs).length;

  function createChecklistTask(item, checklistText, index) {
    const key = `${item.id}:${index}`;
    if (createdTasks[key] || typeof onCreateTask !== 'function') return;
    const priority = item.deadlineDays !== null && item.deadlineDays <= 3 ? 'Alta' : 'Média';
    const due = item.deadlineDays !== null && item.deadlineDays >= 0 && item.deadline
      ? String(item.deadline).slice(0, 10)
      : todayISO();
    onCreateTask({
      title: `${checklistText} — ${item.title}`.slice(0, 240),
      date: due,
      priority,
      linked: item.id,
    });
    setCreatedTasks((current) => ({ ...current, [key]: true }));
  }

  return (
    <div className="decision-page">
      <div className="decision-header">
        <div>
          <div className="decision-eyebrow"><Sparkles size={15} /> ANÁLISE DE OPORTUNIDADES</div>
          <h1>Assistente de decisão</h1>
          <p>Compare compatibilidade, prazo, informações financeiras e pontos que precisam ser confirmados antes de participar.</p>
        </div>
        <button type="button" className="decision-button decision-button-secondary" onClick={() => exportCsv(analyses)} disabled={!analyses.length}>
          <Download size={16} /> Exportar análise
        </button>
      </div>

      <div className="decision-notice" role="note">
        <Info size={18} />
        <div><strong>Recomendação indicativa, não garantia de habilitação.</strong><span>A pontuação usa somente os dados cadastrados. Sempre confira o edital, a documentação e os requisitos da fonte oficial.</span></div>
      </div>

      <div className="decision-metrics">
        <div className="decision-metric"><span className="decision-metric-icon violet"><Target size={19} /></span><div><small>Oportunidades avaliadas</small><strong>{analyses.length}</strong><span>Processos cadastrados</span></div></div>
        <div className="decision-metric"><span className="decision-metric-icon green"><TrendingUp size={19} /></span><div><small>Boas indicações</small><strong>{highPotential}</strong><span>Com pontuação a partir de 75</span></div></div>
        <div className="decision-metric"><span className="decision-metric-icon amber"><ShieldAlert size={19} /></span><div><small>Com pontos de atenção</small><strong>{withRisks}</strong><span>Exigem alguma verificação</span></div></div>
        <div className="decision-metric"><span className="decision-metric-icon blue"><Wallet size={19} /></span><div><small>Sem cálculo financeiro</small><strong>{missingFinance}</strong><span>Receita e custo ainda incompletos</span></div></div>
      </div>

      <div className="decision-toolbar">
        <label className="decision-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por objeto, órgão ou local..." /></label>
        <label className="decision-filter"><span>Mostrar</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">Todas as oportunidades</option><option value="recommended">Boas indicações</option><option value="risks">Com pontos de atenção</option><option value="financial">Sem cálculo financeiro</option></select></label>
      </div>

      {!analyses.length ? (
        <div className="decision-empty"><BrainCircuit size={30} /><h3>Ainda não há processos para analisar</h3><p>Adicione uma oportunidade no Radar ou em Meus processos para receber uma análise aqui.</p></div>
      ) : !filtered.length ? (
        <div className="decision-empty"><Search size={28} /><h3>Nenhuma oportunidade encontrada</h3><p>Experimente trocar o termo ou o filtro selecionado.</p></div>
      ) : (
        <div className="decision-layout">
          <section className="decision-list-panel">
            <div className="decision-panel-heading"><div><h2>Oportunidades</h2><p>Ordenadas pela pontuação indicativa</p></div><span>{filtered.length} resultado(s)</span></div>
            <div className="decision-list">
              {filtered.map((item) => (
                <button type="button" key={item.id} className={`decision-opportunity ${selected?.id === item.id ? 'is-selected' : ''}`} onClick={() => setSelectedId(item.id)}>
                  <div className="decision-opportunity-top"><span className={`decision-score-badge ${item.score >= 75 ? 'score-good' : item.score >= 50 ? 'score-mid' : 'score-low'}`}>{item.score}<small>/100</small></span><span className={`decision-small-status ${item.recommendation.className}`}>{item.recommendation.label}</span></div>
                  <strong>{item.title || 'Oportunidade sem título'}</strong>
                  <span className="decision-opportunity-agency">{item.agency || 'Órgão não informado'}{item.location ? ` · ${item.location}` : ''}</span>
                  <div className="decision-opportunity-foot"><span><CalendarClock size={14} /> {item.deadline ? formatDate(item.deadline) : 'Prazo não informado'}</span><span>{item.amount > 0 ? fmtBRL(item.amount) : 'Valor não informado'}</span></div>
                </button>
              ))}
            </div>
          </section>

          {selected && (
            <section className="decision-detail-panel">
              <div className="decision-detail-header">
                <div className="decision-detail-label"><BrainCircuit size={16} /> RESUMO DA ANÁLISE</div>
                <div className="decision-detail-title-row"><div><h2>{selected.title || 'Oportunidade sem título'}</h2><p>{selected.agency || 'Órgão não informado'}{selected.location ? ` · ${selected.location}` : ''}</p></div><div className={`decision-score-large ${selected.score >= 75 ? 'score-good' : selected.score >= 50 ? 'score-mid' : 'score-low'}`}><strong>{selected.score}</strong><span>/100</span></div></div>
                <div className={`decision-recommendation ${selected.recommendation.className}`}><div><strong>{selected.recommendation.label}</strong><span>{selected.recommendation.detail}</span></div></div>
                <div className="decision-detail-actions">
                  {selected.sourceUrl && <a className="decision-button decision-button-secondary" href={selected.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Abrir fonte</a>}
                  {typeof onEdit === 'function' && <button className="decision-button decision-button-primary" type="button" onClick={() => onEdit(opportunities.find((item) => item.id === selected.id) || selected)}><ArrowUpRight size={16} /> Revisar processo</button>}
                </div>
              </div>

              <div className="decision-section">
                <div className="decision-section-title"><Gauge size={17} /><h3>Como a pontuação foi calculada</h3></div>
                <div className="decision-breakdown">
                  {selected.breakdown.map((factor) => (
                    <div className="decision-factor" key={factor.key}>
                      <div className="decision-factor-top"><strong>{factor.label}</strong><span>{factor.points}/{factor.max}</span></div>
                      <div className="decision-progress"><span className={`factor-${factor.state}`} style={{ width: `${(factor.points / factor.max) * 100}%` }} /></div>
                      <p>{factor.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="decision-section">
                <div className="decision-section-title"><CircleAlert size={17} /><h3>Pontos de atenção</h3><span>{selected.risks.length}</span></div>
                {selected.risks.length ? <div className="decision-risks">{selected.risks.map((risk, index) => <div className={`decision-risk risk-${risk.level}`} key={`${risk.title}-${index}`}><span className="decision-risk-icon">{risk.level === 'critical' || risk.level === 'high' ? <ShieldAlert size={17} /> : <Info size={17} />}</span><div><strong>{risk.title}</strong><p>{risk.detail}</p></div></div>)}</div> : <div className="decision-no-risks"><CheckCircle2 size={17} /><span>Nenhum ponto de atenção foi identificado pelos dados disponíveis. Isso não substitui a leitura do edital.</span></div>}
              </div>

              <div className="decision-section">
                <div className="decision-section-title"><ListChecks size={17} /><h3>Checklist antes de participar</h3></div>
                <p className="decision-section-help">Transforme cada verificação em uma tarefa vinculada a este processo.</p>
                <div className="decision-checklist">{CHECKLIST.map((item, index) => {
                  const key = `${selected.id}:${index}`;
                  const created = Boolean(createdTasks[key]);
                  return <div className={`decision-checklist-item ${created ? 'task-created' : ''}`} key={item}><span className="decision-check-number">{created ? <CheckCircle2 size={17} /> : String(index + 1).padStart(2, '0')}</span><span>{item}</span><button type="button" onClick={() => createChecklistTask(selected, item, index)} disabled={created || typeof onCreateTask !== 'function'} title={created ? 'Tarefa criada' : 'Criar tarefa vinculada'}>{created ? <CheckCircle2 size={16} /> : <Plus size={16} />}{created ? 'Criada' : 'Criar tarefa'}</button></div>;
                })}</div>
              </div>

              <div className="decision-financial-note"><Wallet size={17} /><p><strong>Sobre os números:</strong> lucro e margem só são calculados quando receita prevista e custo estimado estão preenchidos no processo. A estimativa não inclui despesas que não tenham sido cadastradas.</p></div>
            </section>
          )}
        </div>
      )}
      <div className="decision-footer-note"><FileSearch size={15} /> A análise é baseada nos dados presentes no Licita360; confira informações, prazos e requisitos no edital oficial.</div>
    </div>
  );
}
