// 1️⃣ InfoModal.jsx
import React from 'react';

export default function InfoModal({ cardType, onClose }) {
  const renderContent = () => {
    if (cardType === 'summary') {
      return (
        <div>
          <h2 className="text-xl font-bold mb-4">우리 동네 데이터 요약</h2>
          <p>📊 최근 한 달간 업로드된 지역 데이터를 확인하세요.</p>
          <ul className="mt-4 space-y-1 text-sm text-gray-700">
            <li>• 의정부시 – 38건</li>
            <li>• 양주시 – 22건</li>
            <li>• 포천시 – 17건</li>
          </ul>
          <button
            onClick={() => window.location.href = '/search'}
            className="mt-6 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >전체 보기</button>
        </div>
      );
    } else if (cardType === 'story') {
      return (
        <div>
          <h2 className="text-xl font-bold mb-4">데이터 스토리</h2>
          <p>📖 데이터에 담긴 지역 주민들의 이야기를 만나보세요.</p>
          <ul className="mt-4 space-y-2 text-sm text-gray-700">
            <li>• 전통시장 사진 기록 → 지역 홍보 자료로 활용</li>
            <li>• 주민 증언 → 마을 벽화 복원 프로젝트 시작</li>
          </ul>
          <button
            onClick={() => window.location.href = '/story'}
            className="mt-6 bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
          >전체 이야기 보기</button>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-xl"
        >&times;</button>
        {renderContent()}
      </div>
    </div>
  );
}
