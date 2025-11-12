import React from 'react';
import VideoGrid from '../../components/VideoGrid'; // <- important path

const CameraPreview = () => {
  return (
    <section className="panel">
      <h2>Camera Preview</h2>
      <VideoGrid />
    </section>
  );
};

export default CameraPreview;
