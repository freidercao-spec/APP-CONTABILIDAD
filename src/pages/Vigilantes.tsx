import { useState, useEffect } from 'react';
import { useVigilanteStore } from '../store/vigilanteStore';
import GuardModal from '../components/guards/GuardModal';
import GuardDetailModal from '../components/guards/GuardDetailModal';
import { ConfirmDialog, useConfirm } from '../components/ui/ConfirmDialog';

interface VigilanteProps {
    defaultTab?: 'activos' | 'reserva';
}

const Vigilantes = ({ defaultTab = 'activos' }: VigilanteProps) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'activos' | 'reserva'>(defaultTab);
    const [selectedGuardId, setSelectedGuardId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const { confirm, dialogProps } = useConfirm();

    useEffect(() => {
        setActiveTab(defaultTab);
    }, [defaultTab]);

    const vigilantes = useVigilanteStore((state) => state.vigilantes);
    const updateGuardStatus = useVigilanteStore((state) => state.updateGuardStatus);
    const deleteVigilante = useVigilanteStore((state) => state.deleteVigilante);

    const [page, setPage] = useState(1);
    const PAGE_SIZE = 18;

    const filteredVigilantes = vigilantes
        .filter(v => {
            if (activeTab === 'activos') return v.estado === 'activo';
            if (activeTab === 'reserva') return v.estado === 'disponible';
            return false;
        })
        .filter(v =>
            searchQuery === '' ||
            v.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
            v.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            v.cedula.includes(searchQuery)
        );

    const pagedVigilantes = filteredVigilantes.slice(0, page * PAGE_SIZE);
    const hasMore = pagedVigilantes.length < filteredVigilantes.length;

    const selectedGuard = vigilantes.find(v => v.id === selectedGuardId) ?? (pagedVigilantes.length > 0 ? pagedVigilantes[0] : null);

    const handleCardClick = (id: string) => {
        setSelectedGuardId(id);
    };

    const handleViewProfile = () => {
        if (!selectedGuard) return;
        setIsDetailModalOpen(true);
    };

    const handleToggleStatus = async () => {
        if (!selectedGuard) return;
        const newStatus = selectedGuard.estado === 'activo' ? 'disponible' : 'activo';
        const action = newStatus === 'disponible' ? 'pasar a disponible (reserva)' : 'activar (operativo)';
        const ok = await confirm({
            title: `${newStatus === 'disponible' ? 'Pasar a Disponible' : 'Activar'} Vigilante`,
            message: `¿Confirma que desea ${action} a ${selectedGuard.nombre}? Este cambio afectara la cobertura operativa si esta asignado a un puesto.`,
            confirmLabel: newStatus === 'disponible' ? 'Pasar a Disponible' : 'Activar Operativo',
            variant: newStatus === 'disponible' ? 'warning' : 'success',
            requireInput: newStatus === 'disponible',
            inputPlaceholder: 'Indique el motivo por el cual este operativo pasa a estar disponible...',
        });
        if (ok) {
            useVigilanteStore.getState().updateGuardStatus(selectedGuard.id, newStatus, undefined, typeof ok === 'string' ? ok : undefined);
        }
    };

    const handleDeleteGuard = async () => {
        if (!selectedGuard) return;
        const ok = await confirm({
            title: 'Dar de Baja Vigilante',
            message: `¿Esta seguro de eliminar permanentemente a ${selectedGuard.nombre} (${selectedGuard.id})? Esta accion no se puede deshacer y el registro se perdera.`,
            confirmLabel: 'Si, dar de baja',
            variant: 'danger',
        });
        if (ok) {
            const currentIdx = filteredVigilantes.findIndex(v => v.id === selectedGuard.id);
            deleteVigilante(selectedGuard.id);
            const remaining = vigilantes.filter(v => v.id !== selectedGuard.id);
            if (remaining.length > 0) {
                const next = remaining[Math.min(currentIdx, remaining.length - 1)];
                setSelectedGuardId(next?.id || null);
            } else {
                setSelectedGuardId(null);
            }
        }
    };

    const countByStatus = (status: typeof vigilantes[0]['estado']) =>
        vigilantes.filter(v => v.estado === status).length;

    return (
        <div className="page-container animate-in fade-in duration-500 pb-24">
            {/* Action Bar - Tactical Header */}
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-8 mb-10 px-2">
                {/* Title Section */}
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="size-2 bg-primary animate-pulse rounded-full shadow-[0_0_10px_rgba(67,24,255,0.5)]"></span>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em]">Carga Operativa v3.2</p>
                    </div>
                    <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Control de <span className="text-primary">Efectivos</span></h3>
                </div>

                {/* Controls Section (Tactical Dark Panel) */}
                <div className="flex flex-col md:flex-row items-center gap-2 bg-[#111c44] p-3 rounded-[32px] border border-[#1b254b] shadow-[0_20px_50px_-15px_rgba(17,28,68,0.5)]">
                    {/* Search */}
                    <div className="relative group w-full md:w-auto">
                        <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 text-[20px] group-focus-within:text-white transition-colors notranslate pointer-events-none" translate="no">search</span>
                        <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="bg-black/20 border border-white/5 rounded-[24px] py-4 pl-14 pr-6 text-[13px] font-bold focus:outline-none focus:bg-white/10 focus:border-primary/50 focus:ring-4 focus:ring-primary/20 placeholder:text-slate-500 text-white w-full md:w-[280px] transition-all"
                            placeholder="Buscar operativo o ID..."
                        />
                    </div>

                    <div className="w-px h-8 bg-white/10 hidden md:block mx-2"></div>

                    {/* Filter Tabs */}
                    <div className="bg-black/20 p-1.5 rounded-[24px] flex w-full md:w-auto border border-white/5">
                        {(['activos', 'reserva'] as const).map(tab => (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 md:flex-none px-6 py-3 text-[11px] font-black rounded-xl transition-all uppercase tracking-widest select-none flex items-center justify-center gap-2.5 ${activeTab === tab ? 'bg-primary text-white shadow-lg shadow-primary/30 ring-1 ring-white/10' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                            >
                                <span className={`size-1.5 rounded-full ${tab === 'activos' ? 'bg-success' : 'bg-warning'} ${activeTab === tab ? 'animate-pulse shadow-sm' : 'opacity-40'}`}></span>
                                {tab === 'activos' ? `En Campo (${countByStatus('activo')})` :
                                    `Disponibles (${countByStatus('disponible')})`}
                            </button>
                        ))}
                    </div>

                    <div className="w-px h-8 bg-white/10 hidden md:block mx-2"></div>

                    {/* Add Button */}
                    <button
                        type="button"
                        onClick={() => setIsModalOpen(true)}
                        className="bg-primary hover:bg-primary-light text-white flex items-center justify-center gap-3 h-[52px] px-8 rounded-[24px] select-none shadow-[0_10px_25px_rgba(67,24,255,0.4)] transition-all active:scale-95 w-full md:w-auto border border-white/10 font-bold text-[13px]"
                    >
                        <span className="material-symbols-outlined text-[20px] notranslate" translate="no">person_add</span>
                        Nuevo
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
                {/* Left Column - Guard Detail (Elite Profile) */}
                <div className="xl:col-span-4 space-y-6">
                    {selectedGuard ? (
                        <div className="horizon-card p-10 flex flex-col items-center text-center relative group shadow-2xl border-none">
                            {/* Decorative Mesh */}
                            <div className="absolute inset-0 bg-[var(--mesh-gradient)] opacity-30 pointer-events-none"></div>

                            {/* Status Badge - Tactical Grade */}
                            <div className="absolute top-6 right-6 z-10">
                                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 ${selectedGuard.estado === 'activo' ? 'bg-success/10 text-success border-success/30' : selectedGuard.estado === 'ausente' ? 'bg-danger/10 text-danger border-danger/30' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                    <span className={`size-2 rounded-full ${selectedGuard.estado === 'activo' ? 'bg-success glow-active' : selectedGuard.estado === 'ausente' ? 'bg-danger' : 'bg-slate-400'}`}></span>
                                    {selectedGuard.estado === 'activo' ? 'Operativo' : selectedGuard.estado === 'disponible' ? 'En Base' : 'No Localizado'}
                                </span>
                            </div>

                            {/* Photo */}
                            <div className="relative mb-6 mt-4">
                                <div className="size-36 rounded-2xl overflow-hidden bg-slate-50 border-4 border-white shadow-xl ring-1 ring-slate-100 p-1">
                                    <img
                                        className="w-full h-full rounded-xl object-cover"
                                        src={selectedGuard.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedGuard.nombre)}&background=F1F5F9&color=137FEC`}
                                        alt={selectedGuard.nombre}
                                    />
                                </div>
                                <div className="absolute -bottom-2 -right-2 size-10 rounded-full bg-primary flex items-center justify-center border-4 border-white shadow-lg">
                                    <span className="material-symbols-outlined text-white text-[18px] notranslate" translate="no">verified</span>
                                </div>
                            </div>

                            <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-2 uppercase">{selectedGuard.nombre}</h2>
                            <p className="text-primary font-black uppercase text-[11px] tracking-[0.3em] bg-primary/5 px-4 py-1.5 rounded-full">{selectedGuard.rango} • <span className="font-mono text-slate-500 font-bold">{selectedGuard.id}</span></p>

                            {/* Info Row */}
                            <div className="mt-10 w-full bg-slate-50 border border-slate-200/50 rounded-[32px] p-8 space-y-5 text-left shadow-inner">
                                <InfoRow label="Cedula Ciudadana" value={selectedGuard.cedula} mono />
                                <InfoRow label="Incorporacion" value={new Date(selectedGuard.fechaIngreso).toLocaleDateString('es-CO', { dateStyle: 'long' })} />
                                <InfoRow label="Ultima Actividad" value={(selectedGuard.historial || [])[((selectedGuard.historial || []).length || 1) - 1]?.action ?? '-'} highlight />
                            </div>

                            {/* Action Buttons */}
                            <div className="grid grid-cols-2 gap-4 w-full mt-6">
                                <button
                                    type="button"
                                    onClick={handleToggleStatus}
                                    className={`flex items-center justify-center gap-2.5 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 select-none border-2 ${selectedGuard.estado === 'activo' ? 'bg-warning/5 text-warning border-warning/20 hover:bg-warning/10' : 'bg-success/5 text-success border-success/20 hover:bg-success/10'}`}
                                >
                                    <span className="material-symbols-outlined text-[18px] notranslate" translate="no">
                                        {selectedGuard.estado === 'activo' ? 'event_available' : 'play_circle'}
                                    </span>
                                    {selectedGuard.estado === 'activo' ? 'Pasar a Disponible' : 'Activar en Puesto'}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleViewProfile}
                                    className="flex items-center justify-center gap-2 bg-primary text-white py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 select-none hover:bg-primary/90 shadow-lg shadow-primary/20"
                                >
                                    <span className="material-symbols-outlined text-[18px] notranslate" translate="no">description</span>
                                    Ver Detalles
                                </button>
                            </div>

                            {/* Danger Zone */}
                            <button
                                type="button"
                                onClick={handleDeleteGuard}
                                className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-bold text-slate-600 hover:text-danger hover:bg-danger/5 transition-all uppercase tracking-widest active:scale-95 select-none border border-transparent hover:border-danger/20"
                            >
                                <span className="material-symbols-outlined text-[16px] notranslate" translate="no">delete</span>
                                Dar de baja
                            </button>
                        </div>
                    ) : (
                        <div className="glass-panel rounded-2xl p-12 text-center flex flex-col items-center justify-center opacity-40 border border-white/5">
                            <span className="material-symbols-outlined text-5xl mb-4 notranslate" translate="no">person_off</span>
                            <p className="text-[10px] font-bold uppercase tracking-widest">Sin personal registrado</p>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(true)}
                                className="mt-6 opacity-100 bg-primary text-white px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-primary/90 transition-all active:scale-95"
                            >
                                + Registrar primer vigilante
                            </button>
                        </div>
                    )}

                    {/* AI Insight */}
                    <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                        <div className="flex items-center gap-3 mb-4">
                            <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                                <span className="material-symbols-outlined text-[20px] notranslate" translate="no">psychology</span>
                            </div>
                            <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Resumen Operativo IA</h4>
                        </div>
                        <p className="text-[12px] text-slate-500 leading-relaxed font-medium">
                            {countByStatus('activo') > 0
                                ? `${countByStatus('activo')} unidades en campo. ${countByStatus('disponible')} en base. Fuerza operativa al ${Math.round((countByStatus('activo') / (vigilantes.length || 1)) * 100)}%.`
                                : 'Sin despliegues activos. Registre personal para iniciar gestion operativa.'}
                        </p>
                    </div>
                </div>

                {/* Right Column - Board */}
                <div className="xl:col-span-8 flex flex-col gap-5">
                    <div className="flex items-center gap-4 px-1">
                        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] whitespace-nowrap">Tablero de Fichas</h2>
                        <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent"></div>
                        <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-3 py-1 rounded-full">{filteredVigilantes.length} resultados</span>
                    </div>

                    {filteredVigilantes.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {pagedVigilantes.map((v) => (
                                <button
                                    key={v.id}
                                    type="button"
                                    onClick={() => handleCardClick(v.id)}
                                    className={`glass-tactical rounded-[32px] p-6 flex items-center gap-5 cursor-pointer transition-all hover:shadow-2xl active:scale-95 group text-left w-full border-2 ${selectedGuard?.id === v.id ? 'border-primary shadow-xl shadow-primary/20' : 'border-transparent hover:border-slate-200'}`}
                                >
                                    <div className="relative flex-shrink-0">
                                        <div className="size-20 rounded-[24px] overflow-hidden border-4 border-white group-hover:border-primary/20 transition-all shadow-lg">
                                            <img
                                                className="w-full h-full object-cover"
                                                src={v.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(v.nombre)}&background=F1F5F9&color=137FEC`}
                                                alt={v.nombre}
                                            />
                                        </div>
                                        <div className={`absolute -bottom-1 -right-1 size-6 rounded-full border-4 border-white ${v.estado === 'activo' ? 'bg-success glow-active' : v.estado === 'ausente' ? 'bg-danger' : 'bg-slate-300'} shadow-sm`}></div>
                                    </div>
                                    <div className="overflow-hidden text-left flex-1 min-w-0 z-10">
                                        <h4 className="text-slate-900 font-black text-[15px] truncate uppercase tracking-tight mb-1">{v.nombre}</h4>
                                        <p className="text-primary font-black text-[10px] uppercase tracking-[0.2em]">{v.rango}</p>
                                        <p className="text-slate-400 text-[9px] font-mono mt-1 font-bold">{v.id}</p>
                                    </div>
                                </button>
                            ))}

                            {hasMore && (
                                <button
                                    onClick={() => setPage(p => p + 1)}
                                    className="col-span-1 md:col-span-2 lg:col-span-3 py-6 bg-slate-50 border border-slate-200 rounded-3xl text-slate-500 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-white hover:text-primary transition-all active:scale-95"
                                >
                                    Cargar Mas Operativos...
                                </button>
                            )}

                            {/* Add New Card */}
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(true)}
                                className="bg-slate-50 rounded-3xl p-5 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-200 hover:border-primary hover:bg-white transition-all active:scale-95 cursor-pointer min-h-[110px] group shadow-inner"
                            >
                                <div className="size-10 rounded-full bg-white flex items-center justify-center border border-slate-100 shadow-sm group-hover:bg-primary group-hover:text-white transition-all">
                                    <span className="material-symbols-outlined text-[24px] notranslate" translate="no">add</span>
                                </div>
                                <p className="text-[10px] font-black text-slate-400 group-hover:text-primary uppercase tracking-widest transition-colors">Vincular Nueva Ficha</p>
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-32 select-none">
                            <div className="size-24 rounded-full bg-slate-50 flex items-center justify-center mb-6">
                                <span className="material-symbols-outlined text-4xl text-slate-300 notranslate" translate="no">sentiment_neutral</span>
                            </div>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                                {searchQuery ? 'Busqueda sin coincidencias operativas' : 'Directorio vacio'}
                            </p>
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="mt-4 opacity-100 text-primary text-[10px] font-bold uppercase tracking-widest hover:underline active:opacity-70"
                                >
                                    Limpiar filtro
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            <GuardModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
            {selectedGuard && (
                <GuardDetailModal
                    isOpen={isDetailModalOpen}
                    onClose={() => setIsDetailModalOpen(false)}
                    guard={selectedGuard}
                />
            )}
            <ConfirmDialog {...dialogProps} />
        </div>
    );
};

const InfoRow = ({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) => (
    <div className="flex justify-between items-center text-[11px] hover:bg-white/50 py-1.5 rounded-lg transition-all px-1">
        <span className="text-slate-400 font-bold uppercase tracking-wider">{label}</span>
        <span className={`${mono ? 'font-mono' : ''} ${highlight ? 'text-primary font-black' : 'text-slate-700 font-bold'} max-w-[65%] text-right truncate`}>{value}</span>
    </div>
);

export default Vigilantes;
