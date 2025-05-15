// src/components/Navbar.jsx
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import icon from '../assets/icon.png';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  /* ───── 로그인 상태 ───── */
  const [loggedIn, setLoggedIn] = useState(null); // null = 로딩
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE}/api/me`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(() => setLoggedIn(true))
      .catch(() => setLoggedIn(false));
  }, [location.pathname]);

  /* ───── 지역 드롭다운 데이터 ───── */
  const [regionsData, setRegionsData] = useState(null);      // { "서울특별시": ["강남구",…], … }
  const [region,   setRegion]   = useState(localStorage.getItem('userRegion')   || '');
  const [district, setDistrict] = useState(localStorage.getItem('userDistrict') || '');
  const [saving,        setSaving]        = useState(false);

  /* 로그인 후 한 번만 지역 목록 로드 */
  useEffect(() => {
    if (!loggedIn) return;

    fetch(`${import.meta.env.VITE_API_BASE}/api/regions`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => setRegionsData(data))
      .catch(err => console.error('지역 로드 실패', err));
  }, [loggedIn]);

  /* 시·도 선택 시 군·구 초기화 */
  const handleRegionChange = (e) => {
    setRegion(e.target.value);
    setDistrict('');                    // 군·구 초기화
  };

  /* 지역 저장 */
  const handleSetVillage = async () => {
    if ((!region) || (region === '시도(전체)') || (region === '')) {
      alert('시·도를 선택해 주세요.');
      return; 
    }
    if ((!district) || (district === '시군구(전체)') || (district === '')) {
      alert('군·구를 선택해 주세요.');
      return;
    }
    setSaving(true);
    try {
      await fetch(`${import.meta.env.VITE_API_BASE}/set_village`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ region, district }),
      });
    } catch (e) {
      alert('지역 정보를 저장하지 못했습니다.');
      console.error(e);
    } finally {
      localStorage.setItem('userRegion',   region);
      localStorage.setItem('userDistrict', district);
      setSaving(false);
      window.location.reload();	
    }
  };

  /* 로그아웃 */
  const handleLogout = async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_BASE}/api/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch { /* ignore */ }
    setLoggedIn(false);
    localStorage.removeItem('userRegion');
    localStorage.removeItem('userDistrict');
    window.location.href = '/';
  };

  /* ───── 렌더링 ───── */
  if (loggedIn === null) {
    return <nav className="flex justify-between items-center px-6 py-4 shadow-md bg-white" />;
  }

  return (
    <nav className="flex justify-between items-center px-6 py-1 shadow-md bg-white">
      {/* 로고 → 홈 */}
      <Link to="/" className="flex items-center gap-2">
        <img src={icon} alt="로고 아이콘" className="w-30 h-20 object-contain" />
        <span className="text-xl font-bold text-blue-800">Archive ON</span>
      </Link>

      {/* 메뉴 + 지역설정 */}
      <div className="flex gap-6 items-center text-gray-700 font-medium">

        {/* ▼ 지역 드롭다운 (로그인한 경우 & 데이터 로드 완료 시) */}
        {loggedIn && regionsData && (
          <>
            {/* 시·도 */}
            <select
              value={region}
              onChange={handleRegionChange}
              className="border rounded px-2 py-1"
            >
              <option value="">시·도 선택</option>
              {Object.keys(regionsData).map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            {/* 군·구 */}
            <select
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              disabled={!region}
              className="border rounded px-2 py-1"
            >
              <option value="">군·구 선택</option>
              {region && regionsData[region].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            {/* 저장 버튼 */}
            <button
              onClick={handleSetVillage}
              disabled={saving || !district}
              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
            >
              {saving ? '저장중…' : '저장'}
            </button>
          </>
        )}

        {/* 일반 메뉴 */}
        {loggedIn && <Link to="/upload">데이터&nbsp;업로드</Link>}
        <Link to="/search">검색</Link>
        {loggedIn ? (
          <button onClick={handleLogout} className="text-red-600 hover:text-red-700">
            로그아웃
          </button>
        ) : (
          <Link to="/login">로그인&nbsp;&amp;&nbsp;회원가입</Link>
        )}
      </div>
    </nav>
  );
}

