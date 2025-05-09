// src/pages/HomePage.jsx
import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import { Bar } from 'react-chartjs-2';
import InfoModal from '../components/InfoModal';
import exampleImg from '../assets/example.jpg';

/* fetch 래퍼 ------------------------------------------------------ */
const fetchWithAuth = async (url, opts = {}) => {
  const t = localStorage.getItem('token');
  const h = { ...(opts?.headers || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) };
  const r = await fetch(url, { ...opts, headers: h, credentials: 'include' });
  return { ok: r.ok, data: await r.json() };
};

/* 색상 헬퍼 – idx가 커질수록 연해짐 ------------------------------- */
const indigo = (i) => `rgba(99,102,241,${1 - i * 0.15})`; // indigo-500

export default function HomePage() {
  const vizRef = useRef(null);

  /* ─ state ─ */
  const [showViz, setShowViz] = useState(false);
  const [modalCard, setModalCard] = useState(null);
  const [region, setRegion] = useState('정릉3동');
  const navigate = useNavigate();

  useEffect(() => {
    const stored = localStorage.getItem('selectedRegion');
    if (stored) setRegion(stored);
  }, []);

  const regionDataMap = {
    '정릉3동': { upload: 120, video: 42, doc: 78, image: 200 },
    '정릉1동': { upload: 95, video: 30, doc: 55, image: 180 },
    '길음동': { upload: 63, video: 20, doc: 40, image: 130 }
  };

  const data = regionDataMap[region] || regionDataMap['정릉3동'];

  const [globalStats, setGlobalStats] = useState(null);
  const [localStats, setLocalStats] = useState(null);

  const [regionChart, setRegionChart] = useState(null);   // 세로 bar
  const [keywordChart, setKeywordChart] = useState(null); // 가로 bar
  const [villageRows, setVillageRows] = useState([]);

  const fmt = (n) => (n ?? 0).toLocaleString();

  /* 첫 로딩 ------------------------------------------------------- */
  useEffect(() => {
    (async () => {
      const auth   = await fetchWithAuth(`${import.meta.env.VITE_API_BASE}/region_file_count_auth`);
      if (auth.ok) setLocalStats(auth.data);

      const global = await fetchWithAuth(`${import.meta.env.VITE_API_BASE}/region_file_count`);
      if (global.ok) setGlobalStats(global.data);

      const [regions, keywords, villages] = await Promise.all([
        fetchWithAuth(`${import.meta.env.VITE_API_BASE}/region_uploads`),
        fetchWithAuth(`${import.meta.env.VITE_API_BASE}/top_keywords`),
        fetchWithAuth(`${import.meta.env.VITE_API_BASE}/village_uploads`),
      ]);

      /* 지역별 업로드 수 */
      if (regions.ok) {
        const rows = regions.data.data; // {region,district,count}
        setRegionChart({
          labels: rows.map((r) => `${r.region} ${r.district}`),
          datasets: [
            {
              data: rows.map((r) => r.count),
              backgroundColor: rows.map((_, i) => indigo(i)),
              borderRadius: 6,
              borderSkipped: false,
            },
          ],
        });
      }

      /* 키워드 TOP20 */
      if (keywords.ok) {
        const rows = keywords.data.data; // {tag,count}
        setKeywordChart({
          labels: rows.map((r) => r.tag),
          datasets: [
            {
              data: rows.map((r) => r.count),
              backgroundColor: rows.map((_, i) => indigo(i)),
              borderRadius: 6,
              borderSkipped: false,
            },
          ],
        });
      }

      if (villages.ok) setVillageRows(villages.data.data);
    })();
  }, []);

  /* 카드용 통계 --------------------------------------------------- */
  const refStats = localStats ?? globalStats;
  const cnt      = refStats?.type_counts || {};
  const localLabel = localStats
    ? `${localStats.region} ${localStats.district}`
    : '전체 데이터';

  /* 차트 공통 옵션 ------------------------------------------------ */
  const axisStyle = {
    ticks: { color: '#6b7280', font: { size: 12 } },
    grid:  { color: '#e5e7eb', borderDash: [4, 4] },
  };

  const regionOpts = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { ...axisStyle, beginAtZero: true },
      y: { ...axisStyle },
    },
    animation: { duration: 600 },
  };

  const keywordOpts = {
    responsive: true,
    indexAxis: 'y',
    plugins: { legend: { display: false } },
    scales: {
      x: { ...axisStyle, beginAtZero: true },
      y: { ...axisStyle },
    },
    animation: { duration: 600 },
  };

  /* 스크롤 ------------------------------------------------------- */
  const handleScrollToViz = () => {
    setShowViz(true);
    setTimeout(() => vizRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  /* --------------------------- JSX ------------------------------ */
  return (
    <div className="bg-gradient-to-b from-sky-50 to-slate-50 min-h-screen">
      {/* Hero */}
      <section className="text-center py-16 px-6">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4 leading-snug">
          지역을 데이터로 기억하다<br />
          <span className="text-indigo-600">Archive ON</span>
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          마을의 일상과 기억을 데이터로 기록하고 나누는 플랫폼입니다.
        </p>
        <div className="flex justify-center gap-4">
          <Link to="/upload"
                className="bg-indigo-700 text-white px-6 py-3 rounded-full hover:bg-indigo-800 transition">파일 업로드</Link>
          <button onClick={handleScrollToViz}
                  className="border border-indigo-700 text-indigo-700 px-5 py-2.5 rounded-full
                             hover:bg-indigo-100 hover:scale-105 transition-transform">
            데이터 시각화 보기
          </button>
        </div>
      </section>

      {/* 카드 3개 */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 px-8 pb-20">
        {/* 우리 동네 / 전체 */}
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
          ) : (
            <p className="text-sm text-gray-500">데이터를 불러오는 중…</p>
          )}
        </div>

        {/* 아카이브 성과 */}
        <div className="bg-indigo-100 rounded-xl p-6 hover:shadow-md transition">
          <h2 className="text-lg font-semibold mb-4">아카이브 성과</h2>
          {globalStats ? (
            <p className="text-sm text-gray-700">
              업로드된 콘텐츠:<span className="font-bold text-orange-600"> {fmt(globalStats.total)}건</span>
            </p>
          ) : (
            <p className="text-sm text-gray-500">데이터를 불러오는 중…</p>
          )}
        </div>

        {/* 데이터 스토리 */}
        <div className="bg-pink-100 rounded-xl p-6 hover:shadow-md transition cursor-pointer"
             onClick={() => setModalCard('story')}>
          <h2 className="text-lg font-semibold mb-2">데이터 스토리</h2>
          <p className="text-sm mb-2">우리가 기록한 이야기들을 확인해보세요.</p>
          <ul className="text-xs text-gray-700 list-disc list-inside space-y-1">
            <li>로컬 데이터의 의미</li>
            <li>마을 사례 이야기</li>
            <li>주민 참여 경험</li>
          </ul>
        </div>
      </section>

      {/* 시각화 */}
      {showViz && (
        <section ref={vizRef} className="bg-white py-20 border-t border-gray-200 px-6">
          <h2 className="text-2xl font-bold text-center mb-10 text-gray-800">📊 마을 데이터를 한눈에</h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {/* 지역별 업로드 수(세로 bar) */}
            <div className="bg-white rounded-xl p-6 shadow">
              <h3 className="text-lg font-bold mb-6 text-gray-800">지역별 업로드 수</h3>
              {regionChart
                ? <Bar data={regionChart} options={regionOpts} height={300} />
                : <p className="text-sm text-gray-500">로딩…</p>}
            </div>

            {/* 많이 등장한 키워드(가로 bar) */}
            <div className="bg-gray-50 rounded-xl p-6 shadow">
              <h3 className="text-lg font-semibold mb-4 text-gray-700">🔥 많이 등장한 키워드</h3>
              {keywordChart
                ? <Bar data={keywordChart} options={keywordOpts} height={300} />
                : <p className="text-sm text-gray-500">로딩…</p>}
            </div>
          </div>

          {/* 지도용 테이블 */}
          <div className="bg-gray-100 rounded-xl p-6 shadow mt-10">
            <h3 className="text-lg font-semibold mb-4 text-gray-700 text-center">📍 데이터 지도</h3>
            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-sm">
                <thead className="bg-gray-200 sticky top-0">
                  <tr>
                    <th className="px-2 py-1">시/도</th>
                    <th className="px-2 py-1">시/군/구</th>
                    <th className="px-2 py-1">업로드 수</th>
                  </tr>
                </thead>
                <tbody>
                  {villageRows.map((r) => (
                    <tr key={`${r.region}-${r.district}`} className="odd:bg-white even:bg-gray-50">
                      <td className="px-2 py-1 whitespace-nowrap">{r.region}</td>
                      <td className="px-2 py-1 whitespace-nowrap">{r.district}</td>
                      <td className="px-2 py-1 text-right">{fmt(r.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {modalCard && <InfoModal cardType={modalCard} onClose={() => setModalCard(null)} />}
    </div>
  );
}
