// src/components/VideoGrid.js
/* eslint-disable no-unreachable */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';

/**
 * VideoGrid — Sync Master Scaffold
 */

const DEFAULT_SOURCES = ['/videos/sample01.mp4', '/videos/sample02.mp4', '/videos/sample03.mp4'];

export default function VideoGrid({ sources = DEFAULT_SOURCES }) {
  // Refs for the <video> DOM nodes
  const videoRefs = useRef([]);

  // Per-video runtime data we want to show/modify in the UI
  const [durations, setDurations] = useState([]); // seconds
  const [marks, setMarks] = useState([]); // user-selected sync marks (seconds or null)
  const [masterIndex, setMasterIndex] = useState(0); // which video is the reference
  const [activeIndex, setActiveIndex] = useState(0); // which camera keyboard controls target
  const [status, setStatus] = useState('Idle');
  const [endPolicy, setEndPolicy] = useState('stopAllAtFirstEnd');

  // Keep an updating timestamp display without spamming renders
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    let rafId;
    let intId;

    const step = () => {
      setNowTick((t) => (t + 1) % 1_000_000); // lightweight tick to trigger UI time labels
      rafId = requestAnimationFrame(step);
    };

    // Prefer rAF for smoothness; fall back to interval if not available
    if (typeof requestAnimationFrame === 'function') {
      rafId = requestAnimationFrame(step);
      return () => cancelAnimationFrame(rafId);
    } else {
      intId = setInterval(step, 250);
      return () => clearInterval(intId);
    }
  }, []);

  // Initialize arrays when sources change
  useEffect(() => {
    setDurations(new Array(sources.length).fill(0));
    setMarks(new Array(sources.length).fill(null));
    setMasterIndex((prev) => Math.min(prev, sources.length - 1) || 0);
  }, [sources, masterIndex]);

  // ---------- Basic controls (Play/Pause/Reset) ----------
  const playAll = () => {
    videoRefs.current.forEach((v) => v && v.play());
  };

  const pauseAll = () => {
    videoRefs.current.forEach((v) => v && v.pause());
  };

  const resetAll = () => {
    videoRefs.current.forEach((v) => {
      if (!v) return;
      v.pause();
      v.currentTime = 0;
    });

    // 👇 clear all marks when resetting
    setMarks(new Array(sources.length).fill(null));
    setStatus('Idle');
  };

  // ---------- Marking & Master ----------
  const setAsMaster = (i) => {
    setMasterIndex(i);
  };

  const handleMark = (i) => {
    const v = videoRefs.current[i];
    if (!v) return;
    setMarks((prev) => {
      const next = [...prev];
      next[i] = v.currentTime;
      return next;
    });
  };

  // Small nudge controls for manual fine-tuning
  const adjustTime = (i, delta) => {
    const v = videoRefs.current[i];
    if (!v) return;
    const next = Math.max(0, Math.min(v.duration || Infinity, v.currentTime + delta));
    v.currentTime = next;
  };

  // ---------- Sync Logic ----------
  // Compute best master by maximizing overlap window (if marks available for >=2 videos)
  const bestMasterIndex = useMemo(() => {
    const have = marks.map((m) => typeof m === 'number');
    const enoughMarks = have.filter(Boolean).length >= 2;
    if (!enoughMarks) return masterIndex; // fall back to current selection

    let best = { idx: masterIndex, overlap: -Infinity };

    for (let r = 0; r < sources.length; r++) {
      if (!have[r]) continue; // must have a mark to be a candidate master
      const deltas = marks.map((m) => (typeof m === 'number' ? m - marks[r] : null));

      // Common global time window g such that for all i: 0 <= g + delta[i] <= duration[i]
      let startG = -Infinity;
      let endG = Infinity;

      for (let i = 0; i < deltas.length; i++) {
        if (deltas[i] === null || !durations[i]) continue; // ignore videos without marks/duration
        startG = Math.max(startG, -deltas[i]);
        endG = Math.min(endG, durations[i] - deltas[i]);
      }

      const overlap = Math.max(0, endG - startG);
      if (overlap > best.overlap) best = { idx: r, overlap };
    }

    return best.idx;
  }, [marks, durations, sources.length, masterIndex]);

  const startSync = () => {
    // Require at least the master + one other to have marks
    const have = marks.map((m) => typeof m === 'number');
    if (have.filter(Boolean).length < 2) {
      setStatus('Need at least two marks to sync');
      return;
    }

    // Optionally auto-select best master
    const chosenMaster = bestMasterIndex;
    if (chosenMaster !== masterIndex) setMasterIndex(chosenMaster);

    const base = marks[chosenMaster];

    // Align: for each video i, set currentTime so that mark[i] lines up with base
    videoRefs.current.forEach((v, i) => {
      if (!v || typeof marks[i] !== 'number') return;
      const target = Math.max(0, marks[i] - base);
      v.currentTime = target; // this puts all marked events at the same global time
    });

    setStatus('Synced');
  };

  // ---------- End-of-clip behavior ----------
  useEffect(() => {
    const handlers = [];

    videoRefs.current.forEach((v) => {
      if (!v) return;

      const onEnded = () => {
        if (endPolicy === 'stopAllAtFirstEnd') {
          pauseAll();
        } else if (endPolicy === 'freezeFinished') {
          v.pause(); // hold last frame
        } else if (endPolicy === 'loopFinished') {
          v.currentTime = 0;
          v.play();
        }
      };

      v.addEventListener('ended', onEnded);
      handlers.push([v, onEnded]);
    });

    return () => handlers.forEach(([v, h]) => v.removeEventListener('ended', h));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endPolicy, sources.length]);
  // ---------- Keyboard shortcuts ----------
  // Space: play/pause all
  // 1/2/3: select active camera
  // M: mark active camera
  // ← / →: nudge active camera by -0.1s / +0.1s
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't interfere with typing in inputs/textareas (future-proofing)
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      // Space = toggle play/pause all
      if (e.code === 'Space') {
        e.preventDefault();
        const anyPlaying = videoRefs.current.some((v) => v && !v.paused);
        if (anyPlaying) {
          pauseAll();
        } else {
          playAll();
        }
        return;
      }

      // Number keys 1..9: select active camera
      if (e.key >= '1' && e.key <= '9') {
        const idx = Number(e.key) - 1;
        if (idx < sources.length) {
          setActiveIndex(idx);
        }
        return;
      }

      // M = mark active camera
      if (e.key === 'm' || e.key === 'M') {
        handleMark(activeIndex);
        return;
      }

      // Arrow keys = nudge active camera
      if (e.code === 'ArrowLeft') {
        adjustTime(activeIndex, -0.1);
        return;
      }
      if (e.code === 'ArrowRight') {
        adjustTime(activeIndex, +0.1);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, sources.length]);

  // ---------- Helpers ----------
  const handleLoadedMetadata = (i) => {
    const v = videoRefs.current[i];
    if (!v) return;
    setDurations((prev) => {
      const next = [...prev];
      next[i] = v.duration || 0;
      return next;
    });
  };

  const timeLabel = (sec) => (typeof sec === 'number' ? `${sec.toFixed(2)}s` : '—');

  // how many videos currently have a mark
  const marksCount = marks.filter((m) => typeof m === 'number').length;
  const canSync = marksCount >= 2;

  // offset of each camera’s mark relative to the master’s mark
  const offsetLabel = (i) => {
    if (marks[masterIndex] == null || marks[i] == null) return '—';
    const diff = marks[i] - marks[masterIndex];
    if (Math.abs(diff) < 0.0005) return '0.00s';
    const sign = diff >= 0 ? '+' : '';
    return `${sign}${diff.toFixed(2)}s`;
  };

  // ---------- UI ----------
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {/* Top: Camera previews */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {sources.map((src, i) => (
          <div
            key={i}
            style={{
              width: 360,
              padding: 4,
              borderRadius: 10,
              border: i === activeIndex ? '2px solid #0078d4' : '2px solid transparent',
            }}
            onClick={() => setActiveIndex(i)} // click to make this the active camera
          >
            <div style={{ fontWeight: 600, marginBottom: 6 }}>
              Camera {i + 1}
              {i === masterIndex ? ' • Master' : ''}
              {i === activeIndex ? ' • Active' : ''}
            </div>

            <video
              ref={(el) => (videoRefs.current[i] = el)}
              src={src}
              controls
              onLoadedMetadata={() => handleLoadedMetadata(i)}
              style={{
                borderRadius: 8,
                boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                width: '100%',
                maxWidth: 360,
                maxHeight: 220, // cap height so it fits on screen
                objectFit: 'cover', // keeps it filled, crops a bit if needed
              }}
            />

            {/* Inline stats / quick tools */}
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginTop: 8,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <button onClick={() => setAsMaster(i)}>Set as Master</button>
              <button onClick={() => handleMark(i)}>Mark</button>
              <button onClick={() => adjustTime(i, -0.1)}>−0.1s</button>
              <button onClick={() => adjustTime(i, +0.1)}>+0.1s</button>
            </div>

            {/* Live metadata row */}
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>
              Current: {timeLabel(videoRefs.current[i]?.currentTime)} · Duration:{' '}
              {timeLabel(durations[i])} · Mark: {timeLabel(marks[i])} · Offset vs master:{' '}
              {offsetLabel(i)}
              {/* Forces re-render of the label via nowTick */}
              <span style={{ display: 'none' }}>{nowTick}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Global controls */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={playAll}>Play All</button>
        <button onClick={pauseAll}>Pause All</button>
        <button onClick={resetAll}>Reset</button>
        <button onClick={startSync} disabled={!canSync}>
          Start Sync
        </button>

        <button
          onClick={() => {
            console.table(
              videoRefs.current.map((v, i) => ({
                idx: i,
                current: v ? Number(v.currentTime.toFixed(3)) : null,
                duration: durations[i] ? Number(durations[i].toFixed(3)) : null,
                mark: marks[i] ?? null,
              }))
            );
            setStatus('Timestamps logged to console');
          }}
        >
          Validate Timestamps
        </button>

        <label style={{ marginLeft: 16 }}>
          End policy:
          <select
            value={endPolicy}
            onChange={(e) => setEndPolicy(e.target.value)}
            style={{ marginLeft: 8 }}
          >
            <option value="stopAllAtFirstEnd">Stop all at first end</option>
            <option value="freezeFinished">Freeze finished</option>
            <option value="loopFinished">Loop finished</option>
          </select>
        </label>
      </div>

      <div style={{ fontSize: 13 }}>
        Status: <strong>{status}</strong>{' '}
        {bestMasterIndex !== masterIndex
          ? `· (Auto-picked best master: Camera ${bestMasterIndex + 1})`
          : ''}
      </div>
    </div>
  );
}

// 👇 propTypes MUST be outside the component
VideoGrid.propTypes = {
  sources: PropTypes.arrayOf(PropTypes.string),
};
