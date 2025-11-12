// StatusIndicator.jsx
// Displays current sync status, progress bars, or error messages
// Could show "Syncing...", "Upload Complete", or "Timestamp Mismatch"
import PropTypes from 'prop-types';

export default function StatusIndicator({ syncStatus }) {
  return (
    <div style={{ marginTop: 12 }}>
      Status: <b>{syncStatus}</b>
    </div>
  );
}

StatusIndicator.propTypes = {
  syncStatus: PropTypes.string.isRequired,
};
