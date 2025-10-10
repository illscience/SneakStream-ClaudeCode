"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LayoutGrid, Layout } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

type LayoutMode = "classic" | "theater";

interface MainNavProps {
  layoutMode: LayoutMode;
  onLayoutChange: (mode: LayoutMode) => void;
}

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/go-live", label: "Go Live" },
  { href: "/library", label: "My Library", authOnly: true },
  { href: "/profile", label: "Profile", authOnly: true },
];

export default function MainNav({ layoutMode, onLayoutChange }: MainNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const handleLinkClick = () => setMobileOpen(false);

  const isActive = (href: string) => pathname === href;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-black/90 backdrop-blur-xl">
      <div className="flex w-full items-center justify-between px-4 py-4 lg:px-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex items-center justify-center rounded-lg border border-white/10 p-2 text-white transition-colors hover:bg-white/5 lg:hidden"
            aria-expanded={mobileOpen}
            aria-controls="primary-navigation"
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-9 w-9 grid-cols-3 gap-0.5">
              <span className="rounded-sm bg-yellow-400" />
              <span className="rounded-sm bg-pink-400" />
              <span className="rounded-sm bg-cyan-400" />
              <span className="rounded-sm bg-green-400" />
              <span className="rounded-sm bg-purple-400" />
              <span className="rounded-sm bg-orange-400" />
              <span className="rounded-sm bg-red-400" />
              <span className="rounded-sm bg-blue-400" />
              <span className="rounded-sm bg-lime-400" />
            </span>
            <span className="text-xl font-bold tracking-tight">DJ SNEAK</span>
          </Link>
        </div>

        <nav className="hidden items-center gap-8 text-sm font-medium uppercase text-gray-400 lg:flex">
          {navLinks.map(({ href, label, authOnly }) => {
            const active = isActive(href);
            const linkClasses = `relative transition-colors hover:text-white pb-1 ${
              active ? "text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-white" : ""
            }`;

            if (authOnly) {
              return (
                <SignedIn key={href}>
                  <Link className={linkClasses} href={href}>
                    {label}
                  </Link>
                </SignedIn>
              );
            }

            return (
              <Link key={href} className={linkClasses} href={href}>
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <Toggle
            pressed={layoutMode === "theater"}
            onPressedChange={(pressed) => onLayoutChange(pressed ? "theater" : "classic")}
            aria-label="Toggle layout"
            className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-200 transition-colors data-[state=on]:border-lime-400 data-[state=on]:bg-lime-400 data-[state=on]:text-black"
          >
            {layoutMode === "theater" ? (
              <>
                <Layout className="h-4 w-4" />
                Theater
              </>
            ) : (
              <>
                <LayoutGrid className="h-4 w-4" />
                Classic
              </>
            )}
          </Toggle>

          <SignedOut>
            <SignInButton mode="modal">
              <button className="rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10">
                Sign In
              </button>
            </SignInButton>
          </SignedOut>

          <SignedIn>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "h-10 w-10",
                },
              }}
            />
          </SignedIn>
        </div>
      </div>

      {mobileOpen && (
        <div
          id="primary-navigation"
          className="border-t border-white/10 bg-black/95 px-4 pb-4 pt-3 shadow-lg lg:hidden"
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 text-sm font-medium uppercase text-gray-200">
              {navLinks.map(({ href, label, authOnly }) => {
                const active = isActive(href);
                const mobileLinkClasses = `rounded-full px-4 py-3 text-center transition-colors ${
                  active ? "bg-white text-black font-semibold" : "bg-white/5 hover:bg-white/10"
                }`;

                return authOnly ? (
                  <SignedIn key={href}>
                    <Link href={href} onClick={handleLinkClick} className={mobileLinkClasses}>
                      {label}
                    </Link>
                  </SignedIn>
                ) : (
                  <Link key={href} href={href} onClick={handleLinkClick} className={mobileLinkClasses}>
                    {label}
                  </Link>
                );
              })}
            </div>

            <SignedOut>
              <SignInButton mode="modal">
                <button className="w-full rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10">
                  Sign In
                </button>
              </SignInButton>
            </SignedOut>

            <SignedIn>
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-200">
                <span>Account</span>
                <UserButton appearance={{ elements: { avatarBox: "h-9 w-9" } }} />
              </div>
            </SignedIn>
          </div>
        </div>
      )}
    </header>
  );
}
