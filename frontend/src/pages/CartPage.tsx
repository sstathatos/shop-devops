import { useNavigate } from "react-router-dom";
import { useCartStore } from "../store/cartStore";
import client from "../api/client";

export default function CartPage() {
  const navigate = useNavigate();
  const { items, remove, clear, total } = useCartStore();

  const checkout = async () => {
    if (!localStorage.getItem("token")) {
      navigate("/login");
      return;
    }
    try {
      await client.post("/orders", {
        items: items.map((i) => ({
          product_id: i.product_id,
          name: i.name,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
      });
      clear();
      navigate("/orders");
    } catch {
      alert("Checkout failed. Make sure you are logged in.");
    }
  };

  if (items.length === 0) return <p style={{ padding: "1rem" }}>Your cart is empty.</p>;

  return (
    <div style={{ padding: "1rem" }}>
      <h2>Cart</h2>
      {items.map((i) => (
        <div key={i.product_id} style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
          <span>{i.name} x{i.quantity}</span>
          <span>${(i.unit_price * i.quantity).toFixed(2)}</span>
          <button onClick={() => remove(i.product_id)}>Remove</button>
        </div>
      ))}
      <hr />
      <p><strong>Total: ${total().toFixed(2)}</strong></p>
      <button onClick={checkout}>Place Order</button>
    </div>
  );
}
