import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Vigilante, Descargo } from '../../store/vigilanteStore';
import { useVigilanteStore } from '../../store/vigilanteStore';
import { usePuestoStore } from '../../store/puestoStore';
import { useProgramacionStore } from '../../store/programacionStore';
import { ConfirmDialog, useConfirm } from '../ui/ConfirmDialog';

interface GuardDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    guard: Vigilante;
}

type TabType = 'historial' | 'cronograma' | 'descargos' | 'vacaciones';

const TIPOS_DESCARGO: { value: Descargo['tipo']; label: string; color: string }[] = [
    { value: 'disciplinario', label: 'Disciplinario', color: 'text-red-400 bg-red-400/10 border-red-400/20' },
    { value: 'incidente', label: 'Incidente', color: 'text-orange-400 bg-orange-400/10 border-orange-400/20' },
    { value: 'queja', label: 'Queja de Cliente', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' },
    { value: 'disciplinario', label: 'Disciplinario', color: 'text-red-600 bg-red-50 border-red-200' },
    { value: 'incidente', label: 'Incidente', color: 'text-orange-600 bg-orange-50 border-orange-200' },
    { value: 'queja', label: 'Queja de Cliente', color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
    { value: 'administrativo', label: 'Administrativo', color: 'text-blue-600 bg-blue-50 border-blue-200' },
];

const GuardDetailModal = ({ isOpen, onClose, guard }: GuardDetailModalProps) => {
    const [activeTab, setActiveTab] = useState<TabType>('historial');

    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

    // Descargo form
    const [showDescargoForm, setShowDescargoForm] = useState(false);
    const [descTipo, setDescTipo] = useState<Descargo['tipo']>('disciplinario');
    const [descDescripcion, setDescDescripcion] = useState('');
    const [descPuestoId, setDescPuestoId] = useState('');

    // Vacaciones form
    const [showVacForm, setShowVacForm] = useState(false);
    const [vacInicio, setVacInicio] = useState('');
    const [vacFin, setVacFin] = useState('');
    const [vacMotivo, setVacMotivo] = useState('');

    const puestos = usePuestoStore(s => s.puestos);
    const { addDescargo, resolverDescargo, setVacaciones, cancelarVacaciones, updateVigilante } = useVigilanteStore();
    const { confirm, dialogProps } = useConfirm();

    // Edit Profile form
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({
        nombre: guard.nombre,
        cedula: guard.cedula,
        rango: guard.rango,
        foto: guard.foto || '',
        telefono: guard.telefono || '',
        email: guard.email || '',
        especialidad: guard.especialidad || '',
    });

    useEffect(() => {
        if (isOpen) {
            const today = new Date();
            setSelectedMonth(today.getMonth());
            setSelectedYear(today.getFullYear());
            setActiveTab('historial');
            setIsEditing(false);
            setShowDescargoForm(false);
            setShowVacForm(false);
        }
    }, [isOpen, guard?.id]);

    if (!isOpen) return null;

    const handleAddDescargo = () => {
        if (!descDescripcion.trim()) return;
        addDescargo(guard.id, {
            puestoId: descPuestoId || undefined,
            puestoNombre: descPuestoId ? puestos.find(p => p.id === descPuestoId)?.nombre : undefined,
            fecha: new Date().toISOString(),
            descripcion: descDescripcion.trim(),
            tipo: descTipo,
            estado: 'activo',
        });
        setDescDescripcion('');
        setDescPuestoId('');
        setShowDescargoForm(false);
    };

    const handleSetVacaciones = () => {
        if (!vacInicio || !vacFin) return;
        setVacaciones(guard.id, vacInicio, vacFin, vacMotivo || undefined);
        setShowVacForm(false);
        setVacInicio('');
        setVacFin('');
        setVacMotivo('');
    };

    const handleSaveProfile = () => {
        updateVigilante(guard.id, editData);
        setIsEditing(false);
    };

    const tabCls = (t: TabType) =>
        `flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-all rounded-lg ${activeTab === t ? 'bg-primary text-white shadow-xs' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`;

    const descargoTipoInfo = (tipo: Descargo['tipo']) =>
        TIPOS_DESCARGO.find(t => t.value === tipo) || TIPOS_DESCARGO[0];

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"></div>

            <div
                className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-slate-50 px-6 py-4 flex items-center justify-between border-b border-slate-200 flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="size-14 rounded-2xl overflow-hidden border-2 border-primary/30 bg-slate-100">
                            {guard.foto
                                ? <img src={guard.foto} alt={guard.nombre} className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center">
                                    <span className="material-symbols-outlined text-primary text-2xl notranslate" translate="no">person</span>
                                </div>
                            }
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="text-base font-black text-slate-900 uppercase tracking-tight">{guard.nombre}</h4>
                                <button 
                                    onClick={() => {
                                        setEditData({
                                            nombre: guard.nombre,
                                            cedula: guard.cedula,
                                            rango: guard.rango,
                                            foto: guard.foto || '',
                                            telefono: guard.telefono || '',
                                            email: guard.email || '',
                                            especialidad: guard.especialidad || '',
                                        });
                                        setIsEditing(!isEditing);
                                    }}
                                    className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:text-primary hover:bg-primary/10 transition-all active:scale-95"
                                    title="Editar Perfil"
                                >
                                    <span className="material-symbols-outlined text-[16px] notranslate" translate="no">{isEditing ? 'visibility' : 'edit'}</span>
                                </button>
                            </div>
                            <p className="text-[10px] text-primary font-bold uppercase tracking-[0.2em] font-mono">{guard.id} - {guard.rango}</p>
                            <div className="flex items-center gap-3 mt-1.5">
                                <div className="flex items-center gap-2">
                                    <span className={`size-1.5 rounded-full ${guard.estado === 'activo' ? 'bg-success' : guard.estado === 'disponible' ? 'bg-primary' : guard.estado === 'inactivo' ? 'bg-slate-400' : 'bg-danger'}`}></span>
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{guard.estado === 'inactivo' ? 'Retirado' : guard.estado}</span>
                                </div>
                                
                                {guard.estado !== 'inactivo' && (
                                    <button
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            const newStatus = guard.estado === 'activo' ? 'disponible' : 'activo';
                                            const action = newStatus === 'disponible' ? 'pasar a disponible (reserva)' : 'activar (operativo)';
                                            const ok = await confirm({
                                                title: `${newStatus === 'disponible' ? 'Pasar a Disponible' : 'Activar'} Vigilante`,
                                                message: `¿Confirma que desea ${action} a ${guard.nombre}? Este cambio afectara la cobertura operativa si esta asignado a un puesto.`,
                                                confirmLabel: newStatus === 'disponible' ? 'Pasar a Disponible' : 'Activar Operativo',
                                                variant: newStatus === 'disponible' ? 'warning' : 'success',
                                                requireInput: newStatus === 'disponible',
                                                inputPlaceholder: 'Indique el motivo por el cual este operativo pasa a estar disponible...',
                                            });
                                            if (ok) {
                                                useVigilanteStore.getState().updateGuardStatus(guard.id, newStatus, undefined, typeof ok === 'string' ? ok : undefined);
                                            }
                                        }}
                                        className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest transition-all ${guard.estado === 'activo' ? 'bg-warning/20 text-warning hover:bg-warning/30 border border-warning/20' : 'bg-success/20 text-success hover:bg-success/30 border border-success/20'}`}
                                    >
                                        {guard.estado === 'activo' ? 'Pasar a Disponible' : 'Pasar a Operativo'}
                                    </button>
                                )}

                                {guard.justificacionDisponible && (
                                    <span className="text-[9px] text-slate-600 italic">| {guard.justificacionDisponible}</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {isEditing && (
                             <button
                                onClick={handleSaveProfile}
                                className="bg-success text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-success/80 transition-all flex items-center gap-1.5 shadow-lg shadow-success/20"
                            >
                                <span className="material-symbols-outlined text-[16px] notranslate" translate="no">save</span>
                                Guardar
                            </button>
                        )}
                        <button type="button" onClick={onClose}
                            className="size-10 rounded-full flex items-center justify-center hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-all active:scale-90">
                            <span className="material-symbols-outlined notranslate" translate="no">close</span>
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                {!isEditing && (
                    <div className="px-6 py-2.5 flex gap-2 border-b border-slate-200 flex-shrink-0 bg-slate-50">
                        <button className={tabCls('historial')} onClick={() => setActiveTab('historial')}>
                            <span className="material-symbols-outlined text-[14px] mr-1 notranslate align-middle" translate="no">history</span>
                            Novedades
                        </button>
                        <button className={tabCls('cronograma')} onClick={() => setActiveTab('cronograma')}>
                            <span className="material-symbols-outlined text-[14px] mr-1 notranslate align-middle" translate="no">calendar_month</span>
                            Asignaciones
                        </button>
                        <button className={tabCls('descargos')} onClick={() => setActiveTab('descargos')}>
                            <span className="material-symbols-outlined text-[14px] mr-1 notranslate align-middle" translate="no">gavel</span>
                            Descargos
                            {(guard.descargos || []).filter(d => d.estado === 'activo').length > 0 && (
                                <span className="ml-1.5 size-4 rounded-full bg-danger text-white text-[9px] font-black inline-flex items-center justify-center">
                                    {(guard.descargos || []).filter(d => d.estado === 'activo').length}
                                </span>
                            )}
                        </button>
                        <button className={tabCls('vacaciones')} onClick={() => setActiveTab('vacaciones')}>
                            <span className="material-symbols-outlined text-[14px] mr-1 notranslate align-middle" translate="no">beach_access</span>
                            Vacaciones
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {/* ── EDIT FORM ── */}
                    {isEditing && (
                        <div className="p-8 space-y-6 animate-in fade-in duration-300">
                            <div className="flex items-center gap-3 mb-2">
                                <span className="size-2 bg-primary rounded-full"></span>
                                <h3 className="text-xs font-black text-slate-800 uppercase tracking-[0.3em]">Editar Perfil de Efectivo</h3>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                {/* Nombre */}
                                <div className="space-y-1.5 col-span-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Nombre Completo *</label>
                                    <input
                                        value={editData.nombre}
                                        onChange={e => setEditData({...editData, nombre: e.target.value})}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-xs text-slate-900 focus:outline-none focus:border-primary/50 transition-all font-bold"
                                        placeholder="Ingrese el nombre completo..."
                                    />
                                </div>

                                {/* Cedula */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Cedula Ciudadana *</label>
                                    <input
                                        value={editData.cedula}
                                        onChange={e => setEditData({...editData, cedula: e.target.value})}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-xs text-slate-900 focus:outline-none focus:border-primary/50 transition-all font-mono font-bold"
                                        placeholder="Ej: 1.098.765.432"
                                    />
                                </div>

                                {/* Rango */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Cargo / Rango *</label>
                                    <input
                                        value={editData.rango}
                                        onChange={e => setEditData({...editData, rango: e.target.value})}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-xs text-slate-900 focus:outline-none focus:border-primary/50 transition-all font-bold"
                                        placeholder="Ej: Vigilante Senior"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── TAB CRONOGRAMA (DIARIO) ── */}
                    {activeTab === 'cronograma' && !isEditing && (
                        <div className="p-6">
                            {(() => {
                                const myAssignments = useProgramacionStore.getState().getAssignmentsForVigilante(guard.id, selectedYear, selectedMonth);
                                
                                const totalDias = myAssignments.filter(a => a.jornada === 'normal').length;
                                const totalDescansos = myAssignments.filter(a => a.jornada?.includes('descanso')).length;
                                const totalVacas = myAssignments.filter(a => a.jornada === 'vacacion').length;

                                const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

                                return (
                                    <>
                                        {/* Selector de Periodo */}
                                        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                            <div className="flex items-center gap-3">
                                                <div className="flex flex-col">
                                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Año</label>
                                                    <select
                                                        value={selectedYear}
                                                        onChange={e => setSelectedYear(parseInt(e.target.value))}
                                                        className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-primary shadow-xs"
                                                    >
                                                        {[-2, -1, 0, 1].map(offset => {
                                                            const yr = new Date().getFullYear() + offset;
                                                            return <option key={yr} value={yr}>{yr}</option>;
                                                        })}
                                                    </select>
                                                </div>
                                                <div className="flex flex-col">
                                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Mes</label>
                                                    <select
                                                        value={selectedMonth}
                                                        onChange={e => setSelectedMonth(parseInt(e.target.value))}
                                                        className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-primary shadow-xs"
                                                    >
                                                        {MESES.map((mName, idx) => (
                                                            <option key={idx} value={idx}>{mName}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => window.print()} 
                                                className="h-9 px-4 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-700 shadow-xs transition-all active:scale-95 flex items-center gap-1.5"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">print</span>
                                                Exportar PDF
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-3 gap-3 mb-6">
                                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                                                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-1">Días Laborados</p>
                                                <p className="text-xl font-bold text-slate-800">{totalDias}</p>
                                            </div>
                                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                                                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-1">Descansos</p>
                                                <p className="text-xl font-bold text-primary">{totalDescansos}</p>
                                            </div>
                                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                                                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-1">Otros / Vacac.</p>
                                                <p className="text-xl font-bold text-amber-600">{totalVacas}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between mb-4 px-1">
                                            <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Detalle de Operaciones · {MESES[selectedMonth].toUpperCase()} {selectedYear}</h5>
                                        </div>

                                        {myAssignments.length === 0 ? (
                                            <div className="text-center py-16 opacity-50 border border-dashed border-slate-200 rounded-2xl">
                                                <span className="material-symbols-outlined text-4xl text-slate-400 notranslate" translate="no">event_note</span>
                                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mt-3">Sin asignaciones registradas en este periodo</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {myAssignments.map((asig, idx) => {
                                                    const isRest = asig.jornada?.includes('descanso');
                                                    const isVaca = asig.jornada === 'vacacion';
                                                    
                                                    return (
                                                        <div key={`${asig.dia}-${idx}`} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-4 hover:border-primary/20 transition-all">
                                                            <div className={`size-11 rounded-lg flex flex-col items-center justify-center border shrink-0 ${isRest ? 'bg-indigo-50 border-indigo-100' : isVaca ? 'bg-amber-50 border-amber-100' : 'bg-primary/5 border-primary/10'}`}>
                                                                <span className={`text-[8px] font-bold uppercase opacity-60 ${isRest ? 'text-indigo-600' : isVaca ? 'text-amber-700' : 'text-primary'}`}>Día</span>
                                                                <span className={`text-base font-bold leading-none ${isRest ? 'text-indigo-600' : isVaca ? 'text-amber-700' : 'text-primary'}`}>{asig.dia}</span>
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-0.5">
                                                                    <span className="text-[11px] font-bold text-slate-800 truncate uppercase tracking-tight">{asig.puestoNombre}</span>
                                                                    {isRest && <span className="text-[8px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded uppercase font-bold">Descanso</span>}
                                                                    {isVaca && <span className="text-[8px] bg-amber-50 text-amber-700 border border-amber-100 px-1.5 py-0.5 rounded uppercase font-bold">Vacación</span>}
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    <div className="flex items-center gap-1 text-slate-500">
                                                                        <span className="material-symbols-outlined text-[12px] notranslate" translate="no">schedule</span>
                                                                        <span className="text-[10px] font-semibold capitalize">{asig.jornada === 'normal' ? (asig.turno || 'General') : asig.jornada.replace(/_/g, ' ')}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1 text-slate-500">
                                                                        <span className="material-symbols-outlined text-[12px] notranslate" translate="no">stars</span>
                                                                        <span className="text-[10px] font-semibold uppercase tracking-tighter">{asig.rol?.replace(/_/g, ' ') || 'Titular'}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    )}

                    {/* ── TAB HISTORIAL ── */}
                    {activeTab === 'historial' && !isEditing && (
                        <div className="p-6">
                            {/* Summary Header */}
                            <div className="flex items-center justify-between mb-5">
                                <div>
                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Fecha de Ingreso al Sistema</p>
                                    <p className="text-sm font-bold text-slate-800 mt-0.5">
                                        {new Date(guard.fechaIngreso).toLocaleDateString('es-CO', { dateStyle: 'long' })}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Total Eventos</p>
                                    <p className="text-2xl font-bold text-primary">{guard.historial.length}</p>
                                </div>
                            </div>

                            {guard.historial.length > 0 ? (
                                <div className="relative">
                                    <div className="absolute left-5 top-0 bottom-0 w-px bg-gradient-to-b from-primary/30 to-transparent"></div>
                                    <ul className="space-y-3 pl-14">
                                        {[...guard.historial].reverse().map((event, i) => {
                                            const isAssignment = event.action.toLowerCase().includes('asign') || event.action.toLowerCase().includes('puesto') || event.action.toLowerCase().includes('traslado');
                                            const isRemoval = event.action.toLowerCase().includes('remov') || event.action.toLowerCase().includes('retire') || event.action.toLowerCase().includes('baja');
                                            const isIngreso = event.action.toLowerCase().includes('ingreso') || event.action.toLowerCase().includes('registro');
                                            
                                            let dotColor = 'bg-slate-300';
                                            let textColor = 'text-slate-700';
                                            let icon = 'history';
                                            if (i === 0) { dotColor = 'bg-primary'; textColor = 'text-primary'; icon = 'radio_button_checked'; }
                                            else if (isAssignment) { dotColor = 'bg-success'; textColor = 'text-success'; icon = 'location_on'; }
                                            else if (isRemoval) { dotColor = 'bg-danger'; textColor = 'text-danger'; icon = 'location_off'; }
                                            else if (isIngreso) { dotColor = 'bg-amber-400'; textColor = 'text-amber-400'; icon = 'person_add'; }

                                            return (
                                                <li key={event.id} className="relative">
                                                    <div className={`absolute -left-9 top-1.5 size-4 rounded-full border-2 border-white ${dotColor} flex items-center justify-center`}>
                                                        <span className="material-symbols-outlined text-[8px] text-white notranslate">{icon}</span>
                                                    </div>
                                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 hover:border-primary/20 transition-colors">
                                                        <div className="flex justify-between items-start mb-1.5">
                                                            <p className={`text-[11px] font-bold uppercase tracking-wider ${textColor}`}>{event.action}</p>
                                                            <span className="text-[9px] font-mono text-slate-500 ml-4 flex-shrink-0 bg-slate-200 px-2 py-0.5 rounded-full">
                                                                {new Date(event.timestamp).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                                                            </span>
                                                        </div>
                                                        <p className="text-[11px] text-slate-600 leading-relaxed font-medium">{event.details}</p>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            ) : (
                                <div className="text-center py-16 opacity-50 border border-dashed border-slate-200 rounded-2xl">
                                    <span className="material-symbols-outlined text-4xl text-slate-400 notranslate" translate="no">history_off</span>
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mt-3">Sin historial registrado</p>
                                    <p className="text-[10px] text-slate-500 mt-1">Los eventos se registran automáticamente al realizar cambios</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── TAB DESCARGOS ── */}
                    {activeTab === 'descargos' && (
                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    {(guard.descargos || []).length} descargo(s) registrado(s)
                                </p>
                                <button
                                    onClick={() => setShowDescargoForm(!showDescargoForm)}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all"
                                >
                                    <span className="material-symbols-outlined text-[14px] notranslate" translate="no">{showDescargoForm ? 'close' : 'add'}</span>
                                    {showDescargoForm ? 'Cancelar' : 'Nuevo Descargo'}
                                </button>
                            </div>

                            {/* Formulario nuevo descargo */}
                            {showDescargoForm && (
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                    <p className="text-[11px] font-bold text-primary uppercase tracking-wider">Registrar Descargo</p>

                                    {/* Tipo */}
                                    <div className="grid grid-cols-2 gap-2">
                                        {TIPOS_DESCARGO.map(t => (
                                            <button
                                                key={t.value}
                                                onClick={() => setDescTipo(t.value)}
                                                className={`py-2 px-3 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all ${descTipo === t.value ? t.color : 'border-slate-200 text-slate-500 bg-white hover:bg-slate-100'}`}
                                            >
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Puesto relacionado (opcional) */}
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider ml-1">Puesto Relacionado (opcional)</label>
                                        <select
                                            value={descPuestoId}
                                            onChange={e => setDescPuestoId(e.target.value)}
                                            className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-900 outline-none focus:border-primary shadow-xs"
                                        >
                                            <option value="">Sin puesto especifico</option>
                                            {puestos.map(p => <option key={p.id} value={p.id}>{p.id} - {p.nombre}</option>)}
                                        </select>
                                    </div>

                                    {/* Descripcion */}
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider ml-1">Descripcion del Descargo *</label>
                                        <textarea
                                            value={descDescripcion}
                                            onChange={e => setDescDescripcion(e.target.value)}
                                            className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-900 outline-none focus:border-primary h-20 resize-none shadow-xs"
                                            placeholder="Describa en detalle la situacion..."
                                        />
                                    </div>

                                    <button
                                        onClick={handleAddDescargo}
                                        disabled={!descDescripcion.trim()}
                                        className="w-full py-2 bg-danger text-white font-bold text-[10px] uppercase tracking-wider rounded-xl hover:bg-danger/90 active:scale-95 transition-all disabled:opacity-40"
                                    >
                                        Registrar Descargo
                                    </button>
                                </div>
                            )}

                            {/* Lista de descargos */}
                            {(guard.descargos || []).length === 0 ? (
                                <div className="text-center py-12 opacity-50 border border-dashed border-slate-200 rounded-2xl">
                                    <span className="material-symbols-outlined text-4xl text-slate-400 notranslate" translate="no">balance</span>
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mt-3">Sin descargos registrados</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {[...(guard.descargos || [])].reverse().map(d => {
                                        const info = descargoTipoInfo(d.tipo);
                                        return (
                                            <div key={d.id} className={`border rounded-xl p-4 transition-all ${d.estado === 'resuelto' ? 'border-slate-200 bg-slate-50/50 opacity-60' : 'border-slate-200 bg-white shadow-xs'}`}>
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                            <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${info.color}`}>{info.label}</span>
                                                            {d.puestoNombre && <span className="text-[9px] text-slate-600 font-bold bg-slate-100 px-2 py-0.5 rounded-full">{d.puestoNombre}</span>}
                                                            {d.estado === 'resuelto' && <span className="text-[9px] text-success font-bold">✓ Resuelto</span>}
                                                        </div>
                                                        <p className="text-[12px] text-slate-700 font-medium leading-relaxed">{d.descripcion}</p>
                                                        <p className="text-[9px] text-slate-500 mt-2 font-mono">{new Date(d.fecha).toLocaleDateString('es-CO')}</p>
                                                    </div>
                                                    {d.estado === 'activo' && (
                                                        <button
                                                            onClick={() => resolverDescargo(guard.id, d.id)}
                                                            className="shrink-0 px-3 py-1.5 rounded-xl bg-success/10 border border-success/20 text-success text-[9px] font-black uppercase tracking-wider hover:bg-success/20 transition-all"
                                                        >
                                                            Resolver
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── TAB VACACIONES ── */}
                    {activeTab === 'vacaciones' && (
                        <div className="p-6 space-y-4">
                            {/* Vacaciones actuales */}
                            {guard.vacaciones ? (
                                <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 space-y-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="material-symbols-outlined text-primary notranslate text-xl" translate="no">beach_access</span>
                                        <p className="text-[11px] font-bold text-primary uppercase tracking-wider">Periodo Programado</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Inicio</p>
                                            <p className="text-sm font-bold text-slate-800">{new Date(guard.vacaciones.inicio + 'T12:00:00').toLocaleDateString('es-CO', { dateStyle: 'long' })}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Fin</p>
                                            <p className="text-sm font-bold text-slate-800">{new Date(guard.vacaciones.fin + 'T12:00:00').toLocaleDateString('es-CO', { dateStyle: 'long' })}</p>
                                        </div>
                                    </div>
                                    {guard.vacaciones.motivo && (
                                        <p className="text-xs text-slate-500 italic font-medium">{guard.vacaciones.motivo}</p>
                                    )}
                                    <button
                                        onClick={() => cancelarVacaciones(guard.id)}
                                        className="w-full py-2.5 bg-danger/10 border border-danger/20 text-danger rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-danger/20 transition-all mt-2"
                                    >
                                        <span className="material-symbols-outlined text-[13px] mr-1 notranslate align-middle" translate="no">event_busy</span>
                                        Cancelar Vacaciones
                                    </button>
                                </div>
                            ) : (
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-center">
                                    <span className="material-symbols-outlined text-slate-400 text-3xl notranslate" translate="no">event_available</span>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">Sin vacaciones programadas</p>
                                </div>
                            )}

                            {/* Formulario nueva vacacion */}
                            <button
                                onClick={() => setShowVacForm(!showVacForm)}
                                className="w-full py-3 rounded-xl border border-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-wider hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[14px] notranslate" translate="no">{showVacForm ? 'close' : 'add_circle'}</span>
                                {showVacForm ? 'Cancelar' : 'Programar Vacaciones'}
                            </button>

                            {showVacForm && (
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider ml-1">Fecha Inicio *</label>
                                            <input
                                                type="date"
                                                value={vacInicio}
                                                onChange={e => setVacInicio(e.target.value)}
                                                className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-900 outline-none focus:border-primary shadow-xs"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider ml-1">Fecha Fin *</label>
                                            <input
                                                type="date"
                                                value={vacFin}
                                                onChange={e => setVacFin(e.target.value)}
                                                className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-900 outline-none focus:border-primary shadow-xs"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider ml-1">Motivo (opcional)</label>
                                        <input
                                            value={vacMotivo}
                                            onChange={e => setVacMotivo(e.target.value)}
                                            className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-900 outline-none focus:border-primary shadow-xs"
                                            placeholder="Ej: Vacaciones anuales, licencia medica..."
                                        />
                                    </div>
                                    <button
                                        onClick={handleSetVacaciones}
                                        disabled={!vacInicio || !vacFin}
                                        className="w-full py-3 bg-primary text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-primary/80 active:scale-95 transition-all disabled:opacity-40 shadow-md"
                                    >
                                        Programar
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-slate-200 flex-shrink-0 bg-slate-50">
                    <button type="button" onClick={onClose}
                        className="w-full py-3 bg-primary text-white font-bold rounded-xl uppercase tracking-wider text-[10px] hover:bg-primary/95 active:scale-95 transition-all shadow-md shadow-primary/10">
                        Cerrar Ficha
                    </button>
                </div>
            </div>

            <ConfirmDialog {...dialogProps} />
        </div>,
        document.body
    );
};

export default GuardDetailModal;
