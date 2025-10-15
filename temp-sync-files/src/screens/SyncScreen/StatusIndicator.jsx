// StatusIndicator.jsx
// Displays current sync status, progress bars, or error messages
// Could show "Syncing...", "Upload Complete", or "Timestamp Mismatch"
function StatusIndicator({ syncStatus }) {
  return <div>Status: {syncStatus}</div>;
}

export default StatusIndicator;