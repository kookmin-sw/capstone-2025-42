import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import RequireAuth from './components/RequireAuth';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import UploadPage from './pages/UploadPage';
import SearchPage from './pages/SearchPage';
import LoginPage from './pages/LoginPage';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/upload"
            element={
              <RequireAuth>
                <UploadPage />
              </RequireAuth>
            }
          />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </div>
    </Router>
  );
}
