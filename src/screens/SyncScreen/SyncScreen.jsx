// src/screens/SyncScreen/SyncScreen.jsx

import { useState } from 'react';
import styles from './SyncScreen.module.css';  // <-- add this

import CameraPreview from './CameraPreview';
import SyncControls from './SyncControls';
import StatusIndicator from './StatusIndicator';

function SyncScreen() {
  const [syncStatus, setSyncStatus] = useState("Idle");

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Multi-Angle Sync</h1>
      <div className={styles.content}>
        <CameraPreview />
        <SyncControls setSyncStatus={setSyncStatus} />
        <StatusIndicator syncStatus={syncStatus} />
      </div>
    </div>
  );
}

export default SyncScreen;
