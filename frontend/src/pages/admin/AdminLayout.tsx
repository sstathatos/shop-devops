import { NavLink, Outlet } from "react-router-dom";

const tabs = [
  { to: "/admin/products", label: "Products" },
  { to: "/admin/orders", label: "Orders" },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/notifications", label: "Notifications" },
];

export default function AdminLayout() {
  return (
    <div style={{ padding: "1rem" }}>
      <h2 style={{ marginBottom: "1rem" }}>Admin Dashboard</h2>
      <nav style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", borderBottom: "2px solid #eee" }}>
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            style={({ isActive }) => ({
              padding: "0.5rem 1rem",
              textDecoration: "none",
              borderBottom: isActive ? "2px solid #333" : "2px solid transparent",
              fontWeight: isActive ? "bold" : "normal",
              color: "#333",
            })}
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
