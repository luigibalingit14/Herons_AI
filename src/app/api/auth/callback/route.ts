import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth/allowed-email";

export async function GET(request: Request) {
  const url = new URL(request.url); const code = url.searchParams.get("code");
  if (code) { const supabase = await createClient(); const { data, error } = await supabase.auth.exchangeCodeForSession(code); if (!error && data.user?.email && isAllowedEmail(data.user.email)) return NextResponse.redirect(new URL("/dashboard", request.url)); await supabase.auth.signOut(); }
  return NextResponse.redirect(new URL("/login?error=umak_email_required", request.url));
}
