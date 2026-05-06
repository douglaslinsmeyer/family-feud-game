import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminRoute } from './routes/AdminRoute';
import { ProjectorRoute } from './routes/ProjectorRoute';
import { PersistenceProvider } from './persistence/PersistenceProvider';
import { AudioProvider } from './audio/AudioContext';

export default function App() {
  return (
    <PersistenceProvider>
      <AudioProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/admin" replace />} />
            <Route path="/admin" element={<AdminRoute />} />
            <Route path="/projector" element={<ProjectorRoute />} />
          </Routes>
        </BrowserRouter>
      </AudioProvider>
    </PersistenceProvider>
  );
}
