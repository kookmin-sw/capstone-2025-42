import { Link, useNavigate } from 'react-router-dom';
import { useRef, useState, useEffect } from 'react';
import UploadChart from '../components/UploadChart';
import TextFrequencyChart from '../components/TextFrequencyChart';
import DataMap from '../components/DataMap';
import InfoModal from '../components/InfoModal';
import exampleImg from '../assets/example.jpg';

export default function HomePage() {
  const vizRef = useRef(null);
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

  const handleScrollToViz = () => {
    setShowViz(true);
    setTimeout(() => {
      vizRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleStoryClick = () => {
    navigate(`/search?keyword=${encodeURIComponent('정릉3동 한옥길')}`);
  };

  return (
    <div className="bg-gradient-to-b from-sky-50 to-slate-50 min-h-screen">
      <section className="text-center py-16 px-6">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4 leading-snug">
          지역을 데이터로 기억하다<br />
          <span className="text-indigo-600">Archive ON</span>
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          마을의 일상과 기억을 데이터로 기록하고 나누는 플랫폼입니다.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            to="/upload"
            className="bg-indigo-700 text-white px-6 py-3 rounded-full hover:bg-indigo-800 transition"
          >
            파일 업로드
          </Link>
          <button
            onClick={handleScrollToViz}
            className="flex items-center gap-2 border border-indigo-700 text-indigo-700 px-5 py-2.5 rounded-full hover:bg-indigo-100 hover:scale-105 transition-transform duration-200"
          >
            데이터 시각화 보기
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 px-8 pb-20">
        {/* 요약 카드 */}
        <div
          className="bg-blue-50 hover:scale-105 hover:shadow-lg transition-all duration-300 rounded-xl p-6 cursor-pointer h-full flex flex-col justify-between"
          onClick={() => setModalCard('summary')}
        >
          <div>
            <h2 className="text-xl font-bold text-blue-800 flex items-center gap-2 mb-4">📌 우리 동네 데이터 요약</h2>
            <div className="grid grid-cols-2 gap-4 text-base text-gray-800">
              <div className="bg-white p-6 h-36 rounded-md shadow text-center flex flex-col justify-center">
                <p className="text-gray-500 text-base">{region} 업로드</p>
                <p className="text-blue-600 text-xl font-bold">{data.upload}건</p>
              </div>
              <div className="bg-white p-6 h-36 rounded-md shadow text-center flex flex-col justify-center">
                <p className="text-gray-500 text-base">영상 자료</p>
                <p className="text-red-500 text-xl font-bold">{data.video}건</p>
              </div>
              <div className="bg-white p-6 h-36 rounded-md shadow text-center flex flex-col justify-center">
                <p className="text-gray-500 text-base">문서 자료</p>
                <p className="text-gray-800 text-xl font-bold">{data.doc}건</p>
              </div>
              <div className="bg-white p-6 h-36 rounded-md shadow text-center flex flex-col justify-center">
                <p className="text-gray-500 text-base">이미지 자료</p>
                <p className="text-green-600 text-xl font-bold">{data.image}건</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 text-right mt-4">{region} 기준 통계입니다</p>
        </div>

        {/* 아카이브 성과 카드 */}
        <div className="bg-indigo-50 hover:scale-105 hover:shadow-lg transition-all duration-300 rounded-xl p-6 cursor-pointer h-full flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-bold text-indigo-800 flex items-center gap-2 mb-6">🏆 아카이브 성과</h2>
            <div className="space-y-6 text-center text-base">
              <div>
                <p className="text-gray-600 mb-2 text-base">전체 콘텐츠</p>
                <p className="text-orange-600 text-2xl font-bold">1,234건</p>
              </div>
              <div>
                <p className="text-gray-600 mb-2 text-base">분석 완료율</p>
                <p className="text-green-600 text-2xl font-bold">98%</p>
              </div>
              <div>
                <p className="text-gray-600 mb-2 text-base">참여 기관 수</p>
                <p className="text-violet-600 text-2xl font-bold">35개</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 text-right mt-4">2025년 5월 기준</p>
        </div>

        {/* 데이터 스토리 카드 */}
        <div className="bg-pink-100 hover:scale-105 hover:shadow-lg transition-all duration-300 rounded-xl p-6 cursor-pointer h-full flex flex-col justify-between" onClick={handleStoryClick}>
          <div>
            <h2 className="text-xl font-bold text-pink-700 flex items-center gap-2 mb-4">📖 데이터 스토리</h2>
            <p className="text-base text-gray-800 mb-3">📌 우리가 기록한 이야기들을 확인해보세요.</p>
            <ul className="text-sm text-gray-700 list-disc list-inside space-y-1 mb-4">
              <li>마을의 기록, 데이터를 통해 다시 살아나다</li>
              <li>주민의 이야기로 채워진 진짜 아카이브</li>
              <li>로컬의 숨은 역사, 함께 찾아보세요</li>
            </ul>

            <div className="mb-2">
              <p className="text-base text-gray-800 mb-3">📌 자료 추천</p>
            </div>
            <div
              className="bg-white p-4 rounded-lg text-base shadow-sm flex items-center gap-4 cursor-pointer hover:bg-gray-50"
              onClick={handleStoryClick}
            >
              <img src={exampleImg} alt="정릉3동 한옥길" className="w-24 h-16 object-cover rounded-md" />
              <div>
                <p className="text-gray-800 font-semibold truncate">📷 정릉3동 한옥길 추천</p>
                <p className="text-gray-500 truncate text-xs mt-1">정릉 주민들이 기증한 자료로 구성된 이미지 데이터</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 text-right mt-4">주민 사례 기반 예시입니다</p>
        </div>
      </section>

      {showViz && (
        <section ref={vizRef} className="bg-white py-20 border-t border-gray-200 px-6">
          <h2 className="text-2xl font-bold text-center mb-10 text-gray-800">📊 마을 데이터를 한눈에</h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            <div className="bg-white rounded-xl p-6 shadow">
              <h3 className="text-lg font-bold mb-6 text-gray-800">지역별 업로드 비율</h3>
              <UploadChart />
            </div>
            <div className="bg-gray-50 rounded-xl p-6 shadow">
              <h3 className="text-lg font-semibold mb-4 text-gray-700">🔥 많이 등장한 키워드</h3>
              <TextFrequencyChart />
            </div>
          </div>
          <div className="bg-gray-100 rounded-xl p-6 shadow mt-10">
            <h3 className="text-lg font-semibold mb-4 text-gray-700 text-center">📍 데이터 지도</h3>
            <DataMap />
          </div>
        </section>
      )}

      {modalCard && <InfoModal cardType={modalCard} onClose={() => setModalCard(null)} />}
    </div>
  );
}
