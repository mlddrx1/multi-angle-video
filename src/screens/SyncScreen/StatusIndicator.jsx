// StatusIndicator.jsx
// Displays current sync status, progress bars, or error messages
// Could show "Syncing...", "Upload Complete", or "Timestamp Mismatch"
function StatusIndicator({ syncStatus }) {
  const isIdle = syncStatus === 'Idle';
  return (
    <div style={{ marginTop: 12, fontFamily: 'system-ui, sans-serif' }}>
      <span style={{ opacity: 0.7 }}>Status:</span>{' '}
      <span style={{ fontWeight: 600, whiteSpace: 'pre' }}>{syncStatus}</span>
      {!isIdle && <span style={{ marginLeft: 6 }}>⏱️</span>}
    </div>
  );
}
export default StatusIndicator;
