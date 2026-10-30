import React from 'react';

export default function AdminCharts({ subscriptions = [] }) {
  const counts = subscriptions.reduce((result, subscription) => {
    const name = subscription.plan?.name || 'Sem plano';
    result[name] = (result[name] || 0) + 1;
    return result;
  }, {});

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, count]) => count));

  return (
    <section className="l360-admin-panel">
      <div className="l360-admin-panel-head">
        <h3>Assinaturas por plano</h3>
        <span>{subscriptions.length} no total</span>
      </div>
      {entries.length ? (
        <div className="l360-admin-chart-list">
          {entries.map(([name, count]) => (
            <div className="l360-admin-chart-row" key={name}>
              <div className="l360-admin-chart-label">
                <span>{name}</span>
                <strong>{count}</strong>
              </div>
              <div className="l360-admin-chart-track" aria-label={`${count} assinaturas`}>
                <div
                  className="l360-admin-chart-fill"
                  style={{ width: `${(count / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="l360-admin-empty">As assinaturas aparecerão aqui quando houver planos vinculados.</div>
      )}
    </section>
  );
}
