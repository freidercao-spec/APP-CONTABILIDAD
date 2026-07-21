import { useState, useEffect, useCallback } from 'react';
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

    const resetForm = useCallback(() => {
        setNombre('');
        setCedula('');
        setRango('Vigilante');
        setPuestoId('');
        setAsignarPuesto(false);
        setIsSubmitting(false);
        setModulo('disponible');
        setJustificacion('');
        setHoraInicio('06:00');
        setHoraFin('18:00');
    }, []);

    const handleClose = useCallback(() => {
        resetForm();
        onClose();
    }, [onClose, resetForm]);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) handleClose();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen, handleClose]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!nombre.trim() || !cedula.trim()) return;
        setIsSubmitting(true);
        try {
            const assignment = (modulo === 'activo' && asignarPuesto) ? { puestoId, horaInicio, horaFin } : undefined;
            const newId = await addVigilante(nombre.trim(), cedula.trim(), rango, modulo, justificacion.trim() || 'Ingreso manual', assignment);

            if (assignment && newId) {
                assignGuardInPuesto(puestoId, newId, horaInicio, horaFin);
            }
            handleClose();
        } catch {
            setIsSubmitting(false);
        }
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300"
            onClick={handleClose}
        >
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"></div>

            <div
                className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 fade-in duration-150 max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header - Fixed */}
                <div className="bg-slate-50 px-6 py-4 flex items-center justify-between border-b border-slate-200 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                            <span className="material-symbols-outlined text-xl notranslate" translate="no">person_add</span>
                        </div>
                        <div>
                            <h4 className="text-base font-bold text-slate-900 uppercase tracking-tight">Nueva <span className="text-primary">Ficha</span></h4>
                            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Registro en Tablero Operativo</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="size-8 rounded-lg flex items-center justify-center bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-all border border-slate-200"
                    >
                        <span className="material-symbols-outlined text-[16px] notranslate" translate="no">close</span>
                    </button>
                </div>

                {/* Form - Body is scrollable, Footer is fixed */}
                <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden bg-white" noValidate>
                    {/* Scrollable Body */}
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-4">
                        {/* Code Preview Banner */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 flex items-center justify-between shadow-xs">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Código TÁCTICO Asignado</span>
                            <span className="font-mono text-primary font-bold text-base tracking-wider">{formattedPreview}</span>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                                Nombre Completo <span className="text-danger">*</span>
                            </label>
                            <input
                                required
                                autoFocus
                                value={nombre}
                                onChange={(e) => setNombre(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-3.5 text-[12px] font-semibold text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-slate-400 shadow-xs"
                                placeholder="Ej: Juan Carlos Perez"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                                    Número de Cédula <span className="text-danger">*</span>
                                </label>
                                <input
                                    required
                                    type="text"
                                    inputMode="numeric"
                                    value={cedula}
                                    onChange={(e) => setCedula(e.target.value.replace(/[^0-9.]/g, ''))}
                                    className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-3.5 text-[12px] font-semibold text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-slate-400 font-mono shadow-xs"
                                    placeholder="Sin puntos ni comas"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider ml-1">Rango</label>
                                <div className="relative">
                                    <select
                                        value={rango}
                                        onChange={(e) => setRango(e.target.value)}
                                        className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-3.5 text-[12px] font-semibold text-slate-900 appearance-none outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs"
                                    >
                                        {RANGOS.map(r => (
                                            <option key={r.value} value={r.value}>{r.label}</option>
                                        ))}
                                    </select>
                                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none notranslate text-sm" translate="no">expand_more</span>
                                </div>
                            </div>
                        </div>

                        {/* ── Módulo de Registro ── */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 shadow-xs">
                            <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary text-base notranslate" translate="no">hub</span>
                                Ubicación Operativa Inicial
                            </p>

                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => { setModulo('activo'); setAsignarPuesto(false); }}
                                    className={`py-2.5 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 border ${modulo === 'activo' ? 'bg-primary/10 border-primary text-primary shadow-xs' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                                >
                                    <span className="material-symbols-outlined text-[18px] notranslate" translate="no">local_police</span>
                                    Fuerza Operativa
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setModulo('disponible'); setAsignarPuesto(false); }}
                                    className={`py-2.5 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 border ${modulo === 'disponible' ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-xs' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                                >
                                    <span className="material-symbols-outlined text-[18px] notranslate" translate="no">group_add</span>
                                    En Disponibilidad
                                </button>
                            </div>

                            {/* ── SECCIÓN OPCIONAL DE ASIGNACIÓN ── */}
                            <div className="pt-1">
                                <button
                                    type="button"
                                    onClick={() => setAsignarPuesto(!asignarPuesto)}
                                    className={`w-full py-2 px-3 rounded-lg flex items-center justify-between border transition-all text-[9px] font-bold uppercase tracking-wider ${asignarPuesto ? 'bg-primary/10 border-primary text-primary' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-sm">{asignarPuesto ? 'expand_more' : 'chevron_right'}</span>
                                        <span>Asignación Rápida a Puesto (Opcional)</span>
                                    </div>
                                    {asignarPuesto && <span className="text-[8px] bg-primary text-white px-2 py-0.5 rounded font-bold">Activo</span>}
                                </button>

                                {asignarPuesto && (
                                    <div className="mt-2.5 p-3 bg-white rounded-lg border border-slate-200 space-y-3 shadow-xs">
                                        <div className="relative">
                                            <select
                                                value={puestoId}
                                                onChange={(e) => setPuestoId(e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-[11px] font-semibold text-slate-900 appearance-none outline-none focus:border-primary"
                                            >
                                                <option value="">Seleccione el puesto destino...</option>
                                                {puestos.map(p => (
                                                    <option key={p.id} value={p.id}>{p.id} - {p.nombre}</option>
                                                ))}
                                            </select>
                                            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none notranslate text-xs" translate="no">expand_more</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                                <label className="text-[8px] font-bold text-slate-500 uppercase ml-1">Entrada</label>
                                                <MilitaryTimeInput value={horaInicio} onChange={val => setHoraInicio(val)}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2.5 text-xs text-slate-900"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[8px] font-bold text-slate-500 uppercase ml-1">Salida</label>
                                                <MilitaryTimeInput value={horaFin} onChange={val => setHoraFin(val)}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2.5 text-xs text-slate-900"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {modulo === 'disponible' && (
                                <div className="space-y-1 animate-in fade-in duration-150">
                                    <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider ml-1">Nota Adicional / Estado</label>
                                    <textarea
                                        value={justificacion}
                                        onChange={e => setJustificacion(e.target.value)}
                                        className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs text-slate-900 outline-none focus:border-primary h-16 resize-none placeholder:text-slate-400 shadow-xs"
                                        placeholder="Motivo de disponibilidad (Ej: Turno pendiente, Licencia...)"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer - Fixed */}
                    <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex gap-3 shrink-0">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="flex-1 py-2.5 bg-white text-slate-600 hover:text-slate-900 font-bold rounded-xl uppercase tracking-wider active:scale-95 transition-all text-[10px] border border-slate-200 shadow-xs"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !nombre.trim() || !cedula.trim() || (asignarPuesto && !puestoId)}
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
