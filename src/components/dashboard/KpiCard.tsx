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
        indigo:  { bg: 'bg-indigo-50/10',  text: 'text-indigo-400',  border: 'border-indigo-500/20', shadow: 'shadow-indigo-500/10', dot: 'bg-indigo-500' },
        emerald: { bg: 'bg-emerald-50/10', text: 'text-emerald-400', border: 'border-emerald-500/20', shadow: 'shadow-emerald-500/10', dot: 'bg-emerald-500' },
        red:     { bg: 'bg-red-500/5',     text: 'text-red-400',     border: 'border-red-500/20',     shadow: 'shadow-red-500/20',     dot: 'bg-red-500' },
        blue:    { bg: 'bg-blue-50/10',    text: 'text-blue-400',    border: 'border-blue-500/20',    shadow: 'shadow-blue-500/10',    dot: 'bg-blue-500' },
        amber:   { bg: 'bg-amber-500/5',   text: 'text-amber-400',   border: 'border-amber-500/20',   shadow: 'shadow-amber-500/20',   dot: 'bg-amber-500' },
        violet:  { bg: 'bg-violet-50/10',  text: 'text-violet-400',  border: 'border-violet-500/20',  shadow: 'shadow-violet-500/10',  dot: 'bg-violet-500' },
        cyan:    { bg: 'bg-cyan-50/10',    text: 'text-cyan-400',    border: 'border-cyan-500/20',    shadow: 'shadow-cyan-500/10',    dot: 'bg-cyan-500' },
    };
    
    const c = colorMap[color] || colorMap.blue;
    const isCritical = urgent || (label === 'Con Alertas' && Number(value) > 0) || (label === 'Sin Asignar' && Number(value) > 0);

    return (
        <div 
            onClick={onClick}
            className={`
                relative group overflow-hidden rounded-[28px] p-6 border transition-all duration-500 
                hover:-translate-y-1.5 hover:shadow-2xl ${onClick ? 'cursor-pointer active:scale-95' : 'cursor-default'}
                ${isCritical && label === 'Con Alertas' ? 'bg-[#FF4C4C08]' : ''}
                ${isCritical && label === 'Sin Asignar' ? 'bg-[#F5A62308]' : ''}
                ${!isCritical ? 'bg-white/5' : ''}
            `}
            style={{
                borderColor: isCritical ? `${c.dot}40` : 'rgba(255,255,255,0.06)',
                backdropFilter: 'blur(20px)',
                boxShadow: isCritical ? `0 10px 40px ${c.dot}10` : '0 8px 30px rgba(0,0,0,0.3)'
            }}
            aria-label={`${label}: ${value}`}
        >
            {/* Tooltip Float */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-y-2 group-hover:translate-y-0 pointer-events-none z-30">
                <div className="bg-[#161B22] border border-white/10 px-3 py-1.5 rounded-xl whitespace-nowrap shadow-2xl">
                    <p className="text-[10px] font-black text-white uppercase tracking-widest">{detail || sub}</p>
                </div>
            </div>

            <div className="flex items-start justify-between mb-4">
                <div 
                    className={`size-11 rounded-2xl flex items-center justify-center border ${c.bg} ${c.border} group-hover:scale-110 transition-transform duration-500 shadow-lg`}
                    style={{ borderColor: `${c.dot}30` }}
                >
                    <span className={`material-symbols-outlined text-[24px] ${c.text}`}>{icon}</span>
                </div>
                
                {/* Status Badge with pulse if critical */}
                <div className="relative">
                    {isCritical && (
                        <div className={`absolute inset-0 rounded-full animate-ping opacity-60`} style={{ backgroundColor: c.dot }} />
                    )}
                    <div 
                        className={`relative size-2.5 rounded-full shadow-[0_0_8px_currentColor]`}
                        style={{ backgroundColor: c.dot, color: c.dot }}
                    />
                </div>
            </div>

            <div className="flex flex-col">
                <div className={`text-[36px] font-black leading-none tracking-tighter tabular-nums transition-colors duration-300 ${isCritical ? 'text-white' : 'text-white/90 group-hover:text-white'}`}>
                    {value}
                </div>
                
                <div className="flex items-center gap-2 mt-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{label}</p>
                    {trend && (
                        <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg border text-[9px] font-black font-mono transition-all duration-500 ${
                            trend === 'up' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 
                            trend === 'down' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                            'bg-slate-500/10 border-slate-500/30 text-slate-400'
                        }`}>
                            <span className="material-symbols-outlined text-[10px]">
                                {trend === 'up' ? 'trending_up' : trend === 'down' ? 'trending_down' : 'horizontal_rule'}
                            </span>
                            {trendValue || '0'}
                        </div>
                    )}
                </div>
            </div>

            <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mt-2">{sub}</p>
            
            {/* Bottom accent bar */}
            <div className={`absolute bottom-0 left-0 right-0 h-[3px] opacity-20 group-hover:opacity-100 transition-all duration-700`}
                style={{ background: `linear-gradient(90deg, transparent, ${c.dot}, transparent)` }} />
        </div>
    );
};
