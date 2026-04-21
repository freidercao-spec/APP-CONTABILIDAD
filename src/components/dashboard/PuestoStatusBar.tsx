import React from 'react';

export const PuestoStatusBar = ({ label, value, total, color, icon }: any) => {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    const colorMap: any = {
        emerald: { bar: 'bg-emerald-500', text: 'text-emerald-600', icon: 'text-emerald-500' },
        amber:   { bar: 'bg-amber-400',   text: 'text-amber-600',   icon: 'text-amber-500' },
        red:     { bar: 'bg-red-500',      text: 'text-red-600',     icon: 'text-red-500' },
    };
    const c = colorMap[color] || colorMap.emerald;
    return (
        <div className="space-y-1.5">
            <div className="flex justify-between items-center">
                <span className={`flex items-center gap-1.5 text-[11px] font-black text-slate-600 uppercase tracking-wider`}>
                    <span className={`material-symbols-outlined text-[14px] ${c.icon}`}>{icon}</span>
                    {label}
                </span>
                <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-black ${c.text}`}>{value}</span>
                    <span className="text-[9px] text-slate-400 font-bold">({pct}%)</span>
                </div>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className={`h-full ${c.bar} rounded-full transition-all duration-1000 ease-out`}
                    style={{ width: `${pct}%`, boxShadow: `0 0 8px ${pct > 0 ? 'currentColor' : 'transparent'}` }}
                />
            </div>
        </div>
    );
};
