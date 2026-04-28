import React from 'react';

interface KpiCardProps {
  label: string;
  value: string | number;
  sub: string;
  icon: string;
  color: string;
  urgent?: boolean;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  detail?: string;
  onClick?: () => void;
}

export const KpiCard = ({ label, value, sub, icon, color, urgent, trend, trendValue, detail, onClick }: KpiCardProps) => {
    const colorMap: any = {
        indigo:  { primary: '#6366f1', secondary: '#818cf8', glow: 'rgba(99,102,241,0.25)', bg: 'bg-indigo-500/5' },
        emerald: { primary: '#10b981', secondary: '#34d399', glow: 'rgba(16,185,129,0.25)', bg: 'bg-emerald-500/5' },
        red:     { primary: '#f43f5e', secondary: '#fb7185', glow: 'rgba(244,63,94,0.35)',  bg: 'bg-rose-500/5' },
        blue:    { primary: '#0ea5e9', secondary: '#38bdf8', glow: 'rgba(14,165,233,0.25)', bg: 'bg-sky-500/5' },
        amber:   { primary: '#f59e0b', secondary: '#fbbf24', glow: 'rgba(245,158,11,0.35)',  bg: 'bg-amber-500/5' },
        violet:  { primary: '#8b5cf6', secondary: '#a78bfa', glow: 'rgba(139,92,246,0.25)', bg: 'bg-violet-500/5' },
        cyan:    { primary: '#06b6d4', secondary: '#22d3ee', glow: 'rgba(6,182,212,0.25)', bg: 'bg-cyan-500/5' },
    };
    
    const c = colorMap[color] || colorMap.blue;
    const isCritical = urgent || (label.includes('Alertas') && Number(value) > 0) || (label.includes('Asignar') && Number(value) > 0);

    return (
        <div 
            onClick={onClick}
            className={`
                relative group overflow-hidden rounded-[32px] p-8 border transition-all duration-700 
                hover:-translate-y-2 hover:shadow-[0_30px_60px_-12px_rgba(0,0,0,0.6)]
                ${onClick ? 'cursor-pointer active:scale-95' : 'cursor-default'}
                bg-gradient-to-br from-[#0D1525] to-[#070B14]
            `}
            style={{
                borderColor: isCritical ? `${c.primary}60` : 'rgba(255,255,255,0.08)',
                boxShadow: isCritical ? `0 0 40px ${c.glow}, inset 0 0 20px ${c.glow}` : '0 10px 40px rgba(0,0,0,0.4)'
            }}
        >
            {/* Holographic Scanline Animation */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.03]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1)_0.5px,transparent_0.5px)] bg-[length:16px_16px]"></div>
            </div>
            <div className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-white/10 to-transparent top-0 -translate-y-full group-hover:animate-[scan_3s_linear_infinite] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>

            {/* Content Overlay */}
            <div className="relative z-10">
                <div className="flex items-start justify-between mb-8">
                    <div 
                        className={`size-14 rounded-2xl flex items-center justify-center border transition-all duration-700 group-hover:rotate-[360deg] group-hover:scale-110 shadow-2xl relative overflow-hidden`}
                        style={{ backgroundColor: `${c.primary}10`, borderColor: `${c.primary}30` }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <span className={`material-symbols-outlined text-[28px] relative z-10`} style={{ color: c.primary, filter: `drop-shadow(0 0 8px ${c.primary}80)` }}>{icon}</span>
                    </div>
                    
                    <div className="relative flex items-center gap-2">
                        {isCritical && (
                            <span className="text-[9px] font-black tracking-widest text-white/40 uppercase animate-pulse">Critical</span>
                        )}
                        <div className="relative size-3">
                            {isCritical && (
                                <div className={`absolute inset-0 rounded-full animate-ping opacity-60`} style={{ backgroundColor: c.primary }} />
                            )}
                            <div 
                                className={`relative size-full rounded-full`}
                                style={{ backgroundColor: c.primary, boxShadow: `0 0 15px ${c.primary}` }}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex flex-col">
                    <div className="flex items-baseline gap-2">
                        <div className={`text-[48px] font-black leading-none tracking-tighter tabular-nums text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]`}>
                            {value}
                        </div>
                        {trend && (
                            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[10px] font-black font-mono shadow-lg transition-all duration-700 ${
                                trend === 'up' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 
                                trend === 'down' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
                                'bg-slate-500/10 border-slate-500/30 text-slate-400'
                            }`}>
                                <span className="material-symbols-outlined text-[12px]">
                                    {trend === 'up' ? 'keyboard_double_arrow_up' : trend === 'down' ? 'keyboard_double_arrow_down' : 'remove'}
                                </span>
                                {trendValue || '0'}
                            </div>
                        )}
                    </div>
                    
                    <div className="flex flex-col mt-4">
                        <p className="text-[11px] font-black text-white/90 uppercase tracking-[0.25em] mb-1">{label}</p>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed max-w-[80%]">{sub}</p>
                    </div>
                </div>
            </div>

            {/* Interactive Shine Effect */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none"></div>
            
            {/* Corner Decorative Elements */}
            <div className="absolute top-0 right-0 size-8 border-t-2 border-r-2 rounded-tr-[32px] opacity-0 group-hover:opacity-100 transition-all duration-700" style={{ borderColor: `${c.primary}40` }}></div>
            <div className="absolute bottom-0 left-0 size-8 border-b-2 border-l-2 rounded-bl-[32px] opacity-0 group-hover:opacity-100 transition-all duration-700" style={{ borderColor: `${c.primary}40` }}></div>
        </div>
    );
};
