import { useState } from 'react';
import { regionData } from '../data/regionData'; // ← 파일 위치에 맞게 경로 수정

const categories = [
  { name: '건강', icon: '🩺', count: 13 },
  { name: '동물', icon: '🐐', count: 18 },
  { name: '식품', icon: '🍽️', count: 32 },
  { name: '문화', icon: '🎭', count: 53 },
  { name: '생활', icon: '🍳', count: 26 },
  { name: '자원환경', icon: '🌿', count: 37 },
  { name: '기타', icon: '➕', count: 16 },
];

const categoryDataMap = {
  건강: [
    { id: 1, title: '치과기공소 위치 정보', summary: '전국 치과기공소 위치 및 운영 정보', region: '서울특별시', district: '강남구', date: '2024-02-01', type: '문서', fileUrl: '#' },
    { id: 2, title: '병원 영상 데이터', summary: '의료 홍보 영상 아카이브', region: '경기도', district: '수원시', date: '2023-10-18', type: '영상', fileUrl: '#' },
  ],
  동물: [
    { id: 3, title: '유기동물 보호소 목록', summary: '전국 보호소 위치와 보호 현황', region: '부산광역시', district: '해운대구', date: '2023-05-10', type: '문서', fileUrl: '#' },
  ],
};

const dataTypes = ['전체', '문서', '영상', '이미지'];
const sortOptions = ['제목순', '최신순', '지역순'];

export default function SearchPage() {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('시도(전체)');
  const [selectedDistrict, setSelectedDistrict] = useState('시군구(전체)');
  const [selectedDataType, setSelectedDataType] = useState('전체');
  const [selectedSort, setSelectedSort] = useState('최신순');

  const handleRegionChange = (e) => {
    const newRegion = e.target.value;
    setSelectedRegion(newRegion);
    setSelectedDistrict('시군구(전체)');
  };

  const getFilteredData = () => {
    let localData = JSON.parse(localStorage.getItem("uploads") || "[]");
    localData = localData.filter(item => item.category === selectedCategory);

    if (searchKeyword) {
      localData = localData.filter(item =>
        item.title.includes(searchKeyword) || item.description.includes(searchKeyword)
      );
    }

    if (selectedRegion !== '시도(전체)') {
      localData = localData.filter(item => item.region === selectedRegion);
    }

    if (selectedDistrict !== '시군구(전체)') {
      localData = localData.filter(item => item.district === selectedDistrict);
    }

    if (selectedDataType !== '전체') {
      localData = localData.filter(item => item.type === selectedDataType);
    }

    if (selectedSort === '제목순') {
      localData = localData.sort((a, b) => a.title.localeCompare(b.title));
    } else if (selectedSort === '최신순') {
      localData = localData.sort((a, b) => b.id - a.id);
    } else if (selectedSort === '지역순') {
      localData = localData.sort((a, b) => {
        const regionCompare = a.region?.localeCompare(b.region || '') || 0;
        return regionCompare !== 0
          ? regionCompare
          : a.district?.localeCompare(b.district || '') || 0;
      });
    }

    return localData;
  };

  const handleDetail = (item) => {
    alert(`상세 페이지 이동: ${item.title}`);
  };

  const handleDownload = (item) => {
    const a = document.createElement("a");
    a.href = item.previewUrl;
    a.download = item.fileName;
    a.click();
  };

  const filteredData = getFilteredData();

  return (
    <div className="bg-white min-h-screen px-6 py-10">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">카테고리별 조회</h1>

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
            <div className="text-xs text-blue-600 mt-1">조회</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end mb-10 bg-gray-100 p-4 rounded-lg">
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
          placeholder="제목 또는 설명으로 검색"
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded shadow-sm"
        />
      </div>

      {selectedCategory ? (
        <div className="border-t pt-6">
          <h2 className="text-xl font-bold text-gray-700 mb-4">
            {selectedCategory} 관련 데이터 목록
          </h2>

          {filteredData.length > 0 ? (
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
                      <td className="px-4 py-2 text-gray-600">{item.description}</td>
                      <td className="text-center">{item.region || '-'} {item.district || ''}</td>
                      <td className="text-center">{item.type}</td>
                      <td className="text-center">{new Date(item.id).toLocaleDateString()}</td>
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
        </div>
      ) : (
        <p className="text-gray-500 text-sm">카테고리를 선택하면 관련 데이터가 표시됩니다.</p>
      )}
    </div>
  );
}
