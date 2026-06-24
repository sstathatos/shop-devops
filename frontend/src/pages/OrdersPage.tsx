import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";

interface Order {
  id: string;
  status: string;
  total: string;
  created_at: string;
  items: Array<{ name: string; quantity: number; unit_price: string }>;
}

export default function OrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      navigate("/login");
      return;
    }
    client.get("/orders").then(({ data }) => {
      setOrders(data);
      setLoading(false);
    });
  }, [navigate]);

  if (loading) return <p>Loading...</p>;
  if (orders.length === 0) return <p style={{ padding: "1rem" }}>No orders yet.</p>;

  return (
    <div style={{ padding: "1rem" }}>
      <h2>My Orders</h2>
      {orders.map((o) => (
        <div key={o.id} style={{ border: "1px solid #ccc", borderRadius: 8, padding: "1rem", marginBottom: "1rem" }}>
          <p><strong>Order ID:</strong> {o.id}</p>
          <p><strong>Status:</strong> {o.status}</p>
          <p><strong>Total:</strong> ${o.total}</p>
          <p><strong>Date:</strong> {new Date(o.created_at).toLocaleString()}</p>
          <ul>
            {o.items.map((item, idx) => (
              <li key={idx}>{item.name} x{item.quantity} @ ${item.unit_price}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
