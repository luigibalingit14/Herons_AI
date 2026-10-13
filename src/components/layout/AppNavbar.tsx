"use client";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { UmakBrand } from "./UmakBrand";

export function AppNavbar() {
  const signOut = async () => { await createClient().auth.signOut(); window.location.href = "/login"; };
  return (
    <nav className="navbar">
      <UmakBrand />
      <Link className="nav-link" href="/dashboard">
        <MaterialIcon name="dashboard" size={18} /> Dashboard
      </Link>
      <div className="nav-spacer" />
      <button className="nav-button" onClick={signOut}>
        <MaterialIcon name="logout" size={18} /> Sign out
      </button>
    </nav>
  );
}
