import React, { useEffect, useMemo, useRef, useState } from 'react';
import AdminApp from '../admin/AdminApp.jsx';
import {
  Activity, AlertCircle, ArrowRight, ArrowUpRight, Bell,
  BriefcaseBusiness, CalendarClock, Check, CheckCheck, CheckCircle2,
  ChevronDown, ChevronRight, CircleHelp, ClipboardCheck, Clock3,
  CloudDownload, FileCheck2, FileSearch, FileText, Filter, FolderOpen,
  LayoutDashboard, ListTodo, BellRing, Building2, Mail, Play, Save, Users, 
  LoaderCircle, Menu, Plus, Radar, Search,
  Settings2, ShieldCheck, Sparkles, Target, Upload, Wallet, X,
  Eye, EyeOff, KeyRound, LockKeyhole, LogOut, UserRound, Phone, ArrowLeft,
} from 'lucide-react';

import * as Utils from '../../utils/licita360.js';
const { STORAGE_KEY, storageKeyForUser, todayISO, uid, fmtBRL, parseDate, formatDate, toDateTimeLocalValue, initialData, loadData, nav, statusOptions, normalizeSearchText, BRANCH_SYNONYMS, getBranchSearchTerms, findMatchingBranches, calculateProjectedProfit, UF_OPTIONS, csvValues, emptyPartnerDraft } = Utils;

import { PageHeader, PrimaryButton, MetricCard, Overview, OpportunityRow, StatusBadge, PriorityBadge, EmptyState, SearchFilters } from '../../components/dashboard/SharedComponents.jsx';

import { RadarPage, OpportunityCard, PartnersPage, AlertsPage, ProcessesPage, TasksPage, DocumentsPage, CalculatorPage } from '../../components/dashboard/Pages.jsx';

import { OpportunityModal, TaskModal, SettingsModal, HelpModal } from '../../components/dashboard/Modals.jsx';

import EdictAnalyzerPage from '../../components/dashboard/EdictAnalyzerPage.jsx';

import DecisionAssistantPage from '../../components/dashboard/DecisionAssistantPage.jsx';
export default function DashboardApp({ currentUser, onLogout }) {
  const [data, setData] = useState(() => loadData(storageKeyForUser(currentUser.id)));
  const [dataReady, setDataReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState('loading');

  const saveQueueRef = useRef(Promise.resolve());
  const saveVersionRef = useRef(0);

  const [page, setPage] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [partners, setPartners] = useState([]);
  const [automationSettings, setAutomationSettings] = useState(null);
  const [automationBusy, setAutomationBusy] = useState(false);
  const [automationError, setAutomationError] = useState('');
  const [pncpBusy, setPncpBusy] = useState(false);
  const [pncpError, setPncpError] = useState('');
  const [pncpResults, setPncpResults] = useState([]);
  const [pncpInfo, setPncpInfo] = useState('');

  const [pncpFilters, setPncpFilters] = useState({
    modality: '6',
    uf: 'CE',
    days: '30',
  });

  const [taskFilter, setTaskFilter] = useState('Pendentes');

  const [priceForm, setPriceForm] = useState({
    cost: '100',
    tax: '8',
    freight: '4',
    other: '3',
    margin: '15',
  });

  // Carrega os dados do servidor antes de começar a sincronizar alterações.
  useEffect(() => {
    let cancelled = false;

    async function loadFromServer() {
      try {
        const response = await fetch('/api/data');

        if (!response.ok) {
          throw new Error('Não foi possível carregar os dados da API.');
        }

        const payload = await response.json();

        if (cancelled) return;

        if (payload.data && typeof payload.data === 'object') {
          const saved = payload.data;
          const savedProfile =
            saved.profile && typeof saved.profile === 'object'
              ? saved.profile
              : {};

          setData({
            opportunities: Array.isArray(saved.opportunities)
              ? saved.opportunities
              : [],
            tasks: Array.isArray(saved.tasks)
              ? saved.tasks
              : [],
            documents: Array.isArray(saved.documents)
              ? saved.documents
              : [],
            profile: {
              ...initialData.profile,
              ...savedProfile,
              branches: Array.isArray(savedProfile.branches)
                ? savedProfile.branches
                : initialData.profile.branches,
            },
          });
        }
      } catch (error) {
        console.error('Falha ao carregar dados do servidor:', error);
      } finally {
        if (!cancelled) setDataReady(true);
      }
    }

    loadFromServer();

    return () => {
      cancelled = true;
    };
  }, []);

  // Carrega configurações de automação e empresas parceiras.
  useEffect(() => {
    let cancelled = false;

    async function loadAutomationData() {
      try {
        const [settingsResponse, partnersResponse] = await Promise.all([
          fetch('/api/automation/settings'),
          fetch('/api/partners'),
        ]);

        const settingsPayload = await settingsResponse.json();
        const partnersPayload = await partnersResponse.json();

        if (!settingsResponse.ok) {
          throw new Error(
            settingsPayload.error || 'Não foi possível carregar as configurações.'
          );
        }

        if (!partnersResponse.ok) {
          throw new Error(
            partnersPayload.error || 'Não foi possível carregar os parceiros.'
          );
        }

        if (cancelled) return;

        setAutomationSettings(settingsPayload.settings);
        setPartners(
          Array.isArray(partnersPayload.partners)
            ? partnersPayload.partners
            : []
        );

        setAutomationError('');
      } catch (error) {
        if (!cancelled) {
          setAutomationError(error.message);
        }
      }
    }

    loadAutomationData();

    return () => {
      cancelled = true;
    };
  }, []);

  // Mantém uma cópia local e sincroniza com a API que grava pelo Prisma.
  useEffect(() => {
    if (!dataReady) return undefined;

    const version = ++saveVersionRef.current;
    const snapshot = JSON.stringify(data);

    try {
      localStorage.setItem(storageKeyForUser(currentUser.id), snapshot);
    } catch (error) {
      console.warn('Não foi possível atualizar a cópia local:', error);
    }

    const timer = setTimeout(() => {
      if (version === saveVersionRef.current) {
        setSyncStatus('saving');
      }

      const operation = saveQueueRef.current
        .catch(() => {})
        .then(async () => {
          const response = await fetch('/api/data', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: snapshot,
          });

          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(
              payload.error || 'A API não conseguiu salvar os dados.'
            );
          }
        });

      saveQueueRef.current = operation;

      operation
        .then(() => {
          if (version === saveVersionRef.current) {
            setSyncStatus('saved');
          }
        })
        .catch((error) => {
          console.error('Falha ao persistir os dados:', error);

          if (version === saveVersionRef.current) {
            setSyncStatus('offline');
          }
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [data, dataReady]);

  useEffect(() => {
    if (!toast) return undefined;

    const timer = setTimeout(() => setToast(''), 3200);

    return () => clearTimeout(timer);
  }, [toast]);

  const updateData = (key, value) =>
    setData((current) => ({ ...current, [key]: value }));

  const activeOpportunities = data.opportunities.filter(
    (item) => !['Vencida', 'Perdida'].includes(item.status)
  );

  const totalActive = activeOpportunities.length;
  const now = new Date();

  const deadlineCount = data.opportunities.filter((item) => {
    const deadline = parseDate(item.deadline);

    return (
      deadline &&
      deadline >= now &&
      deadline.getTime() - now.getTime() <= 7 * 86400000 &&
      !['Vencida', 'Perdida'].includes(item.status)
    );
  }).length;

  const activeTasks = data.tasks.filter((task) => !task.done).length;

  const profits = activeOpportunities
    .map(calculateProjectedProfit)
    .filter((value) => value !== null);

  const projectedProfit = profits.length
    ? profits.reduce((sum, value) => sum + value, 0)
    : null;

  const profitCoverage = profits.length;

  const filteredOpportunities = useMemo(
    () => data.opportunities.filter((item) => {
      const text = [
        item.title,
        item.category,
        item.agency,
        item.location,
        item.modality,
      ].join(' ').toLowerCase();

      return (
        text.includes(query.toLowerCase()) &&
        (statusFilter === 'Todos' || item.status === statusFilter)
      );
    }),
    [data.opportunities, query, statusFilter]
  );

 function showPage(id) {
  if (id === 'admin' && currentUser?.role !== 'ADMIN') return;
  setPage(id);
  setSidebarOpen(false);
  setQuery('');
  setStatusFilter('Todos');
}

  function saveOpportunity(form) {
    const normalized = {
      ...form,
      amount: Number(form.amount || 0),
      expectedRevenue:
        form.expectedRevenue === '' || form.expectedRevenue == null
          ? null
          : Number(form.expectedRevenue),
      estimatedCost:
        form.estimatedCost === '' || form.estimatedCost == null
          ? null
          : Number(form.estimatedCost),
      taxPercent: Number(form.taxPercent || 0),
      tasks: Array.isArray(form.tasks) ? form.tasks : [],
    };

    const exists = data.opportunities.some(
      (item) => item.id === normalized.id
    );

    updateData(
      'opportunities',
      exists
        ? data.opportunities.map((item) =>
            item.id === normalized.id ? normalized : item
          )
        : [
            {
              ...normalized,
              id: normalized.id || uid(),
            },
            ...data.opportunities,
          ]
    );

    setModal(null);
    setToast(
      exists
        ? 'Processo atualizado.'
        : 'Licitação adicionada ao seu radar.'
    );
  }

  function addPncpRecord(record) {
    if (
      data.opportunities.some(
        (item) =>
          item.sourceId === record.id ||
          item.id === record.id
      )
    ) {
      setToast('Esta oportunidade já está cadastrada.');
      return;
    }

    const newItem = {
      id: uid(),
      sourceId: record.id,
      title: record.title,
      category:
        record.matchedBranches?.join(', ') || 'Importado do PNCP',
      agency: record.agency,
      location: record.uf || pncpFilters.uf || 'BR',
      modality: record.modality,
      amount: record.amount || 0,
      deadline: record.deadline || '',
      status: 'Em análise',
      source: 'PNCP',
      url: record.url,
      tasks: [],
      expectedRevenue: null,
      estimatedCost: null,
      taxPercent: 0,
    };

    updateData('opportunities', [
      newItem,
      ...data.opportunities,
    ]);

    setToast('Oportunidade do PNCP adicionada aos seus processos.');
  }

  async function searchPncp() {
    setPncpBusy(true);
    setPncpError('');
    setPncpInfo('');
    setPncpResults([]);

    const final = new Date();
    final.setDate(final.getDate() + Number(pncpFilters.days || 30));

    const date = [
      final.getFullYear(),
      String(final.getMonth() + 1).padStart(2, '0'),
      String(final.getDate()).padStart(2, '0'),
    ].join('');

    const pageSize = 50;
    const maxPages = 5;
    const allRecords = [];

    try {
      for (
        let pageNumber = 1;
        pageNumber <= maxPages;
        pageNumber += 1
      ) {
        const params = new URLSearchParams({
          dataFinal: date,
          pagina: String(pageNumber),
          tamanhoPagina: String(pageSize),
          modalidade: pncpFilters.modality,
        });

        if (pncpFilters.uf) {
          params.set('uf', pncpFilters.uf);
        }

        const response = await fetch(
          `/api/pncp/propostas?${params.toString()}`
        );

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(
            payload.error || 'Falha na consulta ao PNCP.'
          );
        }

        const pageRecords = Array.isArray(payload.records)
          ? payload.records
          : [];

        allRecords.push(
  ...pageRecords.map((record) => {
    const raw = record.raw || {};
    const unidade =
      raw.unidadeOrgao ||
      raw.unidadeAdministrativa ||
      {};

    const city = String(
      record.city ||
      unidade.municipioNome ||
      unidade.nomeMunicipio ||
      raw.municipioNome ||
      raw.nomeMunicipio ||
      ''
    ).trim();

    const uf = String(
      record.uf ||
      unidade.ufSigla ||
      unidade.uf ||
      raw.ufSigla ||
      raw.uf ||
      ''
    ).trim().toUpperCase();

    const location = city
      ? [city, uf].filter(Boolean).join('/')
      : (
          record.location ||
          (uf
            ? `Município não informado/${uf}`
            : 'Município não informado')
        );

    return {
      ...record,
      city,
      uf,
      location,
    };
  })
);

        if (pageRecords.length < pageSize) {
          break;
        }
      }

      const uniqueRecords = [
        ...new Map(
          allRecords.map((record) => [record.id, record])
        ).values(),
      ];

      setPncpResults(uniqueRecords);

      setPncpInfo(
        `Consulta ao PNCP concluída: ${uniqueRecords.length} registro(s) recebido(s). ` +
        (
          uniqueRecords.length >= pageSize * maxPages
            ? 'Limite de 250 registros atingido. Refine os filtros para ampliar a busca por partes.'
            : 'Confira as correspondências com os ramos cadastrados da empresa.'
        )
      );
    } catch (error) {
      setPncpError(
        `${error.message} Confira a conexão com a API e tente novamente.`
      );
    } finally {
      setPncpBusy(false);
    }
  }

  const addTask = (task) => {
    updateData('tasks', [
      { ...task, id: uid(), done: false },
      ...data.tasks,
    ]);

    setModal(null);
    setToast('Tarefa criada.');
  };

  function addTasks(tasksToAdd) {
  const newTasks = tasksToAdd.map((task) => ({
    ...task,
    id: uid(),
    done: false,
  }));

  setData((current) => ({
    ...current,
    tasks: [...newTasks, ...current.tasks],
  }));

  setToast(`${newTasks.length} tarefa(s) criada(s) a partir do edital.`);
}

  const toggleTask = (id) =>
    updateData(
      'tasks',
      data.tasks.map((item) =>
        item.id === id
          ? { ...item, done: !item.done }
          : item
      )
    );

  const editOpportunity = (item) =>
    setModal({ type: 'opportunity', initial: item });

  const editNew = () =>
    setModal({ type: 'opportunity', initial: null });

  // Salva uma empresa parceira e atualiza a lista exibida na tela.
  async function persistPartner(partner) {
    const editing = Boolean(partner.id);

    try {
      const response = await fetch(
        editing
          ? `/api/partners/${encodeURIComponent(partner.id)}`
          : '/api/partners',
        {
          method: editing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(partner),
        }
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Não foi possível salvar a empresa parceira.');
      }

      const listResponse = await fetch('/api/partners');
      const listPayload = await listResponse.json().catch(() => ({}));
      if (!listResponse.ok) {
        throw new Error(listPayload.error || 'A empresa foi salva, mas não foi possível atualizar a lista.');
      }

      setPartners(Array.isArray(listPayload.partners) ? listPayload.partners : []);
      setToast(editing ? 'Empresa parceira atualizada.' : 'Empresa parceira cadastrada.');
      return true;
    } catch (error) {
      console.error('Falha ao salvar empresa parceira:', error);
      setToast(error.message || 'Erro ao salvar empresa parceira.');
      return false;
    }
  }

  // Remove uma empresa parceira após confirmação.
  async function removePartner(id) {
    if (!confirm('Deseja realmente excluir esta empresa parceira?')) return;

    try {
      const response = await fetch(`/api/partners/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || 'Não foi possível excluir a empresa parceira.');
      }

      setPartners((current) => current.filter((partner) => partner.id !== id));
      setToast('Empresa parceira excluída.');
    } catch (error) {
      console.error('Falha ao excluir empresa parceira:', error);
      setToast(error.message || 'Erro ao excluir empresa parceira.');
    }
  }

  // Persiste as preferências de alertas na API.
  async function saveAutomationSettings(settings) {
    setAutomationBusy(true);
    setAutomationError('');

    try {
      const response = await fetch('/api/automation/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || 'Não foi possível salvar as configurações de alertas.');
      }

      setAutomationSettings(payload.settings || settings);
      setAutomationError('');
      setToast('Preferências de alertas salvas.');
      return true;
    } catch (error) {
      console.error('Falha ao salvar configurações de alertas:', error);
      setAutomationError(error.message || 'Erro ao salvar as configurações.');
      return false;
    } finally {
      setAutomationBusy(false);
    }
  }

  // Solicita à API a execução imediata da rotina de prospecção.
  async function runAutomationNow() {
    if (automationBusy) return;

    setAutomationBusy(true);
    setAutomationError('');

    try {
      const response = await fetch('/api/automation/run', { method: 'POST' });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || 'Não foi possível executar a prospecção.');
      }

      setAutomationError('');
      setToast(payload.message || 'Execução da prospecção concluída.');
    } catch (error) {
      console.error('Falha na execução da prospecção:', error);
      setAutomationError(error.message || 'Erro ao executar a prospecção.');
    } finally {
      setAutomationBusy(false);
    }
  }

  // Solicita o envio de um e-mail de teste com as configurações salvas.
  async function sendTestEmail() {
    if (automationBusy) return;

    setAutomationBusy(true);
    setAutomationError('');

    try {
      const response = await fetch('/api/automation/test-email', {
        method: 'POST',
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || 'Não foi possível enviar o e-mail de teste.');
      }

      setAutomationError('');
      setToast(payload.message || 'Solicitação de e-mail de teste concluída.');
    } catch (error) {
      console.error('Falha no envio do e-mail de teste:', error);
      setAutomationError(error.message || 'Erro ao enviar o e-mail de teste.');
    } finally {
      setAutomationBusy(false);
    }
  }

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <button
          className="mobile-scrim"
          aria-label="Fechar menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-symbol">
            <Radar size={22} />
          </div>

          <div>
            <div className="brand-name">
              licita<span>360</span>
            </div>
            <div className="brand-caption">
              INTELIGÊNCIA EM COMPRAS
            </div>
          </div>

          <button
            className="icon-button sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu"
          >
            <X size={18} />
          </button>
        </div>

        <div className="company-switch">
          <div className="company-avatar">
            {(data.profile.company || 'M').slice(0, 1).toUpperCase()}
          </div>

          <div className="company-meta">
            <strong>{data.profile.company || 'Minha empresa'}</strong>
            <span>Plano demonstração</span>
          </div>

          <ChevronDown size={16} className="muted-icon" />
        </div>

        {currentUser?.role === 'ADMIN' && (
              <button
                className={`nav-link ${page === 'admin' ? 'active' : ''}`}
                onClick={() => showPage('admin')}
                type="button"
              >
                <ShieldCheck size={18} />
                <span>Painel administrativo</span>
              </button>
            )}

        {['WORKSPACE', 'COMERCIAL', 'GESTÃO', 'FERRAMENTAS'].map((group) => (
          <div className="nav-group" key={group}>
            <div className="nav-label">{group}</div>

            {nav.filter((item) => item.group === group).map((item) => (
              <button
                key={item.id}
                onClick={() => showPage(item.id)}
                className={`nav-link ${page === item.id ? 'active' : ''}`}
              >
                <item.icon size={18} />
                <span>{item.label}</span>

                {item.id === 'tasks' && activeTasks > 0 && (
                  <span className="nav-count">{activeTasks}</span>
                )}
              </button>
            ))}
          </div>
        ))}

        <div className="sidebar-bottom">
          <div className="support-card">
            <div className="support-icon">
              <Sparkles size={17} />
            </div>

            <strong>Mais clareza. Mais controle.</strong>
            <p>
              Organize oportunidades, prazos e custos em um só lugar.
            </p>

            <button onClick={() => setModal({ type: 'help' })}>
              Conhecer recursos <ArrowRight size={14} />
            </button>
          </div>

          <button
            className="nav-link"
            onClick={() => setModal({ type: 'settings' })}
          >
            <Settings2 size={18} />
            <span>Configurações</span>
          </button>

          <button
            className="nav-link logout-link"
            onClick={onLogout}
            type="button"
          >
            <LogOut size={18} />
            <span>Sair da conta</span>
          </button>

          <button
            className="profile-row"
            onClick={() => setModal({ type: 'settings' })}
          >
            <div className="user-avatar">AD</div>
            <div>
              <strong>{currentUser.name || 'Usuário'}</strong>
              <span>{currentUser.email}</span>
            </div>
            <ChevronDown size={15} />
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button menu-button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu size={20} />
            </button>

            <div className="breadcrumbs">
              Workspace <ChevronRight size={14} />
              <strong>
                {page === 'admin'
                  ? 'Painel administrativo'
                  : (nav.find((item) => item.id === page)?.label || 'Visão geral')}
              </strong>
            </div>
          </div>

          <div className="topbar-actions">
            <div className="system-status">
              <span
                className={`status-dot ${
                  syncStatus === 'offline' ? 'offline' : ''
                }`}
              />

              {syncStatus === 'loading' && 'Carregando dados...'}
              {syncStatus === 'saving' && 'Salvando dados...'}
              {syncStatus === 'saved' && 'Dados sincronizados'}
              {syncStatus === 'offline' && 'API indisponível — cópia local'}
            </div>

            <button
              className="icon-button notification-button"
              onClick={() => showPage('tasks')}
              aria-label="Ver prazos"
            >
              <Bell size={19} />
              {activeTasks > 0 && <i />}
            </button>

            <div className="topbar-divider" />

            <div className="top-user">
              <div className="user-avatar small">AD</div>
              <ChevronDown size={15} />
            </div>
          </div>
        </header>

        <div className="page-content">
          {page === 'admin' && currentUser?.role === 'ADMIN' && (
            <AdminApp
              currentUser={currentUser}
              onBack={() => showPage('overview')}
              onLogout={onLogout}
            />
          )}

          {page === 'overview' && (
            <Overview
              data={data}
              totalActive={totalActive}
              deadlineCount={deadlineCount}
              activeTasks={activeTasks}
              projectedProfit={projectedProfit}
              profitCoverage={profitCoverage}
              onNavigate={showPage}
              onNew={editNew}
              onEdit={editOpportunity}
              onTask={toggleTask}
              onSettings={() => setModal({ type: 'settings' })}
            />
          )}

          {page === 'radar' && (
            <RadarPage
              query={query}
              setQuery={setQuery}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              opportunities={filteredOpportunities}
              pncpBusy={pncpBusy}
              pncpError={pncpError}
              pncpInfo={pncpInfo}
              pncpResults={pncpResults}
              pncpFilters={pncpFilters}
              setPncpFilters={setPncpFilters}
              searchPncp={searchPncp}
              profile={data.profile}
              onNew={editNew}
              onEdit={editOpportunity}
              onAddPncp={addPncpRecord}
            />
          )}

          {page === 'assistant' && (
            <DecisionAssistantPage
              data={data}
              profile={data.profile}
              onEdit={editOpportunity}
              onCreateTask={addTask}
            />
          )}

          {page === 'edict-analysis' && (
            <EdictAnalyzerPage
              data={data}
              onCreateTask={addTask}
              onCreateTasks={addTasks}
            />
          )}
          {page === 'processes' && (
            <ProcessesPage
              opportunities={filteredOpportunities}
              query={query}
              setQuery={setQuery}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              onEdit={editOpportunity}
              onNew={editNew}
              onRemove={(id) => {
                if (confirm('Excluir este processo da lista?')) {
                  updateData(
                    'opportunities',
                    data.opportunities.filter((item) => item.id !== id)
                  );

                  setToast('Processo removido.');
                }
              }}
            />
          )}

          {page === 'tasks' && (
            <TasksPage
              tasks={data.tasks}
              opportunities={data.opportunities}
              filter={taskFilter}
              setFilter={setTaskFilter}
              onToggle={toggleTask}
              onNew={() => setModal({ type: 'task' })}
              onDelete={(id) =>
                updateData(
                  'tasks',
                  data.tasks.filter((task) => task.id !== id)
                )
              }
            />
          )}

          {page === 'partners' && (
            <PartnersPage
              partners={partners}
              onSave={persistPartner}
              onDelete={removePartner}
            />
          )}

          {page === 'alerts' && (
            <AlertsPage
              settings={automationSettings}
              error={automationError}
              busy={automationBusy}
              onSave={saveAutomationSettings}
              onRun={runAutomationNow}
              onTestEmail={sendTestEmail}
            />
          )}
          {page === 'documents' && (
            <DocumentsPage
              documents={data.documents}
              onUpload={(doc) => {
                updateData('documents', [
                  { ...doc, id: uid() },
                  ...data.documents,
                ]);

                setToast(
                  'Documento registrado. Nesta versão, apenas os metadados são persistidos.'
                );
              }}
              onRemove={(id) =>
                updateData(
                  'documents',
                  data.documents.filter((doc) => doc.id !== id)
                )
              }
            />
          )}

          {page === 'calculator' && (
            <CalculatorPage
              form={priceForm}
              setForm={setPriceForm}
            />
          )}
        </div>

        <footer className="app-footer">
          <span>
            Licita360 <span className="footer-dot">•</span> MVP 0.1.0
          </span>

          <span>
            {syncStatus === 'loading' && 'Carregando dados...'}
            {syncStatus === 'saving' && 'Sincronizando alterações...'}
            {syncStatus === 'saved' && 'Dados persistidos no PostgreSQL via API'}
            {syncStatus === 'offline' && 'Servidor indisponível; cópia local mantida'}
          </span>
        </footer>
      </main>

      {modal?.type === 'opportunity' && (
        <OpportunityModal
          initial={modal.initial}
          onClose={() => setModal(null)}
          onSave={saveOpportunity}
        />
      )}

      {modal?.type === 'task' && (
        <TaskModal
          opportunities={data.opportunities}
          onClose={() => setModal(null)}
          onSave={addTask}
        />
      )}

      {modal?.type === 'settings' && (
        <SettingsModal
          profile={data.profile}
          onClose={() => setModal(null)}
          onSave={(profile) => {
            updateData('profile', profile);
            setModal(null);
            setToast('Configurações atualizadas.');
          }}
          onReset={() => {
            if (
              confirm(
                'ATENÇÃO: restaurar os exemplos substituirá os dados atuais na interface e no PostgreSQL. Faça backup antes. Deseja continuar?'
              )
            ) {
              setData(initialData);
              setModal(null);
              setToast('Exemplos restaurados na interface.');
            }
          }}
        />
      )}

      {modal?.type === 'help' && (
        <HelpModal onClose={() => setModal(null)} />
      )}

      {toast && (
        <div className="toast">
          <CheckCircle2 size={17} />
          {toast}
          <button
            onClick={() => setToast('')}
            aria-label="Fechar notificação"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
