import React from 'react';
import {
  Building2,
  CircleDollarSign,
  FileClock,
  LayoutDashboard,
  Mail,
  Settings2,
  UserCheck,
  Users,
  Zap,
} from 'lucide-react';

const MENU = [
  { id: 'overview', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'users', label: 'Usuários', icon: Users },
  { id: 'companies', label: 'Empresas', icon: Building2 },
  { id: 'plans', label: 'Planos', icon: CircleDollarSign },
  { id: 'subscriptions', label: 'Assinaturas', icon: UserCheck },
  { id: 'automation', label: 'Automações', icon: Zap },
  { id: 'notifications', label: 'Notificações', icon: Mail },
  { id: 'audit', label: 'Auditoria', icon: FileClock },
  { id: 'system', label: 'Sistema', icon: Settings2 },
];

export default function AdminSidebar({ active, onChange }) {
  return (
    <nav className="l360-admin-nav" aria-label="Navegação administrativa">
      {MENU.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className={active === id ? 'active' : ''}
          aria-current={active === id ? 'page' : undefined}
          onClick={() => onChange(id)}
        >
          <Icon size={17} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

export { MENU };
