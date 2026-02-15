"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import LogoShimmer from "./LogoShimmer";
import NotificationBell from "../notification-bell";

interface NavLink {
  href: string;
  label: string;
  authOnly?: boolean;
  adminOnly?: boolean;
}

const navLinks: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/library", label: "My Library", adminOnly: true },
  { href: "/profile", label: "Profile" },
  { href: "/go-live", label: "Go Live", adminOnly: true },
  { href: "/playlist", label: "Playlist", adminOnly: true },
  { href: "/admin", label: "Admin", adminOnly: true },
];

export default function MainNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoTextColor, setLogoTextColor] = useState<string | null>(null);
  const logoText = "djsneak";
  const [letterColors, setLetterColors] = useState<(string | null)[]>(
    Array(logoText.length).fill(null)
  );
  const pathname = usePathname();
  const { user } = useUser();
  const activeStream = useQuery(api.livestream.getActiveStream);

  // Check if current user is admin
  const isAdmin = useQuery(
    api.adminSettings.checkIsAdmin,
    user?.id ? {} : "skip"
  );

  // Check if current user is the one streaming
  const isUserLive = activeStream && user?.id === activeStream.userId;

  useEffect(() => {
    const handleLogoTextShimmer = (event: Event) => {
      const customEvent = event as CustomEvent<{ color: string | null }>;
      setLogoTextColor(customEvent.detail.color);
    };

    window.addEventListener("logoTextShimmer", handleLogoTextShimmer);
    return () => window.removeEventListener("logoTextShimmer", handleLogoTextShimmer);
  }, []);

  const triggerLetterAnimation = () => {
    const colors = [
      "text-amber-600",
      "text-fuchsia-600",
      "text-sky-600",
      "text-emerald-600",
      "text-violet-600",
      "text-rose-600",
      "text-indigo-600",
      "text-lime-600",
    ];

    const letterCount = logoText.length;

    let letterIndex = 0;
    const animateLetter = (delay: number) => {
      if (letterIndex >= letterCount) {
        // Clear all letters after animation
        setTimeout(() => {
          setLetterColors(Array(letterCount).fill(null));
        }, 600);
        return;
      }

      const currentLetterIndex = letterIndex;
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      setTimeout(() => {
        setLetterColors(prev => {
          const newColors = [...prev];
          newColors[currentLetterIndex] = randomColor;
          return newColors;
        });

        // Clear this letter after random duration (600-1000ms)
        setTimeout(() => {
          setLetterColors(prev => {
            const newColors = [...prev];
            newColors[currentLetterIndex] = null;
            return newColors;
          });
        }, Math.random() * 400 + 600);
      }, delay);

      letterIndex++;
      // Random delay: 50/50 chance snappy (30-120ms) or laggy (250-600ms)
      const nextDelay = Math.random() < 0.5
        ? Math.random() * 90 + 30
        : Math.random() * 350 + 250;
      animateLetter(delay + nextDelay);
    };

    animateLetter(0);
  };

  // Auto-trigger animation every 10-30 seconds
  useEffect(() => {
    const scheduleNextAnimation = () => {
      const delay = Math.random() * 20000 + 10000; // 10-30 seconds
      return setTimeout(() => {
        triggerLetterAnimation();
        scheduleNextAnimation();
      }, delay);
    };

    const timeout = scheduleNextAnimation();
    return () => clearTimeout(timeout);
  }, []);

  const handleLogoTextClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    triggerLetterAnimation();
  };

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
            <LogoShimmer />
            <span
              onClick={handleLogoTextClick}
              className="text-xl font-bold tracking-tight cursor-pointer"
            >
              {logoText.split("").map((letter, index) => (
                <span
                  key={index}
                  className={`transition-all duration-300 ${
                    letterColors[index]
                      ? `${letterColors[index]} brightness-125 saturate-150`
                      : "text-white"
                  }`}
                >
                  {letter}
                </span>
              ))}
            </span>
            {activeStream && (
              <span className="flex items-center gap-1 bg-red-600 px-2 py-1 rounded text-xs font-bold text-white">
                <span className="w-1.5 h-1.5 bg-white rounded-sm animate-pulse"></span>
                LIVE
              </span>
            )}
          </Link>
        </div>

        <nav className="hidden items-center gap-8 text-sm font-medium uppercase text-gray-400 lg:flex">
          {navLinks.map(({ href, label, authOnly, adminOnly }) => {
            const active = isActive(href);
            const linkClasses = `relative transition-colors hover:text-white pb-1 ${
              active ? "text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-white" : ""
            }`;

            if (adminOnly) {
              // Only show for admin users
              if (!isAdmin) return null;
              return (
                <SignedIn key={href}>
                  <Link className={linkClasses} href={href}>
                    <span className="flex items-center gap-2">
                      {label}
                    </span>
                  </Link>
                </SignedIn>
              );
            }

            if (authOnly) {
              return (
                <SignedIn key={href}>
                  <Link className={linkClasses} href={href}>
                    <span className="flex items-center gap-2">
                      {label}
                      {href === "/go-live" && isUserLive && (
                        <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
                      )}
                    </span>
                  </Link>
                </SignedIn>
              );
            }

            return (
              <Link key={href} className={linkClasses} href={href}>
                <span className="flex items-center gap-2">
                  {label}
                  {href === "/go-live" && isUserLive && (
                    <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
                  )}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10">
                Sign In
              </button>
            </SignInButton>
          </SignedOut>

          <SignedIn>
            <NotificationBell />
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
              {navLinks.map(({ href, label, authOnly, adminOnly }) => {
                const active = isActive(href);
                const mobileLinkClasses = `rounded-full px-4 py-3 text-center transition-colors ${
                  active ? "bg-white text-black font-semibold" : "bg-white/5 hover:bg-white/10"
                }`;

                if (adminOnly) {
                  // Only show for admin users
                  if (!isAdmin) return null;
                  return (
                    <SignedIn key={href}>
                      <Link href={href} onClick={handleLinkClick} className={mobileLinkClasses}>
                        <span className="flex items-center justify-center gap-2">
                          {label}
                        </span>
                      </Link>
                    </SignedIn>
                  );
                }

                return authOnly ? (
                  <SignedIn key={href}>
                    <Link href={href} onClick={handleLinkClick} className={mobileLinkClasses}>
                      <span className="flex items-center justify-center gap-2">
                        {label}
                        {href === "/go-live" && isUserLive && (
                          <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
                        )}
                      </span>
                    </Link>
                  </SignedIn>
                ) : (
                  <Link key={href} href={href} onClick={handleLinkClick} className={mobileLinkClasses}>
                    <span className="flex items-center justify-center gap-2">
                      {label}
                      {href === "/go-live" && isUserLive && (
                        <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
                      )}
                    </span>
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
                <div className="flex items-center gap-3">
                  <NotificationBell />
                  <UserButton appearance={{ elements: { avatarBox: "h-9 w-9" } }} />
                </div>
              </div>
            </SignedIn>
          </div>
        </div>
      )}
    </header>
  );
}
