// src/screens/SyncScreen/SyncControls.jsx
function SyncControls({ setSyncStatus }) {
  const onStartSync = () => {
    setSyncStatus("Syncing… 0%");
    let p = 0;
    const id = setInterval(() => {
      p += 10;
      if (p >= 100) {
        clearInterval(id);
        setSyncStatus("✅ Sync complete");
        setTimeout(() => setSyncStatus("Idle"), 1500);
      } else {
        setSyncStatus(`Syncing… ${p}%`);
      }
    }, 200);
  };

  const onValidate = () => setSyncStatus("Validating timestamps…");
  const onRecord   = () => setSyncStatus("Recording mode (stub)");
  const onEdit     = () => setSyncStatus("Editing mode (stub)");
  const onExport   = () => setSyncStatus("Export flow (stub)");

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <strong>Sync Controls</strong>
      <button onClick={onStartSync}>🔗 Start Sync</button>
      <button onClick={onValidate}>🕒 Validate Timestamps</button>
      <hr />
      <button onClick={onRecord}>🎥 Start Recording</button>
      <button onClick={onEdit}>🎬 Edit Footage</button>
      <button onClick={onExport}>📤 Share & Export</button>
    </div>
  );
}
export default SyncControls;