import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Database,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import './AdminApp.css';
import AdminSidebar from './AdminSidebar.jsx';
import AdminOverview from './pages/AdminOverview.jsx';
import AdminUsers from './pages/AdminUsers.jsx';
import AdminCompanies from './pages/AdminCompanies.jsx';
import AdminPlans from './pages/AdminPlans.jsx';
import AdminAutomation from './pages/AdminAutomation.jsx';
import AdminNotifications from './pages/AdminNotifications.jsx';
import AdminAudit from './pages/AdminAudit.jsx';
import AdminSettings from './pages/AdminSettings.jsx';

const API = '/api/admin';
const LABELS = {
  overview: 'Visão geral', users: 'Usuários', companies: 'Empresas',
  plans: 'Planos', subscriptions: 'Assinaturas', automation: 'Automações',
  notifications: 'Notificações', audit: 'Auditoria', system: 'Sistema',
};

async function adminFetch(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Falha na administração (HTTP ${response.status}).`);
  }
  return payload;
}

function makeEmptyData() {
  return {
    overview: null,
    users: [],
    companies: [],
    plans: [],
    subscriptions: [],
    automation: null,
    notifications: [],
    audit: [],
    system: null,
  };
}

export default function AdminApp({ currentUser, onBack, onLogout }) {
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [data, setData] = useState(makeEmptyData);
  const [planDraft, setPlanDraft] = useState({
    name: '', code: '', description: '', price: '0', billingCycle: 'MONTHLY',
    trialDays: '0', maxUsers: '1', maxOpportunities: '50', features: '',
  });
  const [subscriptionDraft, setSubscriptionDraft] = useState({
    companyId: '', planId: '', status: 'TRIAL', currentPeriodEnd: '', trialEndsAt: '',
  });

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [overview, users, companies, plans, subscriptions, automation, notifications, audit, system] = await Promise.all([
        adminFetch('/overview'),
        adminFetch('/users'),
        adminFetch('/companies'),
        adminFetch('/plans'),
        adminFetch('/subscriptions'),
        adminFetch('/automation'),
        adminFetch('/notifications'),
        adminFetch('/audit'),
        adminFetch('/system'),
      ]);
      setData({
        overview,
        users: users.users || [],
        companies: companies.companies || [],
        plans: plans.plans || [],
        subscriptions: subscriptions.subscriptions || [],
        automation,
        notifications: notifications.notifications || [],
        audit: audit.logs || [],
        system: system.system || null,
      });
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível carregar o painel administrativo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const showNotice = useCallback((message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3500);
  }, []);

  async function runAction(action, successMessage) {
    setBusy(true);
    setError('');
    try {
      await action();
      if (successMessage) showNotice(successMessage);
      await loadAll();
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível concluir a operação.');
    } finally {
      setBusy(false);
    }
  }

  async function changeUserStatus(user) {
    const next = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const question = next === 'SUSPENDED'
      ? `Suspender o acesso de ${user.name}?`
      : `Reativar o acesso de ${user.name}?`;
    if (!window.confirm(question)) return;
    await runAction(() => adminFetch(`/users/${encodeURIComponent(user.id)}/status`, {
      method: 'PATCH', body: JSON.stringify({ status: next }),
    }), 'Status do usuário atualizado.');
  }

  async function changeCompanyStatus(company) {
    const next = company.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (!window.confirm(`${next === 'SUSPENDED' ? 'Suspender' : 'Reativar'} ${company.name}?`)) return;
    await runAction(() => adminFetch(`/companies/${encodeURIComponent(company.id)}/status`, {
      method: 'PATCH', body: JSON.stringify({ status: next }),
    }), 'Status da empresa atualizado.');
  }

  async function createPlan(event) {
    event.preventDefault();
    await runAction(async () => {
      await adminFetch('/plans', {
        method: 'POST',
        body: JSON.stringify({
          ...planDraft,
          price: Number(planDraft.price),
          trialDays: Number(planDraft.trialDays),
          maxUsers: Number(planDraft.maxUsers),
          maxOpportunities: Number(planDraft.maxOpportunities),
          features: planDraft.features.split('\n').map((item) => item.trim()).filter(Boolean),
        }),
      });
      setPlanDraft({ name: '', code: '', description: '', price: '0', billingCycle: 'MONTHLY', trialDays: '0', maxUsers: '1', maxOpportunities: '50', features: '' });
    }, 'Plano criado com sucesso.');
  }

  async function togglePlan(plan) {
    await runAction(() => adminFetch(`/plans/${encodeURIComponent(plan.id)}`, {
      method: 'PUT', body: JSON.stringify({ active: !plan.active }),
    }), 'Plano atualizado.');
  }

  async function saveSubscription(event) {
    event.preventDefault();
    if (!subscriptionDraft.companyId || !subscriptionDraft.planId) {
      setError('Selecione uma empresa e um plano.');
      return;
    }
    await runAction(async () => {
      await adminFetch(`/subscriptions/${encodeURIComponent(subscriptionDraft.companyId)}`, {
        method: 'PUT',
        body: JSON.stringify({
          planId: subscriptionDraft.planId,
          status: subscriptionDraft.status,
          currentPeriodEnd: subscriptionDraft.currentPeriodEnd || null,
          trialEndsAt: subscriptionDraft.trialEndsAt || null,
        }),
      });
      setSubscriptionDraft({ companyId: '', planId: '', status: 'TRIAL', currentPeriodEnd: '', trialEndsAt: '' });
    }, 'Assinatura vinculada à empresa.');
  }

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.users.filter((user) => `${user.name} ${user.email} ${user.company?.name || ''}`.toLowerCase().includes(term));
  }, [data.users, search]);

  const filteredCompanies = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.companies.filter((company) => `${company.name} ${company.cnpj || ''}`.toLowerCase().includes(term));
  }, [data.companies, search]);

  function changeTab(nextTab) {
    setTab(nextTab);
    setSearch('');
    setError('');
  }

  function renderContent() {
    if (loading) {
      return <div className="l360-admin-loading"><LoaderCircle className="spin" /> Carregando dados administrativos...</div>;
    }

    switch (tab) {
      case 'overview':
        return <AdminOverview overview={data.overview} subscriptions={data.subscriptions} onNavigate={changeTab} />;
      case 'users':
        return <AdminUsers users={filteredUsers} search={search} onSearch={setSearch} busy={busy} onChangeStatus={changeUserStatus} />;
      case 'companies':
        return <AdminCompanies companies={filteredCompanies} search={search} onSearch={setSearch} busy={busy} onChangeStatus={changeCompanyStatus} />;
      case 'plans':
      case 'subscriptions':
        return <AdminPlans
          mode={tab}
          plans={data.plans}
          subscriptions={data.subscriptions}
          companies={data.companies}
          planDraft={planDraft}
          setPlanDraft={setPlanDraft}
          subscriptionDraft={subscriptionDraft}
          setSubscriptionDraft={setSubscriptionDraft}
          busy={busy}
          onCreatePlan={createPlan}
          onTogglePlan={togglePlan}
          onSaveSubscription={saveSubscription}
        />;
      case 'automation':
        return <AdminAutomation automation={data.automation} />;
      case 'notifications':
        return <AdminNotifications notifications={data.notifications} />;
      case 'audit':
        return <AdminAudit logs={data.audit} />;
      case 'system':
        return <AdminSettings system={data.system} />;
      default:
        return <div className="l360-admin-empty">Selecione uma área administrativa.</div>;
    }
  }

  return (
    <section className="l360-admin">
      <header className="l360-admin-header">
        <div className="l360-admin-brand">
          <div className="l360-admin-brand-mark"><ShieldCheck size={21} /></div>
          <div><strong>Licita360 <span>Admin</span></strong><small>Central de controle da plataforma</small></div>
        </div>
        <div className="l360-admin-header-actions">
          <div className="l360-admin-admin-user"><span>{currentUser?.name || 'Administrador'}</span><small>{currentUser?.email}</small></div>
          <button type="button" className="l360-admin-icon-button" onClick={loadAll} title="Atualizar dados" aria-label="Atualizar dados"><RefreshCw size={17} /></button>
          <button type="button" className="l360-admin-back" onClick={onBack}><ArrowLeft size={16} /> Voltar ao sistema</button>
          <button type="button" className="l360-admin-logout" onClick={onLogout}>Sair</button>
        </div>
      </header>

      <div className="l360-admin-intro">
        <div><span className="l360-admin-eyebrow">ADMINISTRAÇÃO DA PLATAFORMA</span><h1>{LABELS[tab] || 'Visão geral'}</h1><p>Gerencie clientes, empresas, planos e operação do Licita360.</p></div>
        <div className="l360-admin-secure"><ShieldCheck size={16} /> Área restrita</div>
      </div>

      <AdminSidebar active={tab} onChange={changeTab} />

      {error ? <div className="l360-admin-alert error"><AlertTriangle size={17} />{error}<button type="button" onClick={() => setError('')} aria-label="Fechar erro"><XCircle size={16} /></button></div> : null}
      {notice ? <div className="l360-admin-alert success"><Check size={17} />{notice}</div> : null}

      <main className="l360-admin-content">{renderContent()}</main>
      <footer className="l360-admin-footer"><span><Database size={14} /> Dados administrativos do PostgreSQL</span><span>Licita360 · Central administrativa</span></footer>
    </section>
  );
}
