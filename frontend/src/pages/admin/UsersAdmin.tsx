import { useEffect, useState } from "react";
import client from "../../api/client";

interface User {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
}

const emptyForm = { full_name: "", email: "", password: "" };

export default function UsersAdmin() {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = () =>
    client.get("/users").then(({ data }) => setUsers(data));

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      await client.post("/users/register", form);
      setForm(emptyForm);
      setSuccess("User created.");
      load();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Request failed");
    }
  };

  return (
    <div>
      <h3>Create User</h3>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.5rem" }}>
        <input
          placeholder="Full name"
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          required
          style={inputStyle}
        />
        <input
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
          style={inputStyle}
        />
        <input
          placeholder="Password"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
          style={inputStyle}
        />
        <button type="submit" style={btnStyle}>Create</button>
      </form>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {success && <p style={{ color: "green" }}>{success}</p>}

      <h3>All Users ({users.length})</h3>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f5f5f5" }}>
            {["ID", "Email", "Full Name", "Registered"].map((h) => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={tdStyle}><code style={{ fontSize: 11 }}>{u.id.slice(0, 8)}…</code></td>
              <td style={tdStyle}>{u.email}</td>
              <td style={tdStyle}>{u.full_name}</td>
              <td style={tdStyle}>{new Date(u.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const inputStyle: React.CSSProperties = { padding: "0.4rem 0.6rem", borderRadius: 4, border: "1px solid #ccc", width: 180 };
const thStyle: React.CSSProperties = { padding: "0.5rem", textAlign: "left", borderBottom: "2px solid #ddd" };
const tdStyle: React.CSSProperties = { padding: "0.5rem" };
const btnStyle: React.CSSProperties = {
  padding: "0.4rem 0.9rem",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  background: "#2e7d32",
  color: "#fff",
};
