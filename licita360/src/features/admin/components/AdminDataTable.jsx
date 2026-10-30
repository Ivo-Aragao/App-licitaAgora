import React from 'react';

export default function AdminDataTable({
  columns,
  rows,
  rowKey = 'id',
  emptyMessage = 'Nenhum registro encontrado.',
  renderRow,
}) {
  return (
    <div className="l360-admin-table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <React.Fragment key={row[rowKey] ?? index}>
              {renderRow ? renderRow(row, index) : (
                <tr>
                  {columns.map((column) => (
                    <td key={column.key}>
                      {typeof column.render === 'function'
                        ? column.render(row)
                        : (row[column.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              )}
            </React.Fragment>
          ))}
          {!rows.length ? (
            <tr>
              <td colSpan={Math.max(columns.length, 1)}>
                <div className="l360-admin-empty">{emptyMessage}</div>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
