import { useState, useEffect, useRef, useMemo } from 'react';
import { usePuestoStore } from '../../store/puestoStore';

// ─── Tipos de geocodificacion ─────────────────────────────────────────────────
interface GeocodeResult {
    name: string;
    display_name: string;
    address: string;
    lat: number;
    lon: number;
    type: string;
    class: string;
    isCustom?: boolean;
}

// ─── Motor Dual: Photon (KomootHQ) + Nominatim (OSM) ─────────────────────────
const searchPhoton = async (query: string, lat: number, lon: number): Promise<GeocodeResult[]> => {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=${lat}&lon=${lon}&limit=8&lang=es`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const data = await res.json();
    return (data.features || []).map((f: any) => {
        const p = f.properties;
        const nameParts = [p.name, p.street, p.housenumber].filter(Boolean);
        const addrParts = [p.district, p.suburb, p.city || p.town || p.village, p.state, p.country].filter(Boolean);
        return {
            name: nameParts[0] || p.name || query,
            display_name: [...nameParts, ...addrParts].join(', '),
            address: addrParts.join(', ') || 'Colombia',
            lat: f.geometry.coordinates[1],
            lon: f.geometry.coordinates[0],
            type: p.osm_value || p.type || 'place',
            class: p.osm_key || p.class || 'place',
        };
    });
};

const searchNominatim = async (query: string, lat: number, lon: number): Promise<GeocodeResult[]> => {
    // Bias: priorizar resultados colombianos
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=geocodejson&addressdetails=1&limit=8&countrycodes=co&viewbox=${lon - 0.5},${lat - 0.5},${lon + 0.5},${lat + 0.5}&bounded=0&accept-language=es`;
    const res = await fetch(url, {
        headers: { 'Accept-Language': 'es', 'User-Agent': 'CorazaCTA-App/1.0' },
        signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    return (data.features || []).map((f: any) => {
        const p = f.properties.geocoding;
        const name = p.name || p.label?.split(',')[0] || query;
        const addrParts = [p.district, p.city || p.town || p.village || p.county, p.state].filter(Boolean);
        return {
            name,
            display_name: p.label || name,
            address: addrParts.join(', ') || 'Colombia',
            lat: f.geometry.coordinates[1],
            lon: f.geometry.coordinates[0],
            type: p.type || 'place',
            class: p.category || 'place',
        };
    });
};

// ─── Google Maps Places Autocomplete (Primary Engine) ─────────────────────────
const searchGooglePlaces = async (query: string, lat: number, lon: number): Promise<GeocodeResult[]> => {
    // Google Places Text Search (New) - requires API KEY
    const GOOGLE_API_KEY = (window as any).__GOOGLE_MAPS_API_KEY || import.meta.env?.VITE_GOOGLE_MAPS_API_KEY || '';
    if (!GOOGLE_API_KEY) throw new Error('No Google API key configured');

    const url = `https://places.googleapis.com/v1/places:searchText`;
    const body = {
        textQuery: query,
        locationBias: {
            circle: {
                center: { latitude: lat, longitude: lon },
                radius: 30000.0, // 30km radius
            },
        },
        languageCode: 'es',
        maxResultCount: 8,
        regionCode: 'CO',
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_API_KEY,
            'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.types',
        },
        signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) throw new Error(`Google Places ${res.status}`);
    const data = await res.json();

    return (data.places || []).map((p: any) => ({
        name: p.displayName?.text || query,
        display_name: p.formattedAddress || '',
        address: p.formattedAddress || 'Colombia',
        lat: p.location?.latitude || lat,
        lon: p.location?.longitude || lon,
        type: (p.types?.[0] || 'place') as string,
        class: 'google',
    }));
};

// ─── Configuracion ────────────────────────────────────────────────────────────
interface PuestoModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialLat?: number;
    initialLng?: number;
    onCreated?: (id: string) => void;
    puestoId?: string | null; // Nuevo prop para modo edición
}

const TIPOS = [
    { value: 'hospital', label: 'Hospital / Clinica' },
    { value: 'comando', label: 'Comando de Policia' },
    { value: 'torre', label: 'Torre de Control / Vigia' },
    { value: 'edificio', label: 'Edificio Corporativo' },
    { value: 'retail', label: 'Comercio / Retail' },
    { value: 'logistica', label: 'Centro Logistico' },
    { value: 'banco', label: 'Entidad Financiera' },
    { value: 'puerto', label: 'Puerto / Aduana' },
];

const PuestoModal = ({ isOpen, onClose, initialLat = 6.2442, initialLng = -75.5812, onCreated, puestoId }: PuestoModalProps) => {
    const isEditing = !!puestoId;
    const [nombre, setNombre] = useState('');
    const [tipo, setTipo] = useState<any>('hospital');
    const [lat, setLat] = useState(initialLat.toString());
    const [lng, setLng] = useState(initialLng.toString());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Advanced fields
    const [contacto, setContacto] = useState('');
    const [telefono, setTelefono] = useState('');
    const [requisitos, setRequisitos] = useState('');
    const [instrucciones, setInstrucciones] = useState('');
    const [prioridad, setPrioridad] = useState<any>('media');
    const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [searchStatus, setSearchStatus] = useState<'idle'|'google'|'photon'|'nominatim'|'done'>('idle');
    // Nuevos campos
    const [numeroContrato, setNumeroContrato] = useState('');
    const [cliente, setCliente] = useState('');
    const [tipoServicio, setTipoServicio] = useState('');
    const [direccion, setDireccion] = useState('');
    const [conArmamento, setConArmamento] = useState(false);

    const abortRef = useRef<AbortController | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const addPuesto = usePuestoStore((state) => state.addPuesto);
    const updatePuesto = usePuestoStore((state) => state.updatePuesto);
    const puestos = usePuestoStore((state) => state.puestos);
    const nextIdNumber = usePuestoStore((state) => state.nextIdNumber);
    
    // Buscar el puesto si estamos editando
    const existingPuesto = useMemo(() => 
        isEditing ? puestos.find(p => p.id === puestoId || p.dbId === puestoId) : null
    , [isEditing, puestoId, puestos]);

    const formattedPreview = isEditing ? existingPuesto?.id : `MED-${String(nextIdNumber).padStart(4, '0')}`;

    // ======== Motor de Busqueda Triple (Google Places → Photon → Nominatim) ========
    const handleSearch = (query: string) => {
        setNombre(query);

        // Cancelar busqueda anterior
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (abortRef.current) abortRef.current.abort();

        if (query.trim().length < 2) {
            setSuggestions([]);
            setIsSearching(false);
            setSearchStatus('idle');
            return;
        }

        setIsSearching(true);

        debounceRef.current = setTimeout(async () => {
            const curLat = parseFloat(lat) || initialLat;
            const curLon = parseFloat(lng) || initialLng;

            // 1. Try Google Places first (most accurate)
            try {
                setSearchStatus('google');
                const googleResults = await searchGooglePlaces(query, curLat, curLon);

                if (googleResults.length > 0) {
                    const withManual = [...googleResults, {
                        name: query,
                        display_name: query,
                        address: 'Registrar esta ubicacion manualmente',
                        lat: curLat, lon: curLon,
                        type: 'manual', class: 'custom', isCustom: true,
                    }];
                    setSuggestions(withManual);
                    setSelectedIndex(-1);
                    setIsSearching(false);
                    setSearchStatus('done');
                    return;
                }
            } catch (_) {
                // Google Places not configured or failed, try Photon
            }

            // 2. Try Photon (fast, good for POIs)
            try {
                setSearchStatus('photon');
                const photonResults = await searchPhoton(query, curLat, curLon);

                if (photonResults.length > 0) {
                    const withManual = [...photonResults, {
                        name: query,
                        display_name: query,
                        address: 'Registrar esta ubicacion manualmente',
                        lat: curLat, lon: curLon,
                        type: 'manual', class: 'custom', isCustom: true,
                    }];
                    setSuggestions(withManual);
                    setSelectedIndex(-1);
                    setIsSearching(false);
                    setSearchStatus('done');
                    return;
                }
            } catch (_) {
                // Photon failed, try Nominatim
            }

            // 3. Fallback: Nominatim (OSM official, global coverage)
            try {
                setSearchStatus('nominatim');
                const nominatimResults = await searchNominatim(query, curLat, curLon);
                const withManual: GeocodeResult[] = [...nominatimResults, {
                    name: query,
                    display_name: query,
                    address: nominatimResults.length === 0 ? 'Registrar manualmente (no encontrado)' : 'Registrar esta ubicacion manualmente',
                    lat: curLat, lon: curLon,
                    type: 'manual', class: 'custom', isCustom: true,
                }];
                setSuggestions(withManual);
                setSelectedIndex(-1);
            } catch (err) {
                // No engine available
                setSuggestions([{
                    name: query,
                    display_name: query,
                    address: 'Sin conexion - Registrar manualmente',
                    lat: curLat, lon: curLon,
                    type: 'manual', class: 'custom', isCustom: true,
                }]);
            } finally {
                setIsSearching(false);
                setSearchStatus('done');
            }
        }, 250);
    };

    const selectSuggestion = (s: GeocodeResult) => {
        setNombre(s.name);
        setLat(s.lat.toFixed(6));
        setLng(s.lon.toFixed(6));
        if (s.address && s.address !== 'Registrar esta ubicacion manualmente') {
            setDireccion(s.display_name || s.address);
        }
        const autoTipo = mapOSMTypeToPuestoType(s.type, s.class);
        if (autoTipo) setTipo(autoTipo);
        setSuggestions([]);
        setSelectedIndex(-1);
    };

    useEffect(() => {
        if (isOpen) {
            if (isEditing && existingPuesto) {
                // MODO EDICIÓN: Hidratar con datos existentes
                setNombre(existingPuesto.nombre || '');
                setTipo(existingPuesto.tipo || 'hospital');
                setLat((existingPuesto.lat || initialLat).toString());
                setLng((existingPuesto.lng || initialLng).toString());
                setContacto(existingPuesto.contacto || '');
                setTelefono(existingPuesto.telefono || '');
                setRequisitos(existingPuesto.requisitos || '');
                setInstrucciones(existingPuesto.instrucciones || '');
                setPrioridad(existingPuesto.prioridad || 'media');
                setNumeroContrato(existingPuesto.numeroContrato || '');
                setCliente(existingPuesto.cliente || '');
                setTipoServicio(existingPuesto.tipoServicio || '');
                setDireccion(existingPuesto.direccion || '');
                setConArmamento(existingPuesto.conArmamento || false);
                setShowAdvanced(true); // Mostrar campos avanzados al editar
            } else {
                // MODO CREACIÓN: Limpiar campos
                setNombre('');
                setTipo('hospital');
                setLat(initialLat.toFixed(6));
                setLng(initialLng.toFixed(6));
                setContacto('');
                setTelefono('');
                setRequisitos('');
                setInstrucciones('');
                setPrioridad('media');
                setNumeroContrato('');
                setCliente('');
                setTipoServicio('');
                setDireccion('');
                setConArmamento(false);
                setShowAdvanced(false);
            }
            setIsSubmitting(false);
            setSuggestions([]);
            setIsSearching(false);
            setSelectedIndex(-1);
            setSearchStatus('idle');
        }
    }, [isOpen, initialLat, initialLng, isEditing, existingPuesto]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (suggestions.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
            e.preventDefault();
            selectSuggestion(suggestions[selectedIndex]);
        } else if (e.key === 'Escape') {
            setSuggestions([]);
        }
    };

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) onClose();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!nombre.trim()) return;

        const finalLat = isNaN(Number(lat)) ? initialLat : Number(lat);
        const finalLng = isNaN(Number(lng)) ? initialLng : Number(lng);

        setIsSubmitting(true);
        try {
            const detalles = {
                contacto: contacto || undefined,
                telefono: telefono || undefined,
                requisitos: requisitos || undefined,
                instrucciones: instrucciones || undefined,
                prioridad,
                numeroContrato: numeroContrato || undefined,
                cliente: cliente || undefined,
                tipoServicio: tipoServicio || undefined,
                direccion: direccion || undefined,
                conArmamento,
            };

            if (isEditing && existingPuesto) {
                // ACTUALIZAR PUESTO
                await updatePuesto(existingPuesto.id, {
                    nombre: nombre.trim(),
                    tipo: tipo as any,
                    ...detalles
                });
                showTacticalToast({ 
                    title: 'Objetivo Actualizado', 
                    message: `Los cambios en ${formattedPreview} han sido persistidos.`, 
                    type: 'success' 
                });
            } else {
                // CREAR NUEVO PUESTO
                const newId = await addPuesto(nombre.trim(), tipo, finalLat, finalLng, 9.14, detalles);
                if (onCreated && newId) onCreated(newId);
            }
            onClose();
        } catch (err) {
            console.error('Error en PuestoModal submit:', err);
            setIsSubmitting(false);
        }
    };

    const engineLabel = searchStatus === 'google' ? 'Google Places - Maps API'
        : searchStatus === 'photon' ? 'Photon - OSM Global'
        : searchStatus === 'nominatim' ? 'Nominatim - OpenStreetMap'
        : searchStatus === 'done' ? 'Motor de Busqueda Activo'
        : 'Geocodificador Triple';

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40" onClick={onClose}>
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"></div>

            <div
                className="relative w-full max-w-lg bg-[#0b1424] border border-white/10 rounded-[28px] shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-300 max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header - Fixed */}
                <div className="bg-gradient-to-r from-primary/15 to-transparent px-8 py-6 flex items-center justify-between border-b border-white/5 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="size-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary border border-primary/20">
                            <span className="material-symbols-outlined text-2xl notranslate" translate="no">{isEditing ? 'edit_location' : 'location_on'}</span>
                        </div>
                        <div>
                            <h4 className="text-lg font-bold text-white uppercase tracking-tight">{isEditing ? 'Ajustes' : 'Recrear'} <span className="text-primary">Objetivo</span></h4>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">{isEditing ? 'Modificar parámetros de red' : 'Escala Real + Elevacion'}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="size-10 rounded-full flex items-center justify-center hover:bg-white/10 text-slate-400 hover:text-white transition-all active:scale-90"
                    >
                        <span className="material-symbols-outlined notranslate" translate="no">close</span>
                    </button>
                </div>

                {/* Form - Body is scrollable, Footer is fixed */}
                <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden" noValidate>
                    {/* Scrollable Body */}
                    <div className="flex-1 overflow-y-auto p-8 pt-5 custom-scrollbar space-y-5">
                        <div className="bg-black/30 border border-primary/20 rounded-2xl px-5 py-3 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Codigo Instancia</span>
                            <span className="font-mono text-primary font-bold text-lg tracking-widest">{formattedPreview}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2 space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                                    Modelo / Tipo de Edificio <span className="text-danger">*</span>
                                </label>
                                <div className="relative">
                                    <select
                                        value={tipo}
                                        onChange={(e) => setTipo(e.target.value)}
                                        className="w-full bg-[#0d1a2e] border border-primary/30 rounded-xl py-3.5 px-5 pr-10 text-sm text-white focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all appearance-none cursor-pointer"
                                        style={{ boxShadow: '0 0 15px rgba(19,127,236,0.1)' }}
                                    >
                                        {TIPOS.map(t => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                    <span className="material-symbols-outlined absolute right-3.5 top-1/2 -translate-y-1/2 text-primary pointer-events-none notranslate" translate="no">domain</span>
                                </div>
                            </div>

                            {/* ── CAMPO DE BUSQUEDA ── */}
                            <div className="col-span-2 space-y-1.5 relative">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                                    Nombre / Direccion del Puesto <span className="text-danger">*</span>
                                </label>
                                <div className="relative group">
                                    <input
                                        required
                                        autoFocus
                                        autoComplete="off"
                                        value={nombre}
                                        onKeyDown={handleKeyDown}
                                        onChange={(e) => handleSearch(e.target.value)}
                                        className="w-full bg-[#0d1a2e] border border-white/8 rounded-xl py-3.5 pl-12 pr-12 text-sm text-white focus:border-primary/60 focus:ring-1 focus:ring-primary/20 outline-none transition-all placeholder:text-slate-600 shadow-inner"
                                        placeholder="Ej: Clinica Las Americas, Cra 81 Calasanz..."
                                    />
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">
                                        <span className="material-symbols-outlined text-xl notranslate" translate="no">search</span>
                                    </div>
                                    {nombre && !isSearching && (
                                        <button
                                            type="button"
                                            onClick={() => { setNombre(''); setSuggestions([]); setSearchStatus('idle'); }}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-lg notranslate" translate="no">cancel</span>
                                        </button>
                                    )}
                                    {isSearching && (
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                            <div className="size-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                                        </div>
                                    )}
                                </div>

                                {/* Hint debajo del campo */}
                                {nombre.length === 0 && (
                                    <p className="text-[9px] text-slate-600 ml-1 flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[12px] text-primary/60">travel_explore</span>
                                        Escribe el nombre del lugar, barrio, direccion o empresa
                                    </p>
                                )}

                                {/* Dropdown de Sugerencias */}
                                {suggestions.length > 0 && (
                                    <div className="absolute z-[210] top-[100%] left-0 right-0 mt-2 bg-[#0b1424] border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden animate-in fade-in slide-in-from-top-2">
                                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                            {suggestions.map((s, i) => {
                                                const icon = getPlaceIcon(s.type, s.class);
                                                const isSelected = i === selectedIndex;
                                                return (
                                                    <button
                                                        key={i}
                                                        type="button"
                                                        onClick={() => selectSuggestion(s)}
                                                        onMouseEnter={() => setSelectedIndex(i)}
                                                        className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors border-b border-white/5 last:border-0 ${isSelected ? 'bg-primary/20 border-l-2 border-l-primary' : 'hover:bg-white/5 border-l-2 border-l-transparent'}`}
                                                    >
                                                        <div className={`mt-0.5 shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${isSelected ? 'bg-primary/20 text-primary' : s.isCustom ? 'bg-warning/10 text-warning' : 'bg-white/5 text-slate-400'}`}>
                                                            <span className="material-symbols-outlined text-[15px] notranslate" translate="no">
                                                                {s.isCustom ? 'add_location_alt' : icon}
                                                            </span>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`text-[12px] font-bold truncate leading-tight ${isSelected ? 'text-primary' : s.isCustom ? 'text-warning' : 'text-white'}`}>
                                                                {s.name}
                                                            </p>
                                                            <p className={`text-[10px] truncate mt-0.5 leading-tight ${s.isCustom ? 'text-warning/60' : 'text-slate-500'}`}>
                                                                {s.address}
                                                            </p>
                                                        </div>
                                                        {!s.isCustom && (
                                                            <div className="shrink-0 text-right">
                                                                <span className="text-[9px] font-mono text-slate-700">{s.lat.toFixed(4)},{s.lon.toFixed(4)}</span>
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <div className="bg-[#0a1020] px-4 py-2 border-t border-white/5 flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <div className="size-1.5 rounded-full bg-success animate-ping shrink-0"></div>
                                                <span className="text-[8px] font-bold text-success uppercase tracking-[0.15em]">
                                                    {engineLabel}
                                                </span>
                                            </div>
                                            <span className="text-[8px] text-slate-600 font-mono">
                                                {suggestions.filter(s => !s.isCustom).length} resultados - ↑↓ navegar - Enter seleccionar
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Estado: buscando sin resultados aun */}
                                {nombre.length > 2 && !isSearching && suggestions.length === 0 && searchStatus === 'done' && (
                                    <div className="absolute z-[210] top-[100%] left-0 right-0 mt-2 bg-[#0b1424] border border-white/10 rounded-2xl p-5 text-center shadow-2xl animate-in fade-in zoom-in-95">
                                        <span className="material-symbols-outlined text-2xl text-slate-600 mb-2 block">travel_explore</span>
                                        <p className="text-[11px] text-slate-400 font-bold">No encontramos «{nombre}»</p>
                                        <p className="text-[10px] text-slate-600 mt-1">Intenta con el barrio, municipio o una calle cercana</p>
                                    </div>
                                )}

                                {/* Campo de Direccion (Extraido de avanzado para visibilidad) */}
                                <div className="mt-2 space-y-1.5 animate-in fade-in slide-in-from-top-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                                        Direccion Especifica <span className="text-slate-600">(opcional)</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            value={direccion}
                                            onChange={(e) => setDireccion(e.target.value)}
                                            className="w-full bg-[#0b1424] border border-white/10 rounded-xl py-3 px-4 text-xs text-white focus:border-primary/50 outline-none"
                                            placeholder="Ej: Calle 49 # 81-24, Interior 201...  (se puede completar después)"
                                        />
                                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-primary/40 text-[18px]">location_on</span>
                                    </div>
                                    <p className="text-[9px] text-slate-600 ml-1">
                                        ✅ <span className="text-success/80 font-bold">Solo el nombre es obligatorio</span> — puedes completar el resto después
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                                    Latitud (Z-Sync) <span className="text-danger">*</span>
                                </label>
                                <input
                                    required
                                    value={lat}
                                    onChange={(e) => setLat(e.target.value)}
                                    className="w-full bg-[#0b1424] border border-white/5 rounded-xl py-3.5 px-4 text-xs text-slate-400 font-mono focus:outline-none focus:border-primary/50"
                                    placeholder="6.2442"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                                    Longitud (Z-Sync) <span className="text-danger">*</span>
                                </label>
                                <input
                                    required
                                    value={lng}
                                    onChange={(e) => setLng(e.target.value)}
                                    className="w-full bg-[#0b1424] border border-white/5 rounded-xl py-3.5 px-4 text-xs text-slate-400 font-mono focus:outline-none focus:border-primary/50"
                                    placeholder="-75.5812"
                                />
                            </div>
                        </div>

                        {/* Auto-Elevation indicator */}
                        <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                            <span className="material-symbols-outlined text-primary text-[16px] notranslate" translate="no">height</span>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                                Offset Z aplicado automaticamente: <span className="text-white">+ 9.14m (30 pies)</span>
                            </p>
                        </div>

                        {/* Advanced Toggle */}
                        <button
                            type="button"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className={`w-full py-3 px-5 rounded-xl border flex items-center justify-between transition-all ${showAdvanced ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-white/3 border-white/10 text-slate-400 hover:bg-white/5'}`}
                        >
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined notranslate" translate="no">{showAdvanced ? 'settings_suggest' : 'add_circle'}</span>
                                <span className="text-[10px] font-bold uppercase tracking-widest">CUADRO OPERATIVO Operativa Avanzada</span>
                            </div>
                            <span className="material-symbols-outlined notranslate" translate="no">{showAdvanced ? 'expand_less' : 'expand_more'}</span>
                        </button>

                        {showAdvanced && (
                            <div className="space-y-4 animate-in slide-in-from-top-4 duration-300">
                                {/* Campos de Contrato y Cliente */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 text-primary">Numero de Contrato</label>
                                        <input
                                            value={numeroContrato}
                                            onChange={e => setNumeroContrato(e.target.value)}
                                            className="w-full bg-[#0d1a2e] border border-white/8 rounded-xl py-2.5 px-4 text-xs text-white outline-none focus:border-primary/50 font-mono"
                                            placeholder="Ej: CTR-2026-001"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 text-primary">Cliente</label>
                                        <input
                                            value={cliente}
                                            onChange={e => setCliente(e.target.value)}
                                            className="w-full bg-[#0d1a2e] border border-white/8 rounded-xl py-2.5 px-4 text-xs text-white outline-none focus:border-primary/50"
                                            placeholder="Nombre del cliente"
                                        />
                                    </div>
                                    <div className="col-span-2 space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 text-primary">Tipo de Servicio</label>
                                        <input
                                            value={tipoServicio}
                                            onChange={e => setTipoServicio(e.target.value)}
                                            className="w-full bg-[#0d1a2e] border border-white/8 rounded-xl py-2.5 px-4 text-xs text-white outline-none focus:border-primary/50"
                                            placeholder="Ej: Vigilancia Fija, Seguridad de Eventos..."
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 text-primary">Contacto Responsable</label>
                                        <input
                                            value={contacto}
                                            onChange={e => setContacto(e.target.value)}
                                            className="w-full bg-[#0d1a2e] border border-white/8 rounded-xl py-2.5 px-4 text-xs text-white outline-none focus:border-primary/50"
                                            placeholder="Ej: Administrador"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 text-primary">Telefono / Radio</label>
                                        <input
                                            value={telefono}
                                            onChange={e => setTelefono(e.target.value)}
                                            className="w-full bg-[#0d1a2e] border border-white/8 rounded-xl py-2.5 px-4 text-xs text-white outline-none focus:border-primary/50"
                                            placeholder="+57 300..."
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 text-primary">Prioridad de Cobertura</label>
                                    <div className="flex gap-2">
                                        {['baja', 'media', 'alta', 'critica'].map(p => (
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() => setPrioridad(p)}
                                                className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-tighter border transition-all ${prioridad === p ? 'bg-primary border-primary text-white' : 'bg-white/5 border-white/10 text-slate-500 hover:bg-white/10'}`}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 text-primary">Instrucciones Tacticas</label>
                                    <textarea
                                        value={instrucciones}
                                        onChange={e => setInstrucciones(e.target.value)}
                                        className="w-full bg-[#0d1a2e] border border-white/8 rounded-xl py-3 px-4 text-xs text-white outline-none focus:border-primary/50 h-20 resize-none"
                                        placeholder="Protocolos especificos para este punto..."
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 text-primary">Requisitos del Puesto</label>
                                    <input
                                        value={requisitos}
                                        onChange={e => setRequisitos(e.target.value)}
                                        className="w-full bg-[#0d1a2e] border border-white/8 rounded-xl py-2.5 px-4 text-xs text-white outline-none focus:border-primary/50"
                                        placeholder="Ej: Arma corta, Radio digital, Chaleco N3"
                                    />
                                </div>

                                <div className="flex items-center justify-between p-4 bg-primary/5 rounded-xl border border-primary/20">
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-primary notranslate" translate="no">gavel</span>
                                        <div>
                                            <p className="text-[11px] font-bold text-white uppercase tracking-tight">Requiere Armamento</p>
                                            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Habilitar porte de armas en este puesto</p>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={conArmamento}
                                            onChange={e => setConArmamento(e.target.checked)}
                                        />
                                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer - Fixed */}
                    <div className="p-8 border-t border-white/5 bg-black/20 flex gap-4 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3.5 bg-white/3 text-slate-400 font-bold rounded-2xl uppercase tracking-widest hover:bg-white/8 active:scale-95 transition-all text-[10px] border border-white/5"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !nombre.trim()}
                            className="flex-1 py-3.5 bg-primary text-white font-bold rounded-2xl uppercase tracking-[0.2em] shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-95 transition-all text-[10px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <span className="material-symbols-outlined text-[16px] animate-spin notranslate" translate="no">progress_activity</span>
                                    {isEditing ? 'Sincronizando...' : 'Instanciando...'}
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-[16px] notranslate" translate="no">{isEditing ? 'save' : 'view_in_ar'}</span>
                                    {isEditing ? 'Guardar Cambios' : 'Recrear Punto en Mapa'}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ─── Helpers de UI ──────────────────────────────────────────────────────────
const mapOSMTypeToPuestoType = (type?: string, cls?: string) => {
    if (cls === 'amenity' || type === 'amenity') {
        if (type === 'hospital' || type === 'clinic' || type === 'doctors') return 'hospital';
        if (type === 'police') return 'comando';
        if (type === 'bank' || type === 'atm') return 'banco';
        if (type === 'university' || type === 'school' || type === 'college') return 'edificio';
        if (type === 'marketplace' || type === 'restaurant' || type === 'mall') return 'retail';
    }
    if (cls === 'health' || type === 'health') return 'hospital';
    if (cls === 'shop' || type === 'mall' || type === 'supermarket') return 'retail';
    if (cls === 'office' || cls === 'building' || type === 'office') return 'edificio';
    if (cls === 'industrial' || type === 'warehouse' || type === 'industrial') return 'logistica';
    if (type === 'aeroway' || type === 'port' || type === 'harbour') return 'puerto';
    return null;
};

const getPlaceIcon = (type?: string, cls?: string) => {
    if (type === 'hospital' || type === 'clinic' || type === 'doctors' || cls === 'health') return 'medical_services';
    if (type === 'police') return 'local_police';
    if (type === 'bank' || type === 'atm') return 'account_balance';
    if (type === 'restaurant' || type === 'cafe' || type === 'food') return 'restaurant';
    if (type === 'school' || type === 'university' || type === 'college') return 'school';
    if (type === 'mall' || type === 'supermarket' || cls === 'shop') return 'shopping_cart';
    if (cls === 'building' || type === 'office') return 'corporate_fare';
    if (cls === 'highway' || type === 'street' || type === 'road') return 'add_road';
    if (type === 'city' || type === 'town' || type === 'municipality') return 'location_city';
    if (type === 'suburb' || type === 'neighbourhood' || type === 'district') return 'home_pin';
    if (cls === 'tourism' || type === 'museum' || type === 'tourism') return 'museum';
    if (type === 'warehouse' || type === 'industrial') return 'warehouse';
    if (type === 'harbour' || type === 'port') return 'anchor';
    return 'location_on';
};

export default PuestoModal;
