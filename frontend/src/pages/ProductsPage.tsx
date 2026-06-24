import { useEffect, useState } from "react";
import client from "../api/client";
import { useCartStore } from "../store/cartStore";

interface Product {
  id: string;
  name: string;
  description: string;
  price: string;
  stock: number;
}

const CARD_COLORS = [
  "#fce4ec", "#e3f2fd", "#e8f5e9", "#fff8e1",
  "#f3e5f5", "#e0f7fa", "#fbe9e7", "#ede7f6",
];

function cardColor(id: string): string {
  const sum = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return CARD_COLORS[sum % CARD_COLORS.length];
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const add = useCartStore((s) => s.add);

  useEffect(() => {
    client.get("/products").then(({ data }) => {
      setProducts(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ padding: "1rem" }}>
      <h2>Products</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1rem" }}>
        {products.map((p) => (
          <div key={p.id} style={{ background: cardColor(p.id), borderRadius: 8, padding: "1rem" }}>
            <h3>{p.name}</h3>
            <p>{p.description}</p>
            <p><strong>${p.price}</strong> &mdash; {p.stock} in stock</p>
            <button
              disabled={p.stock === 0}
              onClick={() => add({ product_id: p.id, name: p.name, unit_price: parseFloat(p.price) })}
            >
              {p.stock === 0 ? "Out of stock" : "Add to cart"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
