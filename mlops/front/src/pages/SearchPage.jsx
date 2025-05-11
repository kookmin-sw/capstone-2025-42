// src/pages/SearchPage.jsx
import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import NumericalDownloads from './NumericalDownloads.jsx';
import MergeTablesModal   from './MergeTablesModal.jsx';

/* ────────── 일반 파일 유형 텍스트 표기 ────────── */
const FILE_TYPE_MAP = { text: '문서', video: '영상', image: '이미지', numerical: '표(정형)' };
const dataTypes   = ['전체', ...Object.values(FILE_TYPE_MAP)];
const sortOptions = ['제목순', '최신순', '지역순'];

/* 카테고리 → 이모지 */
const CATEGORY_EMOJI_MAP = {
  건강: '🩺', 동물: '🐐', 식품: '🍽️', 문화: '🎭',
  생활: '🍳', 자원환경: '🌿', 기타: '➕',
};

/* fetch JSON (세션 쿠키 포함) */
const fetchJSON = async (url, opts={})=>{
  const r = await fetch(url,{...opts,credentials:'include'});
  if(!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

export default function SearchPage() {
  const API = import.meta.env.VITE_API_BASE;
  const navigate = useNavigate();

  /* 로그인 1회 확인 */
  const [loggedIn,setLoggedIn]=useState(false);
  useEffect(()=>{ fetchJSON(`${API}/api/me`).then(()=>setLoggedIn(true)).catch(()=>setLoggedIn(false)); },[]);

  /* 지역·카테고리·파일 데이터 */
  const [regionData,setRegionData]            = useState({'시도(전체)':['시군구(전체)']});
  const [categories,setCategories]            = useState([]);
  const [categoryDataMap,setCategoryDataMap]  = useState({});

  /* 검색·필터 상태 */
  const [selectedCategory,setSelectedCategory]= useState(null);
  const [searchKeyword,setSearchKeyword]      = useState('');
  const [selectedRegion,setSelectedRegion]    = useState('시도(전체)');
  const [selectedDistrict,setSelectedDistrict]= useState('시군구(전체)');
  const [selectedDataType,setSelectedDataType]= useState('전체');
  const [selectedSort,setSelectedSort]        = useState('최신순');
  const [relatedWords,setRelatedWords]        = useState([]);
  const [loading,setLoading]                  = useState(false);

  /* Numerical 팝업 상태 */
  const [selectedNumerical,setSelectedNumerical]=useState(null);
  const [mergeTable,setMergeTable]              = useState(null);

  /* 상세보기 모달 상태 */
  const [detailItem,setDetailItem]   = useState(null);
  const [previewKind,setPreviewKind] = useState('');
  const [previewSrc,setPreviewSrc]   = useState('');
  const [previewLoading,setPreviewLoading]=useState(false);

  /* ① 지역 */
  useEffect(()=>{ fetchJSON(`${API}/api/regions`).then(setRegionData).catch(console.error); },[]);

  /* ② 카테고리 */
  useEffect(()=>{ fetchJSON(`${API}/get_categories`).then(setCategories).catch(console.error); },[]);

  /* ③ 카테고리별 데이터 */
  useEffect(()=>{
    if(!selectedCategory||categoryDataMap[selectedCategory]) return;
    (async()=>{
      setLoading(true);
      try{
        const url=new URL(`${API}/search_by_category`); url.searchParams.set('category',selectedCategory);
        const data=await fetchJSON(url);
        setCategoryDataMap(p=>({...p,[selectedCategory]:data}));
      }finally{ setLoading(false); }
    })();
  },[selectedCategory,categoryDataMap]);

  /* ④ 검색 */
  const handleSearch = useCallback(async(kw=searchKeyword)=>{
    if(!kw.trim()) return;
    const url=new URL(`${API}/search`);
    url.searchParams.set('word',kw.trim());
    if(selectedSort==='제목순') url.searchParams.set('order','name');
    else if(selectedSort==='최신순') url.searchParams.set('order','recent');
    if(selectedDataType!=='전체'){
      const key=Object.entries(FILE_TYPE_MAP).find(([,v])=>v===selectedDataType)?.[0];
      if(key) url.searchParams.set('exp',key);
    }
    setLoading(true);
    try{
      const {results,related_word}=await fetchJSON(url);
      setCategories(Object.keys(results).map(n=>({name:n,count:results[n].length})));
      setCategoryDataMap(results);
      setSelectedCategory(null);
      setRelatedWords(related_word);
    }finally{ setLoading(false); }
  },[searchKeyword,selectedSort,selectedDataType]);

  /* ⑤ 필터·정렬 */
  const filteredData=useMemo(()=>{
    let arr= selectedCategory ? (categoryDataMap[selectedCategory]||[]) : Object.values(categoryDataMap).flat();
    if(selectedRegion!=='시도(전체)') arr=arr.filter(i=>i.region===selectedRegion);
    if(selectedDistrict!=='시군구(전체)') arr=arr.filter(i=>i.district===selectedDistrict);
    if(selectedDataType!=='전체') arr=arr.filter(i=>FILE_TYPE_MAP[i.type]===selectedDataType);

    if(selectedSort==='제목순') arr=[...arr].sort((a,b)=>a.title.localeCompare(b.title));
    else if(selectedSort==='최신순') arr=[...arr].sort((a,b)=>new Date(b.date)-new Date(a.date));
    else arr=[...arr].sort((a,b)=>{const c=a.region.localeCompare(b.region);return c||a.district.localeCompare(b.district);});
    return arr;
  },[selectedCategory,categoryDataMap,selectedRegion,selectedDistrict,selectedDataType,selectedSort]);

  /* ── 상세 미리보기 (비정형 파일) ── */
  const openDetail=async(item)=>{
    setDetailItem(item); setPreviewKind(''); setPreviewSrc('');
    if(item.type==='text'){ setPreviewKind('text-desc'); return; }

    setPreviewLoading(true);
    try{
      const {url,file_type}=await fetchJSON(`${API}/preview_url?file_path=${encodeURIComponent(item.file_path)}`);
      switch(file_type){
        case 'image': case 'video': case 'pdf':
          setPreviewKind(file_type); setPreviewSrc(url); break;
        case 'text':
          setPreviewKind('text'); setPreviewSrc(await fetch(url).then(r=>r.text())); break;
        case 'office':
          setPreviewKind('office'); setPreviewSrc(`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`); break;
        default:
          setPreviewKind('none');
      }
    }catch(e){ console.error(e); setPreviewKind('none'); }
    finally{ setPreviewLoading(false); }
  };
  const closeDetail=()=>{ setDetailItem(null); setPreviewKind(''); setPreviewSrc(''); };

  /* ── 버튼 핸들러 ── */
  const handleDetail = (item)=>{
    if(item.type==='numerical') setMergeTable({ table_name:item.title });
    else openDetail(item);
  };

  const handleDownload = async(item)=>{
    try{ await fetchJSON(`${API}/api/me`); }
    catch{ alert('다운로드하려면 로그인하세요'); return navigate('/login'); }

    if(item.type==='numerical') setSelectedNumerical(item.title);
    else{
      const url=`${API}/download?file_path=${encodeURIComponent(item.file_path)}&title=${encodeURIComponent(item.title)}`;
      window.open(url,'_blank');
    }
  };

  /* ────────────── JSX ────────────── */
  return (
    <>
      <div className="bg-white min-h-screen px-6 py-10">
        <h1 className="text-3xl font-bold mb-8">데이터 검색</h1>

        {/* 카테고리 */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6 mb-10">
          {categories.map(cat=>(
            <div key={cat.name}
              onClick={()=>{setSelectedCategory(cat.name); setSelectedDataType('전체'); setSelectedSort('최신순');}}
              className={`cursor-pointer p-4 rounded-lg shadow flex flex-col items-center
                ${selectedCategory===cat.name?'bg-blue-100':'bg-blue-50'} hover:bg-blue-100`}>
              <span className="text-4xl mb-2">{CATEGORY_EMOJI_MAP[cat.name]??'📂'}</span>
              <div className="text-sm font-semibold">{cat.name}</div>
              <div className="text-xs text-blue-600 mt-1">{cat.count}종</div>
            </div>
          ))}
        </div>

        {/* 검색·필터 */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6 bg-gray-100 p-4 rounded-lg items-end">
          <select value={selectedRegion} onChange={e=>{setSelectedRegion(e.target.value); setSelectedDistrict('시군구(전체)');}} className="border rounded p-4">
            {Object.keys(regionData).map(r=><option key={r}>{r}</option>)}
          </select>
          <select value={selectedDistrict} onChange={e=>setSelectedDistrict(e.target.value)} className="border rounded p-4">
            {(regionData[selectedRegion]||[]).map(d=><option key={d}>{d}</option>)}
          </select>
          <select value={selectedDataType} onChange={e=>setSelectedDataType(e.target.value)} className="border rounded p-4">
            {dataTypes.map(t=><option key={t}>{t}</option>)}
          </select>
          <select value={selectedSort} onChange={e=>setSelectedSort(e.target.value)} className="border rounded p-4">
            {sortOptions.map(s=><option key={s}>{s}</option>)}
          </select>
          <div className="flex gap-2">
            <input value={searchKeyword} onChange={e=>setSearchKeyword(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&handleSearch()}
              className="w-full px-4 py-2 border rounded shadow-sm" placeholder="제목 또는 설명" />
            <button onClick={()=>handleSearch()} className="px-4 py-2 bg-blue-500 text-white text-sm rounded">검색</button>
          </div>
        </div>

        {/* 연관검색어 */}
        {relatedWords.length>0&&(
          <div className="mb-8 flex flex-wrap gap-2">
            {relatedWords.map(w=>(
              <span key={w} onClick={()=>{setSearchKeyword(w); handleSearch(w);}}
                className="cursor-pointer bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full">{w}</span>
            ))}
          </div>
        )}

        {/* 결과 */}
        {loading?(
          <p className="text-sm text-gray-500">데이터를 불러오는 중…</p>
        ):filteredData.length?(
          <div className="border-t pt-6">
            <h2 className="text-xl font-bold mb-4">{selectedCategory??'검색 결과'} 목록</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border">
                <thead className="bg-gray-100">
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
                  {filteredData.map(item=>(
                    <tr key={item.id} className="hover:bg-gray-50 border-b">
                      <td className="px-4 py-2 font-medium text-blue-600">{item.title}</td>
                      <td className="px-4 py-2">{item.summary}</td>
                      <td className="text-center">{item.region} {item.district}</td>
                      <td className="text-center">{FILE_TYPE_MAP[item.type]||item.type}</td>
                      <td className="text-center">{item.date}</td>
                      <td className="text-center whitespace-nowrap">
                        <button onClick={()=>handleDetail(item)} className="text-xs text-indigo-600 hover:underline mr-2">상세보기</button>
                        <button onClick={()=>handleDownload(item)} className="text-xs text-green-600 hover:underline">다운로드</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ):(
          <p className="text-sm text-gray-500">검색 결과가 없습니다.</p>
        )}
      </div>

      {/* ── 비정형 파일 상세 미리보기 모달 ── */}
      {detailItem && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white w-11/12 md:w-2/3 lg:w-1/2 max-h-[90vh] overflow-auto rounded-lg p-6 relative">
            <button onClick={closeDetail} className="absolute top-2 right-2 text-xl text-gray-500 hover:text-gray-700">&times;</button>
            <h3 className="text-lg font-bold mb-4">{detailItem.title}</h3>

            {previewKind==='text-desc' && <p className="whitespace-pre-wrap">{detailItem.summary}</p>}
            {previewKind==='text'      && <pre className="whitespace-pre-wrap text-sm">{previewSrc}</pre>}
            {previewKind==='pdf'   && previewSrc && <iframe src={previewSrc} className="w-full h-[75vh]" />}
            {previewKind==='office'&& previewSrc && <iframe src={previewSrc} className="w-full h-[75vh]" />}
            {previewKind==='image' && previewSrc && <img src={previewSrc} alt={detailItem.title} className="max-w-full mx-auto" />}
            {previewKind==='video' && previewSrc && <video src={previewSrc} controls className="w-full max-h-[70vh] mx-auto" />}
            {previewLoading && <p className="text-sm text-gray-500">미리보기를 불러오는 중…</p>}
            {previewKind==='none' && !previewLoading && <p className="text-sm text-red-500">이 형식은 미리보기를 지원하지 않습니다.</p>}
          </div>
        </div>,
        document.body
      )}

      {/* ── Numerical 팝업들 ── */}
      {selectedNumerical && (
        <NumericalDownloads
          tableName={selectedNumerical}
          onClose={()=>setSelectedNumerical(null)}
        />
      )}
      {mergeTable && (
        <MergeTablesModal
          baseTable={mergeTable}
          onClose={()=>setMergeTable(null)}
        />
      )}
    </>
  );
}

