import { Link, useNavigate } from "react-router-dom";
import { useCartStore } from "../store/cartStore";

export default function Navbar() {
  const navigate = useNavigate();
  const itemCount = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const token = localStorage.getItem("token");

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <nav style={{ display: "flex", gap: "1rem", padding: "1rem", borderBottom: "1px solid #ccc" }}>
      <Link to="/products">Products</Link>
      <Link to="/cart">Cart ({itemCount})</Link>
      <Link to="/orders">My Orders</Link>
      <Link to="/admin" style={{ marginLeft: "auto" }}>Admin</Link>
      {token ? (
        <button onClick={logout}>Logout</button>
      ) : (
        <Link to="/login">Login</Link>
      )}
    </nav>
  );
}
