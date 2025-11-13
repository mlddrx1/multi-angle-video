// src/screens/SyncScreen/SyncScreen.jsx
import { useState } from 'react';
import styles from './SyncScreen.module.css';

// Replaced old components (CameraPreview, SyncControls, StatusIndicator)
// with the new all-in-one VideoGrid
import VideoGrid from '../../components/VideoGrid';

function SyncScreen() {
  const [syncStatus, setSyncStatus] = useState('Idle'); // you can keep this if you plan to expand status handling later

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Multi-Angle Sync</h1>

      <div className={styles.content}>
        {/* New main component with all video controls */}
        <VideoGrid />

        {/* Optional legacy controls if you want them later */}
        {/* <SyncControls setSyncStatus={setSyncStatus} /> */}
        {/* <StatusIndicator syncStatus={syncStatus} /> */}
      </div>
    </div>
  );
}

export default SyncScreen;
