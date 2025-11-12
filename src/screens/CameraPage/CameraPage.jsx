// src/screens/CameraPage/CameraPage.jsx
import { useEffect, useRef, useState } from "react";

/**
 * NOTE for mobile:
 * - Use HTTPS when accessing from a phone (ngrok/cloudflared).
 * - Some browsers (Safari/Chrome) support different MediaRecorder mimeTypes.
 *   We detect the first supported type automatically.
 */

export default function CameraPage() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const checkpointTimerRef = useRef(null);

  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [resolution, setResolution] = useState("1280x720"); // default 720p
  const [fps, setFps] = useState(30);
  const [facing, setFacing] = useState("environment"); // rear camera
  const [status, setStatus] = useState("Idle");
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [downloadName, setDownloadName] = useState("");
  const [metaUrl, setMetaUrl] = useState(null);
  const [metaName, setMetaName] = useState("");

  // metadata state for JSON sidecar
  const [meta, setMeta] = useState({
    device: "",
    startEpochMs: null,
    endEpochMs: null,
    durationMs: null,
    checkpoints: [], // array of { tEpochMs, tPerfMs }
    constraints: {},
    actualSettings: {},
    notes: "Phase 1 capture prototype",
  });

  // build constraints from UI
  const constraintsFromUI = () => {
    const [w, h] = resolution.split("x").map((n) => parseInt(n, 10));
    return {
      audio: true, // include mic; set false if you want silent
      video: {
        facingMode: facing, // "user" (front) or "environment" (rear)
        width: { ideal: w },
        height: { ideal: h },
        frameRate: { ideal: Number(fps) },
      },
    };
  };

  // pick a supported mimeType for MediaRecorder
  const chooseMimeType = () => {
    const candidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4", // Safari often supports this
    ];
    for (const t of candidates) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported(t)) return t;
    }
    // Fallback: let browser choose default
    return "";
  };

  const startPreview = async () => {
    try {
      stopPreview(); // clean previous stream if any

      const constraints = constraintsFromUI();
      setStatus("Requesting camera…");
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Attach stream to video
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Update metadata basics
      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack?.getSettings?.() || {};
      const deviceLabel = videoTrack?.label || ""; // may be empty on first permission
      setMeta((m) => ({
        ...m,
        device: deviceLabel,
        constraints,
        actualSettings: settings,
      }));

      setIsPreviewing(true);
      setStatus("Previewing");
      cleanupDownloads();
    } catch (err) {
      console.error(err);
      setStatus(`Error: ${err.message || "Failed to start preview"}`);
    }
  };

  const stopPreview = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsPreviewing(false);
  };

  const startRecording = async () => {
    try {
      if (!streamRef.current) {
        await startPreview();
      }
      if (!streamRef.current) {
        throw new Error("No media stream available");
      }
      const mimeType = chooseMimeType();
      const recorder = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : {});
      recorderRef.current = recorder;
      chunksRef.current = [];

      // Metadata start times
      const startEpochMs = Date.now();
      const startPerfMs = performance.now();

      setMeta((m) => ({
        ...m,
        startEpochMs,
        endEpochMs: null,
        durationMs: null,
        checkpoints: [{ tEpochMs: startEpochMs, tPerfMs: startPerfMs }],
      }));

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstart = () => {
        setIsRecording(true);
        setStatus(`Recording… (${mimeType || "default"})`);
        // create periodic checkpoints every second for rough alignment
        checkpointTimerRef.current = setInterval(() => {
          setMeta((m) => ({
            ...m,
            checkpoints: [...m.checkpoints, { tEpochMs: Date.now(), tPerfMs: performance.now() }],
          }));
        }, 1000);
      };
      recorder.onerror = (e) => {
        console.error("Recorder error:", e);
        setStatus(`Recorder error: ${e.error?.message || e.name || "unknown"}`);
        setIsRecording(false);
      };
      recorder.onstop = () => {
        clearInterval(checkpointTimerRef.current);
        checkpointTimerRef.current = null;
        setIsRecording(false);

        // finalize metadata
        const endEpochMs = Date.now();
        setMeta((m) => ({
          ...m,
          endEpochMs,
          durationMs: endEpochMs - (m.startEpochMs || endEpochMs),
        }));

        // build blobs and download links
        const blob = new Blob(chunksRef.current, { type: mimeType || "video/webm" });
        const url = URL.createObjectURL(blob);
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        const base = `capture_${ts}`;
        setDownloadUrl(url);
        setDownloadName(`${base}.${(mimeType.includes("mp4") && "mp4") || "webm"}`);

        // metadata blob
        const metaBlob = new Blob([JSON.stringify({ ...meta, endEpochMs, durationMs: endEpochMs - (meta.startEpochMs || endEpochMs) }, null, 2)], { type: "application/json" });
        const murl = URL.createObjectURL(metaBlob);
        setMetaUrl(murl);
        setMetaName(`${base}.metadata.json`);

        setStatus("Recording stopped. Ready to download.");
      };

      recorder.start(250); // timeslice (ms) to flush chunks regularly
    } catch (err) {
      console.error(err);
      setStatus(`Error: ${err.message || "Failed to start recording"}`);
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  };

  const cleanupDownloads = () => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    if (metaUrl) URL.revokeObjectURL(metaUrl);
    setDownloadUrl(null);
    setMetaUrl(null);
    setDownloadName("");
    setMetaName("");
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      stopPreview();
      cleanupDownloads();
      if (checkpointTimerRef.current) clearInterval(checkpointTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Simple UI
  const controlStyle = { display: "grid", gap: 8, alignItems: "start", maxWidth: 900 };
  const card = { border: "1px solid #e6e6e6", borderRadius: 10, padding: 12, background: "#fafafa" };

  return (
    <div style={{ padding: 16 }}>
      <h1>Camera Test</h1>
      <p style={{ marginTop: -8, opacity: 0.8 }}>
        Use HTTPS on phones (ngrok/cloudflared). Rear camera is the default.
      </p>

      <div style={controlStyle}>
        {/* Controls */}
        <section style={card}>
          <h3 style={{ marginTop: 0 }}>Settings</h3>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <label>
              Resolution:&nbsp;
              <select value={resolution} onChange={(e) => setResolution(e.target.value)}>
                <option>640x480</option>
                <option>1280x720</option>
                <option>1920x1080</option>
              </select>
            </label>
            <label>
              FPS:&nbsp;
              <select value={fps} onChange={(e) => setFps(Number(e.target.value))}>
                <option>24</option>
                <option>30</option>
                <option>60</option>
              </select>
            </label>
            <label>
              Facing:&nbsp;
              <select value={facing} onChange={(e) => setFacing(e.target.value)}>
                <option value="environment">Rear</option>
                <option value="user">Front</option>
              </select>
            </label>
          </div>
        </section>

        {/* Preview */}
        <section style={card}>
          <h3 style={{ marginTop: 0 }}>Preview</h3>
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              width: "100%",
              maxWidth: 900,
              background: "#000",
              borderRadius: 8,
              aspectRatio: "16/9",
            }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <button onClick={startPreview} disabled={isPreviewing || isRecording}>Start Preview</button>
            <button onClick={stopPreview} disabled={!isPreviewing || isRecording}>Stop Preview</button>
          </div>
        </section>

        {/* Record */}
        <section style={card}>
          <h3 style={{ marginTop: 0 }}>Record</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={startRecording} disabled={isRecording}>● Record</button>
            <button onClick={stopRecording} disabled={!isRecording}>■ Stop</button>
          </div>
          <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>
            <div>Status: <b>{status}</b></div>
            <div>
              Device: <code>{meta.device || "(unknown until permission granted)"}</code>
            </div>
            <div>
              Actual:{" "}
              <code>
                {meta.actualSettings?.width || "?"}x{meta.actualSettings?.height || "?"}@{meta.actualSettings?.frameRate || "?"}fps
              </code>
            </div>
          </div>
        </section>

        {/* Downloads */}
        <section style={card}>
          <h3 style={{ marginTop: 0 }}>Downloads</h3>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a
              href={downloadUrl || "#"}
              download={downloadName || undefined}
              aria-disabled={!downloadUrl}
              style={{ pointerEvents: downloadUrl ? "auto" : "none" }}
            >
              <button disabled={!downloadUrl}>⬇️ Video</button>
            </a>
            <a
              href={metaUrl || "#"}
              download={metaName || undefined}
              aria-disabled={!metaUrl}
              style={{ pointerEvents: metaUrl ? "auto" : "none" }}
            >
              <button disabled={!metaUrl}>⬇️ Metadata (.json)</button>
            </a>
            <button onClick={cleanupDownloads} disabled={!downloadUrl && !metaUrl}>Clear</button>
          </div>
        </section>
      </div>
    </div>
  );
}
