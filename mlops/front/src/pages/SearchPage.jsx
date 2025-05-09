// src/pages/SearchPage.jsx
import { useState, useEffect, useMemo } from 'react';

/* ─────────── 파일 유형 매핑 ─────────── */
const FILE_TYPE_MAP = {
  text:  '문서',
  video: '영상',
  image: '이미지',
};
const dataTypes   = ['전체', ...Object.values(FILE_TYPE_MAP)];
const sortOptions = ['제목순', '최신순', '지역순'];

/* ─────────── fetch 래퍼 ──────────── */
const fetchWithAuth = async (url, opts = {}) => {
  const token   = localStorage.getItem('token');
  const headers = {
    ...(opts.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(url, { ...opts, headers, credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/* ───────────────────────────────────── */
export default function SearchPage() {
  /* ─────────── 지역 데이터 ─────────── */
  const [regionData, setRegionData] = useState({
    '시도(전체)': ['시군구(전체)'],
  });

  /* state ───────────────────────────── */
  const [categories, setCategories]             = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const [searchKeyword, setSearchKeyword]       = useState('');
  const [selectedRegion, setSelectedRegion]     = useState('시도(전체)');
  const [selectedDistrict, setSelectedDistrict] = useState('시군구(전체)');
  const [selectedDataType, setSelectedDataType] = useState('전체');
  const [selectedSort, setSelectedSort]         = useState('최신순');

  const [categoryDataMap, setCategoryDataMap]   = useState({});
  const [loading, setLoading]                   = useState(false);

  const typeKor2Key = (kor) =>
    Object.entries(FILE_TYPE_MAP).find(([, v]) => v === kor)?.[0];

  /* ① 시/군/구 데이터 로드 ──────────── */
  useEffect(() => {
    const fetchRegions = async () => {
      try {
        const data = await fetchWithAuth(
          `${import.meta.env.VITE_API_BASE}/api/regions`,
        ); // { "서울특별시": [...], ... }
        setRegionData({ '시도(전체)': ['시군구(전체)'], ...data });
      } catch (err) {
        console.error('지역 데이터 로드 오류:', err);
      }
    };
    fetchRegions();
  }, []);

  /* ② 카테고리 목록 초기 로드 ─────────── */
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await fetchWithAuth(
          `${import.meta.env.VITE_API_BASE}/get_categories`,
        );
        setCategories(data); // [{ name, count }]
      } catch (err) {
        console.error('카테고리 로드 오류:', err);
      }
    };
    fetchCategories();
  }, []);

  /* ③ 카테고리별 데이터 로드 ───────────── */
  useEffect(() => {
    if (!selectedCategory || categoryDataMap[selectedCategory]) return;
    const fetchItems = async () => {
      setLoading(true);
      try {
        const url = new URL(
          `${import.meta.env.VITE_API_BASE}/search_by_category`,
        );
        url.searchParams.set('category', selectedCategory);
        const data = await fetchWithAuth(url);
        setCategoryDataMap((p) => ({ ...p, [selectedCategory]: data }));
      } catch (err) {
        console.error('카테고리 데이터 로드 오류:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, [selectedCategory, categoryDataMap]);

  /* ④ /search 호출 ───────────────────── */
  const handleSearch = async () => {
    if (!searchKeyword.trim()) return;
    const url = new URL(`${import.meta.env.VITE_API_BASE}/search`);
    url.searchParams.set('word', searchKeyword.trim());
    if (selectedSort === '제목순')      url.searchParams.set('order', 'name');
    else if (selectedSort === '최신순') url.searchParams.set('order', 'recent');
    if (selectedDataType !== '전체') {
      url.searchParams.set('exp', typeKor2Key(selectedDataType) || 'all');
    }

    setLoading(true);
    try {
      const { results } = await fetchWithAuth(url);
      const newCats = Object.keys(results).map((name) => ({
        name,
        count: results[name].length,
      }));
      setCategories(newCats);
      setCategoryDataMap(results);
      setSelectedCategory(newCats[0]?.name || null);
    } catch (err) {
      console.error('검색 오류:', err);
    } finally {
      setLoading(false);
    }
  };

  /* ⑤ 필터·정렬 메모라이즈 ────────────── */
  const filteredData = useMemo(() => {
    if (!selectedCategory) return [];
    let data = categoryDataMap[selectedCategory] || [];

    if (searchKeyword) {
      data = data.filter(
        (item) =>
          item.title.includes(searchKeyword) ||
          (item.summary && item.summary.includes(searchKeyword)),
      );
    }
    if (selectedRegion !== '시도(전체)')
      data = data.filter((i) => i.region === selectedRegion);
    if (selectedDistrict !== '시군구(전체)')
      data = data.filter((i) => i.district === selectedDistrict);
    if (selectedDataType !== '전체')
      data = data.filter((i) => FILE_TYPE_MAP[i.type] === selectedDataType);

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
    selectedCategory,
    categoryDataMap,
    searchKeyword,
    selectedRegion,
    selectedDistrict,
    selectedDataType,
    selectedSort,
  ]);

  /* 핸들러들 ──────────────────────────── */
  const handleRegionChange = (e) => {
    setSelectedRegion(e.target.value);
    setSelectedDistrict('시군구(전체)');
  };
  const handleCategoryClick = (name) => {
    setSelectedCategory(name);
    setSelectedDataType('전체');
    setSelectedSort('최신순');
  };
  const handleDownload = (item) => {
    const url = `${import.meta.env.VITE_API_BASE}/download?file_path=${encodeURIComponent(
      item.file_path,
    )}&title=${encodeURIComponent(item.title)}`;
    window.open(url, '_blank');
  };

  /* ───────────────────────────────────── UI */
  return (
    <div className="bg-white min-h-screen px-6 py-10">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">데이터 검색</h1>

      {/* 카테고리 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6 mb-10">
        {categories.map((cat) => (
          <div
            key={cat.name}
            onClick={() => handleCategoryClick(cat.name)}
            className={`flex flex-col items-center justify-center p-4 rounded-lg shadow cursor-pointer transition-all hover:bg-blue-100 ${
              selectedCategory === cat.name ? 'bg-blue-100' : 'bg-blue-50'
            }`}
          >
            <div className="text-4xl mb-2">📂</div>
            <div className="text-sm font-semibold text-gray-800">{cat.name}</div>
            <div className="text-xs text-blue-600 mt-1">{cat.count}종</div>
          </div>
        ))}
      </div>

      {/* 필터 패널 */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end mb-10 bg-gray-100 p-4 rounded-lg">
        {/* 시/도 */}
        <select
          value={selectedRegion}
          onChange={handleRegionChange}
          className="border rounded p-4"
        >
          {Object.keys(regionData).map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        {/* 시/군/구 */}
        <select
          value={selectedDistrict}
          onChange={(e) => setSelectedDistrict(e.target.value)}
          className="border rounded p-4"
        >
          {(regionData[selectedRegion] || []).map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        {/* 파일 유형 */}
        <select
          value={selectedDataType}
          onChange={(e) => setSelectedDataType(e.target.value)}
          className="border rounded p-4"
        >
          {dataTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* 정렬 */}
        <select
          value={selectedSort}
          onChange={(e) => setSelectedSort(e.target.value)}
          className="border rounded p-4"
        >
          {sortOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* 키워드 + 검색 버튼 */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="제목 또는 설명으로 검색"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="w-full px-4 py-2 border rounded shadow-sm"
          />
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-blue-500 text-white text-sm rounded"
          >
            검색
          </button>
        </div>
      </div>

      {/* 목록 */}
      {selectedCategory ? (
        loading ? (
          <p className="text-sm text-gray-500">데이터를 불러오는 중입니다…</p>
        ) : (
          <div className="border-t pt-6">
            <h2 className="text-xl font-bold text-gray-700 mb-4">
              {selectedCategory} 관련 데이터 목록
            </h2>

            {filteredData.length ? (
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
                        <td className="text-center">
                          {item.region} {item.district}
                        </td>
                        <td className="text-center">
                          {FILE_TYPE_MAP[item.type] || item.type}
                        </td>
                        <td className="text-center">{item.date}</td>
                        <td className="text-center">
                          <button
                            onClick={() => alert(`상세 페이지 이동: ${item.title}`)}
                            className="text-xs text-indigo-600 hover:underline mr-2"
                          >
                            상세보기
                          </button>
                          <button
                            onClick={() => handleDownload(item)}
                            className="text-xs text-green-600 hover:underline"
                          >
                            다운로드
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">검색 결과가 없습니다.</p>
            )}
          </div>
        )
      ) : (
        <p className="text-gray-500 text-sm">카테고리를 선택하거나 검색을 실행하세요.</p>
      )}
    </div>
  );
}
