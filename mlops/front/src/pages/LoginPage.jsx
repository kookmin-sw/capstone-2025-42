// src/pages/LoginPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  /* ─── 지역 데이터 ─── */
  const [regionData, setRegionData] = useState({
    '시도(전체)': ['시군구(전체)'], // 초기 화면용
  });

  /* ─── 입력값 ─── */
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [region, setRegion]     = useState('시도(전체)');
  const [district, setDistrict] = useState('시군구(전체)');

  /* ─── 회원가입 모달 ─── */
  const [showSignup,     setShowSignup]     = useState(false);
  const [signupName,     setSignupName]     = useState('');
  const [signupEmail,    setSignupEmail]    = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  const navigate    = useNavigate();
  const showMessage = (m) => alert(m);

  /* ① 시/군/구 데이터 로드 */
  useEffect(() => {
    const fetchRegions = async () => {
      try {
        const res  = await fetch(`${import.meta.env.VITE_API_BASE}/api/regions`, {
          credentials: 'include',
        });
        const data = await res.json();
        setRegionData({ '시도(전체)': ['시군구(전체)'], ...data });
      } catch (err) {
        console.error(err);
        showMessage('지역 데이터를 불러오지 못했습니다.');
      }
    };
    fetchRegions();
  }, []);

  /* ② 로그인 */
  const handleLogin = async (e) => {
    e.preventDefault();

    /* 전체(ALL) 선택 방지 ------------------------- */
    if (region === '시도(전체)' || district === '시군구(전체)') {
      showMessage('전체 지역은 선택할 수 없습니다.\n구체적인 시·도와 군·구를 선택해 주세요.');
      return;
    }
    /* -------------------------------------------- */

    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, region, district }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        showMessage('로그인 성공! 메인 페이지로 이동합니다.');
	localStorage.setItem('userRegion',   region);
	localStorage.setItem('userDistrict', district);
	window.location.href = '/';
      } else {
        showMessage(data.message || '로그인 실패');
      }
    } catch (err) {
      console.error(err);
      showMessage('네트워크 오류');
    }
  };

  /* ③ 회원가입 */
  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/register`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: signupName,
          email: signupEmail,
          password: signupPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) showMessage('회원가입 성공! 이제 로그인해 주세요.');
      else        showMessage(data.message || '회원가입 실패');
    } catch (err) {
      console.error(err);
      showMessage('네트워크 오류');
    } finally {
      setShowSignup(false);
    }
  };

  /* ④ 시/도 바뀌면 시/군/구를 **자동으로 첫번째 항목**으로 변경 */
  const handleRegionChange = (e) => {
    const newRegion = e.target.value;
    setRegion(newRegion);

    const firstDistrict =
      (regionData[newRegion] && regionData[newRegion][0]) || '시군구(전체)';
    setDistrict(firstDistrict);
  };

  /* ─── UI ─── */
  return (
    <div className="flex justify-center items-center min-h-screen bg-blue-50 relative">
      {/* 로그인 카드 */}
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md z-10">
        <h2 className="text-2xl font-bold text-center mb-6">로그인</h2>

        <form className="space-y-4" onSubmit={handleLogin}>
          {/* 이메일 */}
          <div>
            <label className="block mb-1 text-gray-700 font-medium">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded px-4 py-2"
              placeholder="email@example.com"
              required
            />
          </div>

          {/* 비밀번호 */}
          <div>
            <label className="block mb-1 text-gray-700 font-medium">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded px-4 py-2"
              placeholder="비밀번호"
              required
            />
          </div>

          {/* 지역 선택 */}
          <div className="grid grid-cols-2 gap-2">
            {/* 시/도 */}
            <select
              value={region}
              onChange={handleRegionChange}
              className="border rounded p-2 text-sm"
              required
            >
              {Object.keys(regionData).map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            {/* 시/군/구 */}
            <select
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="border rounded p-2 text-sm"
              required
            >
              {(regionData[region] || []).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-700 text-white py-2 mt-2 rounded hover:bg-blue-800 transition"
          >
            로그인
          </button>
        </form>

        {/* 회원가입 유도 */}
        <p className="text-center text-sm text-gray-600 mt-4">
          계정이 없으신가요?{' '}
          <button onClick={() => setShowSignup(true)} className="text-blue-700 underline">
            회원가입
          </button>
        </p>
      </div>

      {showSignup && (
        <>
          <div className="fixed inset-0 bg-black/40 z-20" onClick={() => setShowSignup(false)} />
          <div className="fixed inset-0 z-30 flex justify-center items-center">
            <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
              <h3 className="text-xl font-bold mb-6">회원가입</h3>
              <form className="space-y-4" onSubmit={handleSignup}>
                <input
                  type="text"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  className="w-full border rounded px-4 py-2"
                  placeholder="이름"
                  required
                />
                <input
                  type="email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  className="w-full border rounded px-4 py-2"
                  placeholder="email@example.com"
                  required
                />
                <input
                  type="password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  className="w-full border rounded px-4 py-2"
                  placeholder="비밀번호"
                  required
                />

                <div className="flex justify-between mt-6">
                  <button
                    type="button"
                    onClick={() => setShowSignup(false)}
                    className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
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

