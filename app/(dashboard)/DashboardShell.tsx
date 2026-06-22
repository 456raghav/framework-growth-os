"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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

  const isOperator = role === "operator" || role === "specialist";

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-white">
      {/* Sidebar — persistent across every page, this is the actual fix
          for "not interconnected": navigating between clients now means
          clicking an item here, never copying a UUID from Supabase. */}
      <aside className="w-64 shrink-0 border-r border-white/10 bg-slate-900/40 p-4">
        <p className="text-sm font-semibold text-cyan-300">Framework Growth OS</p>
        <p className="mt-1 text-xs text-slate-500">
          {isOperator ? "Operator view" : "Client view"}
        </p>

        <nav className="mt-6 space-y-1">
          {isOperator && (
            <Link
              href="/"
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

          {/* Client-role users have exactly one client, no switcher needed —
              they land directly on their own workspace. */}
          {!isOperator && clients[0] && (
            <Link
              href={`/clients/${clients[0].id}`}
              className="block rounded-md px-3 py-2 text-sm bg-white/10 text-white"
            >
              {clients[0].name}
            </Link>
          )}
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

      {/* Main content — every page renders here, inside the same shell */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
