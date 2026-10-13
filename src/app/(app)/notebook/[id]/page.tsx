import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NotebookClient } from "./NotebookClient";

export const dynamic = "force-dynamic";

export default async function NotebookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: notebook } = await supabase
    .from("notebooks")
    .select("id,title,description")
    .eq("id", id)
    .single();
  if (!notebook) notFound();

  const [{ data: sources }, { data: messages }, { data: studyMaterials, error: studyMaterialsError }] = await Promise.all([
    supabase
      .from("sources")
      .select("id,title,type,status,file_path,file_size,error_message")
      .eq("notebook_id", id)
      .order("created_at"),
    supabase
      .from("messages")
      .select("id,role,content,citations,model_used")
      .eq("notebook_id", id)
      .order("created_at"),
    supabase
      .from("study_materials")
      .select("id,type,title,content,metadata,created_at")
      .eq("notebook_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (studyMaterialsError) {
    console.error("[NotebookPage] Error loading study materials:", studyMaterialsError);
  }

  return (
    <NotebookClient
      notebook={notebook}
      initialSources={sources ?? []}
      initialMessages={messages ?? []}
      initialStudyMaterials={studyMaterials ?? []}
    />
  );
}
