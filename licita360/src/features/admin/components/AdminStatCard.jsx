import React from 'react';

export default function AdminStatCard({ icon: Icon, label, value, note }) {
  return (
    <article className="l360-admin-metric">
      <div className="l360-admin-metric-icon">
        {Icon ? <Icon size={19} /> : null}
      </div>
      <span>{label}</span>
      <strong>{value ?? '—'}</strong>
      {note ? <small>{note}</small> : null}
    </article>
  );
}
