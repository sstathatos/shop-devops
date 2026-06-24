import { useEffect, useState } from "react";
import client from "../../api/client";

interface OrderItem {
  product_id: string;
  quantity: number;
  unit_price: string | number;
}

interface Order {
  id: string;
  user_id: string;
  status: string;
  total: string | number;
  items: OrderItem[];
  created_at: string;
}

export default function OrdersAdmin() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<Set<string>>(new Set());

  const load = () =>
    client.get("/orders/all").then(({ data }) => {
      setOrders(data);
      setLoading(false);
    });

  useEffect(() => { load(); }, []);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const acceptOrder = async (id: string) => {
    setAccepting((prev) => new Set(prev).add(id));
    try {
      await client.post(`/orders/${id}/accept`);
      load();
    } finally {
      setAccepting((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  if (loading) return <p>Loading…</p>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
        <h3 style={{ margin: 0 }}>All Orders ({orders.length})</h3>
        <button onClick={load} style={btnStyle("#555")}>Refresh</button>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f5f5f5" }}>
            {["", "Order ID", "User ID", "Status", "Total", "Items", "Date"].map((h) => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <>
              <tr key={o.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={tdStyle}>
                  <button
                    onClick={() => toggle(o.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16 }}
                  >
                    {expanded.has(o.id) ? "▾" : "▸"}
                  </button>
                </td>
                <td style={tdStyle}><code style={{ fontSize: 11 }}>{o.id.slice(0, 8)}…</code></td>
                <td style={tdStyle}><code style={{ fontSize: 11 }}>{o.user_id.slice(0, 8)}…</code></td>
                <td style={tdStyle}>
                  {o.status === "pending" ? (
                    <button
                      onClick={() => acceptOrder(o.id)}
                      disabled={accepting.has(o.id)}
                      style={btnStyle("#2e7d32")}
                    >
                      {accepting.has(o.id) ? "…" : "Accept"}
                    </button>
                  ) : (
                    <span style={statusBadge(o.status)}>{o.status}</span>
                  )}
                </td>
                <td style={tdStyle}>${Number(o.total).toFixed(2)}</td>
                <td style={tdStyle}>{o.items.length}</td>
                <td style={tdStyle}>{new Date(o.created_at).toLocaleString()}</td>
              </tr>
              {expanded.has(o.id) && (
                <tr key={`${o.id}-detail`}>
                  <td />
                  <td colSpan={6} style={{ padding: "0.5rem 1rem", background: "#fafafa" }}>
                    {o.status === "confirmed" && (
                      <p style={{ color: "#f59e0b", marginBottom: "0.5rem", fontSize: 13 }}>
                        Processing… stock will be deducted and order completed in ~1 minute.
                      </p>
                    )}
                    <table style={{ borderCollapse: "collapse", width: "100%" }}>
                      <thead>
                        <tr>
                          <th style={thStyle}>Product ID</th>
                          <th style={thStyle}>Qty</th>
                          <th style={thStyle}>Unit Price</th>
                          <th style={thStyle}>Line Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {o.items.map((item, i) => (
                          <tr key={i}>
                            <td style={tdStyle}><code style={{ fontSize: 11 }}>{item.product_id.slice(0, 8)}…</code></td>
                            <td style={tdStyle}>{item.quantity}</td>
                            <td style={tdStyle}>${Number(item.unit_price).toFixed(2)}</td>
                            <td style={tdStyle}>${(Number(item.unit_price) * item.quantity).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: "0.5rem", textAlign: "left", borderBottom: "2px solid #ddd" };
const tdStyle: React.CSSProperties = { padding: "0.5rem" };

const statusColors: Record<string, string> = {
  pending: "#f59e0b",
  confirmed: "#3b82f6",
  completed: "#10b981",
  cancelled: "#ef4444",
};

const statusBadge = (status: string): React.CSSProperties => ({
  background: statusColors[status] ?? "#9ca3af",
  color: "#fff",
  borderRadius: 12,
  padding: "2px 8px",
  fontSize: 12,
});

const btnStyle = (bg: string): React.CSSProperties => ({
  padding: "0.3rem 0.8rem",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  background: bg,
  color: "#fff",
  fontSize: 13,
});
