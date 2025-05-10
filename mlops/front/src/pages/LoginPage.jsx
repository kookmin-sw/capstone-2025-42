import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { regionData } from '../data/regionData';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showSignup, setShowSignup] = useState(false);
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('서울특별시');
  const [selectedDistrict, setSelectedDistrict] = useState(regionData['서울특별시'][0]);

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ username: email, password }),
      });

      const data = await res.json();
      if (res.ok) {
        console.log('✅ 로그인 성공', data);
        localStorage.setItem('selectedRegion', `${selectedRegion} ${selectedDistrict}`);
        navigate('/');
      } else {
        alert(data.message || '로그인 실패');
      }
    } catch (err) {
      console.error('로그인 요청 오류', err);
      alert('서버 오류로 로그인에 실패했습니다.');
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: signupEmail, password: signupPassword }),
      });

      const data = await res.json();
      if (res.ok) {
        alert('회원가입 성공');
        setShowSignup(false);
      } else {
        alert(data.message || '회원가입 실패');
      }
    } catch (err) {
      console.error('회원가입 요청 오류', err);
      alert('서버 오류로 회원가입에 실패했습니다.');
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-blue-50 relative">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md z-10">
        <h2 className="text-2xl font-bold text-center mb-6">로그인</h2>
        <form className="space-y-4" onSubmit={handleLogin}>
          <div>
            <label className="block mb-1 text-gray-700 font-medium">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded px-4 py-2"
              placeholder="email@example.com"
              required
            />
          </div>
          <div>
            <label className="block mb-1 text-gray-700 font-medium">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded px-4 py-2"
              placeholder="비밀번호"
              required
            />
          </div>
          <div>
            <label className="block mb-1 text-gray-700 font-medium">시/도</label>
            <select
              value={selectedRegion}
              onChange={(e) => {
                setSelectedRegion(e.target.value);
                setSelectedDistrict(regionData[e.target.value][0]);
              }}
              className="w-full border border-gray-300 rounded px-4 py-2"
            >
              {Object.keys(regionData).map((region) => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mb-1 text-gray-700 font-medium">시/군/구</label>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="w-full border border-gray-300 rounded px-4 py-2"
            >
              {regionData[selectedRegion].map((district) => (
                <option key={district} value={district}>{district}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="w-full bg-blue-700 text-white py-2 rounded hover:bg-blue-800 transition"
          >
            로그인
          </button>
        </form>
        <p className="text-center text-sm text-gray-600 mt-4">
          계정이 없으신가요?{' '}
          <button onClick={() => setShowSignup(true)} className="text-blue-700 underline">
            회원가입
          </button>
        </p>
      </div>

      {showSignup && (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-40 z-20" onClick={() => setShowSignup(false)} />
          <div className="fixed inset-0 z-30 flex justify-center items-center">
            <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
              <h3 className="text-xl font-bold mb-6">회원가입</h3>
              <form className="space-y-4" onSubmit={handleSignup}>
                <div>
                  <label className="block mb-1 text-gray-700 font-medium">이름</label>
                  <input
                    type="text"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    className="w-full border border-gray-300 rounded px-4 py-2"
                    placeholder="홍길동"
                    required
                  />
                </div>
                <div>
                  <label className="block mb-1 text-gray-700 font-medium">이메일</label>
                  <input
                    type="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    className="w-full border border-gray-300 rounded px-4 py-2"
                    placeholder="email@example.com"
                    required
                  />
                </div>
                <div>
                  <label className="block mb-1 text-gray-700 font-medium">비밀번호</label>
                  <input
                    type="password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    className="w-full border border-gray-300 rounded px-4 py-2"
                    placeholder="비밀번호"
                    required
                  />
                </div>
                <div className="flex justify-between mt-6">
                  <button
                    type="button"
                    onClick={() => setShowSignup(false)}
                    className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400 transition"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition"
                  >
                    회원가입
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
