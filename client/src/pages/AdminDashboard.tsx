import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import TopNav from "@/components/TopNav";
import { useEffect } from "react";
import { Users, FolderOpen, Activity, Shield } from "lucide-react";

export default function AdminDashboard() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isAuthenticated && user?.role !== "admin") {
      navigate("/");
    }
  }, [isAuthenticated, user]);

  const { data: users } = trpc.admin.users.useQuery(undefined, { enabled: user?.role === "admin" });

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen nebula-bg flex items-center justify-center">
        <div className="glass-card p-8 text-center">
          <Shield className="w-10 h-10 text-[oklch(0.65_0.25_25)] mx-auto mb-4" />
          <p className="font-cinzel text-[oklch(0.65_0.25_25)]">Access Denied</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen nebula-bg">
      <TopNav />
      <div className="pt-24 pb-16 container mx-auto px-4 sm:px-6 max-w-5xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-[oklch(0.65_0.25_25_/_0.15)] border border-[oklch(0.65_0.25_25_/_0.30)] flex items-center justify-center">
            <Shield className="w-5 h-5 text-[oklch(0.65_0.25_25)]" />
          </div>
          <div>
            <p className="font-cinzel text-[9px] tracking-[0.2em] text-[oklch(0.50_0.02_265)]">SYSTEM CONTROL</p>
            <h1 className="font-cinzel text-2xl font-bold text-[oklch(0.97_0.005_265)]">Admin Dashboard</h1>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: "Total Users", value: users?.length || 0, icon: Users, color: "oklch(0.65 0.30 280)" },
            { label: "Admin Users", value: users?.filter((u: any) => u.role === "admin").length || 0, icon: Shield, color: "oklch(0.65 0.25 25)" },
            { label: "Regular Users", value: users?.filter((u: any) => u.role === "user").length || 0, icon: Activity, color: "oklch(0.72 0.18 145)" },
          ].map(({ label, value, icon: Icon, color }) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-5"
            >
              <div className="flex items-center gap-3 mb-2">
                <Icon className="w-4 h-4" style={{ color }} />
                <p className="font-cinzel text-[9px] tracking-[0.15em] text-[oklch(0.50_0.02_265)]">{label.toUpperCase()}</p>
              </div>
              <p className="font-cinzel text-3xl font-bold text-[oklch(0.97_0.005_265)]">{value}</p>
            </motion.div>
          ))}
        </div>

        {/* Users Table */}
        <div className="glass-card overflow-hidden">
          <div className="px-6 py-4 border-b border-[oklch(0.20_0.02_265_/_0.40)]">
            <h2 className="font-cinzel text-sm font-semibold text-[oklch(0.97_0.005_265)]">All Users</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[oklch(0.15_0.02_265_/_0.40)]">
                  {["ID", "Name", "Email", "Role", "Login Method", "Joined"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-cinzel text-[9px] tracking-[0.15em] text-[oklch(0.45_0.02_265)]">{h.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users?.map((u: any) => (
                  <tr key={u.id} className="border-b border-[oklch(0.12_0.01_265_/_0.30)] hover:bg-[oklch(0.10_0.02_265_/_0.40)] transition-colors">
                    <td className="px-4 py-3 font-jetbrains text-xs text-[oklch(0.55_0.02_265)]">{u.id}</td>
                    <td className="px-4 py-3 font-cormorant text-sm text-[oklch(0.90_0.02_265)]">{u.name || "—"}</td>
                    <td className="px-4 py-3 font-jetbrains text-xs text-[oklch(0.65_0.02_265)]">{u.email || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`font-jetbrains text-[10px] px-2 py-0.5 rounded-full ${
                        u.role === "admin"
                          ? "bg-[oklch(0.65_0.25_25_/_0.15)] text-[oklch(0.65_0.25_25)] border border-[oklch(0.65_0.25_25_/_0.30)]"
                          : "bg-[oklch(0.55_0.28_280_/_0.10)] text-[oklch(0.65_0.30_280)] border border-[oklch(0.55_0.28_280_/_0.20)]"
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-jetbrains text-xs text-[oklch(0.55_0.02_265)]">{u.loginMethod || "—"}</td>
                    <td className="px-4 py-3 font-jetbrains text-xs text-[oklch(0.45_0.02_265)]">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
