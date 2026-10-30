import React from 'react';
import AdminDataTable from '../components/AdminDataTable.jsx';

const formatDate = (value) => value
  ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  : '—';

export default function AdminAudit({ logs }) {
  return (
    <section className="l360-admin-panel">
      <div className="l360-admin-panel-head"><h3>Registro de auditoria</h3><span>{logs.length} ações recentes</span></div>
      <AdminDataTable
        columns={[
          { key: 'date', label: 'Data' },
          { key: 'admin', label: 'Administrador' },
          { key: 'action', label: 'Ação' },
          { key: 'entity', label: 'Entidade' },
          { key: 'id', label: 'ID' },
          { key: 'ip', label: 'IP' },
        ]}
        rows={logs}
        emptyMessage="As ações administrativas aparecerão aqui."
        renderRow={(item) => (
          <tr key={item.id}>
            <td>{formatDate(item.createdAt)}</td>
            <td>{item.adminEmail}</td>
            <td><strong>{item.action}</strong></td>
            <td>{item.entityType}</td>
            <td>{item.entityId || '—'}</td>
            <td>{item.ip || '—'}</td>
          </tr>
        )}
      />
    </section>
  );
}
