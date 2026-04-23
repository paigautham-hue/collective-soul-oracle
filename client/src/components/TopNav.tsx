import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Menu, X, Atom, LayoutDashboard, Shield, LogOut, User, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function TopNav() {
  const { user, isAuthenticated } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      toast.success("Signed out successfully");
      window.location.href = "/";
    },
  });

  const navLinks = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/personas", label: "Personas", icon: Users },
  ];

  if (user?.role === "admin") {
    navLinks.push({ href: "/admin", label: "Admin", icon: Shield });
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-strong border-b border-[oklch(0.35_0.05_265_/_0.35)]">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-8 h-8 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-[oklch(0.55_0.28_280_/_0.2)] group-hover:bg-[oklch(0.55_0.28_280_/_0.35)] transition-all duration-300" />
              <Atom className="w-5 h-5 text-[oklch(0.65_0.30_280)] relative z-10 group-hover:rotate-45 transition-transform duration-500" />
            </div>
            <div className="hidden sm:block">
              <span className="font-cinzel text-sm font-semibold tracking-[0.12em] text-gradient-aurora">
                THE COLLECTIVE SOUL
              </span>
              <span className="block font-jetbrains text-[9px] tracking-[0.25em] text-[oklch(0.55_0.02_265)] uppercase">
                Oracle
              </span>
            </div>
            <div className="sm:hidden">
              <span className="font-cinzel text-xs font-semibold tracking-[0.08em] text-gradient-aurora">
                ORACLE
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = location === link.href;
              return (
                <Link key={link.href} href={link.href}>
                  <button
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-cormorant font-medium transition-all duration-200 ${
                      active
                        ? "bg-[oklch(0.55_0.28_280_/_0.20)] text-[oklch(0.65_0.30_280)] border border-[oklch(0.55_0.28_280_/_0.30)]"
                        : "text-[oklch(0.75_0.02_265)] hover:text-[oklch(0.97_0.005_265)] hover:bg-[oklch(0.15_0.02_265_/_0.50)]"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {link.label}
                  </button>
                </Link>
              );
            })}
          </div>

          {/* Auth Section */}
          <div className="flex items-center gap-3">
            {isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg glass border border-[oklch(0.35_0.05_265_/_0.35)] hover:border-[oklch(0.55_0.15_280_/_0.45)] transition-all duration-200 group">
                    <div className="w-7 h-7 rounded-full bg-[oklch(0.55_0.28_280_/_0.25)] flex items-center justify-center text-[oklch(0.65_0.30_280)] text-xs font-cinzel font-semibold">
                      {user.name?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <span className="hidden sm:block font-cormorant text-sm text-[oklch(0.85_0.02_265)] max-w-[120px] truncate">
                      {user.name || user.email || "User"}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-52 glass-strong border-[oklch(0.35_0.05_265_/_0.35)] text-[oklch(0.97_0.005_265)]"
                  style={{ background: "oklch(0.12 0.02 265 / 0.95)", backdropFilter: "blur(24px)" }}
                >
                  <div className="px-3 py-2 border-b border-[oklch(0.35_0.05_265_/_0.25)]">
                    <p className="font-cinzel text-xs tracking-wider text-[oklch(0.65_0.30_280)]">
                      {user.name || "User"}
                    </p>
                    <p className="font-jetbrains text-[10px] text-[oklch(0.55_0.02_265)] truncate mt-0.5">
                      {user.email || ""}
                    </p>
                  </div>
                  <DropdownMenuItem className="flex items-center gap-2 font-cormorant text-sm cursor-pointer hover:bg-[oklch(0.55_0.28_280_/_0.15)] focus:bg-[oklch(0.55_0.28_280_/_0.15)]">
                    <User className="w-3.5 h-3.5" />
                    Profile
                  </DropdownMenuItem>
                  {user.role === "admin" && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="flex items-center gap-2 font-cormorant text-sm cursor-pointer hover:bg-[oklch(0.55_0.28_280_/_0.15)] focus:bg-[oklch(0.55_0.28_280_/_0.15)]">
                        <Shield className="w-3.5 h-3.5" />
                        Admin Panel
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="bg-[oklch(0.35_0.05_265_/_0.25)]" />
                  <DropdownMenuItem
                    onClick={() => logoutMutation.mutate()}
                    className="flex items-center gap-2 font-cormorant text-sm text-[oklch(0.65_0.25_25)] cursor-pointer hover:bg-[oklch(0.65_0.25_25_/_0.15)] focus:bg-[oklch(0.65_0.25_25_/_0.15)]"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <a href={getLoginUrl()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="font-cormorant text-sm text-[oklch(0.75_0.02_265)] hover:text-[oklch(0.97_0.005_265)] hover:bg-[oklch(0.15_0.02_265_/_0.50)]"
                  >
                    Sign In
                  </Button>
                </a>
                <a href={getLoginUrl()}>
                  <Button
                    size="sm"
                    className="font-cinzel text-xs tracking-wider bg-[oklch(0.55_0.28_280)] hover:bg-[oklch(0.60_0.30_280)] text-[oklch(0.97_0.005_265)] border border-[oklch(0.65_0.30_280_/_0.40)] glow-indigo transition-all duration-200"
                  >
                    Get Started
                  </Button>
                </a>
              </div>
            )}

            {/* Mobile menu toggle */}
            <button
              className="md:hidden p-2 rounded-lg glass border border-[oklch(0.35_0.05_265_/_0.35)] text-[oklch(0.75_0.02_265)] hover:text-[oklch(0.97_0.005_265)] transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden glass-strong border-t border-[oklch(0.35_0.05_265_/_0.25)]"
          >
            <div className="container mx-auto px-4 py-3 flex flex-col gap-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const active = location === link.href;
                return (
                  <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}>
                    <button
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-cormorant font-medium transition-all ${
                        active
                          ? "bg-[oklch(0.55_0.28_280_/_0.20)] text-[oklch(0.65_0.30_280)]"
                          : "text-[oklch(0.75_0.02_265)] hover:text-[oklch(0.97_0.005_265)] hover:bg-[oklch(0.15_0.02_265_/_0.50)]"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {link.label}
                    </button>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
