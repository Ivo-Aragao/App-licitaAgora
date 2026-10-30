import React from 'react';
import { Search } from 'lucide-react';
import AdminDataTable from '../components/AdminDataTable.jsx';

function StatusPill({ value }) {
  const normalized = String(value || '').toLowerCase();
  const label = ({ ACTIVE: 'Ativa', SUSPENDED: 'Suspensa' })[value] || value || '—';
  const tone = normalized === 'active' ? 'success' : normalized === 'suspended' ? 'danger' : 'neutral';
  return <span className={`l360-admin-pill ${tone}`}>{label}</span>;
}

export default function AdminCompanies({ companies, search, onSearch, busy, onChangeStatus }) {
  return (
    <section className="l360-admin-panel">
      <div className="l360-admin-panel-head">
        <h3>Empresas cadastradas</h3>
        <span>{companies.length} registros</span>
      </div>
      <div className="l360-admin-search">
        <Search size={16} />
        <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Buscar por razão social ou CNPJ" />
      </div>
      <AdminDataTable
        columns={[
          { key: 'company', label: 'Empresa' },
          { key: 'uf', label: 'UF' },
          { key: 'users', label: 'Usuários' },
          { key: 'opportunities', label: 'Processos' },
          { key: 'plan', label: 'Plano' },
          { key: 'status', label: 'Status' },
          { key: 'action', label: 'Ação' },
        ]}
        rows={companies}
        renderRow={(company) => (
          <tr key={company.id}>
            <td><strong>{company.name}</strong><small>{company.cnpj || 'CNPJ não informado'}</small></td>
            <td>{company.uf || '—'}</td>
            <td>{company._count?.users ?? 0}</td>
            <td>{company._count?.opportunities ?? 0}</td>
            <td>{company.subscription?.plan?.name || 'Sem plano'}</td>
            <td><StatusPill value={company.status} /></td>
            <td>
              <button
                type="button"
                className={`l360-admin-action ${company.status === 'ACTIVE' ? 'danger' : 'good'}`}
                disabled={busy}
                onClick={() => onChangeStatus(company)}
              >
                {company.status === 'ACTIVE' ? 'Suspender' : 'Reativar'}
              </button>
            </td>
          </tr>
        )}
      />
      <p className="l360-admin-note">A suspensão da empresa bloqueia o acesso dos usuários comuns vinculados a ela. Administradores da plataforma continuam podendo acessar a central.</p>
    </section>
  );
}
