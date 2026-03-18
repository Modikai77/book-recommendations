"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { BookOpenText, LayoutDashboard, ListChecks, Search, UploadCloud, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/submit-source", label: "Submit source", icon: UploadCloud },
  { href: "/recommendations", label: "Recommendations", icon: Search },
  { href: "/lists", label: "Lists", icon: ListChecks },
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/admin/review", label: "Admin", icon: BookOpenText }
] satisfies Array<{ href: Route; label: string; icon: React.ComponentType<{ className?: string }> }>;

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fdf4d9,_#f7efe4_30%,_#efe8dc_100%)] text-stone-900">
      <div className="mx-auto flex min-h-screen max-w-7xl gap-6 px-4 py-6 md:px-6">
        <aside className="hidden w-72 shrink-0 rounded-[2rem] border border-stone-200/80 bg-white/70 p-5 shadow-lg shadow-amber-950/5 backdrop-blur md:block">
          <div className="mb-8">
            <p className="font-serif text-2xl font-semibold">Marginalia</p>
            <p className="mt-2 text-sm text-stone-600">
              Curated book discovery for newsletters, links, and Obsidian notes.
            </p>
          </div>
          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition",
                    active
                      ? "bg-amber-100 text-stone-900 ring-1 ring-amber-300"
                      : "text-stone-700 hover:bg-stone-100"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="mt-8 w-full rounded-2xl border border-stone-200 px-4 py-3 text-left text-sm text-stone-700 transition hover:bg-stone-100"
          >
            Log out
          </button>
        </aside>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
