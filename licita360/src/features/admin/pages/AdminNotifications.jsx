import React from 'react';
import AdminDataTable from '../components/AdminDataTable.jsx';

const formatDate = (value) => value
  ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  : '—';

function StatusPill({ value }) {
  const normalized = String(value || '').toLowerCase();
  const tone = normalized === 'sent' ? 'success' : normalized === 'failed' ? 'danger' : normalized === 'pending' ? 'warning' : 'neutral';
  const label = ({ sent: 'Enviado', failed: 'Falhou', pending: 'Pendente' })[value] || value || '—';
  return <span className={`l360-admin-pill ${tone}`}>{label}</span>;
}

export default function AdminNotifications({ notifications }) {
  return (
    <section className="l360-admin-panel">
      <div className="l360-admin-panel-head"><h3>Histórico de notificações</h3><span>{notifications.length} registros recentes</span></div>
      <AdminDataTable
        columns={[
          { key: 'date', label: 'Data' },
          { key: 'company', label: 'Empresa' },
          { key: 'type', label: 'Tipo' },
          { key: 'recipient', label: 'Destinatário' },
          { key: 'subject', label: 'Assunto' },
          { key: 'status', label: 'Status' },
          { key: 'error', label: 'Erro' },
        ]}
        rows={notifications}
        renderRow={(item) => (
          <tr key={item.id}>
            <td>{formatDate(item.createdAt)}</td>
            <td>{item.company?.name || '—'}</td>
            <td>{item.type}</td>
            <td>{item.recipientEmail || '—'}</td>
            <td>{item.subject}</td>
            <td><StatusPill value={item.status} /></td>
            <td className="l360-admin-error-cell" title={item.error || ''}>{item.error || '—'}</td>
          </tr>
        )}
      />
    </section>
  );
}
