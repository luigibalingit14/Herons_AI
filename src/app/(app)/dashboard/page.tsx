import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "./DashboardClient";
import { NotebookGrid } from "./NotebookGrid";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: notebooks, error } = await supabase
    .from("notebooks")
    .select("id,title,description,theme,updated_at,emoji")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[DashboardPage] Failed to fetch notebooks:", error);
  }

  const items = notebooks ?? [];

  return (
    <main className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div>
          <p className="muted">University of Makati research workspace</p>
          <h1>Research Dashboard</h1>
          <p className="muted">{items.length} {items.length === 1 ? "notebook" : "notebooks"}</p>
        </div>
        <DashboardClient />
      </div>
      <NotebookGrid initialNotebooks={items} />
    </main>
  );
}
