import React from 'react';
import type { Puesto } from '../../store/puestoStore';

export interface ColorLegendProps {
  puestos: Puesto[];
}

const ColorLegend: React.FC<ColorLegendProps> = ({ puestos }) => {
  return (
    <div className="absolute top-4 right-4 z-40 bg-white/10 rounded-xl backdrop-blur-xl p-2 max-w-xs" style={{ backdropFilter: 'blur(12px)' }}>
      <h4 className="text-sm font-bold text-white mb-1">Color Legend</h4>
      <ul className="space-y-1 list-none p-0">
        {puestos.map(p => {
          const hue = ((parseInt(p.id.replace(/\D/g, ''), 10) || 0) * 137) % 360;
    const [r, g, b] = (function(h){ const s=70,l=55; const c=(1-Math.abs(2*l/100-1))*s/100; const x=c*(1-Math.abs(((h/60)%2)-1)); const m=l/100-c/2; let r1,g1,b1; if(h<60){r1=c;g1=x;b1=0;} else if(h<120){r1=x;g1=c;b1=0;} else if(h<180){r1=0;g1=c;b1=x;} else if(h<240){r1=0;g1=x;b1=c;} else if(h<300){r1=x;g1=0;b1=c;} else {r1=c;g1=0;b1=x;} return [Math.round((r1+m)*255), Math.round((g1+m)*255), Math.round((b1+m)*255)]; })(hue);
    const color = `rgb(${r},${g},${b})`;
          return (
            <li key={p.id} className="flex items-center gap-2 text-slate-300 text-xs">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }}></span> {p.nombre}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ColorLegend;
