import React from 'react';
import {
  Activity,
  Building2,
  CircleDollarSign,
  Mail,
  UserCheck,
  Users,
} from 'lucide-react';
import AdminStatCard from '../components/AdminStatCard.jsx';
import AdminCharts from '../components/AdminCharts.jsx';

const formatDate = (value) => value
  ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  : '—';

function StatusPill({ value }) {
  const normalized = String(value || '').toLowerCase();
  const label = ({ ACTIVE: 'Ativo', SUSPENDED: 'Suspenso', TRIAL: 'Em teste', sent: 'Enviado', failed: 'Falhou', pending: 'Pendente' })[value] || value || '—';
  const tone = ['active', 'sent'].includes(normalized)
    ? 'success'
    : ['suspended', 'failed', 'canceled', 'expired'].includes(normalized)
      ? 'danger'
      : ['trial', 'pending', 'past_due'].includes(normalized) ? 'warning' : 'neutral';
  return <span className={`l360-admin-pill ${tone}`}>{label}</span>;
}

export default function AdminOverview({ overview, subscriptions, onNavigate }) {
  const metrics = overview?.metrics || {};
  const recentUsers = overview?.recentUsers || [];
  const recentNotifications = overview?.recentNotifications || [];

  return (
    <>
      <div className="l360-admin-metrics">
        <AdminStatCard icon={Users} label="Usuários" value={metrics.users} note={`${metrics.activeUsers || 0} ativos`} />
        <AdminStatCard icon={Building2} label="Empresas" value={metrics.companies} note={`${metrics.activeCompanies || 0} ativas`} />
        <AdminStatCard icon={Activity} label="Oportunidades" value={metrics.discoveries} note={`${metrics.opportunities || 0} processos dos clientes`} />
        <AdminStatCard icon={Mail} label="E-mails enviados" value={metrics.sentEmails} note={`${metrics.failedEmails || 0} falhas registradas`} />
        <AdminStatCard icon={CircleDollarSign} label="Assinaturas ativas" value={metrics.activeSubscriptions} note="Controle administrativo" />
        <AdminStatCard icon={UserCheck} label="Novos usuários" value={metrics.newUsers30Days} note="Últimos 30 dias" />
      </div>

      <div className="l360-admin-two-col">
        <section className="l360-admin-panel">
          <div className="l360-admin-panel-head">
            <h3>Cadastros recentes</h3>
            <button type="button" onClick={() => onNavigate('users')}>Ver usuários</button>
          </div>
          {recentUsers.length ? recentUsers.map((user) => (
            <div className="l360-admin-list-row" key={user.id}>
              <div className="l360-admin-avatar">{user.name?.slice(0, 1)?.toUpperCase() || 'U'}</div>
              <div className="l360-admin-list-main">
                <strong>{user.name}</strong>
                <span>{user.email} · {user.company?.name || 'Sem empresa'}</span>
              </div>
              <StatusPill value={user.status} />
            </div>
          )) : <div className="l360-admin-empty">Nenhum cadastro recente.</div>}
        </section>

        <section className="l360-admin-panel">
          <div className="l360-admin-panel-head">
            <h3>Atividade de e-mail</h3>
            <button type="button" onClick={() => onNavigate('notifications')}>Ver histórico</button>
          </div>
          {recentNotifications.length ? recentNotifications.map((item) => (
            <div className="l360-admin-list-row" key={item.id}>
              <div className="l360-admin-list-icon"><Mail size={16} /></div>
              <div className="l360-admin-list-main">
                <strong>{item.subject}</strong>
                <span>{item.company?.name || 'Empresa'} · {formatDate(item.createdAt)}</span>
              </div>
              <StatusPill value={item.status} />
            </div>
          )) : <div className="l360-admin-empty">Nenhuma notificação registrada.</div>}
        </section>
      </div>

      <div style={{ marginTop: 14 }}>
        <AdminCharts subscriptions={subscriptions} />
      </div>
    </>
  );
}
