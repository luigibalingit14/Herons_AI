"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function DashboardClient() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const create = async () => {
    const notebookTitle = title.trim();
    if (!notebookTitle || saving) return;
    setSaving(true);
    setError("");

    const client = createClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) {
      setError("Your session expired. Please sign in again.");
      setSaving(false);
      return;
    }

    const { data, error } = await client
      .from("notebooks")
      .insert({ user_id: user.id, title: notebookTitle, theme: "dark" })
      .select("id")
      .single();

    if (error || !data) {
      setError(error?.message ?? "Notebook could not be saved. Please try again.");
      setSaving(false);
      return;
    }

    window.location.href = `/notebook/${data.id}`;
  };

  return (
    <>
      {!open ? (
        <button className="button" onClick={() => setOpen(true)}>
          + New Notebook
        </button>
      ) : (
        <div className="card" style={{ padding: 18, display: "grid", gap: 10 }}>
          <input
            autoFocus
            className="input"
            disabled={saving}
            placeholder="Notebook title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === "Enter" && create()}
          />
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="button" disabled={saving || !title.trim()} onClick={create}>
              {saving ? "Saving…" : "Save notebook"}
            </button>
            <button className="button secondary" disabled={saving} onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
