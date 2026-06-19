import { useEffect, useRef, useState, useCallback } from 'react';
import maplibre, { NavigationControl, Popup } from 'maplibre-gl';
import { usePuestoStore } from '../store/puestoStore';
import 'maplibre-gl/dist/maplibre-gl.css';

// ─── Validador de coordenadas ─────────────────────────────────────────────────
const isValidCoord = (lat: any, lng: any): boolean => {
  const la = Number(lat);
  const lo = Number(lng);
  return (
    !isNaN(la) && !isNaN(lo) &&
    la !== 0 && lo !== 0 &&
    la >= -90 && la <= 90 &&
    lo >= -180 && lo <= 180
  );
};

// ─── Estado inicial de la vista (Medellín - Sede Coraza) ─────────────────────
const HQ_CENTER: [number, number] = [-75.596207, 6.255958];

const MapLibreGL = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<maplibre.Map | null>(null);
  const markersRef = useRef<{ [id: string]: maplibre.Marker }>({});
  const popupRef = useRef<maplibre.Popup | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [validCount, setValidCount] = useState(0);

  const puestos = usePuestoStore((state) => state.puestos);

  // ─── Inicializar mapa ────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current) return;

    const map = new maplibre.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: HQ_CENTER,
      zoom: 13,
      pitch: 45,
      bearing: -10,
      antialias: true,
    });

    map.addControl(new NavigationControl({
      visualizePitch: true,
      showZoom: true,
      showCompass: true,
    }), 'bottom-right');

    map.on('load', () => setMapLoaded(true));

    mapInstance.current = map;

    return () => {
      // Limpiar marcadores antes de destruir el mapa
      Object.values(markersRef.current).forEach(m => m.remove());
      markersRef.current = {};
      popupRef.current?.remove();
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  // ─── Actualizar marcadores cuando cambian los puestos ───────────────────
  useEffect(() => {
    if (!mapInstance.current || !mapLoaded) return;

    const currentMap = mapInstance.current;
    const validPuestos = puestos.filter(p => isValidCoord(p.lat, p.lng));
    setValidCount(validPuestos.length);

    // IDs actuales en el store que son válidos
    const validIds = new Set(validPuestos.map(p => p.id));

    // Eliminar marcadores de puestos que ya no existen o tienen coords inválidas
    Object.keys(markersRef.current).forEach(id => {
      if (!validIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    // Crear o actualizar marcadores
    validPuestos.forEach(puesto => {
      const lng = Number(puesto.lng);
      const lat = Number(puesto.lat);
      const isAlert = puesto.estado === 'alerta';
      const isSelected = puesto.id === selectedId;

      // Colores según estado
      const dotColor = isAlert ? '#ef4444' : isSelected ? '#ffffff' : '#4318FF';
      const ringColor = isAlert ? 'rgba(239,68,68,0.25)' : isSelected ? 'rgba(255,255,255,0.2)' : 'rgba(67,24,255,0.2)';
      const borderColor = isAlert ? '#ef4444' : isSelected ? '#ffffff' : '#6366f1';

      const htmlContent = `
        <div style="
          position:relative;
          display:flex;
          align-items:center;
          justify-content:center;
          cursor:pointer;
        ">
          <div style="
            position:absolute;
            width:28px; height:28px;
            border-radius:50%;
            background:${ringColor};
            ${isAlert ? 'animation: ping 1.2s cubic-bezier(0,0,0.2,1) infinite;' : ''}
          "></div>
          <div style="
            position:relative;
            width:14px; height:14px;
            border-radius:50%;
            background:${dotColor};
            border:2.5px solid ${borderColor};
            box-shadow: 0 0 12px ${dotColor}99;
            transition: all 0.2s;
          "></div>
        </div>
      `;

      if (!markersRef.current[puesto.id]) {
        // ── Crear nuevo marcador ─────────────────────────────────────────
        const el = document.createElement('div');
        el.innerHTML = htmlContent;
        el.className = 'coraza-marker';
        el.style.cssText = 'width:28px;height:28px;';

        // Popup informativo
        const popup = new Popup({
          offset: 25,
          closeButton: false,
          maxWidth: '220px',
          className: 'coraza-popup',
        }).setHTML(`
          <div style="
            background:#0f172a;
            border:1px solid rgba(255,255,255,0.1);
            border-radius:12px;
            padding:10px 12px;
            font-family:Inter,sans-serif;
          ">
            <p style="font-size:8px;font-weight:900;color:#4318FF;text-transform:uppercase;letter-spacing:0.15em;margin:0 0 3px 0;">${puesto.id}</p>
            <p style="font-size:11px;font-weight:700;color:#fff;margin:0 0 4px 0;">${puesto.nombre}</p>
            <div style="display:flex;align-items:center;gap:6px;">
              <div style="width:7px;height:7px;border-radius:50%;background:${isAlert ? '#ef4444' : '#10b981'};${isAlert ? 'box-shadow:0 0 6px #ef4444;' : ''}"></div>
              <span style="font-size:9px;font-weight:700;color:${isAlert ? '#ef4444' : '#10b981'};text-transform:uppercase;">${isAlert ? 'ALERTA' : puesto.estado}</span>
            </div>
            ${puesto.direccion ? `<p style="font-size:8px;color:#94a3b8;margin:4px 0 0 0;">${puesto.direccion.slice(0, 45)}</p>` : ''}
          </div>
        `);

        const marker = new maplibre.Marker({ element: el })
          .setLngLat([lng, lat])
          .setPopup(popup)
          .addTo(currentMap);

        el.addEventListener('click', () => {
          setSelectedId(prev => prev === puesto.id ? null : puesto.id);
          // Hacer zoom al puesto clickeado
          currentMap.flyTo({
            center: [lng, lat],
            zoom: 16,
            pitch: 55,
            duration: 800,
            essential: true,
          });
        });

        markersRef.current[puesto.id] = marker;
      } else {
        // ── Actualizar marcador existente ────────────────────────────────
        const marker = markersRef.current[puesto.id];
        marker.setLngLat([lng, lat]);
        const el = marker.getElement();
        el.innerHTML = htmlContent;
      }
    });

    // ── Añadir marcador HQ si no existe ─────────────────────────────────
    const HQ_ID = 'hq-coraza-cta';
    if (!markersRef.current[HQ_ID]) {
      const el = document.createElement('div');
      el.innerHTML = `
        <div style="position:relative;display:flex;align-items:center;justify-content:center;cursor:pointer;">
          <div style="position:absolute;width:36px;height:36px;border-radius:50%;background:rgba(138,43,226,0.2);"></div>
          <div style="position:relative;width:18px;height:18px;border-radius:50%;background:#8b2be2;border:2.5px solid #fff;box-shadow:0 0 16px #8b2be2;"></div>
        </div>
      `;
      el.style.cssText = 'width:36px;height:36px;z-index:10;';
      el.title = 'SEDE CENTRAL CORAZA CTA';

      const hqPopup = new Popup({
        offset: 25,
        closeButton: false,
        maxWidth: '200px',
      }).setHTML(`
        <div style="background:#0f172a;border:1px solid rgba(139,43,226,0.4);border-radius:12px;padding:10px 12px;font-family:Inter,sans-serif;">
          <p style="font-size:8px;font-weight:900;color:#8b2be2;text-transform:uppercase;letter-spacing:0.15em;margin:0 0 3px 0;">SEDE CENTRAL</p>
          <p style="font-size:11px;font-weight:700;color:#fff;margin:0 0 4px 0;">CORAZA CTA</p>
          <p style="font-size:8px;color:#94a3b8;margin:0;">Cra. 81 #49-24, Calasanz, Medellín</p>
        </div>
      `);

      new maplibre.Marker({ element: el })
        .setLngLat(HQ_CENTER)
        .setPopup(hqPopup)
        .addTo(currentMap);

      markersRef.current[HQ_ID] = new maplibre.Marker({ element: el });
    }

  }, [puestos, mapLoaded, selectedId]);

  // ─── Resetear vista ──────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    mapInstance.current?.flyTo({
      center: HQ_CENTER,
      zoom: 13,
      pitch: 45,
      bearing: -10,
      duration: 1000,
    });
    setSelectedId(null);
  }, []);

  return (
    <div className="relative w-full h-[400px] xl:h-full rounded-2xl overflow-hidden shadow-2xl">
      {/* Estilo para animación del ping en marcadores de alerta */}
      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
        .maplibregl-popup-content { background: transparent !important; padding: 0 !important; box-shadow: none !important; border: none !important; }
        .maplibregl-popup-tip { display: none !important; }
        .coraza-marker { will-change: transform; }
        .maplibregl-canvas { outline: none !important; }
      `}</style>

      <div ref={mapContainer} className="h-full w-full" />

      {/* Overlay decorativo */}
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_80px_rgba(0,0,0,0.5)] bg-gradient-to-b from-transparent via-transparent to-black/30" />

      {/* HUD superior */}
      <div className="absolute top-4 left-4 flex gap-2 pointer-events-none z-10">
        <div className="px-3 py-1.5 rounded-xl bg-primary/20 border border-primary/40 text-[9px] font-black text-primary uppercase tracking-widest backdrop-blur-md shadow-[0_0_15px_rgba(67,24,255,0.2)]">
          Tactical Feed
        </div>
        <div className="px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-[9px] font-black text-slate-300 uppercase tracking-widest backdrop-blur-md flex items-center gap-1.5 shadow-lg">
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_5px_#34d399]"></span>
          {validCount} Puestos
        </div>
      </div>

      {/* Botón reset vista */}
      <button
        onClick={handleReset}
        className="absolute bottom-16 right-4 z-10 size-9 rounded-xl bg-black/60 border border-white/10 backdrop-blur-md text-white hover:bg-primary/80 transition-all flex items-center justify-center shadow-lg"
        title="Restablecer vista"
      >
        <span className="material-symbols-outlined text-[18px]">my_location</span>
      </button>

      {/* Estado vacío: ningún puesto tiene coordenadas */}
      {validCount === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-20 pointer-events-none">
          <span className="material-symbols-outlined text-[48px] text-slate-600 mb-3">location_off</span>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Sin puestos geolocalizados</p>
          <p className="text-[10px] text-slate-600 mt-1">Agrega coordenadas a los puestos para verlos en el mapa</p>
        </div>
      )}
    </div>
  );
};

export default MapLibreGL;
