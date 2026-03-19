import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Vigilante, Descargo } from '../../store/vigilanteStore';
import { useVigilanteStore } from '../../store/vigilanteStore';
import { usePuestoStore } from '../../store/puestoStore';
import { ConfirmDialog, useConfirm } from '../ui/ConfirmDialog';

interface GuardDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    guard: Vigilante;
}

type TabType = 'historial' | 'descargos' | 'vacaciones';

const TIPOS_DESCARGO: { value: Descargo['tipo']; label: string; color: string }[] = [
    { value: 'disciplinario', label: 'Disciplinario', color: 'text-red-400 bg-red-400/10 border-red-400/20' },
    { value: 'incidente', label: 'Incidente', color: 'text-orange-400 bg-orange-400/10 border-orange-400/20' },
    { value: 'queja', label: 'Queja de Cliente', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' },
    { value: 'administrativo', label: 'Administrativo', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
];

const GuardDetailModal = ({ isOpen, onClose, guard }: GuardDetailModalProps) => {
    const [activeTab, setActiveTab] = useState<TabType>('historial');

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
        if (!editData.nombre.trim() || !editData.cedula.trim()) return;
        updateVigilante(guard.id, {
            ...editData,
            foto: editData.foto.trim() || undefined,
            telefono: editData.telefono.trim() || undefined,
            email: editData.email.trim() || undefined,
            especialidad: editData.especialidad.trim() || undefined,
        });
        setIsEditing(false);
    };

    const tabCls = (t: TabType) =>
        `flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all rounded-xl ${activeTab === t ? 'bg-primary text-white shadow-md shadow-primary/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`;

    const descargoTipoInfo = (tipo: Descargo['tipo']) =>
        TIPOS_DESCARGO.find(t => t.value === tipo) || TIPOS_DESCARGO[0];

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={onClose}>
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"></div>

            <div
                className="relative w-full max-w-2xl bg-[#0b1424] border border-white/10 rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[92vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-primary/15 to-transparent px-8 py-5 flex items-center justify-between border-b border-white/5 flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="size-14 rounded-2xl overflow-hidden border-2 border-primary/30">
                            {guard.foto
                                ? <img src={guard.foto} alt={guard.nombre} className="w-full h-full object-cover" />
                                : <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-primary text-2xl notranslate" translate="no">person</span>
                                </div>
                            }
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="text-base font-black text-white uppercase tracking-tight">{guard.nombre}</h4>
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
                                    className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-primary hover:bg-primary/10 transition-all active:scale-95"
                                    title="Editar Perfil"
                                >
                                    <span className="material-symbols-outlined text-[16px] notranslate" translate="no">{isEditing ? 'visibility' : 'edit'}</span>
                                </button>
                            </div>
                            <p className="text-[10px] text-primary font-bold uppercase tracking-[0.2em] font-mono">{guard.id} - {guard.rango}</p>
                            <div className="flex items-center gap-3 mt-1.5">
                                <div className="flex items-center gap-2">
                                    <span className={`size-1.5 rounded-full ${guard.estado === 'activo' ? 'bg-success' : guard.estado === 'disponible' ? 'bg-primary' : 'bg-danger'}`}></span>
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{guard.estado}</span>
                                </div>
                                
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
                            className="size-10 rounded-full flex items-center justify-center hover:bg-white/10 text-slate-400 hover:text-white transition-all active:scale-90">
                            <span className="material-symbols-outlined notranslate" translate="no">close</span>
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                {!isEditing && (
                    <div className="px-6 py-3 flex gap-2 border-b border-white/5 flex-shrink-0 bg-black/20">
                        <button className={tabCls('historial')} onClick={() => setActiveTab('historial')}>
                            <span className="material-symbols-outlined text-[14px] mr-1 notranslate align-middle" translate="no">history</span>
                            Historial
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
                        <div className="p-8 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="flex items-center gap-3 mb-2">
                                <span className="size-2 bg-primary rounded-full"></span>
                                <h3 className="text-xs font-black text-white uppercase tracking-[0.3em]">Editar Perfil de Efectivo</h3>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                {/* Nombre */}
                                <div className="space-y-1.5 col-span-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre Completo *</label>
                                    <input
                                        value={editData.nombre}
                                        onChange={e => setEditData({...editData, nombre: e.target.value})}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-sm text-white focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-bold"
                                        placeholder="Ingrese el nombre completo..."
                                    />
                                </div>

                                {/* Cedula */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Cedula Ciudadana *</label>
                                    <input
                                        value={editData.cedula}
                                        onChange={e => setEditData({...editData, cedula: e.target.value})}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-sm text-white focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-mono font-bold"
                                        placeholder="Ej: 1.098.765.432"
                                    />
                                </div>

                                {/* Rango */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Cargo / Rango *</label>
                                    <input
                                        value={editData.rango}
                                        onChange={e => setEditData({...editData, rango: e.target.value})}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-sm text-white focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-bold"
                                        placeholder="Ej: Vigilante Senior"
                                    />
                                </div>

                                {/* Telefono */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Telefono de Contacto</label>
                                    <input
                                        value={editData.telefono}
                                        onChange={e => setEditData({...editData, telefono: e.target.value})}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-sm text-white focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-bold"
                                        placeholder="Ej: +57 321 000 0000"
                                    />
                                </div>

                                {/* Especialidad */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Especialidad Operativa</label>
                                    <input
                                        value={editData.especialidad}
                                        onChange={e => setEditData({...editData, especialidad: e.target.value})}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-sm text-white focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-bold"
                                        placeholder="Ej: Canino, Armado, Escolta"
                                    />
                                </div>

                                {/* Email */}
                                <div className="space-y-1.5 col-span-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Correo Electronico</label>
                                    <input
                                        value={editData.email}
                                        onChange={e => setEditData({...editData, email: e.target.value})}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-sm text-white focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-bold"
                                        placeholder="Ej: operativo@coraza.com"
                                    />
                                </div>

                                {/* Foto URL */}
                                <div className="space-y-1.5 col-span-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">URL de Foto de Perfil</label>
                                    <input
                                        value={editData.foto}
                                        onChange={e => setEditData({...editData, foto: e.target.value})}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-xs text-white focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-mono"
                                        placeholder="https://ejemplo.com/foto.jpg"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    onClick={() => setIsEditing(false)}
                                    className="flex-1 py-4 rounded-2xl border border-white/10 text-slate-400 text-[11px] font-black uppercase tracking-widest hover:bg-white/5 transition-all"
                                >
                                    Descartar Cambios
                                </button>
                                <button
                                    onClick={handleSaveProfile}
                                    className="flex-1 py-4 rounded-2xl bg-primary text-white text-[11px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                                >
                                    Guardar Cambios
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── TAB HISTORIAL ── */}
                    {activeTab === 'historial' && !isEditing && (
                        <div className="p-6">
                            {/* Summary Header */}
                            <div className="flex items-center justify-between mb-5">
                                <div>
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Fecha de Ingreso al Sistema</p>
                                    <p className="text-sm font-black text-white mt-0.5">
                                        {new Date(guard.fechaIngreso).toLocaleDateString('es-CO', { dateStyle: 'long' })}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total Eventos</p>
                                    <p className="text-2xl font-black text-primary">{guard.historial.length}</p>
                                </div>
                            </div>

                            {guard.historial.length > 0 ? (
                                <div className="relative">
                                    <div className="absolute left-5 top-0 bottom-0 w-px bg-gradient-to-b from-primary/40 via-primary/20 to-transparent"></div>
                                    <ul className="space-y-3 pl-14">
                                        {[...guard.historial].reverse().map((event, i) => {
                                            const isAssignment = event.action.toLowerCase().includes('asign') || event.action.toLowerCase().includes('puesto') || event.action.toLowerCase().includes('traslado');
                                            const isRemoval = event.action.toLowerCase().includes('remov') || event.action.toLowerCase().includes('retire') || event.action.toLowerCase().includes('baja');
                                            const isIngreso = event.action.toLowerCase().includes('ingreso') || event.action.toLowerCase().includes('registro');
                                            
                                            let dotColor = 'bg-slate-700';
                                            let textColor = 'text-slate-300';
                                            let icon = 'history';
                                            if (i === 0) { dotColor = 'bg-primary'; textColor = 'text-primary'; icon = 'radio_button_checked'; }
                                            else if (isAssignment) { dotColor = 'bg-success'; textColor = 'text-success'; icon = 'location_on'; }
                                            else if (isRemoval) { dotColor = 'bg-danger'; textColor = 'text-danger'; icon = 'location_off'; }
                                            else if (isIngreso) { dotColor = 'bg-amber-400'; textColor = 'text-amber-400'; icon = 'person_add'; }

                                            return (
                                                <li key={event.id} className="relative">
                                                    <div className={`absolute -left-9 top-1.5 size-4 rounded-full border-2 border-[#0b1424] ${dotColor} flex items-center justify-center`}>
                                                        <span className="material-symbols-outlined text-[8px] text-white notranslate">{icon}</span>
                                                    </div>
                                                    <div className="bg-white/5 border border-white/5 rounded-2xl p-4 hover:border-primary/20 transition-colors">
                                                        <div className="flex justify-between items-start mb-1.5">
                                                            <p className={`text-[11px] font-black uppercase tracking-wider ${textColor}`}>{event.action}</p>
                                                            <span className="text-[9px] font-mono text-slate-600 ml-4 flex-shrink-0 bg-black/20 px-2 py-0.5 rounded-full">
                                                                {new Date(event.timestamp).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                                                            </span>
                                                        </div>
                                                        <p className="text-[11px] text-slate-400 leading-relaxed">{event.details}</p>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            ) : (
                                <div className="text-center py-16 opacity-40">
                                    <span className="material-symbols-outlined text-4xl notranslate" translate="no">history_off</span>
                                    <p className="text-xs font-bold uppercase tracking-widest mt-3">Sin historial registrado</p>
                                    <p className="text-[10px] text-slate-500 mt-1">Los eventos se registran automaticamente al asignar o modificar al vigilante</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── TAB DESCARGOS ── */}
                    {activeTab === 'descargos' && (
                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
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
                                <div className="bg-[#111c44] border border-primary/20 rounded-2xl p-5 space-y-4 animate-in slide-in-from-top-2 duration-300">
                                    <p className="text-[11px] font-black text-primary uppercase tracking-widest">Registrar Descargo</p>

                                    {/* Tipo */}
                                    <div className="grid grid-cols-2 gap-2">
                                        {TIPOS_DESCARGO.map(t => (
                                            <button
                                                key={t.value}
                                                onClick={() => setDescTipo(t.value)}
                                                className={`py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${descTipo === t.value ? t.color : 'border-white/10 text-slate-500 bg-white/3'}`}
                                            >
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Puesto relacionado (opcional) */}
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Puesto Relacionado (opcional)</label>
                                        <select
                                            value={descPuestoId}
                                            onChange={e => setDescPuestoId(e.target.value)}
                                            className="w-full bg-[#0d1a2e] border border-white/8 rounded-xl py-2.5 px-4 text-xs text-white outline-none focus:border-primary/50 appearance-none"
                                        >
                                            <option value="">Sin puesto especifico</option>
                                            {puestos.map(p => <option key={p.id} value={p.id}>{p.id} - {p.nombre}</option>)}
                                        </select>
                                    </div>

                                    {/* Descripcion */}
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Descripcion del Descargo *</label>
                                        <textarea
                                            value={descDescripcion}
                                            onChange={e => setDescDescripcion(e.target.value)}
                                            className="w-full bg-[#0d1a2e] border border-white/8 rounded-xl py-3 px-4 text-xs text-white outline-none focus:border-primary/50 h-20 resize-none"
                                            placeholder="Describa en detalle la situacion..."
                                        />
                                    </div>

                                    <button
                                        onClick={handleAddDescargo}
                                        disabled={!descDescripcion.trim()}
                                        className="w-full py-3 bg-danger text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-danger/80 active:scale-95 transition-all disabled:opacity-40"
                                    >
                                        <span className="material-symbols-outlined text-[14px] mr-1.5 notranslate align-middle" translate="no">gavel</span>
                                        Registrar Descargo
                                    </button>
                                </div>
                            )}

                            {/* Lista de descargos */}
                            {(guard.descargos || []).length === 0 ? (
                                <div className="text-center py-12 opacity-40">
                                    <span className="material-symbols-outlined text-4xl notranslate" translate="no">balance</span>
                                    <p className="text-xs font-bold uppercase tracking-widest mt-3">Sin descargos registrados</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {[...(guard.descargos || [])].reverse().map(d => {
                                        const info = descargoTipoInfo(d.tipo);
                                        return (
                                            <div key={d.id} className={`border rounded-2xl p-4 transition-all ${d.estado === 'resuelto' ? 'border-white/5 bg-white/2 opacity-50' : 'border-white/10 bg-white/5'}`}>
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${info.color}`}>{info.label}</span>
                                                            {d.puestoNombre && <span className="text-[9px] text-slate-500 font-bold bg-slate-800 px-2 py-0.5 rounded-full">{d.puestoNombre}</span>}
                                                            {d.estado === 'resuelto' && <span className="text-[9px] text-success font-bold">✓ Resuelto</span>}
                                                        </div>
                                                        <p className="text-[12px] text-slate-200 font-medium">{d.descripcion}</p>
                                                        <p className="text-[9px] text-slate-600 mt-1.5 font-mono">{new Date(d.fecha).toLocaleDateString('es-CO')}</p>
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
                                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 space-y-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="material-symbols-outlined text-primary notranslate text-xl" translate="no">beach_access</span>
                                        <p className="text-[11px] font-black text-primary uppercase tracking-widest">Periodo Programado</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-[9px] text-slate-500 uppercase font-bold mb-1">Inicio</p>
                                            <p className="text-sm font-bold text-white">{new Date(guard.vacaciones.inicio + 'T12:00:00').toLocaleDateString('es-CO', { dateStyle: 'long' })}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] text-slate-500 uppercase font-bold mb-1">Fin</p>
                                            <p className="text-sm font-bold text-white">{new Date(guard.vacaciones.fin + 'T12:00:00').toLocaleDateString('es-CO', { dateStyle: 'long' })}</p>
                                        </div>
                                    </div>
                                    {guard.vacaciones.motivo && (
                                        <p className="text-xs text-slate-400 italic">{guard.vacaciones.motivo}</p>
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
                                <div className="bg-white/3 border border-white/10 rounded-2xl p-5 text-center">
                                    <span className="material-symbols-outlined text-slate-600 text-3xl notranslate" translate="no">event_available</span>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">Sin vacaciones programadas</p>
                                </div>
                            )}

                            {/* Formulario nueva vacacion */}
                            <button
                                onClick={() => setShowVacForm(!showVacForm)}
                                className="w-full py-3 rounded-xl border border-white/10 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[14px] notranslate" translate="no">{showVacForm ? 'close' : 'add_circle'}</span>
                                {showVacForm ? 'Cancelar' : 'Programar Vacaciones'}
                            </button>

                            {showVacForm && (
                                <div className="bg-[#111c44] border border-primary/20 rounded-2xl p-5 space-y-4 animate-in slide-in-from-top-2 duration-300">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Fecha Inicio *</label>
                                            <input
                                                type="date"
                                                value={vacInicio}
                                                onChange={e => setVacInicio(e.target.value)}
                                                className="w-full bg-[#0d1a2e] border border-white/8 rounded-xl py-2.5 px-4 text-xs text-white outline-none focus:border-primary/50"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Fecha Fin *</label>
                                            <input
                                                type="date"
                                                value={vacFin}
                                                onChange={e => setVacFin(e.target.value)}
                                                className="w-full bg-[#0d1a2e] border border-white/8 rounded-xl py-2.5 px-4 text-xs text-white outline-none focus:border-primary/50"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Motivo (opcional)</label>
                                        <input
                                            value={vacMotivo}
                                            onChange={e => setVacMotivo(e.target.value)}
                                            className="w-full bg-[#0d1a2e] border border-white/8 rounded-xl py-2.5 px-4 text-xs text-white outline-none focus:border-primary/50"
                                            placeholder="Ej: Vacaciones anuales, licencia medica..."
                                        />
                                    </div>
                                    <button
                                        onClick={handleSetVacaciones}
                                        disabled={!vacInicio || !vacFin}
                                        className="w-full py-3 bg-primary text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-primary/80 active:scale-95 transition-all disabled:opacity-40"
                                    >
                                        Programar
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-white/5 flex-shrink-0">
                    <button type="button" onClick={onClose}
                        className="w-full py-3.5 bg-primary text-white font-bold rounded-2xl uppercase tracking-[0.2em] text-[10px] hover:bg-primary/90 active:scale-95 transition-all shadow-lg shadow-primary/20">
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
