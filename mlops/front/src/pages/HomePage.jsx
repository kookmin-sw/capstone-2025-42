// src/pages/HomePage.jsx
import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import { Bar } from 'react-chartjs-2';

/* fetch 래퍼 ------------------------------------------------------ */
const fetchWithAuth = async (url, opts = {}) => {
  const token = localStorage.getItem('token');
  const hdrs  = { ...(opts?.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const res   = await fetch(url, { ...opts, headers: hdrs, credentials: 'include' });
  return { ok: res.ok, data: await res.json() };
};

/* 색상 헬퍼 ------------------------------------------------------- */
const indigo = (i) => `rgba(99,102,241,${1 - i * 0.15})`;

export default function HomePage() {
  const vizRef = useRef(null);

  /* 상태 ---------------------------------------------------------- */
  const [loggedIn,   setLoggedIn]   = useState(null);        // 로그인 여부
  const [showViz,    setShowViz]    = useState(false);
  const [modalCard,  setModalCard]  = useState(null);

  const [globalStats, setGlobalStats] = useState(null);
  const [localStats,  setLocalStats]  = useState(null);

  const [regionChart,  setRegionChart]  = useState(null);
  const [keywordChart, setKeywordChart] = useState(null);
  const [metrics,      setMetrics]      = useState(null);
  const [story,        setStory]        = useState({ title: '스토리가 없습니다', description: '' });

  const fmt = (n) => (n ?? 0).toLocaleString();

  /* 첫 로딩 ------------------------------------------------------- */
  useEffect(() => {
    /* 0) 로그인 상태 확인 */
    fetch(`${import.meta.env.VITE_API_BASE}/api/me`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(() => setLoggedIn(true))
      .catch(() => setLoggedIn(false));

    /* 1) 메트릭 + 스토리 + 통계 + 차트 */
    (async () => {
      const mt = await fetchWithAuth(`${import.meta.env.VITE_API_BASE}/api/archive_metrics`);
      if (mt.ok) setMetrics(mt.data);

      const s = await fetchWithAuth(`${import.meta.env.VITE_API_BASE}/api/random_story`);
      if (s.ok && s.data.status === 'success') setStory(s.data);

      const auth = await fetchWithAuth(`${import.meta.env.VITE_API_BASE}/region_file_count_auth`);
      if (auth.ok) setLocalStats(auth.data);

      const global = await fetchWithAuth(`${import.meta.env.VITE_API_BASE}/region_file_count`);
      if (global.ok) setGlobalStats(global.data);

      const [regions, keywords] = await Promise.all([
        fetchWithAuth(`${import.meta.env.VITE_API_BASE}/region_uploads`),
        fetchWithAuth(`${import.meta.env.VITE_API_BASE}/top_keywords`),
      ]);

      if (regions.ok) {
        const rows = regions.data.data;
        setRegionChart({
          labels: rows.map((r) => `${r.region} ${r.district}`),
          datasets: [{
            data: rows.map((r) => r.count),
            backgroundColor: rows.map((_, i) => indigo(i)),
            borderRadius: 6,
            borderSkipped: false,
          }],
        });
      }

      if (keywords.ok) {
        const rows = keywords.data.data;
        setKeywordChart({
          labels: rows.map((r) => r.tag),
          datasets: [{
            data: rows.map((r) => r.count),
            backgroundColor: rows.map((_, i) => indigo(i)),
            borderRadius: 6,
            borderSkipped: false,
          }],
        });
      }
    })();
  }, []);

  /* 카드용 데이터 ------------------------------------------------- */
  const refStats   = localStats ?? globalStats;
  const cnt        = refStats?.type_counts || {};
  const localLabel = localStats ? `${localStats.region} ${localStats.district}` : '전체 데이터';

  /* 차트 옵션 ----------------------------------------------------- */
  const axis = {
    ticks: { color: '#6b7280', font: { size: 12 } },
    grid : { color: '#e5e7eb', borderDash: [4,4] },
  };
  const regionOpts  = { responsive:true, plugins:{legend:{display:false}}, scales:{x:{...axis,beginAtZero:true},y:axis}, animation:{duration:600}};
  const keywordOpts = { ...regionOpts, indexAxis:'y' };

  const handleScrollToViz = () => {
    setShowViz(true);
    setTimeout(() => vizRef.current?.scrollIntoView({ behavior:'smooth' }), 100);
  };

  /* ----------------------------- JSX ---------------------------- */
  return (
    <div className="bg-gradient-to-b from-sky-50 to-slate-50 min-h-screen">
      {/* Hero ------------------------------------------------------ */}
      <section className="text-center py-16 px-6">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4 leading-snug">
          지역을 데이터로 기억하다<br /><span className="text-indigo-600">Archive ON</span>
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          마을의 일상과 기억을 데이터로 기록하고 나누는 플랫폼입니다.
        </p>

        <div className="flex flex-wrap justify-center gap-4">
          {loggedIn && (
            <Link to="/upload"
                  className="bg-indigo-700 text-white px-6 py-2.5 rounded-full hover:bg-indigo-800 transition">
              파일 업로드
            </Link>
          )}

          <button onClick={handleScrollToViz}
                  className="border border-indigo-700 text-indigo-700 px-5 py-2.5 rounded-full
                             hover:bg-indigo-100 hover:scale-105 transition-transform">
            데이터 시각화 보기
          </button>
        </div>
      </section>

      {/* 카드 3개 --------------------------------------------------- */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 px-8 pb-20">
        {/* 1) 우리 동네 요약 */}
        <div className="bg-white shadow rounded-xl p-6 hover:shadow-lg transition cursor-pointer"
             onClick={() => setModalCard('summary')}>
          <h2 className="text-lg font-semibold mb-2">{localLabel} 데이터 요약</h2>
          {refStats ? (
            <ul className="text-sm text-gray-700 space-y-2">
              <li>📍 업로드 총계:<span className="font-bold text-blue-600"> {fmt(refStats.total)}건</span></li>
              <li>🎥 영상 자료:<span className="font-bold text-red-500"> {fmt(cnt.video)}</span></li>
              <li>📄 문서 자료:<span className="font-bold text-gray-600"> {fmt(cnt.text)}</span></li>
              <li>🖼️ 이미지 자료:<span className="font-bold text-green-600"> {fmt(cnt.image)}</span></li>
            </ul>
          ) : <p className="text-sm text-gray-500">데이터를 불러오는 중…</p>}
        </div>

        {/* 2) 아카이브 성과 */}
        <div className="bg-indigo-100 rounded-xl p-6 hover:shadow-md transition">
          <h2 className="text-lg font-semibold mb-4">아카이브 성과</h2>
          {metrics ? (
            <ul className="text-sm text-gray-700 space-y-1">
              <li>업로드된 콘텐츠:
                <span className="font-bold text-orange-600"> {fmt(metrics.total)}건</span>
              </li>
              <li>분석 완료율:
                <span className="font-bold text-green-600"> {metrics.completion_rate}%</span>
              </li>
            </ul>
          ) : <p className="text-sm text-gray-500">데이터를 불러오는 중…</p>}
        </div>

        {/* 3) 데이터 스토리 */}
        <div className="bg-pink-100 rounded-xl p-6 hover:shadow-md transition cursor-pointer"
             onClick={() => setModalCard('story')}>
          <h2 className="text-lg font-semibold mb-2">데이터 스토리</h2>
          <p className="text-sm mb-2">우리가 기록한 이야기들을 확인해보세요.</p>
          <ul className="text-xs text-gray-700 list-disc list-inside space-y-1 pb-3">
            <li>로컬 데이터의 의미</li>
            <li>마을 사례 이야기</li>
            <li>주민 참여 경험</li>
          </ul>
          <div className="bg-white p-3 rounded-lg shadow-sm text-sm">
            <p className="font-semibold truncate">📷 {story.title}</p>
            <p className="text-gray-500 truncate text-xs mt-1">{story.description}</p>
          </div>
        </div>
      </section>

      {/* 시각화 ----------------------------------------------------- */}
      {showViz && (
        <section ref={vizRef} className="bg-white py-20 border-t border-gray-200 px-6">
          <h2 className="text-2xl font-bold text-center mb-10 text-gray-800">📊 마을 데이터를 한눈에</h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            <div className="bg-white rounded-xl p-6 shadow">
              <h3 className="text-lg font-bold mb-6 text-gray-800">지역별 업로드 수</h3>
              {regionChart ? <Bar data={regionChart} options={regionOpts} height={300} />
                           : <p className="text-sm text-gray-500">로딩…</p>}
            </div>

            <div className="bg-gray-50 rounded-xl p-6 shadow">
              <h3 className="text-lg font-semibold mb-4 text-gray-700">🔥 많이 등장한 키워드</h3>
              {keywordChart ? <Bar data={keywordChart} options={keywordOpts} height={300} />
                            : <p className="text-sm text-gray-500">로딩…</p>}
            </div>
          </div>

        </section>
      )}
    </div>
  );
}
