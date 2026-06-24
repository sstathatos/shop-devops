import { useEffect, useRef, useState } from "react";
import client from "../../api/client";

interface NotificationEvent {
  event_type: string;
  order_id: string;
  user_id: string;
  total: string | number;
  processed_at: string;
}

export default function NotificationsAdmin() {
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [error, setError] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = () =>
    client
      .get("/notifications/events")
      .then(({ data }) => { setEvents(data); setError(""); })
      .catch(() => setError("Failed to fetch events — check you are logged in"));

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
        <h3 style={{ margin: 0 }}>Event Log (last 100)</h3>
        <button onClick={load} style={btnStyle}>Refresh</button>
        <span style={{ color: "#888", fontSize: 13 }}>Auto-refreshes every 5 s</span>
      </div>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {events.length === 0 ? (
        <p style={{ color: "#888" }}>No events yet — place an order to see them here.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f5f5f5" }}>
              {["Event", "Order ID", "User ID", "Total", "Processed At"].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map((ev, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                <td style={tdStyle}>
                  <span style={{ background: "#1565c0", color: "#fff", borderRadius: 12, padding: "2px 8px", fontSize: 12 }}>
                    {ev.event_type}
                  </span>
                </td>
                <td style={tdStyle}><code style={{ fontSize: 11 }}>{String(ev.order_id).slice(0, 8)}…</code></td>
                <td style={tdStyle}>
                  {ev.user_id
                    ? <code style={{ fontSize: 11 }}>{String(ev.user_id).slice(0, 8)}…</code>
                    : <span style={{ color: "#aaa" }}>—</span>}
                </td>
                <td style={tdStyle}>
                  {ev.total != null && !isNaN(Number(ev.total))
                    ? `$${Number(ev.total).toFixed(2)}`
                    : <span style={{ color: "#aaa" }}>—</span>}
                </td>
                <td style={tdStyle}>{new Date(ev.processed_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: "0.5rem", textAlign: "left", borderBottom: "2px solid #ddd" };
const tdStyle: React.CSSProperties = { padding: "0.5rem" };
const btnStyle: React.CSSProperties = {
  padding: "0.3rem 0.8rem",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  background: "#1565c0",
  color: "#fff",
};
