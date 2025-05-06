import { Link } from 'react-router-dom';
import { useRef, useState } from 'react';
import UploadChart from '../components/UploadChart';
import TextFrequencyChart from '../components/TextFrequencyChart';
import DataMap from '../components/DataMap';
import InfoModal from '../components/InfoModal';

export default function HomePage() {
  const vizRef = useRef(null);
  const [showViz, setShowViz] = useState(false);
  const [modalCard, setModalCard] = useState(null);

  const handleScrollToViz = () => {
    setShowViz(true);
    setTimeout(() => {
      vizRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <div className="bg-gradient-to-b from-sky-50 to-slate-50 min-h-screen">
      {/* Hero Section */}
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

      {/* 카드 섹션 */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 px-8 pb-20">
        <div
          className="bg-white shadow rounded-xl p-6 hover:shadow-lg transition cursor-pointer"
          onClick={() => setModalCard('summary')}
        >
          <h2 className="text-lg font-semibold mb-2">우리 동네 데이터 요약</h2>
          <ul className="text-sm text-gray-700 space-y-2">
            <li>📍 의정부 업로드: <span className="font-bold text-blue-600">320건</span></li>
            <li>🎥 영상 자료: <span className="font-bold text-red-500">42건</span></li>
            <li>📄 문서 자료: <span className="font-bold text-gray-600">78건</span></li>
            <li>🖼️ 이미지 자료: <span className="font-bold text-green-600">200건</span></li>
          </ul>
        </div>

        <div className="bg-indigo-100 rounded-xl p-6 hover:shadow-md transition">
          <h2 className="text-lg font-semibold mb-4">아카이브 성과</h2>
          <ul className="text-sm text-gray-700 space-y-2">
            <li>업로드된 콘텐츠: <span className="font-bold text-orange-600">1,234건</span></li>
            <li>분석 완료율: <span className="font-bold text-green-600">98%</span></li>
            <li>참여 기관 수: <span className="font-bold text-violet-600">35개</span></li>
          </ul>
        </div>

        <div
          className="bg-pink-100 rounded-xl p-6 hover:shadow-md transition cursor-pointer"
          onClick={() => setModalCard('story')}
        >
          <h2 className="text-lg font-semibold mb-2">데이터 스토리</h2>
          <p className="text-sm mb-2">우리가 기록한 이야기들을 확인해보세요.</p>
          <ul className="text-xs text-gray-700 list-disc list-inside space-y-1 mb-3">
            <li>로컬 데이터의 의미</li>
            <li>마을 사례 이야기</li>
            <li>주민 참여 경험</li>
          </ul>
          <div className="bg-white p-3 rounded-lg text-sm shadow-sm">
            <p className="text-gray-800 font-semibold truncate">📷 포천 마을회관의 옛 사진 기록</p>
            <p className="text-gray-500 truncate text-xs mt-1">포천시 주민들이 기증한 자료로 구성된 영상 데이터</p>
          </div>
        </div>
      </section>

      {/* 시각화 요약 */}
      {showViz && (
        <section ref={vizRef} className="bg-white py-20 border-t border-gray-200 px-6">
          <h2 className="text-2xl font-bold text-center mb-10 text-gray-800">📊 마을 데이터를 한눈에</h2>

          <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {/* 막대 그래프 */}
            <div className="bg-white rounded-xl p-6 shadow">
              <h3 className="text-lg font-bold mb-6 text-gray-800">지역별 업로드 비율</h3>
              <UploadChart />
            </div>

            {/* 텍스트 빈도 차트 */}
            <div className="bg-gray-50 rounded-xl p-6 shadow">
              <h3 className="text-lg font-semibold mb-4 text-gray-700">🔥 많이 등장한 키워드</h3>
              <TextFrequencyChart />
            </div>
          </div>

          {/* 지도 시각화 자리 */}
          <div className="bg-gray-100 rounded-xl p-6 shadow mt-10">
            <h3 className="text-lg font-semibold mb-4 text-gray-700 text-center">📍 데이터 지도</h3>
            <DataMap />
          </div>
        </section>
      )}

      {/* 모달 */}
      {modalCard && (
        <InfoModal cardType={modalCard} onClose={() => setModalCard(null)} />
      )}
    </div>
  );
}