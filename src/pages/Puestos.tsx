import { useState, useMemo, useCallback, useEffect } from 'react';
import DeckGL from '@deck.gl/react';
import { Map } from 'react-map-gl/maplibre';
import { ColumnLayer, ScatterplotLayer, TextLayer, ArcLayer, IconLayer } from '@deck.gl/layers';
import { usePuestoStore } from '../store/puestoStore';
import type { Puesto } from '../store/puestoStore';
import { useVigilanteStore } from '../store/vigilanteStore';
import 'maplibre-gl/dist/maplibre-gl.css';
import toast from 'react-hot-toast';
import { showTacticalToast } from '../utils/tacticalToast';

// Helper: convert HSL to RGB to produce unique hues per puesto ID
const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
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

const hashId = (id: string): number => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = (hash * 31 + id.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
};

import PuestoModal from '../components/puestos/PuestoModal';
import PuestoDetailModal from '../components/puestos/PuestoDetailModal';
import GuardModal from '../components/guards/GuardModal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useTacticalOps } from '../hooks/useTacticalOps';
import { MilitaryTimeInput } from '../components/ui/MilitaryTimeInput';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

// ─── Especificaciones de modelos por tipo ────────────────────────────────────
const BUILDING_SPECS: Record<string, { height: number; radius: number; color: [number, number, number]; icon: string }> = {
    hospital: { height: 90, radius: 38, color: [19, 127, 236], icon: 'local_hospital' },
    banco: { height: 180, radius: 22, color: [0, 200, 100], icon: 'account_balance' },
    retail: { height: 60, radius: 55, color: [255, 160, 10], icon: 'shopping_bag' },
    comando: { height: 150, radius: 32, color: [138, 43, 226], icon: 'local_police' },
    torre: { height: 210, radius: 18, color: [0, 220, 240], icon: 'cell_tower' },
    edificio: { height: 120, radius: 32, color: [200, 200, 220], icon: 'domain' },
    logistica: { height: 60, radius: 48, color: [255, 120, 50], icon: 'local_shipping' },
    puerto: { height: 40, radius: 60, color: [30, 180, 255], icon: 'sailing' },
};

const getSpec = (tipo: string) => BUILDING_SPECS[tipo] ?? BUILDING_SPECS.edificio;

// ─── Genera el SVG de bandera con logo CORAZA ─────────────────────────────────
const makeFlagIcon = (color: [number, number, number], isAlerta: boolean) => {
    const r = isAlerta ? 255 : color[0];
    const g = isAlerta ? 71 : color[1];
    const b = isAlerta ? 87 : color[2];
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

      <!-- Sombra inferior en perspectiva -->
      <ellipse cx="40" cy="115" rx="14" ry="4" fill="rgba(0,0,0,0.6)" filter="blur(3px)"/>

      <!-- Resplandor Exterior Suave -->
      <path d="M40 110 C40 110 12 60 12 36 C12 16 22 6 40 6 C58 6 68 16 68 36 C68 60 40 110 40 110 Z"
            fill="none" stroke="#${hex}" stroke-width="5" filter="url(#glow)" opacity="0.45"/>

      <!-- Cuerpo del Marcador Principal -->
      <path d="M40 110 C40 110 12 60 12 36 C12 16 22 6 40 6 C58 6 68 16 68 36 C68 60 40 110 40 110 Z"
            fill="url(#body-grad)" stroke="#${hex}" stroke-width="2" />

      <!-- Circulo Central Oscuro Premium -->
      <circle cx="40" cy="36" r="19" fill="#0f172a" stroke="#${hex}" stroke-width="1.5" filter="url(#glow-inner)"/>
      
      ${isAlerta ? `<circle cx="40" cy="36" r="13" fill="#${hex}" opacity="0.3">
          <animate attributeName="r" values="13;22;13" dur="1.2s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.6;0;0.6" dur="1.2s" repeatCount="indefinite"/>
      </circle>` : ''}

      <!-- Logo de Escudo Coraza -->
      <path d="M40 22 L28 26 L28 37 C28 45 34 51 40 54 C46 51 52 45 52 37 L52 26 Z" fill="#${hex}" opacity="0.95"/>
      <path d="M40 24.5 L31 28 L31 37 C31 43.5 35 48 40 51 C45 48 49 43.5 49 37 L49 28 Z" fill="#0f172a"/>
      <path d="M40 27 L34.5 29.5 L34.5 36.5 C34.5 40 37 44.5 40 47 C43 44.5 45.5 40 45.5 36.5 L45.5 29.5 Z" fill="#${hex}"/>
      
      <!-- Detalle Central Iluminado -->
      <circle cx="40" cy="37" r="2.5" fill="#ffffff" filter="url(#glow-inner)"/>
    </svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`;
};

const INITIAL_VIEW_STATE = {
    longitude: -75.5812,
    latitude: 6.2300,
    zoom: 12.5,
    pitch: 55,
    bearing: -10,
    maxZoom: 20,
    minZoom: 8,
};

type TabKey = 'todos' | 'cubierto' | 'alerta';

const Puestos = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isGuardModalOpen, setIsGuardModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<TabKey>('todos');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [viewState, setViewState] = useState<any>(INITIAL_VIEW_STATE);
    const [clickHint, setClickHint] = useState(true);
    const [draftLat, setDraftLat] = useState(6.2442);
    const [draftLng, setDraftLng] = useState(-75.5812);
    const [confirmDelete, setConfirmDelete] = useState<Puesto | null>(null);
    const [detailPuesto, setDetailPuesto] = useState<Puesto | null>(null);

    const puestos = usePuestoStore(s => s.puestos) || [];
    const deletePuesto = usePuestoStore(s => s.deletePuesto);
    const updatePuestoStatus = usePuestoStore(s => s.updatePuestoStatus);
    const getCobertura24Horas = usePuestoStore(s => s.getCobertura24Horas);
    const verificarCoberturaTotal = usePuestoStore(s => s.verificarCoberturaTotal);
    
    // Centralized tactical operations
    const { assignGuardToPuesto, removeGuardFromPuesto, togglePuestoAlert } = useTacticalOps();

    useEffect(() => { const t = setTimeout(() => setClickHint(false), 5000); return () => clearTimeout(t); }, []);

    // Batched update of coverage statuses to avoid redundant store updates
    useEffect(() => {
        if (!puestos || puestos.length === 0) return;
        
        const { puestosDesprotegidos } = verificarCoberturaTotal();
        const updates: { id: string, status: Puesto['estado'], notification?: string }[] = [];

        puestosDesprotegidos.forEach(puesto => {
            if (puesto.estado !== 'desprotegido') {
                updates.push({ 
                    id: puesto.id, 
                    status: 'desprotegido', 
                    notification: `⚠️ COBERTURA INCOMPLETA: Puesto ${puesto.nombre}` 
                });
            }
        });

        puestos.forEach(puesto => {
            const cobertura = getCobertura24Horas(puesto.id);
            if (cobertura.completa && (puesto.turnos?.length || 0) > 0 && puesto.estado !== 'cubierto') {
                updates.push({ id: puesto.id, status: 'cubierto' });
            }
        });

        // Apply all updates
        updates.forEach(upd => {
            updatePuestoStatus(upd.id, upd.status);
            if (upd.notification) {
                showTacticalToast({
                    title: 'Brecha Detectada',
                    message: upd.notification,
                    type: 'warning'
                });
            }
        });
    }, [puestos.length, getCobertura24Horas, updatePuestoStatus, verificarCoberturaTotal]);

    const vigilantes = useVigilanteStore(s => s.vigilantes) || [];
    const updateGuardStatus = useVigilanteStore(s => s.updateGuardStatus);
    const disponibles = vigilantes.filter(v => v.estado === 'disponible');
    const selectedPuesto = useMemo(() => puestos.find(p => p.id === selectedId), [puestos, selectedId]);

    const [draftGuardHour, setDraftGuardHour] = useState<{ id: string, start: string, end: string } | null>(null);
    const [activeLogGuardId, setActiveLogGuardId] = useState<string | null>(null);
    const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
    const [notifications, setNotifications] = useState<{ id: string, msg: string, type: 'error' | 'warning' }[]>([]);
    const [sidebarTab, setSidebarTab] = useState<'personal' | 'detalles'>('personal');
    const addActivity = useVigilanteStore(s => s.addActivity);

    const addNotification = useCallback((msg: string, type: 'error' | 'warning') => {
        showTacticalToast({
            title: type === 'error' ? 'Falla Critica' : 'Alerta Tecnica',
            message: msg,
            type: type === 'error' ? 'error' : 'warning'
        });
    }, []);

    const total = puestos.length;
    const cubiertos = puestos.filter(p => p.estado === 'cubierto').length;
    const alertas = puestos.filter(p => p.estado === 'alerta').length;

    const filtered = useMemo(() => {
        let list = puestos;
        if (activeTab !== 'todos') list = list.filter(p => p.estado === activeTab);
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(p =>
                p.nombre.toLowerCase().includes(q) ||
                p.id.toLowerCase().includes(q) ||
                p.tipo.toLowerCase().includes(q)
            );
        }
        return list;
    }, [puestos, activeTab, searchQuery]);

    const handleFocus = useCallback((p: Puesto) => {
        setSelectedId(p.id);
        setViewState({
            longitude: p.lng,
            latitude: p.lat,
            zoom: 17,
            pitch: 65,
            bearing: -10,
            maxZoom: 20,
            minZoom: 8,
            transitionDuration: 1000,
        });
    }, []);

    const handleZoom = useCallback((delta: number) => {
        setViewState((prev: any) => ({ ...prev, zoom: Math.max(8, Math.min(20, prev.zoom + delta)), transitionDuration: 200 }));
    }, []);
    const handlePitch = useCallback((delta: number) => {
        setViewState((prev: any) => ({ ...prev, pitch: Math.max(0, Math.min(85, (prev.pitch ?? 0) + delta)), transitionDuration: 200 }));
    }, []);

    const handleMapClick = useCallback((info: any) => {
        if (info.coordinate) {
            setDraftLat(info.coordinate[1]);
            setDraftLng(info.coordinate[0]);
            setIsModalOpen(true);
            setClickHint(false);
        }
    }, []);

    const handleDelete = useCallback((p: Puesto) => setConfirmDelete(p), []);
    const confirmDeleteFn = useCallback(() => {
        if (confirmDelete) { deletePuesto(confirmDelete.id); setConfirmDelete(null); }
    }, [confirmDelete, deletePuesto]);

    const layers = useMemo(() => {
        // Sede Central Coraza CTA
        const hq: Puesto = {
            id: 'hq-coraza',
            nombre: 'SEDE CENTRAL CORAZA CTA',
            lat: 6.255958,
            lng: -75.596207,
            tipo: 'comando',
            estado: 'cubierto',
            direccion: 'Cra. 81 #49 - 24, Calasanz, Medellin, La America, Antioquia',
            contacto: 'Control Central',
            telefono: '311 3836939',
            elevacion: 120,
            turnos: [],
            historial: [],
            fechaRegistro: new Date().toISOString()
        };

        const currentPuestos = puestos;
        // Agregamos la HQ a la lista de puntos a renderizar
        const renderPoints = [...currentPuestos.filter(p => p.id !== hq.id), hq];

        const arcLayer = new ArcLayer({
            id: 'flow-arcs',
            data: currentPuestos.filter(p => p.id !== hq.id), // Desde cada puesto a la sede central
            getSourcePosition: (d: Puesto) => [d.lng, d.lat, 0],
            getTargetPosition: () => [hq.lng, hq.lat, 60],
            getSourceColor: (d: Puesto) => {
                const index = currentPuestos.findIndex(p => p.id === d.id);
                const h = (index * 137.5) % 360; // Usar el angulo dorado para maxima distincion de color
                const [r, g, b] = hslToRgb(h, 100, 55); 
                return [r, g, b, 255];
            },
            getTargetColor: (d: Puesto) => {
                const index = currentPuestos.findIndex(p => p.id === d.id);
                const h = (index * 137.5) % 360;
                const [r, g, b] = hslToRgb(h, 100, 65); 
                return [r, g, b, 255]; // Toda la linea usa el mismo color distinto por puesto
            },
            getWidth: () => 3,
            getHeight: 0.4,
            pickable: false,
        });

        const buildingsLayer = new ColumnLayer({
            id: 'buildings-3d',
            data: renderPoints,
            diskResolution: 6,
            radius: 1,
            extruded: true,
            pickable: true,
            elevationScale: 1,
            getPosition: (d: Puesto) => [d.lng, d.lat, 0],
            getRadius: (d: Puesto) => getSpec(d.tipo).radius,
            getFillColor: (d: Puesto) => {
                const c = getSpec(d.tipo).color;
                const isSelected = d.id === selectedId;
                const isHQ = d.id === hq.id;
                const base = isHQ ? [138, 43, 226] : d.estado === 'alerta' ? [255, 71, 87] : c;
                return [...base, isSelected ? 200 : 120] as any;
            },
            getLineColor: (d: Puesto) => d.estado === 'alerta'
                ? [255, 71, 87, 255]
                : d.id === selectedId ? [255, 255, 255, 255] : [255, 255, 255, 120],
            lineWidthMinPixels: 2,
            getElevation: (d: Puesto) => getSpec(d.tipo).height,
            transitions: { getElevation: 700, getFillColor: 500, getRadius: 500 },
            updateTriggers: { getFillColor: [selectedId], getLineColor: [selectedId] },
        });

        const pulseLayer = new ScatterplotLayer({
            id: 'pulse-rings',
            data: renderPoints,
            pickable: false,
            opacity: 0.55,
            stroked: true,
            filled: false,
            radiusMinPixels: 18,
            radiusMaxPixels: 200,
            lineWidthMinPixels: 1.8,
            getPosition: (d: Puesto) => [d.lng, d.lat, 0],
            getRadius: (d: Puesto) => d.id === hq.id ? 150 : d.estado === 'alerta' ? 130 : 70,
            getLineColor: (d: Puesto) => d.id === hq.id ? [138, 43, 226, 200] : d.estado === 'alerta' ? [255, 71, 87, 220] : [...getSpec(d.tipo).color, 140] as any,
            transitions: { getRadius: { type: 'spring', stiffness: 0.05, damping: 0.3 } },
        });

        const selectionRing = new ScatterplotLayer({
            id: 'selection-ring',
            data: renderPoints.filter(p => p.id === selectedId),
            pickable: false,
            opacity: 1,
            stroked: true,
            filled: false,
            radiusMinPixels: 40,
            radiusMaxPixels: 300,
            lineWidthMinPixels: 3,
            getPosition: (d: Puesto) => [d.lng, d.lat, 0],
            getRadius: () => 180,
            getLineColor: () => [255, 255, 255, 220],
            updateTriggers: { data: selectedId },
        });

        const labelsLayer = new TextLayer({
            id: 'labels',
            data: renderPoints,
            pickable: false,
            getPosition: (d: Puesto) => [d.lng, d.lat, getSpec(d.tipo).height + 50],
            getText: (d: Puesto) => d.nombre.toUpperCase(),
            getSize: (d: Puesto) => d.id === hq.id ? 15 : 13,
            getColor: [255, 255, 255, 220],
            getTextAnchor: 'middle',
            getAlignmentBaseline: 'bottom',
            fontFamily: 'Rajdhani, Inter, sans-serif',
            fontWeight: 700,
            background: true,
            backgroundPadding: [8, 4, 8, 4],
            getBackgroundColor: (d: Puesto) => d.id === hq.id
                ? [138, 43, 226, 240]
                : d.estado === 'alerta'
                ? [200, 30, 30, 230]
                : d.id === selectedId ? [19, 100, 200, 240] : [8, 14, 30, 220],
            fontSettings: { sdf: true, radius: 4 },
            updateTriggers: { getBackgroundColor: [selectedId], getSize: [selectedId] },
        });

        const flagLayer = new IconLayer({
            id: 'coraza-flags',
            data: renderPoints,
            pickable: true,
            getIcon: (d: Puesto) => ({
                url: makeFlagIcon(d.id === hq.id ? [138, 43, 226] : getSpec(d.tipo).color, d.estado === 'alerta'),
                width: 80,
                height: 120,
                anchorY: 120,
            }),
            getSize: (d: Puesto) => d.id === hq.id ? 90 : d.id === selectedId ? 75 : d.estado === 'alerta' ? 65 : 55,
            getPosition: (d: Puesto) => [d.lng, d.lat, getSpec(d.tipo).height + 25],
            sizeScale: 1,
            transitions: { getSize: { type: 'spring', stiffness: 0.1, damping: 0.4 } },
            updateTriggers: { getSize: [selectedId], getIcon: renderPoints.map(p => p.estado).join() },
        });

        return [arcLayer, pulseLayer, selectionRing, buildingsLayer, labelsLayer, flagLayer].filter(Boolean);
    }, [puestos, selectedId]);

    const tabCls = (key: TabKey) =>
        `flex items-center px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ` +
        (activeTab === key
            ? 'bg-primary text-white shadow-[0_0_15px_rgba(19,127,236,0.4)]'
            : 'text-slate-500 hover:text-slate-300 hover:bg-white/5');

    return (
        <div className="h-full flex flex-col overflow-hidden animate-in fade-in duration-500 relative">
            <style dangerouslySetInnerHTML={{ __html: `.maplibregl-canvas { outline: none !important; }` }} />

            {/* Header */}
            <div className="px-4 py-4 md:px-10 md:py-8 border-b border-slate-200/40 bg-white/70 backdrop-blur-xl z-20 sticky top-0 shrink-0">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
                    <div className="flex items-center gap-4 md:gap-8">
                        <div className="hidden sm:flex size-12 md:size-16 rounded-[24px] bg-white items-center justify-center border-2 border-slate-100 shadow-xl shadow-slate-200/50 p-2 transform -rotate-3 hover:rotate-0 transition-transform">
                            <img src="/logo.png" alt="CORAZA" className="w-full h-full object-contain" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
                                <span className="text-[9px] md:text-[11px] font-black text-slate-400 uppercase tracking-[0.4em]">Mision Critica</span>
                                <span className="h-1 w-1 rounded-full bg-primary/30"></span>
                                <span className="text-[9px] md:text-[11px] font-black text-primary uppercase tracking-[0.4em] hidden sm:inline">Red Operativa Coraza</span>
                            </div>
                            <h1 className="text-[20px] md:text-[32px] font-black text-slate-900 uppercase tracking-tighter leading-none">
                                Centro de <span className="text-primary">Control</span>
                            </h1>
                        </div>
                    </div>

                    <div className="hidden md:flex items-center gap-6 px-6 py-2 bg-slate-50 rounded-[22px] border border-slate-100 shadow-inner">
                        <StatBadge label="Total" value={total} color="text-slate-900" />
                        <div className="w-px h-8 bg-slate-200"></div>
                        <StatBadge label="Cubiertos" value={cubiertos} color="text-success" />
                        <div className="w-px h-8 bg-slate-200"></div>
                        <StatBadge label="Alertas" value={alertas} color="text-danger" pulse={alertas > 0} />
                    </div>

                    <button
                        onClick={() => { setDraftLat(INITIAL_VIEW_STATE.latitude); setDraftLng(INITIAL_VIEW_STATE.longitude); setIsModalOpen(true); }}
                        className="flex items-center gap-2 bg-primary text-white text-[11px] font-bold px-6 py-3 rounded-2xl hover:bg-primary/90 transition-all uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95 shrink-0"
                    >
                        <span className="material-symbols-outlined text-[18px] notranslate" translate="no">add_location_alt</span>
                        Nuevo Puesto
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col xl:flex-row overflow-hidden relative">
                {/* Panel Lateral */}
                <aside className="w-full xl:w-[380px] h-[40vh] xl:h-auto shrink-0 border-b xl:border-b-0 xl:border-r border-slate-200/60 bg-white flex flex-col z-10 relative shadow-[10px_0_40px_rgba(0,0,0,0.02)] xl:static">
                    <div className="p-6 border-b border-slate-100 space-y-5">
                        <div className="relative group">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-lg group-focus-within:text-primary transition-colors notranslate pointer-events-none" translate="no">search</span>
                            <input
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200/60 rounded-2xl py-3.5 pl-12 pr-6 text-sm font-bold focus:outline-none focus:border-primary/30 focus:ring-8 focus:ring-primary/5 placeholder:text-slate-300 text-slate-900 transition-all shadow-inner"
                                placeholder="Buscar puesto..."
                            />
                        </div>
                        <div className="flex gap-1.5 p-1.5 bg-slate-100/50 rounded-[20px] border border-slate-200/30">
                            <button onClick={() => setActiveTab('todos')} className={tabCls('todos')}>
                                Todos
                                <span className="ml-1 text-[9px] bg-white/20 px-1.5 py-0.5 rounded-full">{total}</span>
                            </button>
                            <button onClick={() => setActiveTab('cubierto')} className={tabCls('cubierto')}>
                                Cubiertos
                                <span className="ml-1 text-[9px] bg-white/20 px-1.5 py-0.5 rounded-full">{cubiertos}</span>
                            </button>
                            <button onClick={() => setActiveTab('alerta')} className={tabCls('alerta')}>
                                Alertas
                                <span className="ml-1 text-[9px] bg-white/20 px-1.5 py-0.5 rounded-full">{alertas}</span>
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar py-3 px-3 space-y-2">
                        {filtered.length === 0 && (
                            <div className="text-center py-14 opacity-40 flex flex-col items-center gap-3">
                                <span className="material-symbols-outlined text-5xl notranslate" translate="no">location_off</span>
                                <p className="text-[11px] font-bold uppercase tracking-widest">Sin puestos registrados</p>
                            </div>
                        )}

                        {filtered.map((p, idx) => {
                            const spec = getSpec(p.tipo);
                            const rgb = `${spec.color[0]},${spec.color[1]},${spec.color[2]}`;
                            const isAlert = p.estado === 'alerta';
                            const isSel = p.id === selectedId;

                            return (
                                <div
                                    key={p.id}
                                    onClick={() => handleFocus(p)}
                                    className={`relative border-l-[4px] border border-slate-100 rounded-3xl p-5 cursor-pointer transition-all duration-300 group animate-in slide-in-from-left-4 fade-in ${isSel ? 'bg-primary/[0.02] border-primary/20 shadow-xl shadow-primary/5' : 'bg-white hover:bg-slate-50/50 hover:border-slate-300 shadow-sm'} ${isAlert ? 'bg-danger/[0.02] border-danger/30' : ''}`}
                                    style={{
                                        borderLeftColor: isAlert ? '#ff4757' : `rgb(${rgb})`,
                                        animationDelay: `${idx * 40}ms`,
                                    }}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div
                                            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border"
                                            style={{
                                                background: `rgba(${rgb}, 0.12)`,
                                                borderColor: `rgba(${rgb}, 0.3)`,
                                            }}
                                        >
                                            <span className="material-symbols-outlined text-[20px] notranslate" style={{ color: isAlert ? '#ff4757' : `rgb(${rgb})` }} translate="no">{spec.icon}</span>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="font-mono text-[10px] font-bold text-primary tracking-widest">{p.id}</span>
                                                {isSel && <span className="text-[9px] font-bold text-white bg-primary px-1.5 py-0.5 rounded-lg uppercase tracking-wider">Foco</span>}
                                            </div>
                                            <h4 className="text-[14px] font-bold text-slate-900 truncate leading-tight">{p.nombre}</h4>
                                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-1">{p.tipo} - {p.elevacion}m</p>
                                        </div>

                                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                                            <span className={`size-2.5 rounded-full flex-shrink-0 ${isAlert ? 'bg-danger shadow-[0_0_8px_#ff4757] animate-pulse' : 'bg-green-400 opacity-80'}`} />
                                            <span className={`text-[8px] font-bold uppercase tracking-wider ${isAlert ? 'text-danger' : 'text-green-400'}`}>
                                                {isAlert ? 'ALERTA' : 'OK'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex gap-1.5 mt-3 pt-2.5 border-t border-white/5">
                                        <button
                                            onClick={e => { e.stopPropagation(); handleFocus(p); }}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                                        >
                                            <span className="material-symbols-outlined text-[13px] notranslate" translate="no">center_focus_strong</span>
                                            Ver en Mapa
                                        </button>
                                        <div className="w-px bg-white/5" />
                                        <button
                                            onClick={e => { e.stopPropagation(); togglePuestoAlert(p.id, p.estado); }}
                                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-lg transition-all ${isAlert ? 'text-green-400 hover:bg-green-400/10' : 'text-yellow-400 hover:bg-yellow-400/10'}`}
                                        >
                                            <span className="material-symbols-outlined text-[13px] notranslate" translate="no">{isAlert ? 'check_circle' : 'warning'}</span>
                                            {isAlert ? 'Asegurar' : 'Alertar'}
                                        </button>
                                        <div className="w-px bg-white/5" />
                                        <button
                                            onClick={e => { e.stopPropagation(); handleDelete(p); }}
                                            className="px-3 flex items-center justify-center py-1.5 text-slate-600 hover:text-danger hover:bg-danger/10 rounded-lg transition-all"
                                            title="Eliminar puesto"
                                        >
                                            <span className="material-symbols-outlined text-[14px] notranslate" translate="no">delete</span>
                                        </button>
                                        <div className="w-px bg-white/5" />
                                        <button
                                            onClick={e => { e.stopPropagation(); setDetailPuesto(p); }}
                                            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[9px] font-bold uppercase tracking-wider text-primary hover:bg-primary/10 rounded-lg transition-all"
                                            title="Ver historial y detalles"
                                        >
                                            <span className="material-symbols-outlined text-[13px] notranslate" translate="no">history</span>
                                            Detalles
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </aside>

                {/* Mapa */}
                <main className="flex-1 relative bg-[#02060b] overflow-hidden outline-none z-0">
                    <DeckGL
                        viewState={viewState}
                        onViewStateChange={({ viewState: vs }: any) => {
                            const { transitionDuration: _td, transitionInterpolator: _ti, ...cleanState } = vs as any;
                            setViewState({ ...cleanState, maxZoom: 20, minZoom: 8 });
                        }}
                        controller={true}
                        layers={layers}
                        onClick={handleMapClick}
                        getCursor={({ isDragging }) => isDragging ? 'grabbing' : 'crosshair'}
                    >
                        <Map mapStyle={MAP_STYLE} reuseMaps />
                    </DeckGL>

                    {/* Controles Flotantes */}
                    <div className="absolute top-6 right-6 z-10 pointer-events-none">
                        <div className="bg-white/80 backdrop-blur-xl border border-white/40 rounded-[24px] overflow-hidden shadow-xl min-w-[200px]">
                            <div className="flex items-center justify-center py-5 px-4 bg-slate-50/50">
                                <img src="/logo.png" alt="CORAZA CTA" className="h-16 w-16 object-contain" />
                            </div>
                            <div className="px-5 py-4 space-y-3">
                                <p className="text-[11px] font-bold text-primary uppercase tracking-[0.2em] text-center mb-1">Enlace Operativo</p>
                                <InfoRow label="Nodos" value={`${total} unidades`} />
                                <InfoRow label="Reportes OK" value={cubiertos.toString()} valueClass="text-success" />
                                <InfoRow label="Alertas" value={alertas.toString()} valueClass={alertas > 0 ? 'text-danger animate-pulse' : 'text-slate-400'} />
                                <InfoRow label="Status" value="LIVE" valueClass="text-primary font-bold" />
                            </div>
                        </div>
                    </div>

                    <div className="absolute bottom-6 left-4 z-10 flex flex-col gap-1.5">
                        <MapControlBtn icon="add" title="Acercar" onClick={() => handleZoom(1)} />
                        <MapControlBtn icon="remove" title="Alejar" onClick={() => handleZoom(-1)} />
                        <MapControlBtn icon="3d_rotation" title="Vista 3D" onClick={() => handlePitch(viewState.pitch > 10 ? -60 : 60)} active={viewState.pitch > 10} />
                        <MapControlBtn icon="explore" title="Reset Brujula" onClick={() => setViewState((p: any) => ({ ...p, bearing: 0, transitionDuration: 300 }))} />
                        <MapControlBtn icon="my_location" title="Reset Vista" onClick={() => setViewState({ ...INITIAL_VIEW_STATE, transitionDuration: 800 })} accent />
                    </div>

                    {clickHint && (
                        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10 pointer-events-none animate-in fade-in slide-in-from-bottom-4">
                            <div className="bg-white/80 border border-primary/20 text-primary text-[10px] font-bold px-6 py-3 rounded-full backdrop-blur-xl shadow-xl flex items-center gap-3 animate-pulse">
                                <span className="material-symbols-outlined text-[16px]">touch_app</span>
                                Clic en el mapa para posicionar puesto
                            </div>
                        </div>
                    )}
                </main>

                {/* Barra Derecha */}
                <aside className="w-full xl:w-[320px] h-[40vh] xl:h-auto shrink-0 border-t xl:border-t-0 xl:border-l border-slate-100 bg-white flex flex-col z-10 shadow-[-10px_0_40px_rgba(0,0,0,0.03)] relative overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900">Vigilantes</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Control de Fuerza</p>
                        </div>
                        <div className="bg-success/10 px-3 py-1 rounded-xl flex items-center gap-2">
                            <span className="size-1.5 bg-success rounded-full animate-pulse"></span>
                            <span className="text-[10px] text-success font-bold">{disponibles.length} Libres</span>
                        </div>
                    </div>

                    {selectedPuesto && (
                        <div className="flex border-b border-slate-100 bg-slate-50/50 p-1">
                            <button onClick={() => setSidebarTab('personal')} className={`flex-1 py-2.5 text-[10px] font-bold uppercase rounded-lg ${sidebarTab === 'personal' ? 'bg-white text-primary shadow-sm' : 'text-slate-400'}`}>Personal</button>
                            <button onClick={() => setSidebarTab('detalles')} className={`flex-1 py-2.5 text-[10px] font-bold uppercase rounded-lg ${sidebarTab === 'detalles' ? 'bg-white text-primary shadow-sm' : 'text-slate-400'}`}>Detalles</button>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-5">
                        {selectedPuesto ? (
                            <div className="space-y-4">
                                {sidebarTab === 'personal' ? (
                                    <div className="space-y-4">
                                        <div className="bg-white border rounded-2xl p-4 shadow-sm">
                                            <div className="flex justify-between mb-3 text-xs font-bold uppercase text-slate-900">
                                                <span>Despliegue ({selectedPuesto.turnos?.length || 0})</span>
                                                {(() => {
                                                    const cob = getCobertura24Horas(selectedPuesto.id);
                                                    return cob.completa ? (
                                                        <span className="text-success flex items-center gap-1"><span className="material-symbols-outlined text-sm">verified</span> 24H</span>
                                                    ) : (
                                                        <span className="text-danger">{cob.huecos.length}h faltan</span>
                                                    );
                                                })()}
                                            </div>
                                            <div className="space-y-3">
                                                {selectedPuesto.turnos?.map(t => {
                                                    const v = vigilantes.find(gv => gv.id === t.vigilanteId);
                                                    if (!v) return null;
                                                    const isLogging = activeLogGuardId === v.id;

                                                    return (
                                                        <div key={t.vigilanteId} className={`border rounded-xl p-3 ${isLogging ? 'border-primary bg-primary/5' : 'border-slate-100 bg-slate-50'}`}>
                                                            <div className="flex justify-between items-start">
                                                                <div className="flex gap-3">
                                                                    <div className="size-8 rounded-full overflow-hidden shrink-0 border border-slate-200">
                                                                        <img src={v.foto || `https://ui-avatars.com/api/?name=${v.nombre}`} className="w-full h-full object-cover" />
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs font-bold text-slate-900 truncate">{v.nombre}</p>
                                                                        <p className="text-[10px] text-primary font-mono">{t.horaInicio} - {t.horaFin}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex gap-1">
                                                                    <button onClick={() => setActiveLogGuardId(isLogging ? null : v.id)} className="size-6 rounded bg-white border border-slate-200 text-slate-400 flex items-center justify-center hover:text-primary"><span className="material-symbols-outlined text-[14px]">edit_note</span></button>
                                                                    <button onClick={() => setEditingScheduleId(editingScheduleId === v.id ? null : v.id)} className="size-6 rounded bg-white border border-slate-200 text-slate-400 flex items-center justify-center hover:text-yellow-500"><span className="material-symbols-outlined text-[14px]">schedule</span></button>
                                                                    <button onClick={() => {
                                                                        removeGuardFromPuesto(selectedPuesto.id, v.id);
                                                                    }} className="size-6 rounded bg-danger/10 text-danger flex items-center justify-center hover:bg-danger hover:text-white"><span className="material-symbols-outlined text-[14px]">logout</span></button>
                                                                </div>
                                                            </div>

                                                            {editingScheduleId === v.id && (
                                                                <div className="mt-3 space-y-2 border-t pt-3">
                                                                    <div className="flex gap-2">
                                                                        <MilitaryTimeInput value={t.horaInicio} onChange={val => {
                                                                            const field = document.getElementById(`start-${v.id}`) as HTMLInputElement;
                                                                            if(field) field.value = val;
                                                                        }} className="!h-7 text-[10px]" />
                                                                        <MilitaryTimeInput value={t.horaFin} onChange={val => {
                                                                            const field = document.getElementById(`end-${v.id}`) as HTMLInputElement;
                                                                            if(field) field.value = val;
                                                                        }} className="!h-7 text-[10px]" />
                                                                        <input type="hidden" id={`start-${v.id}`} defaultValue={t.horaInicio} />
                                                                        <input type="hidden" id={`end-${v.id}`} defaultValue={t.horaFin} />
                                                                    </div>
                                                                    <button onClick={() => {
                                                                        const s = (document.getElementById(`start-${v.id}`) as HTMLInputElement).value;
                                                                        const e = (document.getElementById(`end-${v.id}`) as HTMLInputElement).value;
                                                                        assignGuardToPuesto(selectedPuesto.id, v.id, s, e);
                                                                        setEditingScheduleId(null);
                                                                    }} className="w-full py-1 bg-primary text-white text-[9px] font-bold rounded">Actualizar</button>
                                                                </div>
                                                            )}

                                                            {isLogging && (
                                                                <div className="mt-3 grid grid-cols-2 gap-1 border-t pt-3">
                                                                    <QuickLogBtn icon="directions_run" label="Patrulla" onClick={() => addActivity(v.id, "PATRULLA", "Ronda perimetral")} />
                                                                    <QuickLogBtn icon="report" label="Alerta" color="text-danger" onClick={() => { addActivity(v.id, "ALERTA", "Incidente reportado"); updatePuestoStatus(selectedPuesto.id, 'alerta'); }} />
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-slate-50 border rounded-2xl p-4 space-y-4">
                                        <div>
                                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Contacto</p>
                                            <p className="text-xs font-bold text-slate-900">{selectedPuesto.contacto || 'No asignado'}</p>
                                            <p className="text-[11px] text-primary">{selectedPuesto.telefono}</p>
                                        </div>
                                        <div className="pt-3 border-t">
                                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Instrucciones</p>
                                            <p className="text-[10px] text-slate-600 italic">"{selectedPuesto.instrucciones || 'Sin instrucciones tacticas'}"</p>
                                        </div>
                                        <button 
                                            onClick={() => setDetailPuesto(selectedPuesto)}
                                            className="w-full mt-2 flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-primary/20"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">history</span>
                                            Ver Historial Completo
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-10 opacity-30">
                                <span className="material-symbols-outlined text-4xl">ads_click</span>
                                <p className="text-[10px] font-bold uppercase mt-2">Selecciona un punto</p>
                            </div>
                        )}

                        <div className="space-y-4 pt-4">
                            <h4 className="text-[11px] font-black text-slate-900 uppercase px-1">Personal en Base</h4>
                            <div className="space-y-2">
                                {disponibles.map(v => (
                                    <div key={v.id} className="bg-white border rounded-2xl p-3 flex justify-between items-center group hover:border-primary/30 transition-all">
                                        <div className="flex gap-3">
                                            <div className="size-10 rounded-xl overflow-hidden border">
                                                <img src={v.foto || `https://ui-avatars.com/api/?name=${v.nombre}`} className="w-full h-full object-cover" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-900 truncate w-32">{v.nombre}</p>
                                                <p className="text-[9px] text-primary font-bold uppercase">{v.rango}</p>
                                            </div>
                                        </div>
                                        {selectedPuesto ? (
                                            <button
                                                onClick={() => setDraftGuardHour({ id: v.id, start: '06:00', end: '18:00' })}
                                                className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-all shadow-sm"
                                            >
                                                <span className="material-symbols-outlined text-lg">add</span>
                                            </button>
                                        ) : (
                                            <span className="size-2 bg-success rounded-full opacity-40"></span>
                                        )}
                                    </div>
                                ))}

                                {draftGuardHour && selectedPuesto && (
                                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                                        <div className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl animate-in zoom-in-95">
                                            <h3 className="text-sm font-black text-slate-900 uppercase mb-4">Asignar Horario</h3>
                                            <div className="grid grid-cols-2 gap-3 mb-5">
                                                <div>
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase">Inicio</label>
                                                    <MilitaryTimeInput value={draftGuardHour.start} onChange={val => setDraftGuardHour({ ...draftGuardHour, start: val })} className="w-full !h-10 border rounded-xl text-xs" />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase">Fin</label>
                                                    <MilitaryTimeInput value={draftGuardHour.end} onChange={val => setDraftGuardHour({ ...draftGuardHour, end: val })} className="w-full !h-10 border rounded-xl text-xs" />
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => setDraftGuardHour(null)} className="flex-1 py-2 text-[10px] font-bold uppercase text-slate-400">Cancelar</button>
                                                <button onClick={() => {
                                                    assignGuardToPuesto(selectedPuesto.id, draftGuardHour.id, draftGuardHour.start, draftGuardHour.end);
                                                    setDraftGuardHour(null);
                                                }} className="flex-1 py-2 bg-primary text-white text-[10px] font-bold uppercase rounded-xl">Confirmar</button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </aside>
            </div>

            {/* Notifications system removed in favor of tactical toasts */}

            <PuestoModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} initialLat={draftLat} initialLng={draftLng} onCreated={id => { setSelectedId(id); setSidebarTab('detalles'); }} />
            <GuardModal isOpen={isGuardModalOpen} onClose={() => setIsGuardModalOpen(false)} />
            {detailPuesto && <PuestoDetailModal isOpen={true} onClose={() => setDetailPuesto(null)} puesto={detailPuesto} />}
            {confirmDelete && (
            <ConfirmDialog
                isOpen={!!confirmDelete}
                title="Eliminar Puesto"
                message={`¿Confirmas la remocion de "${confirmDelete?.nombre}" de la red operativa? Esta accion es irreversible y se perdera todo el historial asociado.`}
                confirmLabel="Si, eliminar"
                variant="danger"
                onConfirm={() => {
                    if (confirmDelete) {
                        deletePuesto(confirmDelete.id);
                        if (selectedId === confirmDelete.id) setSelectedId(null);
                        setConfirmDelete(null);
                    }
                }}
                onCancel={() => setConfirmDelete(null)}
            />
            )}
        </div>
    );
};

const StatBadge = ({ label, value, color, pulse }: { label: string; value: number; color: string; pulse?: boolean }) => (
    <div className="text-center px-2">
        <p className={`text-xl font-black leading-none ${color} ${pulse ? 'animate-pulse' : ''}`}>{value}</p>
        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-1">{label}</p>
    </div>
);

const InfoRow = ({ label, value, valueClass = 'text-slate-900' }: { label: string; value: string; valueClass?: string }) => (
    <div className="flex justify-between text-[10px] font-bold">
        <span className="text-slate-400 uppercase tracking-widest">{label}</span>
        <span className={valueClass}>{value}</span>
    </div>
);

const MapControlBtn = ({ icon, title, onClick, active, accent }: { icon: string; title: string; onClick: () => void; active?: boolean; accent?: boolean }) => (
    <button onClick={onClick} title={title} className={`size-9 rounded-xl flex items-center justify-center border transition-all ${accent ? 'bg-primary text-white border-primary' : active ? 'bg-primary/10 text-primary border-primary/20' : 'bg-white text-slate-500 border-slate-100 hover:bg-slate-50'}`}>
        <span className="material-symbols-outlined text-lg">{icon}</span>
    </button>
);

const QuickLogBtn = ({ icon, label, onClick, color = "text-primary" }: { icon: string; label: string; onClick: () => void; color?: string }) => (
    <button onClick={onClick} className="flex items-center gap-2 p-2 bg-white border border-slate-100 rounded-lg hover:bg-slate-50 transition-all shadow-sm">
        <span className={`material-symbols-outlined text-[16px] ${color}`}>{icon}</span>
        <span className="text-[9px] font-bold text-slate-600 uppercase italic">{label}</span>
    </button>
);

export default Puestos;
