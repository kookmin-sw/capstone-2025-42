import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { regionData } from '../data/regionData'; // 경로는 실제 위치에 맞게 수정해주세요

export default function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [region, setRegion] = useState('');
  const [strict, setStrict] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();

    const loginData = { email, password, region, strict };
    console.log('로그인 정보:', loginData);

    // 지역 정보 저장
    localStorage.setItem('userRegion', region);
    localStorage.setItem('userStrict', strict);

    // 로그인 완료 후 이동
    navigate('/home');
  };

  const regionKeys = Object.keys(regionData).filter((key) => key !== '시도(전체)');

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <form onSubmit={handleLogin} className="bg-white p-8 rounded shadow-md w-96 space-y-4">
        <h2 className="text-2xl font-bold text-center mb-4">로그인</h2>

        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-2 border rounded"
          required
        />

        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-2 border rounded"
          required
        />

        {/* 시/도 선택 */}
        <select
          value={region}
          onChange={(e) => {
            setRegion(e.target.value);
            setStrict('');
          }}
          className="w-full px-4 py-2 border rounded"
          required
        >
          <option value="">시/도를 선택하세요</option>
          {regionKeys.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        {/* 시/군/구 선택 */}
        <select
          value={strict}
          onChange={(e) => setStrict(e.target.value)}
          className="w-full px-4 py-2 border rounded"
          required
        >
          <option value="">시/군/구를 선택하세요</option>
          {region && regionData[region]?.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <button
          type="submit"
          className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
        >
          로그인
        </button>
      </form>
    </div>
  );
}
