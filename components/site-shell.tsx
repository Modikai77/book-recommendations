"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { BookOpenText, LayoutDashboard, ListChecks, Menu, Search, UploadCloud, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/submit-source", label: "Submit source", icon: UploadCloud },
  { href: "/recommendations", label: "Recommendations", icon: Search },
  { href: "/lists", label: "Lists", icon: ListChecks },
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/admin/review", label: "Admin", icon: BookOpenText }
] satisfies Array<{ href: Route; label: string; icon: React.ComponentType<{ className?: string }> }>;

function getPageTitle(pathname: string) {
  const matched = navItems.find((item) => pathname.startsWith(item.href));
  if (matched) {
    return matched.label;
  }

  if (pathname.startsWith("/books/")) {
    return "Book";
  }

  return "Marginalia";
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const firstNavRef = useRef<HTMLAnchorElement>(null);
  const lastNavRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileNavOpen) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileNavOpen(false);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = [closeButtonRef.current, firstNavRef.current, lastNavRef.current].filter(Boolean) as HTMLElement[];
      if (!focusable.length) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileNavOpen]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fdf4d9,_#f7efe4_30%,_#efe8dc_100%)] text-stone-900">
      <div className="sticky top-0 z-30 border-b border-stone-200/70 bg-white/85 px-4 py-3 shadow-sm backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate font-serif text-xl font-semibold">Marginalia</p>
            <p className="truncate text-xs uppercase tracking-[0.25em] text-stone-500">{getPageTitle(pathname)}</p>
          </div>
          <button
            type="button"
            aria-label="Open navigation menu"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen(true)}
            className="rounded-2xl border border-stone-200 bg-white p-3 text-stone-900 shadow-sm"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-40 md:hidden" aria-modal="true" role="dialog">
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setMobileNavOpen(false)}
            className="absolute inset-0 bg-stone-950/35"
          />
          <div className="absolute right-0 top-0 flex h-full w-[min(86vw,22rem)] flex-col border-l border-stone-200 bg-white px-5 pb-5 pt-4 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-serif text-2xl font-semibold">Marginalia</p>
                <p className="mt-2 text-sm text-stone-600">Curated book discovery for newsletters, links, and Obsidian notes.</p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setMobileNavOpen(false)}
                className="rounded-2xl border border-stone-200 p-3 text-stone-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="mt-6 space-y-2">
              {navItems.map((item, index) => {
                const Icon = item.icon;
                const active = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    ref={index === 0 ? firstNavRef : undefined}
                    href={item.href}
                    onClick={() => setMobileNavOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-4 py-4 text-base transition",
                      active
                        ? "bg-amber-100 text-stone-900 ring-1 ring-amber-300"
                        : "text-stone-700 hover:bg-stone-100"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <button
              ref={lastNavRef}
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="mt-auto w-full rounded-2xl border border-stone-200 px-4 py-4 text-left text-base text-stone-700 transition hover:bg-stone-100"
            >
              Log out
            </button>
          </div>
        </div>
      ) : null}

      <div className="mx-auto flex min-h-screen max-w-7xl gap-4 px-4 py-4 md:gap-6 md:px-6 md:py-6">
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
        <main className="min-w-0 flex-1 pb-6 md:pb-0">{children}</main>
      </div>
    </div>
  );
}
