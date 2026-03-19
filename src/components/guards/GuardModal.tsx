import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useVigilanteStore } from '../../store/vigilanteStore';
import { usePuestoStore } from '../../store/puestoStore';
import { MilitaryTimeInput } from '../ui/MilitaryTimeInput';

interface GuardModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const RANGOS = [
    { value: 'Vigilante', label: 'Vigilante Estandar' },
    { value: 'Vigilante Senior', label: 'Vigilante Senior' },
    { value: 'Supervisor', label: 'Supervisor de Zona' },
    { value: 'Operador', label: 'Operador de Medios' },
    { value: 'Escolta', label: 'Escolta Personal' },
];

const GuardModal = ({ isOpen, onClose }: GuardModalProps) => {
    const [nombre, setNombre] = useState('');
    const [cedula, setCedula] = useState('');
    const [rango, setRango] = useState('Vigilante');
    const [puestoId, setPuestoId] = useState('');
    const [horaInicio, setHoraInicio] = useState('06:00');
    const [horaFin, setHoraFin] = useState('18:00');
    const [isSubmitting, setIsSubmitting] = useState(false);
    // Modulo: 'disponible' o 'activo'
    const [modulo, setModulo] = useState<'disponible' | 'activo'>('disponible');
    const [justificacion, setJustificacion] = useState('');
    const [asignarPuesto, setAsignarPuesto] = useState(false);

    const addVigilante = useVigilanteStore((state) => state.addVigilante);
    const puestos = usePuestoStore((state) => state.puestos);
    const assignGuardInPuesto = usePuestoStore((state) => state.assignGuard);
    const nextIdNumber = useVigilanteStore((state) => state.nextIdNumber);
    const formattedPreview = `C-${String(nextIdNumber).padStart(4, '0')}`;

    useEffect(() => {
        if (isOpen) {
            setNombre('');
            setCedula('');
            setRango('Vigilante');
            setPuestoId('');
            setAsignarPuesto(false);
            setIsSubmitting(false);
            setModulo('disponible');
            setJustificacion('');
        }
    }, [isOpen]);

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
        if (!nombre.trim() || !cedula.trim()) return;
        if (modulo === 'disponible' && !justificacion.trim()) {
            return;
        }
        if (asignarPuesto && !puestoId) return;

        setIsSubmitting(true);
        try {
            const assignment = (modulo === 'activo' && asignarPuesto) ? { puestoId, horaInicio, horaFin } : undefined;
            const newId = await addVigilante(nombre.trim(), cedula.trim(), rango, modulo, justificacion, assignment);

            if (assignment && newId) {
                assignGuardInPuesto(puestoId, newId, horaInicio, horaFin);
            }
            onClose();
        } catch {
            setIsSubmitting(false);
        }
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300"
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"></div>

            <div
                className="relative w-full max-w-lg bg-[#0b1424] border border-white/10 rounded-[28px] shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-300 max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header - Fixed */}
                <div className="bg-gradient-to-r from-primary/15 to-transparent px-8 py-6 flex items-center justify-between border-b border-white/5 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="size-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary border border-primary/20">
                            <span className="material-symbols-outlined text-2xl notranslate" translate="no">person_add</span>
                        </div>
                        <div>
                            <h4 className="text-lg font-bold text-white uppercase tracking-tight">Nueva <span className="text-primary">Ficha</span></h4>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Registro en Tablero Operativo</p>
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
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-5">
                        {/* Code Preview Banner */}
                        <div className="bg-black/30 border border-primary/20 rounded-2xl px-5 py-3 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Codigo TACTICO Asignado</span>
                            <span className="font-mono text-primary font-bold text-lg tracking-widest">{formattedPreview}</span>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                                Nombre Completo <span className="text-danger">*</span>
                            </label>
                            <input
                                required
                                autoFocus
                                value={nombre}
                                onChange={(e) => setNombre(e.target.value)}
                                className="w-full bg-[#0d1a2e] border border-white/8 rounded-xl py-3.5 px-5 text-sm text-white focus:border-primary/60 focus:ring-1 focus:ring-primary/20 outline-none transition-all placeholder:text-slate-700"
                                placeholder="Ej: Juan Carlos Perez"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                                    Numero de Cedula <span className="text-danger">*</span>
                                </label>
                                <input
                                    required
                                    type="text"
                                    inputMode="numeric"
                                    value={cedula}
                                    onChange={(e) => setCedula(e.target.value.replace(/[^0-9.]/g, ''))}
                                    className="w-full bg-[#0d1a2e] border border-white/8 rounded-xl py-3.5 px-4 text-sm text-white focus:border-primary/60 focus:ring-1 focus:ring-primary/20 outline-none transition-all placeholder:text-slate-700 font-mono"
                                    placeholder="Sin puntos ni comas"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Rango</label>
                                <div className="relative">
                                    <select
                                        value={rango}
                                        onChange={(e) => setRango(e.target.value)}
                                        className="w-full bg-[#0d1a2e] border border-white/8 rounded-xl py-3.5 px-4 text-sm text-white appearance-none outline-none focus:border-primary/50"
                                    >
                                        {RANGOS.map(r => (
                                            <option key={r.value} value={r.value}>{r.label}</option>
                                        ))}
                                    </select>
                                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none notranslate text-sm" translate="no">expand_more</span>
                                </div>
                            </div>
                        </div>

                        {/* ── Modulo de destino ── */}
                        <div className="bg-[#111c44] border border-primary/20 rounded-[24px] p-5 space-y-4 shadow-2xl">
                            <p className="text-[11px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary text-lg notranslate" translate="no">hub</span>
                                Modulo de Destino
                            </p>

                            {/* Tabs Modulo */}
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => { setModulo('disponible'); setAsignarPuesto(false); }}
                                    className={`py-3 px-4 rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all flex flex-col items-center gap-1.5 border-2 ${modulo === 'disponible' ? 'bg-success/10 border-success text-success' : 'border-white/10 text-slate-500 hover:border-white/20'}`}
                                >
                                    <span className="material-symbols-outlined text-[20px] notranslate" translate="no">group_add</span>
                                    Disponibles
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setModulo('activo')}
                                    className={`py-3 px-4 rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all flex flex-col items-center gap-1.5 border-2 ${modulo === 'activo' ? 'bg-primary/10 border-primary text-primary' : 'border-white/10 text-slate-500 hover:border-white/20'}`}
                                >
                                    <span className="material-symbols-outlined text-[20px] notranslate" translate="no">local_police</span>
                                    Vigilantes
                                </button>
                            </div>

                            {modulo === 'disponible' && (
                                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                                        Justificacion de Disponibilidad <span className="text-danger">*</span>
                                    </label>
                                    <textarea
                                        value={justificacion}
                                        onChange={e => setJustificacion(e.target.value)}
                                        className="w-full bg-[#0d2020] border border-success/30 rounded-xl py-3 px-4 text-xs text-white outline-none focus:border-success/60 h-16 resize-none placeholder:text-slate-600"
                                        placeholder="Ej: En periodo de induccion, proximo a iniciar turno, licencia medica..."
                                    />
                                    <p className="text-[9px] text-slate-500 ml-1">Campo obligatorio para modulo Disponibles</p>
                                </div>
                            )}

                            {modulo === 'activo' && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-4">
                                    <button
                                        type="button"
                                        onClick={() => setAsignarPuesto(!asignarPuesto)}
                                        className={`w-full py-2.5 px-4 rounded-xl flex items-center justify-between border transition-all ${asignarPuesto ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-white/5 border-white/10 text-slate-400'}`}
                                    >
                                        <span className="text-[10px] font-black uppercase tracking-wider">Asignar a Puesto Ahora</span>
                                        <span className={`size-5 rounded-full border-2 flex items-center justify-center transition-all ${asignarPuesto ? 'bg-primary border-primary' : 'border-slate-600'}`}>
                                            {asignarPuesto && <span className="material-symbols-outlined text-white text-[12px]">check</span>}
                                        </span>
                                    </button>

                                    {asignarPuesto && (
                                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                            <div className="relative">
                                                <select
                                                    value={puestoId}
                                                    onChange={(e) => setPuestoId(e.target.value)}
                                                    className="w-full bg-[#0d1a2e] border border-white/8 rounded-xl py-3 px-5 text-sm text-white appearance-none outline-none focus:border-primary/50"
                                                >
                                                    <option value="">Seleccione Puesto...</option>
                                                    {puestos.map(p => (
                                                        <option key={p.id} value={p.id}>{p.id} - {p.nombre}</option>
                                                    ))}
                                                </select>
                                                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none notranslate" translate="no">expand_more</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Inicio Turno</label>
                                                    <MilitaryTimeInput value={horaInicio} onChange={val => setHoraInicio(val)}
                                                        className="w-full bg-[#0d1a2e] border border-white/8 rounded-xl py-2.5 px-3 text-xs text-white outline-none focus:border-primary/50"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Fin Turno</label>
                                                    <MilitaryTimeInput value={horaFin} onChange={val => setHoraFin(val)}
                                                        className="w-full bg-[#0d1a2e] border border-white/8 rounded-xl py-2.5 px-3 text-xs text-white outline-none focus:border-primary/50"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
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
                            disabled={isSubmitting || !nombre.trim() || !cedula.trim() || (modulo === 'disponible' && !justificacion.trim())}
                            className="flex-1 py-3.5 bg-primary text-white font-bold rounded-2xl uppercase tracking-[0.2em] shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-95 transition-all text-[10px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <span className="material-symbols-outlined text-[16px] animate-spin notranslate" translate="no">progress_activity</span>
                                    Registrando...
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-[16px] notranslate" translate="no">add_circle</span>
                                    Registrar Ficha
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default GuardModal;
