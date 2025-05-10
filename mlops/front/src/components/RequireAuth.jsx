// src/components/RequireAuth.jsx
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

export default function RequireAuth({ children }) {
  const [auth, setAuth] = useState(null);  // null=로딩, true/false=결과

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE}/api/me`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then(() => setAuth(true))
      .catch(() => setAuth(false));
  }, []);

  if (auth === null) return null;          // 스피너 등을 넣어도 됨
  if (auth === false) return <Navigate replace to="/login" />;
  return children;                         // 통과 → 실제 페이지 렌더
}

