import type { Puesto } from '../store/puestoStore';

export const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
    s /= 100; l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
};

export const hashId = (id: string): number => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = (hash * 31 + id.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
};

export const makeFlagIcon = (color: [number, number, number], estado: Puesto['estado']) => {
    const isAlerta = estado === 'alerta';
    const isDesprotegido = estado === 'desprotegido';
    
    const r = isAlerta ? 255 : isDesprotegido ? 245 : color[0];
    const g = isAlerta ? 71 : isDesprotegido ? 158 : color[1];
    const b = isAlerta ? 87 : isDesprotegido ? 11 : color[2];
    const hex = `${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="120" viewBox="0 0 80 120">
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.5" result="blur"/>
          <feComposite in="SourceGraphic" in2="blur" operator="over"/>
        </filter>
        <filter id="glow-inner" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="blur"/>
          <feComposite in="SourceGraphic" in2="blur" operator="over"/>
        </filter>
        <linearGradient id="body-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="100%" stop-color="#e2e8f0"/>
        </linearGradient>
      </defs>
      <ellipse cx="40" cy="115" rx="14" ry="4" fill="rgba(0,0,0,0.6)" filter="blur(3px)"/>
      <path d="M40 110 C40 110 12 60 12 36 C12 16 22 6 40 6 C58 6 68 16 68 36 C68 60 40 110 40 110 Z"
            fill="none" stroke="#${hex}" stroke-width="5" filter="url(#glow)" opacity="0.45"/>
      <path d="M40 110 C40 110 12 60 12 36 C12 16 22 6 40 6 C58 6 68 16 68 36 C68 60 40 110 40 110 Z"
            fill="url(#body-grad)" stroke="#${hex}" stroke-width="2" />
      <circle cx="40" cy="36" r="19" fill="#0f172a" stroke="#${hex}" stroke-width="1.5" filter="url(#glow-inner)"/>
    </svg>`;
    
    return `data:image/svg+xml;base64,${btoa(svgStr)}`;
};
