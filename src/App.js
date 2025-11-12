import { Routes, Route } from 'react-router-dom';
import SyncScreen from './screens/SyncScreen/SyncScreen';
import EditScreen from './screens/EditScreen/EditScreen';
import CameraPage from './screens/CameraPage/CameraPage';

export default function App() {
  return (
    <div style={{ padding: 16 }}>
      <Routes>
        <Route path="/" element={<SyncScreen />} />
        <Route path="/edit" element={<EditScreen />} />
        <Route path="/camera" element={<CameraPage />} /> {/* ← new */}
      </Routes>
    </div>
  );
}
