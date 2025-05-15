// src/components/Navbar.jsx
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react';
import icon from '../assets/icon.png';

export default function Navbar() {
  const navigate   = useNavigate();
  const [loggedIn, setLoggedIn] = useState(null);     // null = 로딩 중
  const location = useLocation();

  /* ✔︎ 로그인 여부: 서버에 물어보기 -------------------------------- */
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE}/api/me`, {
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(() => setLoggedIn(true))      // 토큰 OK
      .catch(() => setLoggedIn(false));   // 미로그인 • 만료 • 오류
  }, [location.pathname]);

  /* ✔︎ 로그아웃 --------------------------------------------------- */
  const handleLogout = async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_BASE}/api/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (_) {/* ignore network errors */}
    setLoggedIn(false);
    navigate('/');
  };

  /* 로딩 상태일 땐 잠깐 빈 네비게이션을 보여 주거나 스켈레톤 처리 */
  if (loggedIn === null) {
    return (
      <nav className="flex justify-between items-center px-6 py-4 shadow-md bg-white">
        <div />
      </nav>
    );
  }

  return (
    <nav className="flex justify-between items-center px-6 py-1 shadow-md bg-white">
      {/* 로고 → 홈 */}
      <Link to="/" className="flex items-center gap-2">
        <img src={icon} alt="로고 아이콘" className="w-30 h-20 object-contain" />
        <span className="text-xl font-bold text-blue-800">Archive ON</span>
      </Link>

      {/* 메뉴 */}
      <div className="flex gap-6 text-gray-700 font-medium">
        {/* 업로드는 로그인한 경우에만 */}
        {loggedIn && <Link to="/upload">데이터 업로드</Link>}

        <Link to="/search">검색</Link>

        {loggedIn ? (
          <button
            onClick={handleLogout}
            className="text-red-600 hover:text-red-700 transition"
          >
            로그아웃
          </button>
        ) : (
          <Link to="/login">로그인&nbsp;&amp;&nbsp;회원가입</Link>
        )}
      </div>
    </nav>
  
  );
}

