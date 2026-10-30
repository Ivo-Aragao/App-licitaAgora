import React from 'react';
import AdminDataTable from '../components/AdminDataTable.jsx';

const formatMoney = (value) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', maximumFractionDigits: 2,
}).format(Number(value || 0));

const formatDate = (value) => value
  ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value))
  : '—';

function StatusPill({ value }) {
  const normalized = String(value || '').toLowerCase();
  const labels = { ACTIVE: 'Ativo', SUSPENDED: 'Inativo', TRIAL: 'Em teste', PAST_DUE: 'Pagamento pendente', CANCELED: 'Cancelado', EXPIRED: 'Expirado' };
  const tone = ['active'].includes(normalized) ? 'success' : ['suspended', 'canceled', 'expired'].includes(normalized) ? 'danger' : ['trial', 'past_due'].includes(normalized) ? 'warning' : 'neutral';
  return <span className={`l360-admin-pill ${tone}`}>{labels[value] || value || '—'}</span>;
}

function PlansList({ plans, busy, onToggle }) {
  return (
    <section className="l360-admin-panel">
      <div className="l360-admin-panel-head">
        <h3>Planos cadastrados</h3>
        <span>{plans.length} planos</span>
      </div>
      {plans.length ? plans.map((plan) => (
        <div className="l360-admin-plan-row" key={plan.id}>
          <div>
            <strong>{plan.name}</strong>
            <span>{plan.code} · {plan.billingCycle === 'YEARLY' ? 'Anual' : 'Mensal'}</span>
            <b>{formatMoney(plan.price)}</b>
            <small>{plan.maxUsers} usuário(s) · {plan.maxOpportunities} oportunidades · {plan._count?.subscriptions || 0} assinatura(s)</small>
          </div>
          <div className="l360-admin-plan-actions">
            <StatusPill value={plan.active ? 'ACTIVE' : 'SUSPENDED'} />
            <button type="button" className="l360-admin-action" disabled={busy} onClick={() => onToggle(plan)}>
              {plan.active ? 'Desativar' : 'Ativar'}
            </button>
          </div>
        </div>
      )) : <div className="l360-admin-empty">Nenhum plano cadastrado. Crie o primeiro ao lado.</div>}
    </section>
  );
}

function PlanForm({ draft, setDraft, busy, onSubmit }) {
  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  return (
    <form className="l360-admin-panel l360-admin-form" onSubmit={onSubmit}>
      <div className="l360-admin-panel-head"><h3>Novo plano</h3></div>
      <label>Nome<input required value={draft.name} onChange={(event) => update('name', event.target.value)} placeholder="Ex.: Profissional" /></label>
      <label>Código (opcional)<input value={draft.code} onChange={(event) => update('code', event.target.value)} placeholder="profissional" /></label>
      <label>Descrição<input value={draft.description} onChange={(event) => update('description', event.target.value)} placeholder="Para empresas em crescimento" /></label>
      <div className="l360-admin-form-grid">
        <label>Preço (R$)<input type="number" min="0" step="0.01" value={draft.price} onChange={(event) => update('price', event.target.value)} /></label>
        <label>Cobrança<select value={draft.billingCycle} onChange={(event) => update('billingCycle', event.target.value)}><option value="MONTHLY">Mensal</option><option value="YEARLY">Anual</option></select></label>
      </div>
      <div className="l360-admin-form-grid">
        <label>Dias de teste<input type="number" min="0" max="365" value={draft.trialDays} onChange={(event) => update('trialDays', event.target.value)} /></label>
        <label>Limite de usuários<input type="number" min="1" value={draft.maxUsers} onChange={(event) => update('maxUsers', event.target.value)} /></label>
      </div>
      <label>Limite de oportunidades<input type="number" min="1" value={draft.maxOpportunities} onChange={(event) => update('maxOpportunities', event.target.value)} /></label>
      <label>Recursos (um por linha)<textarea rows="3" value={draft.features} onChange={(event) => update('features', event.target.value)} placeholder={'Radar de licitações\nAlertas por e-mail\nAnálise de editais'} /></label>
      <button type="submit" className="l360-admin-primary" disabled={busy}>Criar plano</button>
      <p className="l360-admin-note">Cadastro e gestão de planos. Não há cobrança automática conectada nesta etapa.</p>
    </form>
  );
}

function Subscriptions({ subscriptions, companies, plans, draft, setDraft, busy, onSubmit }) {
  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  return (
    <div className="l360-admin-two-col">
      <section className="l360-admin-panel">
        <div className="l360-admin-panel-head"><h3>Assinaturas</h3><span>{subscriptions.length} registros</span></div>
        <AdminDataTable
          columns={[
            { key: 'company', label: 'Empresa' },
            { key: 'plan', label: 'Plano' },
            { key: 'status', label: 'Status' },
            { key: 'end', label: 'Vencimento' },
          ]}
          rows={subscriptions}
          emptyMessage="Nenhuma assinatura vinculada."
          renderRow={(sub) => (
            <tr key={sub.id}>
              <td><strong>{sub.company?.name || '—'}</strong><small>{sub.company?.cnpj || 'CNPJ não informado'}</small></td>
              <td>{sub.plan?.name || '—'} · {formatMoney(sub.plan?.price)}</td>
              <td><StatusPill value={sub.status} /></td>
              <td>{formatDate(sub.currentPeriodEnd || sub.trialEndsAt)}</td>
            </tr>
          )}
        />
      </section>
      <form className="l360-admin-panel l360-admin-form" onSubmit={onSubmit}>
        <div className="l360-admin-panel-head"><h3>Vincular plano à empresa</h3></div>
        <label>Empresa<select required value={draft.companyId} onChange={(event) => update('companyId', event.target.value)}><option value="">Selecione uma empresa</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
        <label>Plano<select required value={draft.planId} onChange={(event) => update('planId', event.target.value)}><option value="">Selecione um plano</option>{plans.filter((plan) => plan.active).map((plan) => <option key={plan.id} value={plan.id}>{plan.name} — {formatMoney(plan.price)}</option>)}</select></label>
        <label>Status<select value={draft.status} onChange={(event) => update('status', event.target.value)}><option value="TRIAL">Em teste</option><option value="ACTIVE">Ativa</option><option value="PAST_DUE">Pagamento pendente</option><option value="CANCELED">Cancelada</option><option value="EXPIRED">Expirada</option></select></label>
        <label>Fim do período<input type="date" value={draft.currentPeriodEnd} onChange={(event) => update('currentPeriodEnd', event.target.value)} /></label>
        <label>Fim do teste<input type="date" value={draft.trialEndsAt} onChange={(event) => update('trialEndsAt', event.target.value)} /></label>
        <button type="submit" className="l360-admin-primary" disabled={busy}>Salvar assinatura</button>
        <p className="l360-admin-note">A associação é administrativa. Gateway, cobrança recorrente e webhooks ainda não estão incluídos.</p>
      </form>
    </div>
  );
}

export default function AdminPlans({
  mode = 'plans', plans, subscriptions, companies, planDraft, setPlanDraft,
  subscriptionDraft, setSubscriptionDraft, busy, onCreatePlan, onTogglePlan, onSaveSubscription,
}) {
  if (mode === 'subscriptions') {
    return <Subscriptions subscriptions={subscriptions} companies={companies} plans={plans} draft={subscriptionDraft} setDraft={setSubscriptionDraft} busy={busy} onSubmit={onSaveSubscription} />;
  }
  return (
    <div className="l360-admin-two-col l360-admin-plans-layout">
      <PlansList plans={plans} busy={busy} onToggle={onTogglePlan} />
      <PlanForm draft={planDraft} setDraft={setPlanDraft} busy={busy} onSubmit={onCreatePlan} />
    </div>
  );
}
