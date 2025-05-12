import React, { useEffect, useState, useCallback } from 'react';

/**
 * NumericalDownloads
 *
 * - 미리보기 + 컬럼 체크박스 + 다중 정렬 UI
 * - "CSV 다운로드" 시 열·정렬 파라미터를 쿼리로 전달하여 필터링된 CSV 제공
 *
 * ⚠️ 전달받는 tableName(title에 보이지 않는 비밀 HEX 포함)이 백엔드의 실제 테이블과 달라
 *     404 가 나는 경우가 있었음.
 *   👉 title 로 다시 검색해 table_name 을 재해석하는 자동 보정 로직을 추가.
 */
function NumericalDownloads({ tableName, title, onClose }) {
  /** 실제 백엔드가 인식하는 테이블명 */
  const [resolvedTable, setResolvedTable] = useState(tableName || '');

  const [columns, setColumns]   = useState([]);
  const [preview, setPreview]   = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [sorts, setSorts]       = useState([]);

  /**
   * 백엔드에 미리보기 요청
   * 만약 컬럼이 비어있으면 title 로 검색해 table_name 을 찾아 재시도
   */
  const fetchPreview = useCallback(async tbl => {
    if (!tbl) return;

    const tryPreview = async t => {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE}/preview_numerical?table_name=${encodeURIComponent(t)}` +
          `&title=${encodeURIComponent(title)}`
      );
      if (!res.ok) throw new Error('preview fetch failed');
      return res.json();
    };

    try {
      const data = await tryPreview(tbl);
      if (data.columns?.length) {
        setColumns(data.columns);
        setPreview(data.preview);
        setSelected(new Set(data.columns));
        setResolvedTable(tbl);
        return;
      }
      throw new Error('empty columns');
    } catch (e) {
      /* title 로 재검색 */
      try {
        const searchRes = await fetch(
          `${import.meta.env.VITE_API_BASE}/search?word=${encodeURIComponent(title)}`
        );
        const searchJson = await searchRes.json();
        const results = searchJson.results || {};
        const flat = Object.values(results).flat();
        const hit = flat.find(item => item.title === title || item.original_title === title);
        if (hit?.table_name) {
          await fetchPreview(hit.table_name);
        } else {
          console.error('테이블 이름 재해석 실패');
        }
      } catch (err) {
        console.error('preview & search error', err);
      }
    }
  }, [title]);

  /* 최초 & tableName 변경 시 */
  useEffect(() => {
    fetchPreview(tableName);
  }, [tableName, fetchPreview]);

  /* ---------- UI 헬퍼 ---------- */
  const toggleColumn = col => {
    const next = new Set(selected);
    next.has(col) ? next.delete(col) : next.add(col);
    setSelected(next);
  };

  const toggleSort = col => {
    setSorts(prev => {
      const idx = prev.findIndex(s => s.col === col);
      if (idx === -1) return [...prev, { col, order: 'asc' }];
      if (prev[idx].order === 'asc') return prev.map((s, i) => i === idx ? { ...s, order: 'desc' } : s);
      return prev.filter((_, i) => i !== idx);
    });
  };
  const getSortIndex = col => sorts.findIndex(s => s.col === col);

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
    const cols       = Array.from(selected).join(',');
    const sortParams = sorts.map(s => `${s.col}:${s.order}`).join(',');

    const url = `${import.meta.env.VITE_API_BASE}/download_numerical_filtered` +
      `?table_name=${encodeURIComponent(resolvedTable)}` +
      `&title=${encodeURIComponent(title)}` +
      `&columns=${encodeURIComponent(cols)}` +
      `&sort=${encodeURIComponent(sortParams)}`;
    window.open(url, '_blank');
  };

  /* ---------- Render ---------- */
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: '#fff',
          padding: '1rem',
          borderRadius: '10px',
          width: '95%',
          maxWidth: '95%',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 700 }}>
          {title} - 컬럼 선택 및 정렬
        </h3>

        {/* ---- PREVIEW TABLE ---- */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
            <thead>
              <tr>
                {columns.map(col => {
                  const idx       = getSortIndex(col);
                  const sortInfo  = idx > -1 ? sorts[idx] : null;
                  const sortLabel = sortInfo ? (sortInfo.order === 'asc' ? `↑(${idx + 1})` : `↓(${idx + 1})`) : '정렬';

                  return (
                    <th key={col} style={{ padding: '0.5rem', borderBottom: '1px solid #ccc' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <button
                          onClick={() => toggleColumn(col)}
                          style={{
                            padding: '0.3rem 0.6rem',
                            borderRadius: 5,
                            background: selected.has(col) ? '#2563eb' : '#e5e7eb',
                            color: selected.has(col) ? '#fff' : '#000',
                            border: 'none',
                            marginBottom: 4,
                            cursor: 'pointer',
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
                            cursor: 'pointer',
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

        {/* ---- ACTION BUTTONS ---- */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button
            onClick={onClose}
            style={{ padding: '0.5rem 1rem', border: '1px solid #ccc', borderRadius: 5 }}
          >
            닫기
          </button>
          <button
            onClick={handleDownload}
            style={{ padding: '0.5rem 1rem', background: '#10b981', color: '#fff', border: 'none', borderRadius: 5 }}
          >
            CSV 다운로드
          </button>
        </div>
      </div>
    </div>
  );
}

export default NumericalDownloads;

