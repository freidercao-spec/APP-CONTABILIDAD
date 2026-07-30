import React from "react";

interface KpiCardProps {
  label: string;
  value: string | number;
  sub: string;
  icon: string;
  color: string;
  urgent?: boolean;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  detail?: string;
  onClick?: () => void;
}

export const KpiCard = ({ label, value, sub, icon, color, urgent, trend, trendValue, onClick }: KpiCardProps) => {
  const colorMap: Record<string, { primary: string; secondary: string; glow: string; border: string }> = {
    indigo:  { primary: "#6366f1", secondary: "#818cf8", glow: "rgba(99,102,241,0.35)", border: "rgba(99,102,241,0.3)" },
    emerald: { primary: "#10b981", secondary: "#34d399", glow: "rgba(16,185,129,0.35)", border: "rgba(16,185,129,0.3)" },
    red:     { primary: "#f43f5e", secondary: "#fb7185", glow: "rgba(244,63,94,0.40)", border: "rgba(244,63,94,0.4)" },
    blue:    { primary: "#0ea5e9", secondary: "#38bdf8", glow: "rgba(14,165,233,0.35)", border: "rgba(14,165,233,0.3)" },
    amber:   { primary: "#f59e0b", secondary: "#fbbf24", glow: "rgba(245,158,11,0.40)", border: "rgba(245,158,11,0.4)" },
    violet:  { primary: "#8b5cf6", secondary: "#a78bfa", glow: "rgba(139,92,246,0.35)", border: "rgba(139,92,246,0.3)" },
    cyan:    { primary: "#06b6d4", secondary: "#22d3ee", glow: "rgba(6,182,212,0.35)", border: "rgba(6,182,212,0.3)" }
  };

  const c = colorMap[color] || colorMap.blue;
  const isCritical = urgent || (label.includes("Alertas") && Number(value) > 0) || (label.includes("Asignar") && Number(value) > 0);
  const trendIcon = trend === "up" ? "trending_up" : trend === "down" ? "trending_down" : "trending_flat";
  const trendColor = trend === "up" ? "#10b981" : trend === "down" ? "#f43f5e" : "#475569";

  return (
    <div
      onClick={onClick}
      className={`relative group overflow-hidden transition-all duration-300 backdrop-blur-md ${
        onClick ? "cursor-pointer active:scale-[0.98] hover:-translate-y-0.5" : "cursor-default"
      }`}
      style={{
        background: "linear-gradient(135deg, rgba(15, 23, 42, 0.85), rgba(2, 6, 23, 0.95))",
        border: isCritical ? `1px solid ${c.primary}60` : "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "16px",
        boxShadow: isCritical ? `0 4px 24px ${c.glow}` : "0 4px 20px rgba(0, 0, 0, 0.25)"
      }}
    >
      {/* Top glowing line */}
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${c.primary}, transparent)` }} />

      <div className="relative z-10 flex items-center gap-3.5 px-5 py-4">
        {/* Icon Badge */}
        <div
          className="shrink-0 size-11 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 shadow-inner"
          style={{ background: `${c.primary}18`, border: `1px solid ${c.primary}35` }}
        >
          <span className="material-symbols-outlined text-[20px]" style={{ color: c.primary }}>{icon}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-[24px] font-black leading-none tabular-nums text-white tracking-tight">{value}</span>
            {trend && (
              <div className="flex items-center gap-0.5 text-[10px] font-black" style={{ color: trendColor }}>
                <span className="material-symbols-outlined text-[12px]">{trendIcon}</span>
                <span className="font-mono">{trendValue}</span>
              </div>
            )}
          </div>
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.16em] leading-none truncate">{label}</p>
          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider truncate mt-1">{sub}</p>
        </div>

        {/* Pulse / Status */}
        <div className="shrink-0 flex flex-col items-end gap-1">
          <div className="relative size-2.5">
            {isCritical && <div className="absolute inset-0 rounded-full animate-ping opacity-75" style={{ backgroundColor: c.primary }} />}
            <div className="relative size-full rounded-full" style={{ backgroundColor: c.primary, boxShadow: `0 0 8px ${c.primary}` }} />
          </div>
          {isCritical && <span className="text-[7.5px] font-black uppercase tracking-widest animate-pulse" style={{ color: c.secondary }}>ALERTA</span>}
        </div>
      </div>

      {/* Progress Bottom Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-slate-950/80">
        <div
          className="h-full transition-all duration-500 rounded-r-full"
          style={{
            width: `${Math.min(100, Math.max(10, (Number(value) / 10) * 100))}%`,
            background: `linear-gradient(90deg, ${c.primary}, ${c.secondary})`,
            boxShadow: `0 0 8px ${c.primary}80`
          }}
        />
      </div>
    </div>
  );
};