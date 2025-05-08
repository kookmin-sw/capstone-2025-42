// src/pages/UploadPage.jsx
import { useState, useRef, useEffect } from "react";
import { typeMap } from "../data/typeMap";

const categories = [
  { name: '건강', icon: '🩺' }, { name: '동물', icon: '🐐' }, { name: '식품', icon: '🍽️' },
  { name: '문화', icon: '🎭' }, { name: '생활', icon: '🍳' }, { name: '자원환경', icon: '🌿' },
  { name: '기타', icon: '➕' },
];

export default function UploadPage() {
  const [files, setFiles] = useState([]);
  const [previewMap, setPreviewMap] = useState({});
  const [descriptionMap, setDescriptionMap] = useState({});
  const [selectedCategory, setSelectedCategory] = useState("");

  const fileInputRef = useRef(null);

  const detectDataType = (fileName) => {
    const ext = fileName.split('.').pop().toLowerCase();
    for (const [type, extensions] of Object.entries(typeMap)) {
      if (extensions.includes(ext)) return type;
    }
    return '기타';
  };

  const getFileTitle = (fileName) => fileName.replace(/\.[^/.]+$/, "");

  const handleFiles = (incomingFiles) => {
    const filtered = Array.from(incomingFiles).filter(file => detectDataType(file.name) !== '기타');
    if (!filtered.length) {
      alert("지원되지 않는 파일이거나 모든 파일이 유효하지 않습니다.");
      return;
    }
    setFiles(filtered);
    setPreviewMap({});
    setDescriptionMap({});

    filtered.forEach((file) => {
      const type = detectDataType(file.name);

      if (type === "이미지") {
        const url = URL.createObjectURL(file);
        setPreviewMap(prev => ({ ...prev, [file.name]: url }));
      }

      if (type === "영상") {
        const video = document.createElement("video");
        const canvas = document.createElement("canvas");
        const url = URL.createObjectURL(file);
        video.src = url;

        video.onloadedmetadata = () => {
          video.currentTime = 0.1;
        };

        video.onseeked = () => {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL();
          setPreviewMap(prev => ({ ...prev, [file.name]: dataUrl }));
        };
      }
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (!selectedCategory) return alert("카테고리를 먼저 선택하세요.");
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e) => e.preventDefault();

  const handleClickUploadBox = () => {
    if (!selectedCategory) return alert("카테고리를 먼저 선택하세요.");
    fileInputRef.current?.click();
  };

  const handleDescriptionChange = (fileName, text) => {
    setDescriptionMap(prev => ({ ...prev, [fileName]: text }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!files.length || !selectedCategory) return alert("카테고리와 파일을 모두 선택하세요.");

    const missing = files.filter(file => !descriptionMap[file.name]?.trim());
    if (missing.length > 0) return alert("모든 파일에 대한 설명을 입력하세요.");

    const existing = JSON.parse(localStorage.getItem("uploads") || "[]");
    for (const file of files) {
      const type = detectDataType(file.name);
      const newUpload = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        fileName: file.name,
        title: getFileTitle(file.name),
        type,
        category: selectedCategory,
        description: descriptionMap[file.name],
        previewUrl: previewMap[file.name] || "",
      };
      existing.push(newUpload);
    }
    localStorage.setItem("uploads", JSON.stringify(existing));
    alert("파일이 성공적으로 업로드되었습니다.");
    setFiles([]);
    setPreviewMap({});
    setDescriptionMap({});
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-8">📁 파일 업로드</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          {categories.map(cat => (
            <div
              key={cat.name}
              onClick={() => setSelectedCategory(cat.name)}
              className={`cursor-pointer p-4 border rounded text-center transition ${
                selectedCategory === cat.name ? 'bg-indigo-100 border-indigo-400' : 'bg-gray-50'
              }`}
            >
              <div className="text-2xl mb-1">{cat.icon}</div>
              <div className="text-sm font-medium">{cat.name}</div>
            </div>
          ))}
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={handleClickUploadBox}
          className="mt-6 p-8 border-2 border-dotted rounded-2xl bg-sky-300 text-white text-center cursor-pointer select-none"
        >
          <div className="text-4xl mb-2">📄</div>
          <p className="text-lg font-semibold">Drop files here</p>
          <p className="mt-2 text-sm">or <span className="underline">Choose file</span></p>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        {files.map(file => (
          <div key={file.name} className="mt-6 border rounded-lg p-4 bg-gray-50">
            <p className="font-semibold text-gray-800 mb-2">{getFileTitle(file.name)}</p>
            {previewMap[file.name] && (
              <img
                src={previewMap[file.name]}
                alt="미리보기"
                className="max-h-48 mb-3 border rounded"
              />
            )}
            <textarea
              value={descriptionMap[file.name] || ""}
              onChange={(e) => handleDescriptionChange(file.name, e.target.value)}
              placeholder="이 파일에 대한 설명 입력"
              className="border p-2 rounded w-full"
              rows="3"
            />
          </div>
        ))}

        <button
          type="submit"
          className="bg-indigo-500 text-white px-6 py-2 rounded-full hover:bg-indigo-600"
          disabled={!files.length}
        >
          업로드
        </button>
      </form>
    </div>
  );
}