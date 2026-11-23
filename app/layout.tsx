import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";
import "./refinements.css";

export const metadata: Metadata = {
  title: "Trade Show Scorecard",
  description: "Collaborative trade show participation assessment",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // The nav shows only when signed in; Admin only for administrators.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link href={user ? "/dashboard" : "/login"} className="brand">
            <span className="brand-mark">X</span>
            <span><strong>Trade Show</strong><small>Participation Scorecard</small></span>
          </Link>
          {user && <SiteNav isAdmin={profile?.role === "admin"} />}
        </header>
        {children}
      </body>
    </html>
  );
}
