import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminRoute } from './routes/AdminRoute';
import { ProjectorRoute } from './routes/ProjectorRoute';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/admin" element={<AdminRoute />} />
        <Route path="/projector" element={<ProjectorRoute />} />
      </Routes>
    </BrowserRouter>
  );
}
