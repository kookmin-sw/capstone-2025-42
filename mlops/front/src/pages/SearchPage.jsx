import { useState } from 'react';
import { regionData } from '../data/regionData'; // 존재 시 사용
import NumericalDownloads from './NumericalDownloads.jsx';
import MergeTablesModal from './MergeTablesModal.jsx';

const categories = [
  { name: '건강', icon: '🩺', count: 13 },
  { name: '동물', icon: '🐐', count: 18 },
  { name: '식품', icon: '🍽️', count: 32 },
  { name: '문화', icon: '🎭', count: 53 },
  { name: '생활', icon: '🍳', count: 26 },
  { name: '자원환경', icon: '🌿', count: 37 },
  { name: '기타', icon: '➕', count: 16 },
];

const dataTypes = ['전체', '문서', '영상', '이미지', '엑셀'];
const sortOptions = ['제목순', '최신순'];

export default function SearchPage() {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedDataType, setSelectedDataType] = useState('전체');
  const [selectedSort, setSelectedSort] = useState('최신순');
  const [selectedRegion, setSelectedRegion] = useState('시도(전체)');
  const [selectedDistrict, setSelectedDistrict] = useState('시군구(전체)');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [filteredData, setFilteredData] = useState([]);
  const [relatedWords, setRelatedWords] = useState([]);
  const [selectedNumerical, setSelectedNumerical] = useState(null);
  const [mergeTable, setMergeTable] = useState(null);

  const handleRegionChange = (e) => {
    const newRegion = e.target.value;
    setSelectedRegion(newRegion);
    setSelectedDistrict('시군구(전체)');
  };

  const handleSearch = async () => {
    const query = new URLSearchParams({
      word: searchKeyword,
      order: selectedSort === '최신순' ? 'recent' : 'name',
      date: 'all',
      exp: selectedDataType === '전체' ? 'all' : selectedDataType,
    }).toString();

    try {
      const [fileRes, numericalRes] = await Promise.all([
        fetch(`/search?${query}`, {
          method: 'GET',
          credentials: 'include',
        }),
          fetch(`/search_numerical?word=${encodeURIComponent(searchKeyword)}`, {
          method: 'GET',
        }),
      ]);

      const fileData = await fileRes.json();
      const numericalData = await numericalRes.json();

      const fileResults = (fileData.results || []).map((item, i) => ({
        id: `file-${i}`,
        type: 'file',
        title: item.file_name,
        summary: item.real_path,
        region: '-',   // 미지원
        district: '-', // 미지원
        date: '-',     // 미지원
        fileUrl: `/download?file_name=${encodeURIComponent(item.real_path)}&origin_name=${encodeURIComponent(item.file_name)}`,
      }));

      const numericalResults = (numericalData.results || []).map((item, i) => ({
        id: `num-${i}`,
        type: 'numerical',
        title: item.table_name,
        summary: `${item.year}년 ${item.month}월 ${item.category}`,
        region: '-',   // 미지원
        district: '-', // 미지원
        date: '-',     // 미지원
        fileUrl: `/download_numerical?table_name=${encodeURIComponent(item.table_name)}`, // 추후 구현 필요
      }));

      setFilteredData([...fileResults, ...numericalResults]);
      setRelatedWords(fileData.related_word || []);
    } catch (err) {
      console.error('검색 실패:', err);
      setFilteredData([]);
    }
  };

  const handleDetail = (item) => {
    if (item.type === 'numerical') {
      setMergeTable({ table_name: item.title }); // 머지 팝업 호출
    } else {
    alert(`상세 보기 기능은 수치 데이터에만 지원됩니다.`);
    }
  };

  const handleDownload = (item) => {
    if (item.type === 'numerical') {
      setSelectedNumerical(item.title); // table_name 전달
    } else {
      window.open(item.fileUrl, '_blank');
    }
  };

  return (
    <div className="bg-white min-h-screen px-6 py-10">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">데이터 검색</h1>

      {/* 카테고리 UI (비활성화된 필터) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6 mb-10">
        {categories.map((cat) => (
          <div
            key={cat.name}
            onClick={() => setSelectedCategory(cat.name)}
            className={`flex flex-col items-center justify-center p-4 rounded-lg shadow cursor-pointer transition-all hover:bg-blue-100 ${
              selectedCategory === cat.name ? 'bg-blue-100' : 'bg-blue-50'
            }`}
          >
            <div className="text-4xl mb-2">{cat.icon}</div>
            <div className="text-sm font-semibold text-gray-800">{cat.name}</div>
            <div className="text-xs text-blue-600 mt-1">{cat.count}종</div>
          </div>
        ))}
      </div>

      {/* 검색 필터 바 */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end mb-10 bg-gray-100 p-4 rounded-lg">
        <select value={selectedRegion} onChange={handleRegionChange} className="border rounded p-2">
          {Object.keys(regionData).map((region) => (
            <option key={region} value={region}>{region}</option>
          ))}
        </select>

        <select value={selectedDistrict} onChange={(e) => setSelectedDistrict(e.target.value)} className="border rounded p-2">
          {regionData[selectedRegion]?.map((district) => (
            <option key={district} value={district}>{district}</option>
          ))}
        </select>

        <select value={selectedDataType} onChange={(e) => setSelectedDataType(e.target.value)} className="border rounded p-2">
          {dataTypes.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>

        <select value={selectedSort} onChange={(e) => setSelectedSort(e.target.value)} className="border rounded p-2">
          {sortOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <input
          type="text"
          placeholder="파일 이름 또는 설명 검색"
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSearch();
          }}
          className="w-full px-4 py-2 border border-gray-300 rounded shadow-sm"
        />

        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-800 transition"
        >
          검색
        </button>
      </div>

      {relatedWords.length > 0 && (
        <div className="mb-6 text-sm text-gray-500">
          연관 키워드: {relatedWords.map((w) => <span key={w} className="mr-2 text-blue-600">#{w}</span>)}
        </div>
      )}

      {filteredData.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="px-4 py-2 text-left">제목</th>
                <th className="px-4 py-2 text-left">파일 경로</th>
                <th className="px-4 py-2 text-center">기능</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 border-b">
                  <td className="px-4 py-2 font-medium text-blue-600">{item.title}</td>
                  <td className="px-4 py-2 text-gray-600">{item.summary}</td>
                  <td className="text-center">
                    <button
                      onClick={() => handleDetail(item)}
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
      {selectedNumerical && (
        <NumericalDownloads
            tableName={selectedNumerical}
            onClose={() => setSelectedNumerical(null)}
        />
      )}
      {mergeTable && (
        <MergeTablesModal
          baseTable={mergeTable}
          onClose={() => setMergeTable(null)}
        />
      )}
    </div>
  );
}
