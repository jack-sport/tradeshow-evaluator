"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BarChart3, CalendarDays, CircleHelp, LogOut, Menu, Shield, Wallet, X } from "lucide-react";

const MAIN = [
  { href: "/dashboard", label: "Events", icon: CalendarDays, match: ["/dashboard", "/events"] },
  { href: "/budget", label: "Budget", icon: Wallet, match: ["/budget"] },
  { href: "/baseline", label: "Baseline", icon: BarChart3, match: ["/baseline"] },
];

/** Site navigation: the main areas, Admin for administrators, help and sign out. Folds into a menu on phones. */
export function SiteNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Close the phone menu when a link is chosen.
  const close = () => setOpen(false);
  const active = (match: string[]) => match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const items = isAdmin ? [...MAIN, { href: "/admin", label: "Admin", icon: Shield, match: ["/admin"] }] : MAIN;

  return (
    <>
      <button type="button" className="nav-toggle" aria-expanded={open} aria-controls="site-nav" onClick={() => setOpen(!open)}>
        {open ? <X size={20} /> : <Menu size={20} />}<span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
      </button>
      <nav id="site-nav" className={`site-nav${open ? " open" : ""}`} aria-label="Main">
        <ul className="nav-main">
          {items.map(({ href, label, icon: Icon, match }) => (
            <li key={href}>
              <Link href={href} onClick={close} aria-current={active(match) ? "page" : undefined}><Icon size={16} aria-hidden />{label}</Link>
            </li>
          ))}
        </ul>
        <div className="nav-side">
          <Link href="/scoring" onClick={close} className="nav-help" aria-current={active(["/scoring"]) ? "page" : undefined}><CircleHelp size={17} aria-hidden />How scoring works</Link>
          <form action="/auth/signout" method="post">
            <button className="icon-button nav-signout" title="Sign out"><LogOut size={17} aria-hidden /><span>Sign out</span></button>
          </form>
        </div>
      </nav>
    </>
  );
}
