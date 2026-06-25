import React from "react";
interface KpiCardProps { label: string; value: string | number; sub: string; icon: string; color: string; urgent?: boolean; trend?: "up" | "down" | "neutral"; trendValue?: string; detail?: string; onClick?: () => void; }
export const KpiCard = ({ label, value, sub, icon, color, urgent, trend, trendValue, onClick }: KpiCardProps) => {
  const colorMap: any = { indigo:{primary:"#6366f1",secondary:"#818cf8",glow:"rgba(99,102,241,0.25)"}, emerald:{primary:"#10b981",secondary:"#34d399",glow:"rgba(16,185,129,0.25)"}, red:{primary:"#f43f5e",secondary:"#fb7185",glow:"rgba(244,63,94,0.30)"}, blue:{primary:"#0ea5e9",secondary:"#38bdf8",glow:"rgba(14,165,233,0.25)"}, amber:{primary:"#f59e0b",secondary:"#fbbf24",glow:"rgba(245,158,11,0.30)"}, violet:{primary:"#8b5cf6",secondary:"#a78bfa",glow:"rgba(139,92,246,0.25)"}, cyan:{primary:"#06b6d4",secondary:"#22d3ee",glow:"rgba(6,182,212,0.25)"} };
  const c = colorMap[color] || colorMap.blue;
  const isCritical = urgent || (label.includes("Alertas") && Number(value) > 0) || (label.includes("Asignar") && Number(value) > 0);
  const trendIcon = trend === "up" ? "trending_up" : trend === "down" ? "trending_down" : "trending_flat";
  const trendColor = trend === "up" ? "#10b981" : trend === "down" ? "#f43f5e" : "#475569";
  return (
    <div onClick={onClick} className={`relative group overflow-hidden transition-all duration-300 ${onClick ? "cursor-pointer active:scale-[0.98]" : "cursor-default"}`} style={{ background:"linear-gradient(135deg,rgba(13,21,37,0.95),rgba(7,11,20,0.98))", border: isCritical ? `1px solid ${c.primary}45` : "1px solid rgba(255,255,255,0.07)", borderRadius:"12px", boxShadow: isCritical ? `0 0 20px ${c.glow}` : "0 2px 12px rgba(0,0,0,0.4)" }}>
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background:`linear-gradient(90deg,transparent,${c.primary}70,transparent)` }} />
      <div className="relative z-10 flex items-center gap-3 px-4 py-3">
        <div className="shrink-0 size-9 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:scale-110" style={{ background:`${c.primary}15`, border:`1px solid ${c.primary}30` }}>
          <span className="material-symbols-outlined text-[18px]" style={{ color:c.primary }}>{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 mb-0.5">
            <span className="text-[22px] font-black leading-none tabular-nums text-white">{value}</span>
            {trend && <div className="flex items-center gap-0.5 text-[9px] font-black" style={{ color:trendColor }}><span className="material-symbols-outlined text-[11px]">{trendIcon}</span><span className="font-mono">{trendValue}</span></div>}
          </div>
          <p className="text-[9px] font-black text-white/75 uppercase tracking-[0.18em] leading-none truncate">{label}</p>
          <p className="text-[8px] text-slate-600 font-bold uppercase tracking-wider truncate mt-0.5">{sub}</p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <div className="relative size-2">{isCritical && <div className="absolute inset-0 rounded-full animate-ping opacity-70" style={{ backgroundColor:c.primary }} />}<div className="relative size-full rounded-full" style={{ backgroundColor:c.primary, boxShadow:`0 0 6px ${c.primary}` }} /></div>
          {isCritical && <span className="text-[7px] font-black uppercase tracking-widest animate-pulse" style={{ color:c.secondary }}>CRITICO</span>}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background:"rgba(255,255,255,0.03)" }}><div className="h-full" style={{ width:`${Math.min(100,Math.max(8,(Number(value)/10)*100))}%`, background:`linear-gradient(90deg,${c.primary}50,${c.secondary})`, opacity:0.6 }} /></div>
    </div>
  );
};