// src/pages/SearchPage.jsx
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import NumericalDownloads from './NumericalDownloads.jsx';
import MergeTablesModal from './MergeTablesModal.jsx';

/* ─────────── 파일 유형 매핑 ─────────── */
const FILE_TYPE_MAP = { text: '문서', video: '영상', image: '이미지' };
const dataTypes   = ['전체', ...Object.values(FILE_TYPE_MAP)];
const sortOptions = ['제목순', '최신순', '지역순'];

/* 카테고리 → 이모지 */
const CATEGORY_EMOJI_MAP = {
  건강: '🩺', 동물: '🐐', 식품: '🍽️', 문화: '🎭',
  생활: '🍳', 자원환경: '🌿', 기타: '➕',
  };

/* ───── fetch 래퍼 (세션 쿠키만) ───── */
const fetchWithSession = async (url, opts = {}) => {
  const res = await fetch(url, { ...opts, credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export default function SearchPage() {
  const navigate = useNavigate();

  /* 로그인 여부: /api/me 로 판정 ---------------- */
  const [loggedIn, setLoggedIn] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        await fetchWithSession(`${import.meta.env.VITE_API_BASE}/api/me`);
        setLoggedIn(true);
      } catch {
        setLoggedIn(false);
      }
    })();
  }, []);

  /* 데이터 상태 ------------------------------ */
  const [regionData, setRegionData]            = useState({ '시도(전체)': ['시군구(전체)'] });
  const [categories, setCategories]            = useState([]);
  const [categoryDataMap, setCategoryDataMap]  = useState({});

  /* 선택 상태 ------------------------------- */
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchKeyword, setSearchKeyword]       = useState('');
  const [selectedRegion, setSelectedRegion]     = useState('시도(전체)');
  const [selectedDistrict, setSelectedDistrict] = useState('시군구(전체)');
  const [selectedDataType, setSelectedDataType] = useState('전체');
  const [selectedSort, setSelectedSort]         = useState('최신순');
  const [relatedWords, setRelatedWords]         = useState([]);
  const [loading, setLoading]                   = useState(false);
  const [selectedNumerical, setSelectedNumerical] = useState(null);
  const [mergeTable, setMergeTable]             = useState(null);
  const [selectedFile, setSelectedFile]         = useState(null);

  const typeKor2Key = (kor) =>
    Object.entries(FILE_TYPE_MAP).find(([, v]) => v === kor)?.[0];

  /* ① 지역 데이터 --------------------------- */
  useEffect(() => {
    (async () => {
      try {
        const data = await fetchWithSession(`${import.meta.env.VITE_API_BASE}/api/regions`);
        setRegionData({ '시도(전체)': ['시군구(전체)'], ...data });
      } catch (err) { console.error('지역 데이터 로드 오류:', err); }
    })();
  }, []);

  /* ② 카테고리 목록 ------------------------- */
  useEffect(() => {
    (async () => {
      try {
        const data = await fetchWithSession(`${import.meta.env.VITE_API_BASE}/get_categories`);
        setCategories(data);        // [{ name, count }]
      } catch (err) { console.error('카테고리 로드 오류:', err); }
    })();
  }, []);

  /* ③ 선택 카테고리 데이터 ------------------ */
  useEffect(() => {
    if (!selectedCategory || categoryDataMap[selectedCategory]) return;
    (async () => {
      setLoading(true);
      try {
        const url = new URL(`${import.meta.env.VITE_API_BASE}/search_by_category`);
        url.searchParams.set('category', selectedCategory);
        const data = await fetchWithSession(url);
        setCategoryDataMap((p) => ({ ...p, [selectedCategory]: data }));
      } catch (err) { console.error('카테고리 데이터 로드 오류:', err); }
      finally { setLoading(false); }
    })();
  }, [selectedCategory, categoryDataMap]);

  /* ④ /search 실행 ------------------------- */
  const handleSearch = useCallback(async (keyword = searchKeyword) => {
    if (!keyword.trim()) return;

    const url = new URL(`${import.meta.env.VITE_API_BASE}/search`);
    url.searchParams.set('word', keyword.trim());
    if (selectedSort === '제목순')      url.searchParams.set('order', 'name');
    else if (selectedSort === '최신순') url.searchParams.set('order', 'recent');
    if (selectedDataType !== '전체')
      url.searchParams.set('exp', typeKor2Key(selectedDataType) || 'all');

    setLoading(true);
    try {
      const { results, related_word } = await fetchWithSession(url);

      const newCats = Object.keys(results).map((name) => ({
        name, count: results[name].length,
      }));
      setCategories(newCats);
      setCategoryDataMap(results);
      setSelectedCategory(null);          // 검색 시 선택 해제
      setRelatedWords(related_word);
    } catch (err) { console.error('검색 오류:', err); }
    finally { setLoading(false); }
  }, [searchKeyword, selectedSort, selectedDataType]);

  /* ⑤ 필터·정렬 ----------------------------- */
  const filteredData = useMemo(() => {
    /* 선택 없음 → 모든 카테고리 데이터 합침 */
    let data = selectedCategory
      ? categoryDataMap[selectedCategory] || []
      : Object.values(categoryDataMap).flat();

    /* 지역·타입 필터 */
    if (selectedRegion !== '시도(전체)')
      data = data.filter((i) => i.region === selectedRegion);
    if (selectedDistrict !== '시군구(전체)')
      data = data.filter((i) => i.district === selectedDistrict);
    if (selectedDataType !== '전체')
      data = data.filter((i) => FILE_TYPE_MAP[i.type] === selectedDataType);

    /* 정렬 */
    if (selectedSort === '제목순')
      data = [...data].sort((a, b) => a.title.localeCompare(b.title));
    else if (selectedSort === '최신순')
      data = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));
    else if (selectedSort === '지역순')
      data = [...data].sort((a, b) => {
        const c = a.region.localeCompare(b.region);
        return c !== 0 ? c : a.district.localeCompare(b.district);
      });

    return data;
  }, [
    selectedCategory, categoryDataMap,
    selectedRegion, selectedDistrict, selectedDataType, selectedSort,
  ]);

  /* ---- 핸들러 ---- */
  const handleRegionChange = (e) => {
    setSelectedRegion(e.target.value);
    setSelectedDistrict('시군구(전체)');
  };
  const handleCategoryClick = (name) => {
    setSelectedCategory(name);
    setSelectedDataType('전체');
    setSelectedSort('최신순');
  };
  const handleRelatedClick = (word) => {
    setSearchKeyword(word);
    handleSearch(word);
  };

  /* ✅ 상세보기 */
  const handleDetail = async (item) => {
    try {
      await fetchWithSession(`${import.meta.env.VITE_API_BASE}/api/me`);
    } catch {
      alert('상세보기하려면 로그인이 필요합니다.');
      return navigate('/login');
    }
    if (item.type === 'numerical') {
      setMergeTable({ table_name: item.title }); // 머지 팝업 호출
    } else {
      console.log("📂 파일 상세 정보:", item);
      alert('준비 중');
    }
  };

  /* ✅ 다운로드 */
  const handleDownload = async (item) => {
    try {
      await fetchWithSession(`${import.meta.env.VITE_API_BASE}/api/me`);
    } catch {
      alert('다운로드하려면 로그인이 필요합니다.');
      return navigate('/login');
    }

    if (item.type === 'numerical') {
      setSelectedNumerical(item.title);
    } else {
      const url =
        `${import.meta.env.VITE_API_BASE}/download?` +
        `file_path=${encodeURIComponent(item.file_path)}` +
        `&title=${encodeURIComponent(item.title)}`;
      window.open(url, '_blank');
    }
  };

  /* ─────────── UI ─────────── */
  return (
    <div className="bg-white min-h-screen px-6 py-10">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">데이터 검색</h1>

      {/* 🗂 카테고리 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6 mb-10">
        {categories.map((cat) => (
          <div
            key={cat.name}
            onClick={() => handleCategoryClick(cat.name)}
            className={`flex flex-col items-center justify-center p-4 rounded-lg shadow cursor-pointer transition-all
              hover:bg-blue-100 ${selectedCategory === cat.name ? 'bg-blue-100' : 'bg-blue-50'}`}
          >
            <span className="text-4xl mb-2">
              {CATEGORY_EMOJI_MAP[cat.name] ?? '📂'}
            </span>
            <div className="text-sm font-semibold text-gray-800">{cat.name}</div>
            <div className="text-xs text-blue-600 mt-1">{cat.count}종</div>
          </div>
        ))}
      </div>

      {/* 🔍 검색·필터 패널 */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end mb-6 bg-gray-100 p-4 rounded-lg">
        <select value={selectedRegion} onChange={handleRegionChange}  className="border rounded p-4">
          {Object.keys(regionData).map((r) => <option key={r}>{r}</option>)}
        </select>

        <select value={selectedDistrict} onChange={(e) => setSelectedDistrict(e.target.value)} className="border rounded p-4">
          {(regionData[selectedRegion] || []).map((d) => <option key={d}>{d}</option>)}
        </select>

        <select value={selectedDataType} onChange={(e) => setSelectedDataType(e.target.value)} className="border rounded p-4">
          {dataTypes.map((t) => <option key={t}>{t}</option>)}
        </select>

        <select value={selectedSort} onChange={(e) => setSelectedSort(e.target.value)} className="border rounded p-4">
          {sortOptions.map((s) => <option key={s}>{s}</option>)}
        </select>

        {/* 검색창 */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="제목 또는 설명으로 검색"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="w-full px-4 py-2 border rounded shadow-sm"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={() => handleSearch()}
                  className="px-4 py-2 bg-blue-500 text-white text-sm rounded">검색
          </button>
        </div>
      </div>

      {/* 연관검색어 */}
      {relatedWords.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          {relatedWords.map((word) => (
            <span
              key={word}
              onClick={() => handleRelatedClick(word)}
              className="cursor-pointer bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full"
            >
              {word}
            </span>
          ))}
        </div>
      )}

      {/* 결과 테이블 / 메시지 */}
      {loading ? (
        <p className="text-sm text-gray-500">데이터를 불러오는 중입니다…</p>
      ) : filteredData.length ? (
        <div className="border-t pt-6">
          <h2 className="text-xl font-bold text-gray-700 mb-4">
            {selectedCategory ?? '검색 결과'} 목록
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border">
              <thead className="bg-gray-100 text-gray-600">
                <tr>
                  <th className="px-4 py-2 text-left">제목</th>
                  <th className="px-4 py-2 text-left">설명</th>
                  <th className="px-4 py-2">지역</th>
                  <th className="px-4 py-2">유형</th>
                  <th className="px-4 py-2">업로드일</th>
                  <th className="px-4 py-2">기능</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 border-b">
                    <td className="px-4 py-2 font-medium text-blue-600">{item.title}</td>
                    <td className="px-4 py-2 text-gray-600">{item.summary}</td>
                    <td className="text-center">{item.region} {item.district}</td>
                    <td className="text-center">{FILE_TYPE_MAP[item.type] || item.type}</td>
                    <td className="text-center">{item.date}</td>
                    <td className="text-center">
                      <button onClick={() => handleDetail(item)}
                              className="text-xs text-indigo-600 hover:underline mr-2">상세보기</button>
                      <button onClick={() => handleDownload(item)}
                              className="text-xs text-green-600 hover:underline">다운로드</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-gray-500 text-sm">검색 결과가 없습니다.</p>
      )}

      {/* Numerical 팝업 렌더링 */}
      {selectedNumerical && (
        <NumericalDownloads
          tableName={selectedNumerical}
          onClose={() => setSelectedNumerical(null)}
        />
      )}
      {/* Numerical 상세보기 팝업 렌더링 */}
      {mergeTable && (
        <MergeTablesModal
          baseTable={mergeTable}
          onClose={() => setMergeTable(null)}
        />
      )}
      {/* 파일 상세보기 팝업 렌더링 */}
      {selectedFile && (
        <FilePreviewModal
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
        />
      )}
    </div>
  );
}
