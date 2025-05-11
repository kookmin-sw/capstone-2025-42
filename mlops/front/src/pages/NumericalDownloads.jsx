import React, { useEffect, useState } from 'react';

function NumericalDownloads({ tableName, title, onClose }) {
  const [columns, setColumns] = useState([]);
  const [preview, setPreview] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [sorts, setSorts] = useState([]);

  useEffect(() => {
    if (!tableName) return;
    fetch(`${import.meta.env.VITE_API_BASE}/preview_numerical?` +
            `table_name=${encodeURIComponent(tableName)}` +
            `&title=${encodeURIComponent(title)}`)
      .then(res => res.json())
      .then(data => {
        console.log("📢 전달되는 테이블명:", title);
        if (data.columns && data.preview) {
          setColumns(data.columns);
          setPreview(data.preview);
          setSelected(new Set(data.columns));
        }
      });
  }, [tableName, title]);

  const toggleColumn = (col) => {
    const updated = new Set(selected);
    updated.has(col) ? updated.delete(col) : updated.add(col);
    setSelected(updated);
  };

  const toggleSort = (col) => {
    setSorts(prev => {
      const existing = prev.find(s => s.col === col);
      if (!existing) return [...prev, { col, order: 'asc' }];
      if (existing.order === 'asc') return prev.map(s => s.col === col ? { ...s, order: 'desc' } : s);
      return prev.filter(s => s.col !== col);
    });
  };

  const getSortIndex = (col) => sorts.findIndex(s => s.col === col);

  const sortedPreview = [...preview].sort((a, b) => {
    for (const { col, order } of sorts) {
      const aVal = a[col];
      const bVal = b[col];
      if (aVal === bVal) continue;
      return order === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    }
    return 0;
  });

  const handleDownload = () => {
    const cols = Array.from(selected);
    const sortParams = sorts.map(s => `${s.col}:${s.order}`).join(',');
    const url = `${import.meta.env.VITE_API_BASE}/download_numerical_filtered` +
      `?table_name=${encodeURIComponent(tableName)}` +
      `&title=${encodeURIComponent(title)}` +
      `&columns=${encodeURIComponent(cols.join(','))}` +
      `&sort=${encodeURIComponent(sortParams)}`;
    window.open(url, '_blank');
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '1rem',
        borderRadius: '10px',
        width: '95%',
        maxWidth: '95%',
        maxHeight: '90vh',
        overflow: 'auto',
      }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 'bold' }}>
          {title} - 컬럼 선택 및 정렬
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
            <thead>
              <tr>
                {columns.map(col => {
                  const sortIdx = getSortIndex(col);
                  const sortInfo = sorts[sortIdx];
                  const sortLabel = sortInfo
                    ? (sortInfo.order === 'asc' ? `↑(${sortIdx + 1})` : `↓(${sortIdx + 1})`)
                    : '정렬';

                  return (
                    <th key={col} style={{ padding: '0.5rem', borderBottom: '1px solid #ccc' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <button
                          onClick={() => toggleColumn(col)}
                          style={{
                            padding: '0.3rem 0.6rem',
                            borderRadius: '5px',
                            backgroundColor: selected.has(col) ? '#2563eb' : '#e5e7eb',
                            color: selected.has(col) ? 'white' : 'black',
                            border: 'none',
                            cursor: 'pointer',
                            marginBottom: '4px'
                          }}
                        >
                          {col}
                        </button>
                        <button
                          onClick={() => toggleSort(col)}
                          style={{
                            fontSize: '0.75rem',
                            color: '#333',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          {sortLabel}
                        </button>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedPreview.map((row, idx) => (
                <tr key={idx}>
                  {columns.map(col => (
                    <td key={col} style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>
                      {row[col]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 1rem', border: '1px solid #ccc', borderRadius: '5px' }}>
            닫기
          </button>
          <button onClick={handleDownload} style={{ padding: '0.5rem 1rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '5px' }}>
            CSV 다운로드
          </button>
        </div>
      </div>
    </div>
  );
}

export default NumericalDownloads;
