import { useState } from 'react';
import { showTacticalToast } from '../utils/tacticalToast';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';

const Configuracion = () => {
    const { username, role, updateProfile } = useAuthStore();
    const { soundEnabled, toggleSound, topbarConfig, setTopbarConfig } = useAppStore();
    const [altaContraste, setAltaContraste] = useState(true);
    const [hardwareAccel, setHardwareAccel] = useState(false);
    
    // Profile Edit State
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [editName, setEditName] = useState(username || '');
    const [editRole, setEditRole] = useState(role || '');

    const [config, setConfig] = useState({
        toleranciaAusencia: '15 MINUTOS',
        recargaNocturno: '21:00 - 06:00',
        frecuenciaSync: '30 SEGUNDOS',
    });
    const [edited, setEdited] = useState(false);

    const handleConfigChange = (key: keyof typeof config, value: string) => {
        setConfig(prev => ({ ...prev, [key]: value }));
        setEdited(true);
    };

    const handleSave = () => {
        showTacticalToast({
            title: 'Configuracion Guardada',
            message: 'Los parametros del sistema han sido actualizados exitosamente.',
            type: 'success'
        });
        setEdited(false);
    };

    const handleSaveProfile = () => {
        if (!editName.trim() || !editRole.trim()) {
            showTacticalToast({
                title: 'Error de entrada',
                message: 'Todos los campos de perfil son obligatorios.',
                type: 'error'
            });
            return;
        }
        updateProfile(editName, editRole);
        setIsEditingProfile(false);
        showTacticalToast({
            title: 'Perfil Actualizado',
            message: 'Informacion de identidad sincronizada con el nucleo.',
            type: 'success'
        });
    };

    const handleReset = () => {
        setConfig({ toleranciaAusencia: '15 MINUTOS', recargaNocturno: '21:00 - 06:00', frecuenciaSync: '30 SEGUNDOS' });
        setEdited(false);
        setTopbarConfig({
            companyName: 'CORAZA SEGURIDAD',
            showSearch: true,
            showClock: true,
            showNotifications: true,
            showUserAvatar: true,
            accentColor: '#4318FF',
        });
        showTacticalToast({
            title: 'Restablecimiento',
            message: 'Configuraciones devueltas a valores de fabrica.',
            type: 'info'
        });
    };

    return (
        <div className="page-container space-y-10 animate-in fade-in duration-500 pb-20">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
                <div>
                    <div className="flex items-center gap-2 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                        <span>Sistema</span>
                        <span className="material-symbols-outlined text-[14px] notranslate" translate="no">chevron_right</span>
                        <span className="text-primary">Panel de Control</span>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight uppercase tracking-widest">Sistema <span className="text-primary font-black" style={{ color: topbarConfig.accentColor }}>Central</span></h1>
                </div>

                <div className="flex items-center gap-3">
                    {edited && (
                        <span className="text-[10px] font-black text-warning uppercase tracking-widest animate-pulse">
                            ● Cambios sin guardar
                        </span>
                    )}
                    <button onClick={handleReset} className="bg-slate-100 text-slate-500 text-[10px] font-bold px-6 py-3 rounded-xl hover:bg-slate-200 transition-all uppercase tracking-widest">
                        Restablecer
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* User Profile Section */}
                <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm flex flex-col gap-8">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary notranslate" translate="no" style={{ color: topbarConfig.accentColor }}>person_outline</span>
                        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Perfil de Usuario Activo</h3>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="relative">
                            <div className="size-24 rounded-full overflow-hidden bg-slate-100 border-2 border-primary/20 p-1" style={{ borderColor: `${topbarConfig.accentColor}33` }}>
                                <img
                                    className="w-full h-full rounded-full object-cover"
                                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(username || 'Admin')}&background=${topbarConfig.accentColor.replace('#','')}&color=fff&bold=true&size=200`}
                                    alt=""
                                />
                            </div>
                            <div className="absolute bottom-0 right-0 size-7 bg-primary rounded-full border-4 border-white flex items-center justify-center" style={{ backgroundColor: topbarConfig.accentColor }}>
                                <span className="material-symbols-outlined text-white text-[14px] notranslate" translate="no">verified</span>
                            </div>
                        </div>
                        <div>
                            {isEditingProfile ? (
                                <div className="space-y-2">
                                    <input 
                                        type="text" 
                                        value={editName} 
                                        onChange={e => setEditName(e.target.value)} 
                                        className="w-full text-lg font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:border-primary/50 outline-none" 
                                        placeholder="Tu nombre" 
                                    />
                                    <input 
                                        type="text" 
                                        value={editRole} 
                                        onChange={e => setEditRole(e.target.value)} 
                                        className="w-full text-[11px] font-black text-primary bg-primary/5 border border-primary/20 rounded-lg px-3 py-1.5 outline-none uppercase tracking-wider" 
                                        style={{ color: topbarConfig.accentColor, backgroundColor: `${topbarConfig.accentColor}0D`, borderColor: `${topbarConfig.accentColor}33` }}
                                        placeholder="Tu cargo" 
                                    />
                                </div>
                            ) : (
                                <>
                                    <h4 className="text-2xl font-bold text-slate-900 mb-1">{username || 'Operador'}</h4>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[11px] font-black text-primary bg-primary/5 border border-primary/15 px-3 py-1 rounded-full uppercase tracking-wider" style={{ color: topbarConfig.accentColor, backgroundColor: `${topbarConfig.accentColor}0D`, borderColor: `${topbarConfig.accentColor}26` }}>{role || 'Operativo'}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {isEditingProfile ? (
                            <>
                                <button onClick={handleSaveProfile} className="py-4 bg-success text-white text-[10px] font-bold rounded-2xl uppercase tracking-widest hover:brightness-110 shadow-lg shadow-success/20 transition-all flex items-center justify-center gap-2">
                                    <span className="material-symbols-outlined text-[16px] notranslate">save</span> Guardar
                                </button>
                                <button onClick={() => { setIsEditingProfile(false); setEditName(username || ''); setEditRole(role || ''); }} className="py-4 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-2xl uppercase tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => setIsEditingProfile(true)} className="py-4 bg-primary text-white text-[10px] font-bold rounded-2xl uppercase tracking-widest hover:brightness-110 shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2" style={{ backgroundColor: topbarConfig.accentColor }}>
                                    <span className="material-symbols-outlined text-[16px] notranslate">edit</span> Editar Perfil
                                </button>
                                <button className="py-4 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-2xl uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
                                    <span className="material-symbols-outlined text-[16px] notranslate" translate="no">vpn_key</span> Contrasena
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Personalizacion de la Barra - 100% Editable */}
                <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm flex flex-col gap-8">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary notranslate" translate="no" style={{ color: topbarConfig.accentColor }}>palette</span>
                        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Personalizacion de la Barra</h3>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre de la Empresa</label>
                            <input 
                                type="text"
                                value={topbarConfig.companyName}
                                onChange={(e) => setTopbarConfig({ companyName: e.target.value.toUpperCase() })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-xs font-bold text-slate-900 focus:border-primary outline-none transition-all"
                                style={{ borderColor: topbarConfig.accentColor }}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Color de Acento</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="color"
                                        value={topbarConfig.accentColor}
                                        onChange={(e) => setTopbarConfig({ accentColor: e.target.value })}
                                        className="size-10 rounded-lg overflow-hidden border-none p-0 cursor-pointer"
                                    />
                                    <input 
                                        type="text"
                                        value={topbarConfig.accentColor}
                                        onChange={(e) => setTopbarConfig({ accentColor: e.target.value })}
                                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 text-[10px] font-mono font-bold uppercase"
                                    />
                                </div>
                            </div>
                            <div className="space-y-4 pt-4">
                                {[
                                    { label: 'Buscador', key: 'showSearch' as const },
                                    { label: 'Reloj', key: 'showClock' as const },
                                    { label: 'Notificaciones', key: 'showNotifications' as const },
                                    { label: 'Avatar', key: 'showUserAvatar' as const },
                                ].map(item => (
                                    <div key={item.key} className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-slate-600">{item.label}</span>
                                        <button
                                            onClick={() => setTopbarConfig({ [item.key]: !topbarConfig[item.key] })}
                                            className={`w-10 h-5 rounded-full relative transition-all duration-300 ${topbarConfig[item.key] ? 'bg-primary' : 'bg-slate-200'}`}
                                            style={{ backgroundColor: topbarConfig[item.key] ? topbarConfig.accentColor : undefined }}
                                        >
                                            <div className={`absolute top-0.5 size-4 bg-white rounded-full shadow-sm transition-all duration-300 ${topbarConfig[item.key] ? 'right-0.5' : 'left-0.5'}`} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* GESTION de Turnos Maestros (100% Personalizable) */}
                <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm flex flex-col gap-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-primary notranslate" translate="no" style={{ color: topbarConfig.accentColor }}>history_toggle_off</span>
                            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">GESTION de Turnos Maestros</h3>
                        </div>
                        <button 
                            className="text-[9px] font-black text-primary uppercase tracking-widest border-b-2 border-primary/20 hover:border-primary transition-all pb-0.5"
                            style={{ color: topbarConfig.accentColor, borderColor: `${topbarConfig.accentColor}33` }}
                        >
                            + Anadir Turno
                        </button>
                    </div>

                    <div className="space-y-3">
                        {useAppStore.getState().shiftPresets.map((preset, index) => (
                            <div key={preset.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 group">
                                <div className="size-8 rounded-lg flex items-center justify-center text-[10px] font-black text-white" style={{ backgroundColor: preset.color }}>
                                    {index + 1}
                                </div>
                                <div className="flex-1 grid grid-cols-2 gap-4">
                                    <input 
                                        type="text" 
                                        value={preset.label}
                                        onChange={(e) => {
                                            const newPresets = [...useAppStore.getState().shiftPresets];
                                            newPresets[index] = { ...preset, label: e.target.value.toUpperCase() };
                                            useAppStore.getState().setShiftPresets(newPresets);
                                        }}
                                        className="bg-transparent text-[10px] font-black text-slate-600 outline-none uppercase tracking-widest"
                                        placeholder="Etiqueta"
                                    />
                                    <input 
                                        type="text" 
                                        value={preset.value}
                                        onChange={(e) => {
                                            const newPresets = [...useAppStore.getState().shiftPresets];
                                            newPresets[index] = { ...preset, value: e.target.value };
                                            useAppStore.getState().setShiftPresets(newPresets);
                                        }}
                                        className="bg-transparent text-xs font-mono font-bold text-primary outline-none"
                                        style={{ color: topbarConfig.accentColor }}
                                    />
                                </div>
                                <span className="material-symbols-outlined text-slate-200 group-hover:text-danger cursor-pointer transition-colors text-[18px]">delete</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* System Preferences */}
                <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm flex flex-col gap-8">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary notranslate" translate="no" style={{ color: topbarConfig.accentColor }}>terminal</span>
                        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Preferencias de Interfaz</h3>
                    </div>

                    <div className="space-y-4">
                        {[
                            { label: 'Modo de Alto Contraste', desc: 'Optimizado para centros de monitoreo nocturnos.', value: altaContraste, toggle: () => { setAltaContraste(v => !v); showTacticalToast({ title: 'Ajuste Visual', message: 'Contraste de interfaz modificado.', type: 'info' }); } },
                            { label: 'Alertas Sonoras Criticas', desc: 'Notificaciones auditivas para incidentes Nivel 3.', value: soundEnabled, toggle: () => { toggleSound(); showTacticalToast({ title: 'Control de Audio', message: `Alertas sonoras ${!soundEnabled ? 'activadas' : 'desactivadas'}.`, type: 'info' }); } },
                            { label: 'Hardware Acceleration', desc: 'Renderizado de mapas 3D mediante GPU.', value: hardwareAccel, toggle: () => { setHardwareAccel(v => !v); showTacticalToast({ title: 'Rendimiento Tecnico', message: 'Aceleracion por hardware aplicada.', type: 'info' }); } },
                        ].map(pref => (
                            <div key={pref.label} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-primary/20 transition-all">
                                <div>
                                    <p className="text-sm font-bold text-slate-900 mb-0.5">{pref.label}</p>
                                    <p className="text-[11px] text-slate-500">{pref.desc}</p>
                                </div>
                                <button
                                    onClick={pref.toggle}
                                    className={`w-12 h-6 rounded-full relative cursor-pointer transition-all duration-300 ${pref.value ? 'bg-primary shadow-lg shadow-primary/30' : 'bg-slate-200'}`}
                                    style={{ backgroundColor: pref.value ? topbarConfig.accentColor : undefined }}
                                >
                                    <div className={`absolute top-1 size-4 bg-white rounded-full shadow-sm transition-all duration-300 ${pref.value ? 'right-1' : 'left-1'}`} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Threshold Configuration */}
                <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm flex flex-col gap-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-primary notranslate" translate="no" style={{ color: topbarConfig.accentColor }}>settings_input_component</span>
                            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Umbrales Operativos</h3>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            { key: 'toleranciaAusencia' as const, label: 'Tolerancia', icon: 'timer' },
                            { key: 'recargaNocturno' as const, label: 'Nocturno', icon: 'dark_mode' },
                            { key: 'frecuenciaSync' as const, label: 'Sync', icon: 'sync' },
                        ].map(field => (
                            <div key={field.key} className="space-y-3">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{field.label}</label>
                                <div className="relative group">
                                    <input
                                        value={config[field.key]}
                                        onChange={e => handleConfigChange(field.key, e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm text-primary font-mono focus:border-primary/50 focus:bg-white outline-none transition-all"
                                        style={{ color: topbarConfig.accentColor }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={handleSave}
                        className={`py-5 rounded-[24px] uppercase tracking-[0.3em] transition-all mt-4 text-[11px] font-black ${edited ? 'bg-primary text-white shadow-2xl shadow-primary/20 hover:brightness-110 active:scale-[0.99]' : 'bg-slate-100 text-slate-400 cursor-default'}`}
                        style={{ backgroundColor: edited ? topbarConfig.accentColor : undefined }}
                    >
                        {edited ? '✓ Guardar Configuracion' : 'Sin cambios pendientes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Configuracion;
