import { Link } from 'react-router-dom';
import icon from '../assets/icon.png';

export default function Navbar() {
  return (
    <nav className="flex justify-between items-center px-6 py-2 shadow-md bg-white h-16">
      <Link to="/" className="flex items-center gap-3">
        <img src={icon} alt="로고 아이콘" className="h-20 w-auto object-center" />
        <span className="text-2xl font-bold text-blue-800">Archive ON</span>
      </Link>
      <div className="flex gap-6 text-gray-700 font-medium">
        <Link to="/upload">데이터 업로드</Link>
        <Link to="/search">검색</Link>
        <Link to="/login">로그인 & 회원가입</Link>
      </div>
    </nav>
  
  );
}

