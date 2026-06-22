"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

type ClientItem = {
  id: string;
  name: string;
};

type Props = {
  role: string;
  fullName: string;
  clients: ClientItem[];
  children: React.ReactNode;
};

export default function DashboardShell({
  role,
  fullName,
  clients,
  children,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const isOperator = role === "operator" || role === "specialist";

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const navLinks = (
    <>
      {isOperator && (
        <Link
          href="/"
          onClick={() => setMenuOpen(false)}
          className={`block rounded-md px-3 py-2 text-sm ${
            pathname === "/"
              ? "bg-white/10 text-white"
              : "text-slate-400 hover:bg-white/5"
          }`}
        >
          All Clients
        </Link>
      )}

      {isOperator && clients.length > 0 && (
        <div className="pt-3">
          <p className="px-3 text-xs font-medium uppercase tracking-wide text-slate-600">
            Clients
          </p>
          <div className="mt-1 space-y-0.5">
            {clients.map((client) => (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                onClick={() => setMenuOpen(false)}
                className={`block rounded-md px-3 py-2 text-sm truncate ${
                  pathname === `/clients/${client.id}`
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:bg-white/5"
                }`}
              >
                {client.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {!isOperator && clients[0] && (
        <Link
          href={`/clients/${clients[0].id}`}
          onClick={() => setMenuOpen(false)}
          className="block rounded-md px-3 py-2 text-sm bg-white/10 text-white"
        >
          {clients[0].name}
        </Link>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* ── MOBILE TOP NAV (visible below md) ── */}
      <div className="md:hidden">
        <div className="flex items-center justify-between border-b border-white/10 bg-slate-900/40 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-cyan-300">Framework Growth OS</p>
            <p className="text-xs text-slate-500">
              {isOperator ? "Operator view" : "Client view"}
            </p>
          </div>
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className="rounded-md border border-white/10 px-3 py-2 text-xs text-slate-400"
          >
            {menuOpen ? "Close" : "Menu"}
          </button>
        </div>

        {/* Mobile dropdown menu */}
        {menuOpen && (
          <div className="border-b border-white/10 bg-slate-900 px-4 py-3 space-y-1">
            {navLinks}
            <div className="pt-3 border-t border-white/10 mt-3">
              <p className="truncate text-xs text-slate-500 mb-2">{fullName}</p>
              <button
                onClick={handleLogout}
                className="w-full rounded-md border border-white/10 px-3 py-2 text-xs text-slate-400 hover:bg-white/5 text-left"
              >
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── DESKTOP LAYOUT (visible from md up) ── */}
      <div className="hidden md:flex min-h-screen">
        {/* Sidebar */}
        <aside className="w-64 shrink-0 border-r border-white/10 bg-slate-900/40 p-4 relative">
          <p className="text-sm font-semibold text-cyan-300">Framework Growth OS</p>
          <p className="mt-1 text-xs text-slate-500">
            {isOperator ? "Operator view" : "Client view"}
          </p>

          <nav className="mt-6 space-y-1">
            {navLinks}
          </nav>

          <div className="absolute bottom-4 left-4 right-4 w-56">
            <p className="truncate text-xs text-slate-500">{fullName}</p>
            <button
              onClick={handleLogout}
              className="mt-2 w-full rounded-md border border-white/10 px-3 py-2 text-xs text-slate-400 hover:bg-white/5"
            >
              Sign out
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      {/* Mobile main content */}
      <div className="md:hidden">
        <main>{children}</main>
      </div>

    </div>
  );
}