// src/pages/UploadPage.jsx
import { useState, useRef } from 'react';
import axios from 'axios';

/* ───── 카테고리 ───── */
const categories = [
  { name: '건강',     icon: '🩺' },
  { name: '동물',     icon: '🐐' },
  { name: '식품',     icon: '🍽️' },
  { name: '문화',     icon: '🎭' },
  { name: '생활',     icon: '🍳' },
  { name: '자원환경', icon: '🌿' },
  { name: '기타',     icon: '➕' },
];

/* ───── 확장자 → 미리보기 타입 ───── */
const previewTypeMap = {
  이미지: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'],
  영상:   ['mp4', 'avi', 'mov', 'mkv'],
};
const extPreviewType = (n) =>
  Object.entries(previewTypeMap)
    .find(([, exts]) => exts.includes(n.split('.').pop().toLowerCase()))?.[0] || '';

export default function UploadPage() {
  /* ─── state ─── */
  const [selectedCategory, setSelectedCategory] = useState('');
  const [files, setFiles]       = useState([]);   // File[]
  const [preview, setPreview]   = useState({});   // {fileName:dataUrl}

  /* 파일별 메타 */
  const [fileMetas, setFileMetas] = useState([]); // [{description, tagOptions, selectedTags}]
  const patchMeta = (i, p) => setFileMetas((prev) =>
    prev.map((m, idx) => (idx === i ? { ...m, ...p } : m)));

  /* 일괄 설명/태그 */
  const [bulk, setBulk]       = useState(false);
  const [bulkDesc, setBulkDesc] = useState('');
  const [bulkTags, setBulkTags] = useState([]);
  const [bulkSel,  setBulkSel]  = useState([]);

  const [uploading, setUploading] = useState(false);
  const fileInput = useRef(null);
  const msg = (m) => alert(m);

  /* ─── 파일 선택/미리보기 ─── */
  const addFiles = (list) => {
    if (!selectedCategory) return msg('카테고리를 먼저 선택하세요.');

    const chosen = Array.from(list);
    setFiles(chosen);
    setPreview({});
    setFileMetas(chosen.map(() => ({ description: '', tagOptions: [], selectedTags: [] })));

    /* 이미지·영상만 썸네일 생성 */
    chosen.forEach((file) => {
      const t   = extPreviewType(file.name);
      const url = URL.createObjectURL(file);

      if (t === '이미지') {
        setPreview((p) => ({ ...p, [file.name]: url }));
      } else if (t === '영상') {
        const video  = document.createElement('video');
        const canvas = document.createElement('canvas');
        video.src = url;
        video.onloadedmetadata = () => (video.currentTime = 0.1);
        video.onseeked = () => {
          canvas.width  = video.videoWidth;
          canvas.height = video.videoHeight;
          canvas.getContext('2d').drawImage(video, 0, 0);
          setPreview((p) => ({ ...p, [file.name]: canvas.toDataURL() }));
        };
      }
    });
  };

  const onDrop     = (e) => { e.preventDefault(); addFiles(e.dataTransfer.files); };
  const onOver     = (e) => e.preventDefault();
  const openPicker = () =>
    !selectedCategory ? msg('카테고리를 먼저 선택하세요.') : fileInput.current?.click();

  /* ─── 태그 생성 공용 ─── */
  const generateTags = async (description, cb) => {
    try {
      const form = new FormData();
      form.append('description', description);
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_BASE}/make_tags`,
        form,
        { withCredentials: true },
      );
      if (data.status === 'success') {
        cb(data.tags || []);
        msg('태그 생성 완료');
      } else msg(data.message || '태그 생성 실패');
    } catch {
      msg('네트워크 오류');
    }
  };

  /* 파일별 태그 */
  const makeFileTags = (idx) => {
    const d = fileMetas[idx].description.trim();
    if (!d) return msg('설명을 입력하세요.');
    generateTags(d, (tags) => patchMeta(idx, { tagOptions: tags, selectedTags: tags }));
  };
  const toggleFileTag = (idx, t) => {
    const cur = fileMetas[idx].selectedTags;
    patchMeta(idx, {
      selectedTags: cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t],
    });
  };

  /* 일괄 태그 */
  const makeBulkTags = () => {
    if (!bulkDesc.trim()) return msg('설명을 입력하세요.');
    generateTags(bulkDesc, (tags) => {
      setBulkTags(tags);
      setBulkSel(tags);
    });
  };
  const toggleBulkTag = (t) =>
    setBulkSel((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));

  /* ─── 업로드 ─── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!files.length || !selectedCategory) return msg('카테고리와 파일을 모두 선택하세요.');

    const missing = bulk
      ? !bulkDesc.trim()
      : fileMetas.some((m) => !m.description.trim());
    if (missing) return msg('모든 설명을 입력하세요.');

    const form = new FormData();
    files.forEach((f) => form.append('file', f));
    const meta = files.map((_, i) => ({
      description: bulk ? bulkDesc.trim() : fileMetas[i].description.trim(),
      tags:        (bulk ? bulkSel : fileMetas[i].selectedTags).join(','),
      category:    selectedCategory,
    }));
    form.append('meta', JSON.stringify(meta));

    setUploading(true);
    try {
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_BASE}/upload`,
        form,
        { withCredentials: true },
      );
      if (data.status === 'success') {
        msg('업로드 완료');
        setFiles([]); setPreview({}); setFileMetas([]);
        setBulkDesc(''); setBulkTags([]); setBulkSel([]);
        window.scrollTo(0, 0);
      } else msg(data.message || '업로드 실패');
    } catch {
      msg('네트워크 오류');
    } finally {
      setUploading(false);
    }
  };

  /* ─── UI ─── */
  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold text-center mb-8">⬆ 데이터 업로드</h1>

      {/* 카테고리 */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-4 mb-8">
        {categories.map((c) => (
          <div
            key={c.name}
            onClick={() => setSelectedCategory(c.name)}
            className={`cursor-pointer p-4 text-center border rounded transition
              ${selectedCategory === c.name ? 'bg-indigo-100 border-indigo-400' : 'bg-gray-50'}`}
          >
            <div className="text-2xl">{c.icon}</div>
            <div className="text-sm font-medium">{c.name}</div>
          </div>
        ))}
      </div>

      {/* 일괄 설명 토글 */}
      <label className="flex items-center gap-2 mb-6">
        <input type="checkbox" checked={bulk} onChange={(e) => setBulk(e.target.checked)} />
        부연 설명 일괄 적용
      </label>

      {/* 업로드 박스 */}
      <div
        onClick={openPicker}
        onDrop={onDrop}
        onDragOver={onOver}
        className="p-10 border-2 border-dotted rounded-2xl bg-sky-300 text-white text-center cursor-pointer"
      >
        <div className="text-4xl">📄</div>
        <p className="text-lg font-semibold mt-2">Drop files here</p>
        <p className="text-sm">
          or <span className="underline">Choose file</span>
        </p>
        <input
          ref={fileInput}
          type="file"
          multiple
          onChange={(e) => addFiles(e.target.files)}
          className="hidden"
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-8 mt-8">
        {/* 일괄 설명/태그 */}
        {bulk && files.length > 0 && (
          <>
            <textarea
              rows="4"
              className="border w-full p-3 rounded"
              placeholder="모든 파일에 적용될 설명"
              value={bulkDesc}
              onChange={(e) => setBulkDesc(e.target.value)}
            />
            <button
              type="button"
              onClick={makeBulkTags}
              className="px-3 py-1 text-xs bg-purple-600 text-white rounded"
            >
              태그 생성
            </button>

            {bulkTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {bulkTags.map((t) => {
                  const sel = bulkSel.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleBulkTag(t)}
                      className={`px-2 py-1 rounded text-xs border
                        ${sel ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                    >
                      #{t}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* 파일별 입력 */}
        {!bulk &&
          files.map((file, idx) => {
            const meta = fileMetas[idx] || {};
            return (
              <div key={idx} className="border rounded-lg p-4 bg-gray-50 space-y-3">
                <div className="font-semibold text-gray-700">📄 {file.name}</div>
                {preview[file.name] && (
                  <img
                    src={preview[file.name]}
                    alt="preview"
                    className="max-h-48 object-contain border rounded"
                  />
                )}

                <textarea
                  rows="3"
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="파일 설명"
                  value={meta.description}
                  onChange={(e) => patchMeta(idx, { description: e.target.value })}
                />

                <button
                  type="button"
                  onClick={() => makeFileTags(idx)}
                  className="px-3 py-1 text-xs bg-purple-600 text-white rounded"
                >
                  태그 생성
                </button>

                {meta.tagOptions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {meta.tagOptions.map((t) => {
                      const sel = meta.selectedTags.includes(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => toggleFileTag(idx, t)}
                          className={`px-2 py-1 rounded text-xs border
                            ${sel ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                        >
                          #{t}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

        {/* 업로드 버튼 */}
        {files.length > 0 && (
          <button
            type="submit"
            disabled={uploading}
            className="w-full bg-blue-600 text-white py-3 rounded text-lg disabled:opacity-60"
          >
            {uploading ? '업로드 중…' : '업로드'}
          </button>
        )}
      </form>
    </div>
  );
}

