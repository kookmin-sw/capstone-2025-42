import { Link } from 'react-router-dom';
import icon from '../assets/icon.png';

export default function Navbar() {
  return (
    <nav className="flex justify-between items-center px-6 py-4 shadow-md bg-white">
      {/* 로고 클릭 시 홈으로 이동 */}
      <Link to="/" className="flex items-center gap-2">
        <img src={icon} alt="로고 아이콘" className="w-8 h-8 object-contain" />
        <span className="text-xl font-bold text-blue-800">Archive ON</span>
      </Link>

      {/* 네비게이션 메뉴 */}
      <div className="flex gap-6 text-gray-700 font-medium">
        <Link to="/upload">데이터 업로드</Link>
        <Link to="/search">검색</Link>
        <Link to="/login">로그인 & 회원가입</Link>
      </div>
    </nav>
  );
}
