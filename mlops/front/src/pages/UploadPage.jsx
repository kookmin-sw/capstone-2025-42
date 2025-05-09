// src/pages/UploadPage.jsx
import { useState } from 'react';
import axios from 'axios';

const categories = ['건강', '동물', '식품', '문화', '생활', '자원환경', '기타'];

export default function UploadPage() {
  /* ── state ───────────────────────────── */
  const [files,     setFiles]     = useState([]);
  const [fileMetas, setFileMetas] = useState([]);   // [{description, category, tagOptions, selectedTags}]
  const [uploading, setUploading] = useState(false);

  const showMessage = (m) => alert(m);
  const updateMeta  = (idx, patch) =>
    setFileMetas((prev) => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)));

  /* ── 파일 선택 ───────────────────────── */
  const handleFileChange = (e) => {
    const chosen = Array.from(e.target.files || []);
    setFiles(chosen);
    setFileMetas(
      chosen.map(() => ({
        description: '',
        category:    categories[0],
        tagOptions:  [],
        selectedTags: [],
      })),
    );
  };

  /* ── 태그 자동 생성 (파일별) ───────────── */
  const handleMakeTags = async (idx) => {
    const desc = fileMetas[idx].description.trim();
    if (!desc) return showMessage('설명을 입력하세요.');

    try {
      const form = new FormData();
      form.append('description', desc);
      const res = await axios.post(
        `${import.meta.env.VITE_API_BASE}/make_tags`,
        form,
        { withCredentials: true },
      );

      if (res.data?.status === 'success') {
        const tags = res.data.tags || [];
        updateMeta(idx, { tagOptions: tags, selectedTags: tags });
        showMessage('태그가 생성되었습니다.');
      } else {
        showMessage(res.data?.message || '태그 생성 실패');
      }
    } catch {
      showMessage('네트워크 오류');
    }
  };

  /* ── 태그 토글 ────────────────────────── */
  const toggleTag = (idx, t) => {
    const { selectedTags } = fileMetas[idx];
    updateMeta(idx, {
      selectedTags: selectedTags.includes(t)
        ? selectedTags.filter((x) => x !== t)
        : [...selectedTags, t],
    });
  };

  /* ── 업로드 ───────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!files.length) return showMessage('업로드할 파일을 선택하세요.');

    const form = new FormData();
    files.forEach((f) => form.append('file', f));

    const metaList = fileMetas.map((m) => ({
      description: m.description.trim(),
      tags:        m.selectedTags.join(','),
      category:    m.category,
    }));
    form.append('meta', JSON.stringify(metaList));

    setUploading(true);
    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_BASE}/upload`,
        form,
        { withCredentials: true },
      );
      if (res.data?.status === 'success') {
        showMessage('업로드 완료!');
        setFiles([]);
        setFileMetas([]);
	window.location.reload();
      } else {
        showMessage(res.data?.message || '업로드 실패');
      }
    } catch {
      showMessage('네트워크 오류');
    } finally {
      setUploading(false);
    }
  };

  /* ── UI ───────────────────────────────── */
  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-gray-800 mb-8 text-center">⬆ 데이터 업로드</h1>

      <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 space-y-6">
        {/* 파일 선택 */}
        <div>
          <label className="block font-medium mb-1">파일 선택 (여러 개 가능)</label>
          <input
            type="file"
            multiple
            onChange={handleFileChange}
            className="w-full border rounded p-2 text-sm"
            required
          />
        </div>

        {/* 파일별 카드 */}
        {files.map((file, idx) => {
          const meta = fileMetas[idx] || {};
          return (
            <div key={idx} className="border rounded-lg p-4 space-y-3">
              <h2 className="font-semibold text-gray-700">📄 {file.name}</h2>

              {/* 설명 */}
              <div>
                <label className="block text-sm font-medium mb-1">설명</label>
                <textarea
                  rows="3"
                  value={meta.description}
                  onChange={(e) => updateMeta(idx, { description: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="파일 설명"
                />
                <button
                  type="button"
                  onClick={() => handleMakeTags(idx)}
                  className="mt-2 px-3 py-1 text-xs bg-purple-600 text-white rounded"
                >
                  태그 생성
                </button>
              </div>

              {/* 태그 선택 */}
              {meta.tagOptions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {meta.tagOptions.map((t) => {
                    const selected = meta.selectedTags.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleTag(idx, t)}
                        className={`px-2 py-1 rounded text-xs border
                          ${selected ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700'}
                        `}
                      >
                        #{t}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 카테고리 선택 (개별) */}
              <div>
                <label className="block text-sm font-medium mb-1">카테고리</label>
                <select
                  value={meta.category}
                  onChange={(e) => updateMeta(idx, { category: e.target.value })}
                  className="border rounded p-2 text-sm"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}

        {/* 업로드 버튼 */}
        <button
          type="submit"
          disabled={uploading}
          className="w-full bg-blue-600 text-white py-2 rounded disabled:opacity-60"
        >
          {uploading ? '업로드 중…' : '업로드'}
        </button>
      </form>
    </div>
  );
}
