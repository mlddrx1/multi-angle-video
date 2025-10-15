import { Routes, Route } from "react-router-dom";
import SyncScreen from "./screens/SyncScreen/SyncScreen";
import EditScreen from "./screens/EditScreen/EditScreen";

export default function App() {
  return (
    <div style={{ padding: 16 }}>
      <Routes>
        <Route path="/" element={<SyncScreen />} />
        <Route path="/edit" element={<EditScreen />} />
      </Routes>
    </div>
  );
}
