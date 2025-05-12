import React, { useEffect, useState } from 'react';

function MergeTablesModal({ baseTable, onClose }) {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [targetTable, setTargetTable] = useState('');
  const [joinType, setJoinType] = useState('join');
  const [joinKey, setJoinKey] = useState('');

  const [baseColumns, setBaseColumns] = useState([]);
  const [basePreview, setBasePreview] = useState([]);
  const [baseSelected, setBaseSelected] = useState(new Set());

  const [targetColumns, setTargetColumns] = useState([]);
  const [targetPreview, setTargetPreview] = useState([]);
  const [targetSelected, setTargetSelected] = useState(new Set());

  const [commonColumns, setCommonColumns] = useState([]);

  useEffect(() => {
    if (!baseTable?.table_name) return;
    fetch(`${import.meta.env.VITE_API_BASE}/preview_numerical?table_name=${encodeURIComponent(baseTable.table_name)}`)
      .then(r => r.json())
      .then(data => {
        setBaseColumns(data.columns);
        setBasePreview(data.preview);
        setBaseSelected(new Set(data.columns));
      });
  }, [baseTable]);

  useEffect(() => {
    if (!targetTable) return;
    fetch(`${import.meta.env.VITE_API_BASE}/preview_numerical?table_name=${encodeURIComponent(targetTable)}`)
      .then(r => r.json())
      .then(data => {
        setTargetColumns(data.columns);
        setTargetPreview(data.preview);
        setTargetSelected(new Set(data.columns));

        const common = data.columns.filter(col => baseColumns.includes(col));
        setCommonColumns(common);
        if (common.length > 0) setJoinKey(common[0]);
      });
  }, [targetTable, baseColumns]);

  const handleSearch = () => {
    fetch(`${import.meta.env.VITE_API_BASE}/search?word=${encodeURIComponent(searchKeyword)}`)
      .then(r => r.json())
      .then(data => {
        const results = data.results || {};
        const numericalResults = Object.entries(results).flatMap(([category, items]) =>
          items
            .filter(item => item.specific_type === 'numerical')
            .map(item => ({
              label: item.title || item.original_title || item.table_name,
              table_name: item.table_name,
            }))
        );
        setSearchResults(numericalResults);
      });
  };

  const handleDownload = () => {
    const baseCols = Array.from(baseSelected);
    const targetCols = Array.from(targetSelected);
    const url =
      `${import.meta.env.VITE_API_BASE}/download_merge` +
      `?base=${encodeURIComponent(baseTable.table_name)}` +
      `&target=${encodeURIComponent(targetTable)}` +
      `&join_type=${joinType}` +
      `&join_key=${encodeURIComponent(joinKey)}` +
      `&base_cols=${encodeURIComponent(baseCols.join(','))}` +
      `&target_cols=${encodeURIComponent(targetCols.join(','))}`;
    window.open(url, '_blank');
  };

  const toggleCol = (setState, state, col) => {
    const updated = new Set(state);
    updated.has(col) ? updated.delete(col) : updated.add(col);
    setState(updated);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '10px',
          width: '95%',
          maxWidth: '900px',
        }}
      >
        <h3>📌 테이블 병합 및 다운로드</h3>
        <p>
          <b>기준 테이블:</b> {baseTable.table_name}
        </p>

        {basePreview.length > 0 && (
          <>
            <h4>기준 테이블 미리보기</h4>
            <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
              <table>
                <thead>
                  <tr>
                    {baseColumns.map(col => (
                      <th key={col}>
                        <button
                          onClick={() => toggleCol(setBaseSelected, baseSelected, col)}
                          style={{
                            backgroundColor: baseSelected.has(col) ? '#2563eb' : '#e5e7eb',
                            color: baseSelected.has(col) ? 'white' : 'black',
                            borderRadius: '5px',
                            border: 'none',
                            padding: '0.3rem 0.6rem',
                          }}
                        >
                          {col}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {basePreview.map((row, idx) => (
                    <tr key={idx}>
                      {baseColumns.map(col => (
                        <td key={col}>{row[col]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem' }}>
          <input
            value={searchKeyword}
            onChange={e => setSearchKeyword(e.target.value)}
            placeholder="추가 테이블 검색"
            style={{ flex: 1 }}
          />
          <button onClick={handleSearch}>검색</button>
        </div>

        {searchResults.map(item => (
          <button
            key={item.table_name}
            onClick={() => setTargetTable(item.table_name)}
            style={{
              marginRight: '0.5rem',
              marginBottom: '0.5rem',
              padding: '0.3rem 0.6rem',
              border: '1px solid #e5e7eb',
              borderRadius: '5px',
              backgroundColor: targetTable === item.table_name ? '#2563eb' : '#f9fafb',
              color: targetTable === item.table_name ? 'white' : 'black',
            }}
          >
            {item.label}
          </button>
        ))}

        {targetTable && (
          <>
            <p>
              <b>추가 테이블:</b> {targetTable}
            </p>

            <label>
              병합 방식:&nbsp;
              <select value={joinType} onChange={e => setJoinType(e.target.value)}>
                <option value="join">조인</option>
                <option value="concat_h">좌우 병합</option>
                <option value="concat_v">상하 병합</option>
              </select>
            </label>

            {joinType === 'join' && (
              <label>
                &nbsp;&nbsp;조인 기준 컬럼:&nbsp;
                <select value={joinKey} onChange={e => setJoinKey(e.target.value)}>
                  {commonColumns.map(col => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </>
        )}

        {targetPreview.length > 0 && (
          <>
            <h4>추가 테이블 미리보기</h4>
            <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
              <table>
                <thead>
                  <tr>
                    {targetColumns.map(col => (
                      <th key={col}>
                        <button
                          onClick={() => toggleCol(setTargetSelected, targetSelected, col)}
                          style={{
                            backgroundColor: targetSelected.has(col) ? '#2563eb' : '#e5e7eb',
                            color: targetSelected.has(col) ? 'white' : 'black',
                            borderRadius: '5px',
                            border: 'none',
                            padding: '0.3rem 0.6rem',
                          }}
                        >
                          {col}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {targetPreview.map((row, idx) => (
                    <tr key={idx}>
                      {targetColumns.map(col => (
                        <td key={col}>{row[col]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button onClick={onClose}>닫기</button>
          <button onClick={handleDownload} style={{ backgroundColor: '#10b981', color: 'white' }}>
            CSV 다운로드
          </button>
        </div>
      </div>
    </div>
  );
}

export default MergeTablesModal;

