import React from 'react';
import { Search } from 'lucide-react';
import AdminDataTable from '../components/AdminDataTable.jsx';

const formatDate = (value) => value
  ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  : '—';

function StatusPill({ value }) {
  const normalized = String(value || '').toLowerCase();
  const label = ({ ACTIVE: 'Ativo', SUSPENDED: 'Suspenso' })[value] || value || '—';
  const tone = normalized === 'active' ? 'success' : normalized === 'suspended' ? 'danger' : 'neutral';
  return <span className={`l360-admin-pill ${tone}`}>{label}</span>;
}

export default function AdminUsers({ users, search, onSearch, busy, onChangeStatus }) {
  return (
    <section className="l360-admin-panel">
      <div className="l360-admin-panel-head">
        <h3>Contas de usuários</h3>
        <span>{users.length} registros</span>
      </div>
      <div className="l360-admin-search">
        <Search size={16} />
        <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Buscar por nome, e-mail ou empresa" />
      </div>
      <AdminDataTable
        columns={[
          { key: 'user', label: 'Usuário' },
          { key: 'company', label: 'Empresa' },
          { key: 'role', label: 'Perfil' },
          { key: 'status', label: 'Status' },
          { key: 'lastLogin', label: 'Último acesso' },
          { key: 'action', label: 'Ação' },
        ]}
        rows={users}
        emptyMessage="Não encontramos usuários com essa busca."
        renderRow={(user) => (
          <tr key={user.id}>
            <td><strong>{user.name}</strong><small>{user.email}</small></td>
            <td>{user.company?.name || '—'}</td>
            <td>{user.role === 'ADMIN' ? 'Administrador' : user.role}</td>
            <td><StatusPill value={user.status} /></td>
            <td>{formatDate(user.lastLoginAt)}</td>
            <td>
              <button
                type="button"
                className={`l360-admin-action ${user.status === 'ACTIVE' ? 'danger' : 'good'}`}
                disabled={busy || user.role === 'ADMIN'}
                onClick={() => onChangeStatus(user)}
              >
                {user.status === 'ACTIVE' ? 'Suspender' : 'Reativar'}
              </button>
            </td>
          </tr>
        )}
      />
      <p className="l360-admin-note">A promoção de administradores é controlada pela variável ADMIN_EMAILS no servidor. Ela não pode ser concedida por esta tabela.</p>
    </section>
  );
}
