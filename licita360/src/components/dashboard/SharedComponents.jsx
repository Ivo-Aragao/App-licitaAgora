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

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="page-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  icon: Icon = Plus,
  variant = 'primary',
  type = 'button',
  disabled = false,
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`button button-${variant}`}
      onClick={onClick}
    >
      {Icon && <Icon size={16} />}
      <span>{children}</span>
    </button>
  );
}

export function MetricCard({ label, value, hint, icon: Icon, color, change, onClick }) {
  return (
    <button
      className={`metric-card metric-${color}`}
      onClick={onClick}
      type="button"
    >
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-icon">
          <Icon size={19} />
        </span>
      </div>

      <div className="metric-value">{value}</div>

      <div className="metric-bottom">
        <span>
          {change && <strong>{change}</strong>} {hint}
        </span>
        <ArrowUpRight size={15} />
      </div>
    </button>
  );
}

export function Overview({
  data,
  totalActive,
  deadlineCount,
  activeTasks,
  projectedProfit,
  profitCoverage,
  onNavigate,
  onNew,
  onEdit,
  onTask,
  onSettings,
}) {
  const priorities = data.tasks.filter((task) => !task.done).slice(0, 4);

  const topOps = [...data.opportunities]
    .sort(
      (a, b) =>
        (parseDate(a.deadline)?.getTime() ?? Infinity) -
        (parseDate(b.deadline)?.getTime() ?? Infinity)
    )
    .slice(0, 4);

  const totalTasks = data.opportunities.reduce(
    (n, item) => n + (item.tasks || []).length,
    0
  );

  const doneTasks = data.opportunities.reduce(
    (n, item) =>
      n + (item.tasks || []).filter((task) => task.done).length,
    0
  );

  const completion = totalTasks
    ? Math.round((doneTasks / totalTasks) * 100)
    : 0;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const sevenDaysFromNow = new Date(todayStart);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const thirtyDaysFromNow = new Date(todayStart);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const documentAlerts = data.documents.filter((document) => {
    const expiry = parseDate(document.expires);
    return expiry && expiry <= thirtyDaysFromNow;
  });

  const taskAlerts = data.tasks.filter((task) => {
    if (task.done || !task.date) return false;

    const dueDate = parseDate(task.date);
    return dueDate && dueDate < tomorrowStart;
  });

  const processAlerts = data.opportunities.filter((item) => {
    if (['Vencida', 'Perdida'].includes(item.status)) return false;

    const deadline = parseDate(item.deadline);
    return (
      deadline &&
      deadline >= todayStart &&
      deadline <= sevenDaysFromNow
    );
  });

  const attentionCount =
    documentAlerts.length +
    taskAlerts.length +
    processAlerts.length;

  return (
    <>
      <PageHeader
        eyebrow={new Intl.DateTimeFormat('pt-BR', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
        }).format(new Date()).toUpperCase()}
        title="Visão geral"
        description="Aqui está o resumo do que merece sua atenção hoje."
        actions={
          <>
            <button
              className="button button-secondary"
              onClick={() => onNavigate('radar')}
            >
              <Radar size={16} /> Buscar oportunidades
            </button>
            <PrimaryButton onClick={onNew}>Nova licitação</PrimaryButton>
          </>
        }
      />

      <div className="welcome-strip">
        <div className="welcome-mark">
          <Activity size={22} />
        </div>
        <div>
          <strong>Bom trabalho começa com visão clara.</strong>
          <p>
            Organize seus processos, acompanhe os prazos e mantenha sua
            operação em movimento.
          </p>
        </div>
        <div className="welcome-right">
          <span className="live-pulse" />
          Visão atualizada
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard
          label="Processos ativos"
          value={String(totalActive).padStart(2, '0')}
          hint="na sua carteira"
          icon={BriefcaseBusiness}
          color="blue"
          onClick={() => onNavigate('processes')}
        />

        <MetricCard
          label="Prazos próximos"
          value={String(deadlineCount).padStart(2, '0')}
          hint="nos próximos 7 dias"
          icon={CalendarClock}
          color="amber"
          onClick={() => onNavigate('tasks')}
        />

        <MetricCard
          label="Tarefas pendentes"
          value={String(activeTasks).padStart(2, '0')}
          hint="para concluir"
          icon={ClipboardCheck}
          color="violet"
          onClick={() => onNavigate('tasks')}
        />

        <MetricCard
          label="Lucro projetado"
          value={profitCoverage ? fmtBRL(projectedProfit) : '—'}
          hint={
            profitCoverage
              ? `calculado em ${profitCoverage} processo(s)`
              : 'informe receita e custo'
          }
          icon={Wallet}
          color="green"
          onClick={() => onNavigate('processes')}
        />
      </div>

      <section className="panel attention-panel">
        <div className="panel-header">
          <div>
            <h2>Atenção hoje</h2>
            <p>Pendências identificadas nos registros da sua empresa.</p>
          </div>

          <span className="attention-total">
            {attentionCount === 0
              ? 'Tudo em dia'
              : `${attentionCount} alerta(s)`}
          </span>
        </div>

        <div className="attention-grid">
          <button
            type="button"
            className="attention-item"
            onClick={() => onNavigate('documents')}
          >
            <span className="attention-item-icon">
              <FileCheck2 size={19} />
            </span>
            <span className="attention-copy">
              <strong>Documentos</strong>
              <small>Vencidos ou vencendo em 30 dias</small>
            </span>
            <b>{documentAlerts.length}</b>
          </button>

          <button
            type="button"
            className="attention-item"
            onClick={() => onNavigate('tasks')}
          >
            <span className="attention-item-icon">
              <ClipboardCheck size={19} />
            </span>
            <span className="attention-copy">
              <strong>Tarefas</strong>
              <small>Atrasadas ou com prazo hoje</small>
            </span>
            <b>{taskAlerts.length}</b>
          </button>

          <button
            type="button"
            className="attention-item"
            onClick={() => onNavigate('processes')}
          >
            <span className="attention-item-icon">
              <CalendarClock size={19} />
            </span>
            <span className="attention-copy">
              <strong>Prazos de processos</strong>
              <small>Nos próximos 7 dias</small>
            </span>
            <b>{processAlerts.length}</b>
          </button>
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="panel opportunities-panel">
          <div className="panel-header">
            <div>
              <h2>Oportunidades em acompanhamento</h2>
              <p>Processos com datas e etapas para monitorar</p>
            </div>

            <button
              className="text-button"
              onClick={() => onNavigate('processes')}
            >
              Ver todos <ArrowRight size={15} />
            </button>
          </div>

          <div className="opportunity-list">
            {topOps.map((item) => (
              <OpportunityRow
                key={item.id}
                item={item}
                onClick={() => onEdit(item)}
              />
            ))}

            {!topOps.length && (
              <EmptyState
                icon={Radar}
                title="Nenhum processo cadastrado"
                description="Adicione uma licitação para começar seu acompanhamento."
              />
            )}
          </div>

          <div className="panel-bottom-link">
            <button
              className="subtle-link"
              onClick={() => onNavigate('radar')}
            >
              <Radar size={16} />
              Explorar novas oportunidades <ArrowRight size={15} />
            </button>
          </div>
        </section>

        <section className="panel task-panel">
          <div className="panel-header">
            <div>
              <h2>Minha lista de tarefas</h2>
              <p>Pequenas ações, grandes resultados</p>
            </div>

            <button
              className="icon-button tiny"
              onClick={() => onNavigate('tasks')}
            >
              <ArrowRight size={16} />
            </button>
          </div>

          <div className="task-list">
            {priorities.length ? (
              priorities.map((task) => (
                <div className="task-row" key={task.id}>
                  <button
                    className={`task-check ${task.done ? 'checked' : ''}`}
                    onClick={() => onTask(task.id)}
                    aria-label={
                      task.done ? 'Marcar pendente' : 'Concluir tarefa'
                    }
                  >
                    {task.done && <Check size={13} />}
                  </button>

                  <div className="task-copy">
                    <strong className={task.done ? 'task-done' : ''}>
                      {task.title}
                    </strong>
                    <span>
                      <Clock3 size={12} /> {formatDate(task.date)}
                    </span>
                  </div>

                  <PriorityBadge value={task.priority} />
                </div>
              ))
            ) : (
              <EmptyState
                icon={CheckCheck}
                title="Tudo em dia"
                description="Nenhuma tarefa pendente nesta lista."
              />
            )}
          </div>

          <button
            className="full-width-link"
            onClick={() => onNavigate('tasks')}
          >
            Abrir lista completa <ArrowRight size={15} />
          </button>
        </section>
      </div>

      <div className="bottom-grid">
        <section className="panel branches-panel">
          <div className="panel-header">
            <div>
              <h2>Seus ramos de atuação</h2>
              <p>Áreas acompanhadas pela empresa</p>
            </div>

            <button
              className="icon-button tiny"
              title="Editar empresa"
              onClick={onSettings}
            >
              <ChevronDown size={15} />
            </button>
          </div>

          <div className="branch-tags">
            {data.profile.branches.map((branch) => (
              <span className="branch-tag" key={branch}>
                <span className="branch-dot" />
                {branch}
              </span>
            ))}

            <span className="branch-note">
              {data.profile.branches.length} categorias cadastradas
            </span>
          </div>
        </section>

        <section className="panel progress-panel">
          <div className="panel-header">
            <div>
              <h2>Checklist dos processos</h2>
              <p>Conclusão das tarefas vinculadas aos editais</p>
            </div>

            <span className="progress-value">{completion}%</span>
          </div>

          <div className="progress-track">
            <div style={{ width: `${completion}%` }} />
          </div>

          <div className="progress-legend">
            <span>{doneTasks} concluídas</span>
            <span>{Math.max(0, totalTasks - doneTasks)} pendentes</span>
          </div>
        </section>
      </div>

      <div className="demo-notice">
        <CircleHelp size={16} />
        <span>
          <strong>Modo demonstração:</strong> os exemplos iniciais são fictícios.
          Substitua-os pelos dados da sua empresa. O lucro projetado só aparece
          para processos com receita, custo e tributos informados.
        </span>
      </div>
    </>
  );
}

export function OpportunityRow({ item, onClick }) {
  const deadline = parseDate(item.deadline);
  const expired = deadline && deadline < new Date();

  return (
    <button className="opportunity-row" onClick={onClick}>
      <div
        className={`opportunity-type-icon ${
          item.source === 'PNCP' ? 'type-purple' : ''
        }`}
      >
        <FileText size={19} />
      </div>

      <div className="opp-main">
        <strong>{item.title}</strong>
        <span>{item.agency}</span>

        <div className="opp-tags">
          <span className="category-chip">{item.category}</span>
          <StatusBadge value={item.status} />
        </div>
      </div>

      <div className="opp-value">
        <strong>{fmtBRL(item.amount)}</strong>
        <span>
          <CalendarClock size={13} />
          {expired ? 'Prazo passou' : formatDate(item.deadline)}
        </span>
      </div>

      <ChevronRight size={17} className="row-chevron" />
    </button>
  );
}

export function StatusBadge({ value }) {
  const cls =
    value === 'Disputa agendada' || value === 'Preparar proposta'
      ? 'status-blue'
      : value === 'Documentação' || value === 'Em análise'
        ? 'status-amber'
        : value === 'Enviada'
          ? 'status-green'
          : value === 'Perdida' || value === 'Vencida'
            ? 'status-red'
            : 'status-neutral';

  return <span className={`status-badge ${cls}`}>{value}</span>;
}

export function PriorityBadge({ value }) {
  return (
    <span className={`priority priority-${(value || 'Média').toLowerCase()}`}>
      {value || 'Média'}
    </span>
  );
}

export function EmptyState({ icon: Icon = FileSearch, title, description }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={22} />
      </div>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

export function SearchFilters({
  query,
  setQuery,
  statusFilter,
  setStatusFilter,
}) {
  return (
    <div className="filter-toolbar">
      <div className="search-box">
        <Search size={17} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por edital, órgão, ramo..."
        />
      </div>

      <div className="select-wrap">
        <Filter size={15} />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option>Todos</option>
          {statusOptions.map((status) => (
            <option key={status}>{status}</option>
          ))}
        </select>
        <ChevronDown size={14} />
      </div>
    </div>
  );
}
