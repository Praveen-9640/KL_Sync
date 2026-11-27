import Admin from './pages/Admin.jsx';
import Events from './pages/Events.jsx';
import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Rooms from './pages/Rooms.jsx';
import Play from './pages/Play.jsx';
import Market from './pages/Market.jsx';
import Needs from './pages/Needs.jsx';
import Projects from './pages/Projects.jsx';
import Profile from './pages/Profile.jsx';
import Settings from './pages/Settings.jsx';


export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="rooms" element={<Rooms />} />
        <Route path="play" element={<Play />} />
        <Route path="market" element={<Market />} />
        <Route path="needs" element={<Needs />} />
        <Route path="events" element={<Events />} />
        <Route path="projects" element={<Projects />} />
        <Route path="profile" element={<Profile />} />
        <Route path="settings" element={<Settings />} />
        <Route path="admin" element={<ProtectedRoute admin><Admin /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
