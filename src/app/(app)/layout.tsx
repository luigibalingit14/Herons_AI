import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNavbar } from "@/components/layout/AppNavbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email?.toLowerCase().endsWith("@umak.edu.ph")) {
    await supabase.auth.signOut();
    redirect("/login?error=umak_email_required");
  }
  return <div className="shell"><AppNavbar />{children}</div>;
}
