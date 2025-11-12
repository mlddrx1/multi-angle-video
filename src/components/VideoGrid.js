// src/components/VideoGrid.js
import React, { useRef } from 'react';

export default function VideoGrid() {
  // Holds an array of video elements
  const videoRefs = useRef([]);

  // Filenames in /public/videos
  const videoFiles = ['sample01.mp4', 'sample02.mp4', 'sample03.mp4'];

  const handlePlayAll = () => {
    videoRefs.current.forEach((video) => {
      if (video) video.play();
    });
  };

  const handlePauseAll = () => {
    videoRefs.current.forEach((video) => {
      if (video) video.pause();
    });
  };

  const handleResetAll = () => {
    videoRefs.current.forEach((video) => {
      if (video) {
        video.pause();
        video.currentTime = 0;
      }
    });
  };

  return (
    <div>
      {/* Row of video players */}
      <div style={{ display: 'flex', gap: '10px' }}>
        {videoFiles.map((file, i) => (
          <video
            key={file}
            ref={(el) => (videoRefs.current[i] = el)}
            width="320"
            height="180"
            controls
            src={`/videos/${file}`} // served from public/videos
          />
        ))}
      </div>

      {/* Control buttons */}
      <div style={{ marginTop: 10 }}>
        <button onClick={handlePlayAll}>Play All</button>
        <button onClick={handlePauseAll}>Pause All</button>
        <button onClick={handleResetAll}>Reset</button>
      </div>
    </div>
  );
}
