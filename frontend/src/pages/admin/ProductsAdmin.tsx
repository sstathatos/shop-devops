import { useEffect, useState } from "react";
import client from "../../api/client";

interface Product {
  id: string;
  name: string;
  description: string;
  price: string;
  stock: number;
}

const emptyForm = { name: "", description: "", price: "", stock: "" };

export default function ProductsAdmin() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = () =>
    client.get("/products").then(({ data }) => setProducts(data));

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const payload = {
      name: form.name,
      description: form.description,
      price: parseFloat(form.price),
      stock: parseInt(form.stock, 10),
    };
    try {
      if (editId) {
        await client.patch(`/products/${editId}`, payload);
      } else {
        await client.post("/products", payload);
      }
      setForm(emptyForm);
      setEditId(null);
      load();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Request failed");
    }
  };

  const startEdit = (p: Product) => {
    setEditId(p.id);
    setForm({ name: p.name, description: p.description, price: p.price, stock: String(p.stock) });
  };

  const cancelEdit = () => {
    setEditId(null);
    setForm(emptyForm);
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    await client.delete(`/products/${id}`);
    load();
  };

  return (
    <div>
      <h3>{editId ? "Edit Product" : "Create Product"}</h3>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.5rem" }}>
        <input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          style={inputStyle}
        />
        <input
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          style={{ ...inputStyle, width: 220 }}
        />
        <input
          placeholder="Price"
          type="number"
          step="0.01"
          min="0"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
          required
          style={{ ...inputStyle, width: 100 }}
        />
        <input
          placeholder="Stock"
          type="number"
          min="0"
          value={form.stock}
          onChange={(e) => setForm({ ...form, stock: e.target.value })}
          required
          style={{ ...inputStyle, width: 80 }}
        />
        <button type="submit" style={btnStyle("green")}>{editId ? "Save" : "Create"}</button>
        {editId && <button type="button" onClick={cancelEdit} style={btnStyle("gray")}>Cancel</button>}
      </form>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f5f5f5" }}>
            {["ID", "Name", "Description", "Price", "Stock", "Actions"].map((h) => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={tdStyle}><code style={{ fontSize: 11 }}>{p.id.slice(0, 8)}…</code></td>
              <td style={tdStyle}>{p.name}</td>
              <td style={tdStyle}>{p.description}</td>
              <td style={tdStyle}>${p.price}</td>
              <td style={tdStyle}>{p.stock}</td>
              <td style={tdStyle}>
                <button onClick={() => startEdit(p)} style={btnStyle("blue")}>Edit</button>
                {" "}
                <button onClick={() => deleteProduct(p.id)} style={btnStyle("red")}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const inputStyle: React.CSSProperties = { padding: "0.4rem 0.6rem", borderRadius: 4, border: "1px solid #ccc", width: 160 };
const thStyle: React.CSSProperties = { padding: "0.5rem", textAlign: "left", borderBottom: "2px solid #ddd" };
const tdStyle: React.CSSProperties = { padding: "0.5rem" };
const btnStyle = (color: string): React.CSSProperties => ({
  padding: "0.3rem 0.7rem",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  background: color === "green" ? "#2e7d32" : color === "red" ? "#c62828" : color === "blue" ? "#1565c0" : "#757575",
  color: "#fff",
  fontSize: 13,
});
