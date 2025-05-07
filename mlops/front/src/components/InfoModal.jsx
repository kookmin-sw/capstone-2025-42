import { Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";

export default function InfoModal({ cardType, onClose }) {
  return (
    <Transition appear show={!!cardType} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
                  정릉과 길음의 마을 이야기
                </h2>
                <p className="text-sm text-gray-600 text-center mb-6">
                  서울 성북구 정릉·길음동에서 수집한 주민들의 소중한 기록입니다.
                </p>

                <ul className="space-y-2 text-sm text-gray-800">
                  <li className="flex items-center gap-2">📷 <span>정릉시장 거리 풍경 사진 기록</span></li>
                  <li className="flex items-center gap-2">📝 <span>길음 청소년문화의집 활동 보고서</span></li>
                  <li className="flex items-center gap-2">🎬 <span>정릉천 정비 과정 관련 영상 자료</span></li>
                </ul>

                <div className="mt-6 p-4 border rounded-lg bg-gray-50 shadow-sm hover:bg-gray-100 transition">
                  <p className="text-sm font-semibold text-gray-800 mb-1">
                    📄 정릉 청년회 2000년대 초반 행사 자료
                  </p>
                  <p className="text-xs text-gray-600">
                    지역 청년들이 기획한 축제와 회의록 등을 디지털 아카이브로 정리함
                  </p>
                </div>

                <button
                  onClick={onClose}
                  className="w-full mt-6 py-2 bg-indigo-600 text-white text-sm rounded-full hover:bg-indigo-700 transition"
                >
                  닫기
                </button>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}