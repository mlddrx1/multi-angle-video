/* eslint-disable no-unreachable */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';

/**
 * VideoGrid — Sync Master Scaffold
 */

const DEFAULT_SOURCES = ['/videos/sample01.mp4', '/videos/sample02.mp4', '/videos/sample03.mp4'];

// ==== SYNC STATE SAVE / RESTORE ADDITIONS ====
const AUTOSAVE_KEY = 'multiAngleSyncState_auto_v1';
const MANUAL_KEY = 'multiAngleSyncState_saved_v1';

function saveSyncStateToStorage(key, state) {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save sync state', err);
  }
}

function loadSyncStateFromStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load sync state', err);
    return null;
  }
}

function clearSyncStateFromStorage() {
  localStorage.removeItem(AUTOSAVE_KEY);
  localStorage.removeItem(MANUAL_KEY);
}
// =================================================

export default function VideoGrid({ sources = DEFAULT_SOURCES }) {
  // Refs for the <video> DOM nodes
  const videoRefs = useRef([]);

  // Per-video runtime data
  const [durations, setDurations] = useState([]);
  const [marks, setMarks] = useState([]);
  const [masterIndex, setMasterIndex] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [status, setStatus] = useState('Idle');
  const [endPolicy, setEndPolicy] = useState('stopAllAtFirstEnd');
  const [showShortcuts, setShowShortcuts] = useState(false);

  // ==== SYNC STATE SAVE / RESTORE ADDITIONS ====
  const hasInitLoadedRef = useRef(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);

  function buildSyncState() {
    return {
      masterIndex,
      endPolicy,
      marks, // array of numbers | null
    };
  }

  function applySyncState(sync) {
    if (!sync) return;

    if (typeof sync.masterIndex === 'number') {
      setMasterIndex(sync.masterIndex);
    }
    if (typeof sync.endPolicy === 'string') {
      setEndPolicy(sync.endPolicy);
    }
    if (Array.isArray(sync.marks)) {
      setMarks(sync.marks);
    }
  }

  // Load saved state ONCE when component mounts
  useEffect(() => {
    const manual = loadSyncStateFromStorage(MANUAL_KEY);
    if (manual) {
      applySyncState(manual);
      hasInitLoadedRef.current = true;
      return;
    }

    const auto = loadSyncStateFromStorage(AUTOSAVE_KEY);
    if (auto) {
      applySyncState(auto);
    }

    hasInitLoadedRef.current = true;
  }, []);

  // Autosave on changes
  useEffect(() => {
    if (!hasInitLoadedRef.current) return; // don't save initial blank state
    const snapshot = buildSyncState();
    saveSyncStateToStorage(AUTOSAVE_KEY, snapshot);
  }, [marks, masterIndex, endPolicy]);
  // =================================================

  // Keep updating time stamp display
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    let rafId;
    const step = () => {
      setNowTick((t) => (t + 1) % 1_000_000);
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Initialize arrays when sources change
  useEffect(() => {
    setDurations(new Array(sources.length).fill(0));
    setMarks((prev) => {
      const next = new Array(sources.length).fill(null);
      return prev.length === sources.length ? prev : next;
    });
    setMasterIndex((prev) => Math.min(prev, sources.length - 1) || 0);
  }, [sources, masterIndex]);

  // ---------- Basic controls ----------
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
    setMarks(new Array(sources.length).fill(null));
    setStatus('Idle');
  };

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

  const adjustTime = (i, delta) => {
    const v = videoRefs.current[i];
    if (!v) return;
    const next = Math.max(0, Math.min(v.duration || Infinity, v.currentTime + delta));
    v.currentTime = next;
    setMarks((prev) => {
      const updated = [...prev];
      updated[i] = next;
      return updated;
    });
  };

  // ---------- Sync Logic ----------
  const bestMasterIndex = useMemo(() => {
    const have = marks.map((m) => typeof m === 'number');
    const enoughMarks = have.filter(Boolean).length >= 2;
    if (!enoughMarks) return masterIndex;

    let best = { idx: masterIndex, overlap: -Infinity };

    for (let r = 0; r < sources.length; r++) {
      if (!have[r]) continue;
      const deltas = marks.map((m) => (typeof m === 'number' ? m - marks[r] : null));

      let startG = -Infinity;
      let endG = Infinity;

      for (let i = 0; i < deltas.length; i++) {
        if (deltas[i] === null || !durations[i]) continue;
        startG = Math.max(startG, -deltas[i]);
        endG = Math.min(endG, durations[i] - deltas[i]);
      }

      const overlap = Math.max(0, endG - startG);
      if (overlap > best.overlap) best = { idx: r, overlap };
    }
    return best.idx;
  }, [marks, durations, sources.length, masterIndex]);

  const startSync = () => {
    const have = marks.map((m) => typeof m === 'number');
    if (have.filter(Boolean).length < 2) {
      setStatus('Cannot sync yet – set marks on at least two cameras first.');
      return;
    }

    const chosenMaster = bestMasterIndex;
    if (chosenMaster !== masterIndex) setMasterIndex(chosenMaster);

    const base = marks[chosenMaster];

    videoRefs.current.forEach((v, i) => {
      if (!v || typeof marks[i] !== 'number') return;
      const target = Math.max(0, marks[i] - base);
      v.currentTime = target;
    });

    setStatus('Synced. Use Play All to review the alignment.');
  };

  // ---------- End-of-clip ----------
  useEffect(() => {
    const handlers = [];
    videoRefs.current.forEach((v) => {
      if (!v) return;
      const onEnded = () => {
        if (endPolicy === 'stopAllAtFirstEnd') pauseAll();
        else if (endPolicy === 'freezeFinished') v.pause();
        else if (endPolicy === 'loopFinished') {
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

  // ---------- UI ----------
  // Helper to record duration once metadata is loaded
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

  const marksCount = marks.filter((m) => typeof m === 'number').length;
  const canSync = marksCount >= 2;
  const syncTip =
    marksCount === 0
      ? 'Set a mark on at least two cameras to enable Start Sync.'
      : marksCount === 1
        ? 'Set one more mark on another camera to enable Start Sync.'
        : '';

  const offsetLabel = (i) => {
    if (marks[masterIndex] == null || marks[i] == null) return '—';
    const diff = marks[i] - marks[masterIndex];
    const sign = diff >= 0 ? '+' : '';
    return `${sign}${diff.toFixed(2)}s`;
  };

  const offsetColor = (i) => {
    if (marks[masterIndex] == null || marks[i] == null) return '#555';
    const diff = marks[i] - marks[masterIndex];
    const abs = Math.abs(diff);
    if (abs < 0.05) return '#16a34a';
    if (diff > 0) return '#d97706';
    if (diff < 0) return '#2563eb';
    return '#555';
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {/* Top video previews */}
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
            onClick={() => setActiveIndex(i)}
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
                maxHeight: 220,
                objectFit: 'cover',
              }}
            />

            {/* Inline controls */}
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <button onClick={() => setAsMaster(i)}>Set as Master</button>
              <button onClick={() => handleMark(i)}>Mark</button>
              <button onClick={() => adjustTime(i, -0.1)}>−0.1s</button>
              <button onClick={() => adjustTime(i, +0.1)}>+0.1s</button>
            </div>

            {/* Metadata */}
            <div style={{ fontSize: 12, marginTop: 6 }}>
              <div>
                Current: {timeLabel(videoRefs.current[i]?.currentTime)} · Duration:{' '}
                {timeLabel(durations[i])}
              </div>
              <div>
                Mark: {timeLabel(marks[i])} ·{' '}
                <span style={{ color: offsetColor(i) }}>Offset vs master: {offsetLabel(i)}</span>
              </div>
              <span style={{ display: 'none' }}>{nowTick}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Global Controls */}
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
            setStatus('Timestamps logged to console (see DevTools → Console).');
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

        <button type="button" onClick={() => setShowShortcuts((prev) => !prev)}>
          {showShortcuts ? 'Hide Shortcuts' : 'Show Shortcuts'}
        </button>

        {/* ==== SYNC STATE SAVE / CLEAR BUTTONS ==== */}

        <button
          style={{ marginLeft: 12 }}
          onClick={() => {
            const snap = buildSyncState();
            saveSyncStateToStorage(MANUAL_KEY, snap);
            saveSyncStateToStorage(AUTOSAVE_KEY, snap);
            setLastSavedAt(new Date());
            setStatus('Sync state saved. It will be restored on reload.');
          }}
        >
          Save Sync State
        </button>

        <button
          onClick={() => {
            clearSyncStateFromStorage();
            setStatus('Saved sync cleared. Reload to start from a blank state.');
          }}
        >
          Clear Saved Sync
        </button>
      </div>
      {showShortcuts && (
        <div
          style={{
            background: '#f9f9f9',
            border: '1px solid #ccc',
            borderRadius: 8,
            padding: '12px 16px',
            marginTop: 8,
            marginBottom: 8,
            maxWidth: 380,
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Keyboard Shortcuts</div>
          <div>
            <strong>Space</strong> – Play / Pause All
          </div>
          <div>
            <strong>1 / 2 / 3</strong> – Select active camera
          </div>
          <div>
            <strong>M</strong> – Mark active camera
          </div>
          <div>
            <strong>← / →</strong> – Nudge active camera (−0.1s / +0.1s)
          </div>
          <div style={{ marginTop: 4, fontStyle: 'italic' }}>
            Shortcuts work when the page has focus (click anywhere on the page first).
          </div>
        </div>
      )}

      <div style={{ fontSize: 13 }}>
        Status: <strong>{status}</strong> {syncTip && `· ${syncTip}`}{' '}
        {bestMasterIndex !== masterIndex
          ? `· (Auto-picked best master: Camera ${bestMasterIndex + 1})`
          : ''}
        {lastSavedAt ? `· Saved at ${lastSavedAt.toLocaleTimeString()}` : ''}
      </div>
    </div>
  );
}

// PropTypes
VideoGrid.propTypes = {
  sources: PropTypes.arrayOf(PropTypes.string),
};
