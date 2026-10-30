import React from 'react';

function StatusPill({ active }) {
  return <span className={`l360-admin-pill ${active ? 'success' : 'danger'}`}>{active ? 'Configurado' : 'Não configurado'}</span>;
}

export default function AdminSettings({ system }) {
  return (
    <section className="l360-admin-panel">
      <div className="l360-admin-panel-head">
        <h3>Saúde e configuração do sistema</h3>
        <span><StatusPill active={system?.databaseConnected} /></span>
      </div>
      <div className="l360-admin-system-grid">
        <div><span>Ambiente</span><strong>{system?.environment || '—'}</strong></div>
        <div><span>Versão do Node.js</span><strong>{system?.nodeVersion || '—'}</strong></div>
        <div><span>Fuso horário</span><strong>{system?.timezone || '—'}</strong></div>
        <div><span>Tempo ligado</span><strong>{Math.floor((system?.uptimeSeconds || 0) / 3600)} h</strong></div>
        <div><span>Google Apps Script</span><StatusPill active={system?.gmailScriptConfigured} /></div>
        <div><span>Allowlist de administradores</span><StatusPill active={system?.adminAllowlistConfigured} /></div>
        <div><span>URL do frontend</span><StatusPill active={system?.frontendUrlConfigured} /></div>
        <div><span>PostgreSQL</span><StatusPill active={system?.databaseConnected} /></div>
      </div>
      <p className="l360-admin-note">Por segurança, esta tela mostra apenas se as integrações estão configuradas. Senhas, tokens, URLs privadas e conteúdo de variáveis secretas nunca são exibidos.</p>
    </section>
  );
}
