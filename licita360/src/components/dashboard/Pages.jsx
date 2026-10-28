import React, { useEffect, useMemo, useRef, useState } from 'react';

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

import { PageHeader, PrimaryButton, MetricCard, Overview, OpportunityRow, StatusBadge, PriorityBadge, EmptyState, SearchFilters } from './SharedComponents.jsx';

export function RadarPage({
  query,
  setQuery,
  statusFilter,
  setStatusFilter,
  opportunities,
  pncpBusy,
  pncpError,
  pncpInfo,
  pncpResults,
  pncpFilters,
  setPncpFilters,
  searchPncp,
  profile,
  onNew,
  onEdit,
  onAddPncp,
}) {
  const [filterByBranches, setFilterByBranches] = useState(true);

  const companyBranches = Array.isArray(profile?.branches)
    ? profile.branches
    : [];

  const pncpVisibleResults = pncpResults
    .map((record) => ({
      ...record,
      matchedBranches: findMatchingBranches(record, companyBranches),
    }))
    .filter((record) => {
      if (!filterByBranches || !companyBranches.length) {
        return true;
      }

      return record.matchedBranches.length > 0;
    });

  return (
    <>
      <PageHeader
        eyebrow="DESCOBERTA E OPORTUNIDADES"
        title="Radar de licitações"
        description="Pesquise, avalie e organize oportunidades para os ramos da sua empresa."
        actions={
          <PrimaryButton onClick={onNew}>
            Cadastrar oportunidade
          </PrimaryButton>
        }
      />

      <section className="panel pncp-panel">
        <div className="pncp-head">
          <div className="pncp-mark">
            <CloudDownload size={21} />
          </div>

          <div>
            <h2>Buscar oportunidades no PNCP</h2>
            <p>
              Consulta à API pública do Portal Nacional de Contratações Públicas.
            </p>
          </div>

          <span className="source-tag">
            <span className="status-dot" />
            Fonte oficial
          </span>
        </div>

        <div className="pncp-controls">
          <label>
            Modalidade
            <select
              value={pncpFilters.modality}
              onChange={(e) =>
                setPncpFilters((prev) => ({
                  ...prev,
                  modality: e.target.value,
                }))
              }
            >
              <option value="6">Pregão eletrônico</option>
              <option value="4">Concorrência eletrônica</option>
              <option value="8">Dispensa de licitação</option>
              <option value="9">Inexigibilidade</option>
              <option value="12">Credenciamento</option>
              <option value="1">Leilão eletrônico</option>
              <option value="2">Diálogo competitivo</option>
              <option value="3">Concurso</option>
            </select>
          </label>

          <label>
            Estado (UF)
            <select
              value={pncpFilters.uf}
              onChange={(e) =>
                setPncpFilters((prev) => ({
                  ...prev,
                  uf: e.target.value,
                }))
              }
            >
              <option value="">Todos os estados</option>
              {'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'
                .split(' ')
                .map((uf) => (
                  <option key={uf}>{uf}</option>
                ))}
            </select>
          </label>

          <label>
            Encerramento em
            <select
              value={pncpFilters.days}
              onChange={(e) =>
                setPncpFilters((prev) => ({
                  ...prev,
                  days: e.target.value,
                }))
              }
            >
              <option value="7">Próximos 7 dias</option>
              <option value="15">Próximos 15 dias</option>
              <option value="30">Próximos 30 dias</option>
              <option value="60">Próximos 60 dias</option>
            </select>
          </label>

          <PrimaryButton
            onClick={searchPncp}
            disabled={pncpBusy}
            icon={pncpBusy ? LoaderCircle : Search}
          >
            {pncpBusy ? 'Consultando...' : 'Buscar no PNCP'}
          </PrimaryButton>
        </div>

        <div className="branch-filter-control">
          <label className="branch-filter-label">
            <input
              type="checkbox"
              checked={filterByBranches}
              disabled={!companyBranches.length}
              onChange={(event) =>
                setFilterByBranches(event.target.checked)
              }
            />
            <span>
              Mostrar somente licitações compatíveis com minha empresa
            </span>
          </label>

          <p>
            {companyBranches.length
              ? `Ramos cadastrados: ${companyBranches.join(' · ')}`
              : 'Cadastre seus ramos em Configurações para ativar esse filtro.'}
          </p>
        </div>

        {pncpError && (
          <div className="inline-alert alert-error">
            <AlertCircle size={17} />
            <span>{pncpError}</span>
          </div>
        )}

        {pncpInfo && !pncpBusy && (
          <div className="inline-alert">
            <CheckCircle2 size={17} />
            <span>{pncpInfo}</span>
          </div>
        )}

        {pncpBusy && (
          <div className="loading-line">
            <LoaderCircle size={17} />
            Consultando dados públicos do PNCP...
          </div>
        )}

        {(pncpResults.length > 0 || pncpInfo) && !pncpBusy && (
          <div className="pncp-results">
            <div className="result-heading">
              <strong>
                {pncpVisibleResults.length} oportunidade(s)
                {filterByBranches ? ' compatível(is)' : ' recebida(s)'}
              </strong>

              <span>
                {filterByBranches && companyBranches.length
                  ? 'Filtradas pelos ramos cadastrados da empresa.'
                  : 'Filtro por ramo desativado.'}
              </span>
            </div>

            {pncpResults.length > 0 && pncpVisibleResults.length === 0 && (
              <div className="inline-alert">
                <AlertCircle size={17} />
                <span>
                  Nenhuma oportunidade da amostra consultada corresponde aos
                  ramos cadastrados. Tente ampliar as especialidades, alterar
                  a UF ou a modalidade, ou desative o filtro para conferir os
                  demais resultados.
                </span>
              </div>
            )}

            {pncpVisibleResults.map((record) => (
              <div className="pncp-result-row" key={record.id}>
                <div className="pncp-result-copy">
                  <strong>{record.title}</strong>

                  <span>
  {record.agency || 'Órgão não informado'}
  {' · '}
  {record.city
    ? [record.city, record.uf].filter(Boolean).join('/')
    : (record.location || record.uf || 'Município não informado')}
  {' · '}
  {record.modality || 'Modalidade não informada'}
</span>

                  <div className="pncp-result-meta">
                    <span>
                      {record.amount
                        ? fmtBRL(record.amount)
                        : 'Valor não informado'}
                    </span>

                    <span>
                      Propostas até: {formatDate(record.deadline)}
                    </span>

                    {record.matchedBranches.length > 0 && (
                      <span>
                        Área compatível: {record.matchedBranches.join(', ')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="pncp-result-actions">
                  <a
                    href={record.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir fonte <ArrowUpRight size={13} />
                  </a>

                  <button
                    className="button button-small"
                    onClick={() => onAddPncp(record)}
                  >
                    <Plus size={14} /> Adicionar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pncp-footnote">
          A consulta depende da disponibilidade da API do PNCP. O filtro por
          ramo usa palavras-chave e sinônimos, portanto pode deixar passar
          oportunidades ou exibir correspondências que exigem conferência.
          Verifique o edital e a fonte oficial antes de decidir participar.
        </div>
      </section>

      <div className="section-title-row">
        <div>
          <h2>Minha carteira de oportunidades</h2>
          <p>Processos que você cadastrou ou importou para acompanhar.</p>
        </div>

        <span className="count-pill">
          {opportunities.length} processos
        </span>
      </div>

      <SearchFilters
        query={query}
        setQuery={setQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
      />

      <div className="radar-grid">
        {opportunities.map((item) => (
          <OpportunityCard
            key={item.id}
            item={item}
            onClick={() => onEdit(item)}
          />
        ))}

        {!opportunities.length && (
          <div className="empty-card">
            <EmptyState
              icon={Radar}
              title="Nenhuma oportunidade encontrada"
              description="Altere seus filtros, busque no PNCP ou cadastre uma licitação manualmente."
            />

            <button
              className="button button-secondary"
              onClick={onNew}
            >
              <Plus size={16} /> Cadastrar oportunidade
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export function OpportunityCard({ item, onClick }) {
  return (
    <button className="opportunity-card" onClick={onClick}>
      <div className="card-top">
        <span className="card-file-icon">
          <FileText size={18} />
        </span>
        <StatusBadge value={item.status} />
      </div>

      <div className="card-category">{item.category}</div>
      <h3>{item.title}</h3>
      <p className="card-agency">{item.agency}</p>

      <div className="card-details">
        <div>
          <span>Valor estimado</span>
          <strong>{fmtBRL(item.amount)}</strong>
        </div>
        <div>
          <span>Prazo</span>
          <strong>{formatDate(item.deadline)}</strong>
        </div>
      </div>

      <div className="card-footer">
        <span className="region-chip">{item.location || 'BR'}</span>
        <span className="modality-label">{item.modality}</span>
        <ArrowRight size={16} />
      </div>
    </button>
  );
}

export function PartnersPage({ partners, onSave, onDelete }) {
  const [draft, setDraft] = useState(emptyPartnerDraft());

  function update(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function startEdit(partner) {
    setDraft({
      id: partner.id,
      name: partner.name || '',
      cnpj: partner.cnpj || '',
      contactName: partner.contactName || '',
      email: partner.email || '',
      phone: partner.phone || '',
      uf: partner.uf || 'CE',
      cities: (partner.cities || []).join(', '),
      branches: (partner.branches || [])
        .map((branch) => branch.name)
        .join(', '),
      minimumAmount: partner.minimumAmount ?? '',
      maximumAmount: partner.maximumAmount ?? '',
      active: partner.active !== false,
      notifyOpportunities: partner.notifyOpportunities !== false,
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submit(event) {
    event.preventDefault();

    const success = await onSave({
      ...draft,
      cities: csvValues(draft.cities),
      branches: csvValues(draft.branches),
      minimumAmount:
        draft.minimumAmount === '' ? null : Number(draft.minimumAmount),
      maximumAmount:
        draft.maximumAmount === '' ? null : Number(draft.maximumAmount),
    });

    if (success) setDraft(emptyPartnerDraft());
  }

  return (
    <>
      <PageHeader
        eyebrow="PROSPECÇÃO COMERCIAL"
        title="Carteira de clientes"
        description="Cadastre empresas parceiras para encontrar licitações potencialmente interessantes para cada segmento."
        actions={
          <PrimaryButton
            icon={Building2}
            onClick={() => setDraft(emptyPartnerDraft())}
          >
            Nova empresa
          </PrimaryButton>
        }
      />

      <div className="partner-layout">
        <section className="panel partner-form-panel">
          <div className="panel-header">
            <div>
              <h2>{draft.id ? 'Editar empresa' : 'Cadastrar empresa parceira'}</h2>
              <p>Defina segmentos e regiões para melhorar as correspondências.</p>
            </div>
          </div>

          <form className="form-stack" onSubmit={submit}>
            <label>
              Nome da empresa
              <input
                required
                value={draft.name}
                onChange={(event) => update('name', event.target.value)}
                placeholder="Nome comercial"
              />
            </label>

            <div className="form-grid">
              <label>
                CNPJ (opcional)
                <input
                  value={draft.cnpj}
                  onChange={(event) => update('cnpj', event.target.value)}
                  placeholder="00.000.000/0000-00"
                />
              </label>

              <label>
                Nome do contato
                <input
                  value={draft.contactName}
                  onChange={(event) => update('contactName', event.target.value)}
                  placeholder="Responsável comercial"
                />
              </label>

              <label>
                E-mail de contato
                <input
                  type="email"
                  value={draft.email}
                  onChange={(event) => update('email', event.target.value)}
                  placeholder="contato@empresa.com.br"
                />
              </label>

              <label>
                Telefone
                <input
                  value={draft.phone}
                  onChange={(event) => update('phone', event.target.value)}
                  placeholder="Telefone comercial"
                />
              </label>
            </div>

            <label>
              Ramos de atuação
              <input
                required
                value={draft.branches}
                onChange={(event) => update('branches', event.target.value)}
                placeholder="Dedetização, limpeza, serviços administrativos"
              />
              <small>Separe os ramos por vírgula.</small>
            </label>

            <div className="form-grid">
              <label>
                Estado principal
                <select
                  value={draft.uf}
                  onChange={(event) => update('uf', event.target.value)}
                >
                  {UF_OPTIONS.map((uf) => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </label>

              <label>
                Cidades atendidas (opcional)
                <input
                  value={draft.cities}
                  onChange={(event) => update('cities', event.target.value)}
                  placeholder="Fortaleza, Maracanaú"
                />
              </label>

              <label>
                Valor mínimo (opcional)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.minimumAmount}
                  onChange={(event) => update('minimumAmount', event.target.value)}
                />
              </label>

              <label>
                Valor máximo (opcional)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.maximumAmount}
                  onChange={(event) => update('maximumAmount', event.target.value)}
                />
              </label>
            </div>

            <label className="check-row">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(event) => update('active', event.target.checked)}
              />
              <span>Empresa ativa na carteira</span>
            </label>

            <label className="check-row">
              <input
                type="checkbox"
                checked={draft.notifyOpportunities}
                onChange={(event) =>
                  update('notifyOpportunities', event.target.checked)
                }
              />
              <span>Gerar alertas de oportunidades compatíveis</span>
            </label>

            <div className="modal-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setDraft(emptyPartnerDraft())}
              >
                Limpar
              </button>

              <PrimaryButton type="submit" icon={Save}>
                {draft.id ? 'Salvar empresa' : 'Cadastrar empresa'}
              </PrimaryButton>
            </div>
          </form>
        </section>

        <section className="panel partner-list-panel">
          <div className="panel-header">
            <div>
              <h2>Empresas cadastradas</h2>
              <p>{partners.length} empresa(s) na carteira</p>
            </div>

            <span className="count-pill">{partners.length}</span>
          </div>

          {partners.map((partner) => (
            <article className="partner-row" key={partner.id}>
              <div className="partner-avatar">
                <Building2 size={19} />
              </div>

              <div className="partner-details">
                <strong>{partner.name}</strong>
                <span>
                  {partner.contactName || 'Contato não cadastrado'}
                  {' · '}
                  {partner.uf || 'UF não informada'}
                </span>
                <span>
                  {(partner.branches || [])
                    .map((branch) => branch.name)
                    .join(' · ') || 'Sem ramos cadastrados'}
                </span>
                {partner.cities?.length > 0 && (
                  <small>Cidades: {partner.cities.join(', ')}</small>
                )}
                <small>
                  {partner.active ? 'Ativa' : 'Inativa'}
                  {' · '}
                  {partner.notifyOpportunities
                    ? 'Alertas habilitados'
                    : 'Alertas desabilitados'}
                </small>
              </div>

              <div className="partner-actions">
                <button
                  type="button"
                  className="button button-secondary button-small"
                  onClick={() => startEdit(partner)}
                >
                  Editar
                </button>

                <button
                  type="button"
                  className="button button-secondary button-small"
                  onClick={() => onDelete(partner.id)}
                >
                  Excluir
                </button>
              </div>
            </article>
          ))}

          {!partners.length && (
            <EmptyState
              icon={Users}
              title="Sua carteira ainda está vazia"
              description="Cadastre a primeira empresa e informe os ramos que ela atende."
            />
          )}
        </section>
      </div>

      <div className="inline-alert">
        <Mail size={17} />
        <span>
          Os avisos de correspondência são enviados ao e-mail principal
          configurado em Alertas e automação. O e-mail de contato da parceira
          fica cadastrado para referência; ele não recebe mensagens
          automaticamente nesta versão.
        </span>
      </div>
    </>
  );
}

export function AlertsPage({
  settings,
  error,
  busy,
  onSave,
  onRun,
  onTestEmail,
}) {
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (!settings) return;

    setForm({
      recipientEmail: settings.recipientEmail || '',
      enabled: Boolean(settings.enabled),
      dailyEmailEnabled: settings.dailyEmailEnabled !== false,
      documentAlertsEnabled: settings.documentAlertsEnabled !== false,
      partnerAlertsEnabled: settings.partnerAlertsEnabled !== false,
      ufs: (settings.ufs || ['CE']).join(', '),
      modalities: (settings.modalities || ['8']).join(', '),
      daysAhead: String(settings.daysAhead || 30),
      minAmount: settings.minAmount ?? '',
      maxAmount: settings.maxAmount ?? '',
      documentAlertDays: (
        settings.documentAlertDays || [30, 15, 7, 1, 0]
      ).join(', '),
    });
  }, [settings]);

  if (!form) {
    return (
      <div className="panel">
        <div className="loading-line">
          <LoaderCircle size={17} />
          Carregando configurações de alertas...
        </div>
      </div>
    );
  }

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();

    await onSave({
      recipientEmail: form.recipientEmail.trim(),
      enabled: form.enabled,
      dailyEmailEnabled: form.dailyEmailEnabled,
      documentAlertsEnabled: form.documentAlertsEnabled,
      partnerAlertsEnabled: form.partnerAlertsEnabled,
      ufs: csvValues(form.ufs).map((uf) => uf.toUpperCase()),
      modalities: csvValues(form.modalities),
      daysAhead: Number(form.daysAhead),
      minAmount: form.minAmount === '' ? null : Number(form.minAmount),
      maxAmount: form.maxAmount === '' ? null : Number(form.maxAmount),
      documentAlertDays: csvValues(form.documentAlertDays).map(Number),
    });
  }

  return (
    <>
      <PageHeader
        eyebrow="AUTOMAÇÃO E NOTIFICAÇÕES"
        title="Alertas e automação"
        description="Configure a prospecção programada, os filtros de oportunidades e os avisos da sua operação."
        actions={
          <PrimaryButton
            icon={Play}
            disabled={busy}
            onClick={onRun}
          >
            Executar agora
          </PrimaryButton>
        }
      />

      {error && (
        <div className="inline-alert alert-error">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      <div className="panel alerts-panel">
        <div className="panel-header">
          <div>
            <h2>Preferências de notificação</h2>
            <p>Os alertas serão direcionados ao destinatário cadastrado aqui.</p>
          </div>
        </div>

        <form className="form-stack" onSubmit={submit}>
          <label>
            E-mail que receberá os alertas
            <input
              required
              type="email"
              value={form.recipientEmail}
              onChange={(event) => update('recipientEmail', event.target.value)}
              placeholder="seuemail@empresa.com.br"
            />
          </label>

          <label className="check-row">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(event) => update('enabled', event.target.checked)}
            />
            <span>Ativar prospecção automática pelo PNCP</span>
          </label>

          <label className="check-row">
            <input
              type="checkbox"
              checked={form.dailyEmailEnabled}
              onChange={(event) =>
                update('dailyEmailEnabled', event.target.checked)
              }
            />
            <span>Receber o resumo diário de oportunidades por e-mail</span>
          </label>

          <label className="check-row">
            <input
              type="checkbox"
              checked={form.partnerAlertsEnabled}
              onChange={(event) =>
                update('partnerAlertsEnabled', event.target.checked)
              }
            />
            <span>Receber avisos quando surgir oportunidade para uma parceira</span>
          </label>

          <label className="check-row">
            <input
              type="checkbox"
              checked={form.documentAlertsEnabled}
              onChange={(event) =>
                update('documentAlertsEnabled', event.target.checked)
              }
            />
            <span>Receber alertas de vencimento documental</span>
          </label>

          <div className="form-grid">
            <label>
              Estados (UF)
              <input
                value={form.ufs}
                onChange={(event) => update('ufs', event.target.value)}
                placeholder="CE, PB"
              />
              <small>Separe por vírgula. A consulta também considera a UF das parceiras ativas.</small>
            </label>

            <label>
              Códigos de modalidade do PNCP
              <input
                value={form.modalities}
                onChange={(event) => update('modalities', event.target.value)}
                placeholder="8"
              />
              <small>Use os códigos de modalidade aceitos pela API do PNCP.</small>
            </label>

            <label>
              Encerramento nos próximos dias
              <select
                value={form.daysAhead}
                onChange={(event) => update('daysAhead', event.target.value)}
              >
                <option value="7">7 dias</option>
                <option value="15">15 dias</option>
                <option value="30">30 dias</option>
                <option value="60">60 dias</option>
                <option value="90">90 dias</option>
              </select>
            </label>

            <label>
              Valor mínimo (R$), opcional
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.minAmount}
                onChange={(event) => update('minAmount', event.target.value)}
              />
            </label>

            <label>
              Valor máximo (R$), opcional
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.maxAmount}
                onChange={(event) => update('maxAmount', event.target.value)}
              />
            </label>

            <label>
              Alertar documentos (dias antes)
              <input
                value={form.documentAlertDays}
                onChange={(event) =>
                  update('documentAlertDays', event.target.value)
                }
                placeholder="30, 15, 7, 1, 0"
              />
              <small>
                Exemplo: 30, 15, 7, 1, 0 para avisos antes e no vencimento.
              </small>
            </label>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="button button-secondary"
              disabled={busy}
              onClick={onTestEmail}
            >
              <Mail size={16} /> Testar e-mail
            </button>

            <PrimaryButton type="submit" icon={Save}>
              Salvar preferências
            </PrimaryButton>
          </div>
        </form>
      </div>

      <section className="panel automation-info">
        <h2>Agenda do serviço</h2>
        <p>
          A prospecção é programada para rodar a cada 30 minutos. O resumo
          diário é programado para as 08:00, no horário de Fortaleza. A
          execução manual permite testar a consulta imediatamente.
        </p>
        <p>
          Para esses horários serem cumpridos, a API Express precisa estar em
          execução. Se o computador estiver desligado, um servidor hospedado
          continuamente será necessário.
        </p>
      </section>
    </>
  );
}

export function ProcessesPage({
  opportunities,
  query,
  setQuery,
  statusFilter,
  setStatusFilter,
  onEdit,
  onNew,
  onRemove,
}) {
  return (
    <>
      <PageHeader
        eyebrow="ACOMPANHAMENTO OPERACIONAL"
        title="Meus processos"
        description="Acompanhe cada oportunidade do primeiro filtro até o resultado."
        actions={
          <PrimaryButton onClick={onNew}>Novo processo</PrimaryButton>
        }
      />

      <div className="process-summary">
        <div>
          <span>Na tela</span>
          <strong>{opportunities.length}</strong>
        </div>

        <div>
          <span>Em análise</span>
          <strong>
            {opportunities.filter((o) => o.status === 'Em análise').length}
          </strong>
        </div>

        <div>
          <span>Preparando proposta</span>
          <strong>
            {opportunities.filter((o) => o.status === 'Preparar proposta').length}
          </strong>
        </div>

        <div>
          <span>Valor estimado</span>
          <strong>
            {fmtBRL(
              opportunities.reduce(
                (sum, item) => sum + Number(item.amount || 0),
                0
              )
            )}
          </strong>
        </div>
      </div>

      <SearchFilters
        query={query}
        setQuery={setQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
      />

      <div className="panel table-panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Oportunidade</th>
                <th>Órgão</th>
                <th>Valor</th>
                <th>Prazo</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {opportunities.map((item) => (
                <tr key={item.id}>
                  <td>
                    <button
                      className="table-title-button"
                      onClick={() => onEdit(item)}
                    >
                      <strong>{item.title}</strong>
                      <span>
                        {item.category} · {item.modality}
                      </span>
                    </button>
                  </td>

                  <td>
                    {item.agency}
                    <span className="cell-muted">{item.location}</span>
                  </td>

                  <td className="amount-cell">{fmtBRL(item.amount)}</td>
                  <td>{formatDate(item.deadline)}</td>

                  <td>
                    <StatusBadge value={item.status} />
                  </td>

                  <td>
                    <div className="table-actions">
                      <button
                        className="icon-button tiny"
                        title="Editar"
                        onClick={() => onEdit(item)}
                      >
                        <Settings2 size={15} />
                      </button>

                      <button
                        className="icon-button tiny danger-hover"
                        title="Excluir"
                        onClick={() => onRemove(item.id)}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!opportunities.length && (
            <EmptyState
              icon={BriefcaseBusiness}
              title="Nenhum processo encontrado"
              description="Cadastre um processo ou ajuste os filtros."
            />
          )}
        </div>

        <div className="table-footer">
          Exibindo {opportunities.length} processo(s)
          <span>Os dados são salvos no servidor quando a API está disponível.</span>
        </div>
      </div>
    </>
  );
}

export function TasksPage({
  tasks,
  opportunities,
  filter,
  setFilter,
  onToggle,
  onNew,
  onDelete,
}) {
  const visible = tasks
    .filter(
      (task) =>
        filter === 'Todas' ||
        (filter === 'Pendentes' ? !task.done : task.done)
    )
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  return (
    <>
      <PageHeader
        eyebrow="ROTINA E PRAZOS"
        title="Tarefas e prazos"
        description="Transforme cada exigência em uma ação com responsável e data."
        actions={<PrimaryButton onClick={onNew}>Nova tarefa</PrimaryButton>}
      />

      <div className="task-stats">
        <div className="task-stat-card">
          <div className="task-stat-icon orange">
            <Clock3 size={19} />
          </div>
          <div>
            <strong>{tasks.filter((t) => !t.done).length}</strong>
            <span>Pendentes</span>
          </div>
        </div>

        <div className="task-stat-card">
          <div className="task-stat-icon green">
            <CheckCheck size={19} />
          </div>
          <div>
            <strong>{tasks.filter((t) => t.done).length}</strong>
            <span>Concluídas</span>
          </div>
        </div>

        <div className="task-stat-card">
          <div className="task-stat-icon violet">
            <CalendarClock size={19} />
          </div>
          <div>
            <strong>
              {
                tasks.filter(
                  (t) => !t.done && t.date && t.date < todayISO()
                ).length
              }
            </strong>
            <span>Atrasadas</span>
          </div>
        </div>
      </div>

      <div className="task-filter-tabs">
        {['Pendentes', 'Todas', 'Concluídas'].map((item) => (
          <button
            key={item}
            className={filter === item ? 'selected' : ''}
            onClick={() => setFilter(item)}
          >
            {item}

            <span>
              {item === 'Todas'
                ? tasks.length
                : item === 'Pendentes'
                  ? tasks.filter((t) => !t.done).length
                  : tasks.filter((t) => t.done).length}
            </span>
          </button>
        ))}
      </div>

      <div className="panel task-manager">
        {visible.map((task) => (
          <div
            className={`manager-task ${task.done ? 'completed' : ''}`}
            key={task.id}
          >
            <button
              className={`task-check large ${task.done ? 'checked' : ''}`}
              onClick={() => onToggle(task.id)}
              aria-label={task.done ? 'Marcar pendente' : 'Concluir tarefa'}
            >
              {task.done && <Check size={14} />}
            </button>

            <div className="manager-task-main">
              <strong>{task.title}</strong>
              <span>
                <CalendarClock size={13} />
                {formatDate(task.date)}

                {task.linked && (
                  <>
                    {' '}
                    <span className="task-separator">·</span>{' '}
                    {opportunities.find(
                      (item) => item.id === task.linked
                    )?.title || 'Processo vinculado'}
                  </>
                )}
              </span>
            </div>

            <PriorityBadge value={task.priority} />

            <button
              className="icon-button tiny danger-hover"
              onClick={() => onDelete(task.id)}
              title="Excluir tarefa"
            >
              <X size={15} />
            </button>
          </div>
        ))}

        {!visible.length && (
          <EmptyState
            icon={ListTodo}
            title="Nenhuma tarefa por aqui"
            description="Crie uma tarefa ou escolha outro filtro."
          />
        )}
      </div>
    </>
  );
}

export function DocumentsPage({ documents, onUpload, onRemove }) {
  const [draft, setDraft] = useState({
    name: '',
    type: 'Certidão',
    expires: '',
  });

  const [selectedFile, setSelectedFile] = useState(null);

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!draft.name.trim()) return;

    const expiry = parseDate(draft.expires);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const limit = new Date(today);
    limit.setDate(limit.getDate() + 30);

    onUpload({
      ...draft,
      status: !expiry
        ? 'Sem validade informada'
        : expiry < today
          ? 'Vencido'
          : expiry <= limit
            ? 'Vence em breve'
            : 'Em dia',
      fileName: selectedFile?.name || '',
    });

    setDraft({ name: '', type: 'Certidão', expires: '' });
    setSelectedFile(null);
    event.currentTarget.reset();
  };

  return (
    <>
      <PageHeader
        eyebrow="HABILITAÇÃO E ARQUIVOS"
        title="Cofre de documentos"
        description="Controle os documentos da empresa e acompanhe seus vencimentos."
        actions={
          <PrimaryButton
            onClick={() => document.getElementById('doc-name')?.focus()}
            icon={Upload}
          >
            Adicionar documento
          </PrimaryButton>
        }
      />

      <div className="document-notice">
        <ShieldCheck size={19} />
        <div>
          <strong>Organização documental</strong>
          <p>
            Esta versão salva os metadados no PostgreSQL. O arquivo selecionado
            ainda não é enviado ao servidor; o nome do arquivo é apenas uma
            referência.
          </p>
        </div>
      </div>

      <div className="document-layout">
        <section className="panel document-list-panel">
          <div className="panel-header">
            <div>
              <h2>Documentos cadastrados</h2>
              <p>{documents.length} itens cadastrados</p>
            </div>

            <span className="count-pill">
              {documents.filter((doc) => doc.status !== 'Em dia').length} atenção
            </span>
          </div>

          {documents.map((doc) => (
            <div className="document-row" key={doc.id}>
              <div className="document-icon">
                <FileCheck2 size={19} />
              </div>

              <div className="document-copy">
                <strong>{doc.name}</strong>
                <span>
                  {doc.type}
                  {doc.fileName ? ` · ${doc.fileName}` : ''}
                </span>
                <small>Validade: {formatDate(doc.expires)}</small>
              </div>

              <span
                className={`doc-status ${
                  doc.status === 'Em dia' ? 'doc-ok' : 'doc-warning'
                }`}
              >
                {doc.status}
              </span>

              <button
                className="icon-button tiny danger-hover"
                onClick={() => onRemove(doc.id)}
                aria-label="Remover documento"
              >
                <X size={15} />
              </button>
            </div>
          ))}

          {!documents.length && (
            <EmptyState
              icon={FolderOpen}
              title="Seu cofre está vazio"
              description="Cadastre os documentos usados na habilitação."
            />
          )}
        </section>

        <section className="panel add-document-panel">
          <div className="panel-header">
            <div>
              <h2>Novo documento</h2>
              <p>Cadastre nome, categoria e validade.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="form-stack">
            <label>
              Nome do documento
              <input
                id="doc-name"
                required
                value={draft.name}
                onChange={(e) =>
                  setDraft({ ...draft, name: e.target.value })
                }
                placeholder="Ex.: Certidão municipal"
              />
            </label>

            <label>
              Categoria
              <select
                value={draft.type}
                onChange={(e) =>
                  setDraft({ ...draft, type: e.target.value })
                }
              >
                <option>Certidão</option>
                <option>Societário</option>
                <option>Contábil</option>
                <option>Técnico</option>
                <option>Declaração</option>
                <option>Outro</option>
              </select>
            </label>

            <label>
              Data de validade
              <input
                type="date"
                value={draft.expires}
                onChange={(e) =>
                  setDraft({ ...draft, expires: e.target.value })
                }
              />
            </label>

            <label>
              Arquivo (opcional)
              <input
                type="file"
                onChange={(e) =>
                  setSelectedFile(e.target.files?.[0] || null)
                }
              />
              <small>
                O arquivo não é transferido nesta versão; somente seu nome será guardado.
              </small>
            </label>

            <PrimaryButton type="submit" icon={Plus}>
              Registrar documento
            </PrimaryButton>
          </form>
        </section>
      </div>
    </>
  );
}

export function CalculatorPage({ form, setForm }) {
  const cost = Number(form.cost) || 0;
  const tax = Number(form.tax) || 0;
  const freight = Number(form.freight) || 0;
  const other = Number(form.other) || 0;
  const margin = Number(form.margin) || 0;

  const baseCost = cost + freight + other;
  const denominator = 1 - (tax + margin) / 100;
  const valid = denominator > 0;
  const price = valid ? baseCost / denominator : 0;

  const taxAmount = (price * tax) / 100;
  const grossProfit = price - baseCost - taxAmount;

  const asPercent = (value) =>
    `${Number(value).toLocaleString('pt-BR', {
      maximumFractionDigits: 2,
    })}%`;

  return (
    <>
      <PageHeader
        eyebrow="FORMAÇÃO DE PREÇOS"
        title="Calculadora de preço"
        description="Simule um preço de venda com custos, tributos e margem alvo antes de decidir disputar."
      />

      <div className="calculator-layout">
        <section className="panel calculator-form">
          <div className="panel-header">
            <div>
              <h2>Dados da sua operação</h2>
              <p>Preencha os valores para simular um item ou serviço.</p>
            </div>

            <span className="calculator-icon">
              <Wallet size={18} />
            </span>
          </div>

          <div className="form-grid">
            <label>
              Custo de compra / execução (R$)
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.cost}
                onChange={(e) =>
                  setForm({ ...form, cost: e.target.value })
                }
              />
            </label>

            <label>
              Impostos e tributos (%)
              <input
                type="number"
                min="0"
                max="99"
                step="0.1"
                value={form.tax}
                onChange={(e) =>
                  setForm({ ...form, tax: e.target.value })
                }
              />
            </label>

            <label>
              Frete e logística (R$)
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.freight}
                onChange={(e) =>
                  setForm({ ...form, freight: e.target.value })
                }
              />
            </label>

            <label>
              Outras despesas (R$)
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.other}
                onChange={(e) =>
                  setForm({ ...form, other: e.target.value })
                }
              />
            </label>

            <label className="full-field">
              Margem alvo sobre o preço de venda (%)
              <div className="range-value">
                <input
                  type="range"
                  min="0"
                  max="60"
                  step="0.5"
                  value={form.margin}
                  onChange={(e) =>
                    setForm({ ...form, margin: e.target.value })
                  }
                />
                <strong>{asPercent(margin)}</strong>
              </div>
            </label>
          </div>

          <div className="calculation-equation">
            <span>
              <CheckCircle2 size={16} /> Custo total considerado
            </span>
            <strong>{fmtBRL(baseCost)}</strong>
          </div>

          <p className="form-note">
            Estimativa simplificada. Confirme o regime tributário, os custos
            indiretos e as regras fiscais antes de usar o preço em uma proposta.
          </p>
        </section>

        <section className="price-result">
          <div className="price-result-top">
            <span>PREÇO DE VENDA SUGERIDO</span>
            <div className="price-result-icon">
              <Target size={20} />
            </div>
          </div>

          <div className="suggested-price">
            {valid ? fmtBRL(price) : 'Revise os percentuais'}
          </div>

          <p>
            Preço simulado para atingir a margem informada, considerando os
            dados preenchidos.
          </p>

          <div className="price-breakdown">
            <div>
              <span>Custo + logística + outros</span>
              <strong>{fmtBRL(baseCost)}</strong>
            </div>
            <div>
              <span>Tributos estimados ({asPercent(tax)})</span>
              <strong>{fmtBRL(taxAmount)}</strong>
            </div>
            <div>
              <span>Lucro estimado</span>
              <strong className="profit-amount">{fmtBRL(grossProfit)}</strong>
            </div>
          </div>

          <div className="margin-indicator">
            <div className="margin-indicator-row">
              <span>Margem sobre a venda</span>
              <strong>
                {valid && price
                  ? asPercent((grossProfit / price) * 100)
                  : '—'}
              </strong>
            </div>

            <div className="progress-track">
              <div
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(0, (margin / 60) * 100)
                  )}%`,
                }}
              />
            </div>
          </div>

          <button
            className="button button-light full-button"
            onClick={() => window.print()}
          >
            <FileText size={16} /> Imprimir / salvar como PDF
          </button>
        </section>
      </div>

      <div className="inline-alert price-warning">
        <AlertCircle size={17} />
        <span>
          Não use esse resultado como preço mínimo automático de lance sem
          validar custos, incidências tributárias, garantias, prazo de
          pagamento e riscos contratuais.
        </span>
      </div>
    </>
  );
}
