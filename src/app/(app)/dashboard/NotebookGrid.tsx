"use client";
import { useState } from "react";
import Link from "next/link";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { createClient } from "@/lib/supabase/client";

export type NotebookItem = {
  id: string;
  title: string;
  description: string | null;
  theme: string | null;
  updated_at: string;
  emoji?: string | null;
};

export function NotebookGrid({ initialNotebooks }: { initialNotebooks: NotebookItem[] }) {
  const [notebooks, setNotebooks] = useState<NotebookItem[]>(initialNotebooks);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, id: string, title: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Delete notebook "${title}"? This will delete all its sources and study materials.`)) return;

    setDeletingId(id);
    const client = createClient();
    const { error } = await client.from("notebooks").delete().eq("id", id);
    if (!error) {
      setNotebooks(prev => prev.filter(n => n.id !== id));
    } else {
      alert(`Could not delete notebook: ${error.message}`);
    }
    setDeletingId(null);
  };

  if (!notebooks.length) {
    return (
      <div className="card stat" style={{ textAlign: "center" }}>
        <MaterialIcon name="menu_book" size={38} />
        <h2>Your research starts here</h2>
        <p className="muted">Create a notebook, add sources, and ask questions grounded in your material.</p>
      </div>
    );
  }

  return (
    <div className="grid">
      {notebooks.map(n => (
        <div key={n.id} style={{ position: "relative" }}>
          <Link
            className="card stat"
            href={`/notebook/${n.id}`}
            style={{ display: "flex", flexDirection: "column", height: "100%", textDecoration: "none", color: "inherit" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <MaterialIcon name="description" size={28} />
              <button
                type="button"
                className="icon-button"
                title="Delete notebook"
                aria-label={`Delete ${n.title}`}
                disabled={deletingId === n.id}
                onClick={e => handleDelete(e, n.id, n.title)}
                style={{ opacity: 0.7, padding: 6 }}
              >
                <MaterialIcon name="delete" size={18} />
              </button>
            </div>
            <h2 style={{ margin: "0 0 6px" }}>{n.title}</h2>
            {n.description && <p className="muted" style={{ margin: "0 0 10px" }}>{n.description}</p>}
            <small className="muted" style={{ marginTop: "auto", paddingTop: 10 }}>
              {n.theme ?? "Research"} · Updated {new Date(n.updated_at).toLocaleDateString()}
            </small>
          </Link>
        </div>
      ))}
    </div>
  );
}
