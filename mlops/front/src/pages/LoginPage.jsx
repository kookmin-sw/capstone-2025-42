import { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showSignup, setShowSignup] = useState(false);

  // 회원가입용 상태
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    console.log('✅ 로그인 시도:', { email, password });
  };

  const handleSignup = (e) => {
    e.preventDefault();
    console.log('✅ 회원가입 시도:', {
      name: signupName,
      email: signupEmail,
      password: signupPassword,
    });
    setShowSignup(false); // 모달 닫기
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-blue-50 relative">
      {/* 로그인 폼 */}
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

      {/* 회원가입 모달 */}
      {showSignup && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-40 z-20"
            onClick={() => setShowSignup(false)}
          />
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
