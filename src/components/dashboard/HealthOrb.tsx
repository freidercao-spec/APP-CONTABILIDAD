import React from 'react';

export const HealthOrb = ({ label, pct, sub, color }: any) => {
    const r = 40;
    const circumference = 2 * Math.PI * r;
    return (
        <div className="flex flex-col items-center gap-3 p-5 rounded-3xl bg-gradient-to-b from-slate-50 to-white border border-slate-100 group hover:border-slate-200 transition-all duration-300">
            <div className="relative size-28">
                <svg className="size-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r={r} fill="none" stroke="#f1f5f9" strokeWidth="10"/>
                    <circle
                        cx="50" cy="50" r={r}
                        fill="none"
                        stroke={color}
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={circumference * (1 - Math.max(0, Math.min(100, pct)) / 100)}
                        style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1)', filter: `drop-shadow(0 0 6px ${color}66)` }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-black text-slate-900 text-[20px] leading-none tabular-nums">{pct}%</span>
                </div>
            </div>
            <div className="text-center">
                <p className="text-[11px] font-black text-slate-800 uppercase tracking-wide">{label}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{sub}</p>
            </div>
        </div>
    );
};
