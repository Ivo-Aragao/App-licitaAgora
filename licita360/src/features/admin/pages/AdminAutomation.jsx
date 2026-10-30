import React from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock3, Mail, Zap } from 'lucide-react';
import AdminStatCard from '../components/AdminStatCard.jsx';
import AdminDataTable from '../components/AdminDataTable.jsx';

const formatDate = (value) => value
  ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  : '—';

function StatusPill({ active }) {
  return <span className={`l360-admin-pill ${active ? 'success' : 'neutral'}`}>{active ? 'Ativo' : 'Desativado'}</span>;
}

export default function AdminAutomation({ automation }) {
  const metrics = automation?.metrics || {};
  const settings = automation?.settings || [];
  return (
    <>
      <div className="l360-admin-metrics">
        <AdminStatCard icon={Zap} label="Empresas configuradas" value={metrics.configuredCompanies} />
        <AdminStatCard icon={Activity} label="Prospecção habilitada" value={metrics.enabledProspecting} />
        <AdminStatCard icon={Mail} label="Resumos diários ativos" value={metrics.dailyDigestEnabled} />
        <AdminStatCard icon={CheckCircle2} label="E-mails enviados" value={metrics.sent} />
        <AdminStatCard icon={AlertTriangle} label="Falhas" value={metrics.failed} />
        <AdminStatCard icon={Clock3} label="Pendentes" value={metrics.pending} />
      </div>
      <section className="l360-admin-panel">
        <div className="l360-admin-panel-head"><h3>Configuração por empresa</h3><span>Último registro: {formatDate(metrics.lastNotificationAt)}</span></div>
        <AdminDataTable
          columns={[
            { key: 'company', label: 'Empresa' },
            { key: 'prospecting', label: 'Prospecção' },
            { key: 'digest', label: 'Resumo diário' },
            { key: 'documents', label: 'Alertas documentais' },
            { key: 'recipient', label: 'Destinatário' },
            { key: 'updated', label: 'Atualizado' },
          ]}
          rows={settings}
          emptyMessage="Nenhuma configuração de automação encontrada."
          renderRow={(item) => (
            <tr key={item.id}>
              <td><strong>{item.company?.name || 'Empresa'}</strong></td>
              <td><StatusPill active={item.enabled} /></td>
              <td><StatusPill active={item.dailyEmailEnabled} /></td>
              <td><StatusPill active={item.documentAlertsEnabled} /></td>
              <td>{item.recipientEmail || 'Não configurado'}</td>
              <td>{formatDate(item.updatedAt)}</td>
            </tr>
          )}
        />
      </section>
    </>
  );
}
