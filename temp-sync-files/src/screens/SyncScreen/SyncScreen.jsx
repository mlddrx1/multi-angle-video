// SyncScreen.jsx

import { useState } from 'react';
import CameraPreview from './CameraPreview';
import SyncControls from './SyncControls';
import StatusIndicator from './StatusIndicator';

function SyncScreen() {
  const [syncStatus, setSyncStatus] = useState("Idle");

  return (
    <div>
      <h1>Multi-Angle Sync</h1>
      <CameraPreview />
      <SyncControls />
      <StatusIndicator syncStatus={syncStatus} />
    </div>
  );
}

export default SyncScreen;