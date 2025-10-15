import { Link } from "react-router-dom";

export default function EditScreen() {
  return (
    <div style={{ padding: 16 }}>
      <h1>Edit / Export</h1>

      <div style={{ display: "grid", gap: 12, maxWidth: 900 }}>
        {/* Mock clip list */}
        <section style={{ padding: 12, border: "1px solid #e6e6e6", borderRadius: 10 }}>
          <h3 style={{ marginTop: 0 }}>Synced Clips (mock)</h3>
          <ul>
            <li>Cam A — 00:00:00 → 00:10:00</li>
            <li>Cam B — 00:00:00 → 00:10:00</li>
            <li>Cam C — 00:00:00 → 00:10:00</li>
          </ul>
        </section>

        {/* Mock timeline */}
        <section style={{ padding: 12, border: "1px solid #e6e6e6", borderRadius: 10 }}>
          <h3 style={{ marginTop: 0 }}>Timeline (mock)</h3>
          <div style={{ height: 8, background: "#eee", borderRadius: 4, position: "relative" }}>
            <div style={{ position:"absolute", left:"20%", top:-8 }}>▲</div>
            <div style={{ position:"absolute", left:"60%", top:-8 }}>▲</div>
          </div>
          <small>Markers show where you’ll switch angles.</small>
        </section>

        {/* Mock export */}
        <section style={{ padding: 12, border: "1px solid #e6e6e6", borderRadius: 10 }}>
          <h3 style={{ marginTop: 0 }}>Export (mock)</h3>
          <button>Render MP4</button>
        </section>
      </div>

      <div style={{ marginTop: 16 }}>
        <Link to="">{/* noop to keep tab index sane */}</Link>
        <Link to="/">{`← Back to Sync`}</Link>
      </div>
    </div>
  );
}
