import type { Metadata } from "next";
import Link from "next/link";
import { LogOut } from "lucide-react";
import "./globals.css";
import "./refinements.css";

export const metadata: Metadata = {
  title: "Trade Show Scorecard",
  description: "Collaborative trade show participation assessment",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link href="/dashboard" className="brand">
            <span className="brand-mark">X</span>
            <span><strong>Trade Show</strong><small>Participation Scorecard</small></span>
          </Link>
          <form action="/auth/signout" method="post">
            <button className="icon-button" title="Sign out"><LogOut size={18} /><span>Sign out</span></button>
          </form>
        </header>
        {children}
      </body>
    </html>
  );
}
