import { useEffect, useRef } from 'react';
import maplibre, { NavigationControl, Marker } from 'maplibre-gl';
import { usePuestoStore } from '../store/puestoStore';
import 'maplibre-gl/dist/maplibre-gl.css';

const MapLibreGL = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<maplibre.Map | null>(null);
  const markersRef = useRef<{ [id: string]: maplibre.Marker }>({});

  const puestos = usePuestoStore((state) => state.puestos);

  useEffect(() => {
    if (!mapContainer.current) return;

    const map = new maplibre.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [-75.5667, 6.2308], // Centrado en Medellín (Coraza CTA)
      zoom: 12.5,
      pitch: 45, // Ángulo táctico
      bearing: -17
    });

    map.addControl(new NavigationControl({
      visualizePitch: true,
      showZoom: true,
      showCompass: true
    }), 'bottom-right');

    mapInstance.current = map;

    return () => {
      map.remove();
    };
  }, []);

  // Update markers when puestos data changes
  useEffect(() => {
    if (!mapInstance.current) return;

    const currentMap = mapInstance.current;

    // Create or update markers
    puestos.forEach(puesto => {
      if (!markersRef.current[puesto.id]) {
        // Create custom HTML element for marker
        const el = document.createElement('div');
        el.className = 'marker-tactical';
        el.innerHTML = `
                <div class="relative flex items-center justify-center group">
                    <div class="absolute w-8 h-8 rounded-full ${puesto.estado === 'alerta' ? 'bg-danger/20 animate-ping' : 'bg-primary/20'}"></div>
                    <div class="relative w-4 h-4 rounded-full border-[2px] border-white shadow-[0_0_10px_rgba(0,0,0,0.5)] ${puesto.estado === 'alerta' ? 'bg-danger' : 'bg-primary'}"></div>
                    
                    <div class="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 backdrop-blur-md border border-white/10 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap shadow-xl pointer-events-none z-50">
                        <span class="text-primary tracking-widest block text-[8px] uppercase">${puesto.id}</span>
                        ${puesto.nombre}
                    </div>
                </div>
            `;

        const marker = new maplibre.Marker({ element: el })
          .setLngLat([puesto.lng, puesto.lat])
          .addTo(currentMap);

        markersRef.current[puesto.id] = marker;
      } else {
        // Update existing marker's position/color if needed
        const marker = markersRef.current[puesto.id];
        marker.setLngLat([puesto.lng, puesto.lat]);

        // Just replace the inner HTML to update color state
        marker.getElement().innerHTML = `
                <div class="relative flex items-center justify-center group">
                    <div class="absolute w-8 h-8 rounded-full ${puesto.estado === 'alerta' ? 'bg-danger/20 animate-ping' : 'bg-primary/20'}"></div>
                    <div class="relative w-4 h-4 rounded-full border-[2px] border-white shadow-[0_0_10px_rgba(0,0,0,0.5)] ${puesto.estado === 'alerta' ? 'bg-danger' : 'bg-primary'}"></div>
                    
                    <div class="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 backdrop-blur-md border border-white/10 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap shadow-xl pointer-events-none z-50">
                        <span class="text-primary tracking-widest block text-[8px] uppercase">${puesto.id}</span>
                        ${puesto.nombre}
                    </div>
                </div>
            `;
      }
    });

    // Remove markers that are no longer in state
    Object.keys(markersRef.current).forEach(id => {
      if (!puestos.find(p => p.id === id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

  }, [puestos]);

  return (
    <div className="relative w-full h-[400px] xl:h-full rounded-2xl overflow-hidden shadow-2xl">
      <div ref={mapContainer} className="h-full w-full" />
      {/* Capa táctica decorativa */}
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_80px_rgba(0,0,0,0.5)] bg-gradient-to-b from-transparent via-transparent to-black/30" />

      {/* Bordes de escaneo */}
      <div className="absolute top-4 left-4 flex gap-2 pointer-events-none">
        <div className="px-3 py-1.5 rounded-xl bg-primary/20 border border-primary/40 text-[9px] font-black text-primary uppercase tracking-widest backdrop-blur-md shadow-[0_0_15px_rgba(67,24,255,0.2)]">Tactical Feed</div>
        <div className="px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-[9px] font-black text-slate-300 uppercase tracking-widest backdrop-blur-md flex items-center gap-1.5 shadow-lg">
          <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse shadow-[0_0_5px_#05cd99]"></span>
          Active
        </div>
      </div>
    </div>
  );
};

export default MapLibreGL;
