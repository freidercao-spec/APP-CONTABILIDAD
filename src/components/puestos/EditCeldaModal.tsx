import React, { useState, useMemo, useEffect } from 'react';
import { type AsignacionDia, type TipoJornada, type CodigoEstado, ESTADOS_LABORALES, getEstadoLaboral } from '../../store/programacionStore';
import { type TurnoConfig, type JornadaCustom } from '../../store/puestoStore';
import { useVigilanteStore, type Vigilante } from '../../store/vigilanteStore';
import { DEFAULT_TURNOS } from '../../utils/puestosConstants';

interface EditCeldaModalProps {
  asig: AsignacionDia;
  vigilantes: Vigilante[];
  titularesId: string[];
  titulares: any[];
  puestoNombre?: string;
  diaLabel?: string;
  turnosConfig?: TurnoConfig[];
  jornadasCustom?: JornadaCustom[];
  initialVigilanteId?: string;
  ocupados?: Map<string, any[]>;
  onSave: (asig: AsignacionDia) => Promise<any> | void;
  onClose: () => void;
}

// Helper para comparar IDs de manera robusta (UUID vs Legacy)
const idsMatch = (id1: any, id2: any) => {
  if (!id1 || !id2) return false;
  const s1 = String(id1).toLowerCase();
  const s2 = String(id2).toLowerCase();
  return s1 === s2;
};

const getActiveCode = (asig: any): string => {
  if (asig.codigo_personalizado) return asig.codigo_personalizado;
  if (asig.jornada === 'normal') {
    return asig.turno === 'PM' ? 'N' : 'D';
  }
  const map: Record<string, string> = {
      descanso_remunerado:    'DR',
      descanso_no_remunerado: 'NR',
      vacacion:               'VAC',
      licencia:               'LC',
      suspension:             'SP',
      incapacidad:            'IN',
      accidente:              'AC',
      sin_asignar:            '-',
  };
  return map[asig.jornada] || '-';
};

export const EditCeldaModal = ({ 
  asig, vigilantes, titularesId, titulares, puestoNombre, diaLabel, 
  turnosConfig = [], jornadasCustom = [], initialVigilanteId, onSave, onClose 
}: EditCeldaModalProps) => {
  const [activeTab, setActiveTab] = useState<'quick' | 'search'>(titularesId.length > 0 ? 'quick' : 'search');
  const [search, setSearch] = useState('');
  const effectiveTurnos = useMemo(() => {
    return turnosConfig.length > 0 ? turnosConfig : DEFAULT_TURNOS;
  }, [turnosConfig]);

  const [selectedVigilante, setSelectedVigilante] = useState<Vigilante | null>(() => {
    const vid = asig.vigilanteId || initialVigilanteId;
    if (!vid) return null;
    return vigilantes.find(v => idsMatch(v.id, vid) || idsMatch(v.dbId, vid)) || null;
  });

  const [tempAsig, setTempAsig] = useState<AsignacionDia>(() => {
    const turnoId = asig.turno || 'AM';
    const config = effectiveTurnos.find(t => t.id === turnoId) || effectiveTurnos[0];
    const jornadaInicial = (asig.jornada && asig.jornada !== 'sin_asignar') ? asig.jornada : 'normal';
    return { 
      ...asig,
      turno: turnoId as any,
      vigilanteId: asig.vigilanteId || initialVigilanteId || '',
      jornada: jornadaInicial,
      inicio: asig.inicio || config?.inicio || '06:00',
      fin: asig.fin || config?.fin || '18:00'
    };
  });

  const filteredVigilantes = useMemo(() => {
    if (!search) return [];
    return vigilantes.filter(v => 
      v.nombre.toLowerCase().includes(search.toLowerCase()) ||
      v.documento?.toString().includes(search)
    ).slice(0, 5);
  }, [search, vigilantes]);

  const titularesList = useMemo(() => {
    return titularesId.map(id => {
      const found = vigilantes.find(v => idsMatch(v.id, id) || idsMatch(v.dbId, id));
      if (found) return found;
      return { 
        id, 
        dbId: id, 
        nombre: `Vigilante (${id})`, 
        documento: 'Cargando...',
        empresaId: '',
        activo: true
      } as Vigilante;
    }).filter(Boolean) as Vigilante[];
  }, [titularesId, vigilantes]);

  const formatTime = (time: string) => {
    if (!time) return '';
    const parts = time.split(':');
    if (parts.length === 1) return `${parts[0].padStart(2, '0')}:00`;
    return `${parts[0].padStart(2, '0')}:${parts[1].padEnd(2, '0')}`;
  };

  useEffect(() => {
    const fixTime = (t: string) => {
      if (!t || !t.includes(':')) return t;
      const [h, m] = t.split(':');
      if (h && m && m.length === 1) return `${h.padStart(2, '0')}:0${m}`;
      if (h && m === '') return `${h.padStart(2, '0')}:00`;
      return t;
    };

    const newInicio = fixTime(tempAsig.inicio || '');
    const newFin = fixTime(tempAsig.fin || '');
    
    if (newInicio !== tempAsig.inicio || newFin !== tempAsig.fin) {
      setTempAsig(prev => ({ ...prev, inicio: newInicio, fin: newFin }));
    }
  }, [tempAsig.inicio, tempAsig.fin]);

  const handleSelectVigilante = (v: Vigilante) => {
    setSelectedVigilante(v);
    setTempAsig(prev => ({ ...prev, vigilanteId: v.dbId || v.id }));
  };

  const setTurnoPreset = (turnoId: string) => {
    const config = effectiveTurnos.find(t => t.id === turnoId) || DEFAULT_TURNOS.find(t => t.id === turnoId);
    setTempAsig(prev => ({
      ...prev,
      turno: turnoId as any,
      jornada: 'normal' as any,
      codigo_personalizado: undefined,
      inicio: formatTime(config?.inicio || prev.inicio || '06:00'),
      fin: formatTime(config?.fin || prev.fin || '18:00')
    }));
  };

  const setEstadoLaboral = (jornada: string, codigo: string) => {
    setTempAsig(prev => {
      let nextTurno = prev.turno;
      if (jornada === 'normal') {
        nextTurno = codigo === 'N' ? 'PM' : 'AM';
      }
      return {
        ...prev,
        jornada: jornada as any,
        codigo_personalizado: codigo,
        turno: nextTurno as any
      };
    });
  };

  const handleSave = async () => {
    const finalTurno = tempAsig.turno || 'AM';
    const updated: AsignacionDia = {
      ...tempAsig,
      turno: finalTurno as any,
      vigilanteId: selectedVigilante?.dbId || selectedVigilante?.id || tempAsig.vigilanteId || null,
      confirmado_por: (window as any).__usuario_actual || 'Operador',
      timestamp_confirmacion: new Date().toISOString(),
    };
    await onSave(updated);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Background Overlay with Blur */}
      <div 
        className="absolute inset-0 bg-[#020617]/90 backdrop-blur-sm transition-opacity duration-500"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div 
        className="relative w-full max-w-2xl bg-[#0f172a]/95 border border-white/10 rounded-3xl shadow-[0_32px_128px_-12px_rgba(0,0,0,0.8)] overflow-hidden animate-in fade-in zoom-in duration-300"
        style={{ backdropFilter: 'blur(32px)' }}
      >
        {/* Header Elite */}
        <div className="relative px-6 py-4 bg-gradient-to-r from-indigo-500/10 via-transparent to-transparent border-b border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="size-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.4)] border border-indigo-400/20">
                <span className="material-symbols-outlined text-white text-[20px]">event_available</span>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded text-[8px] font-black uppercase tracking-[0.2em]">Operaciones</span>
                  <span className="text-white/20 text-[8px]">•</span>
                  <span className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.15em]">{diaLabel || `Día ${asig.dia}`}</span>
                </div>
                <h2 className="text-xl font-black text-white tracking-tighter uppercase italic leading-none">
                  PERSONALIZAR <span className="text-indigo-500 not-italic">JORNADA</span>
                </h2>
              </div>
            </div>
            <button onClick={onClose} className="size-8 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-all flex items-center justify-center border border-white/10">
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {/* SELECCIÓN DE PERSONAL */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Efectivo de Seguridad</span>
              <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                <button 
                  onClick={() => setActiveTab('quick')}
                  className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${activeTab === 'quick' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-white'}`}
                >Titulares</button>
                <button 
                  onClick={() => setActiveTab('search')}
                  className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${activeTab === 'search' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-white'}`}
                >Global</button>
              </div>
            </div>

            {selectedVigilante ? (
              <div className="relative group p-4 rounded-2xl bg-indigo-500/[0.03] border border-indigo-500/10 flex items-center justify-between shadow-lg overflow-hidden transition-all hover:border-indigo-500/25">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[50px] pointer-events-none" />
                <div className="flex items-center gap-4 relative">
                  <div className="size-11 rounded-xl bg-indigo-600/10 border border-indigo-500/25 flex items-center justify-center text-sm font-black text-indigo-400 shadow-inner">
                    {selectedVigilante.nombre.substring(0,2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-[14px] font-black text-white uppercase tracking-tight leading-none mb-1">{selectedVigilante.nombre}</h4>
                    <div className="flex items-center gap-3">
                       <p className="text-[11px] font-bold text-indigo-400/80 tracking-wide">{selectedVigilante.documento || 'Sin Cédula'}</p>
                       <span className="size-1 rounded-full bg-indigo-500/30" />
                       <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                         <span className="size-1.5 bg-emerald-500 rounded-full animate-pulse" /> Disponible
                       </span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => { setSelectedVigilante(null); setTempAsig(prev => ({ ...prev, vigilanteId: '' })); setActiveTab('search'); }}
                  className="px-4 py-2 bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/30 text-[9px] font-black text-slate-400 hover:text-rose-400 rounded-xl uppercase tracking-wider transition-all shadow-md"
                >Reasignar</button>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                {activeTab === 'search' ? (
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 text-[18px]">search</span>
                    <input 
                      autoFocus
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Identificación o nombres completos..."
                      className="w-full h-11 pl-11 pr-4 bg-black/40 border border-white/10 rounded-xl text-[12px] font-bold text-white outline-none focus:border-indigo-500/40 transition-all placeholder:text-slate-700 shadow-inner"
                    />
                    {filteredVigilantes.length > 0 && (
                      <div className="mt-2 p-2 bg-[#0c1425] border border-white/10 rounded-xl overflow-hidden shadow-2xl divide-y divide-white/5">
                        {filteredVigilantes.map(v => (
                          <div 
                            key={v.id} 
                            onClick={() => handleSelectVigilante(v)}
                            className="flex items-center justify-between p-3 hover:bg-indigo-600/10 cursor-pointer rounded-lg transition-all group"
                          >
                            <div className="flex items-center gap-3">
                              <div className="size-8 rounded-lg bg-white/5 flex items-center justify-center text-xs font-black text-slate-500 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                {v.nombre[0]}
                              </div>
                              <div>
                                 <p className="text-[13px] font-black text-white group-hover:text-indigo-400">{v.nombre}</p>
                                 <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{v.documento}</p>
                              </div>
                            </div>
                            <span className="material-symbols-outlined text-slate-700 group-hover:text-indigo-500 transition-colors text-[18px]">add_circle</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    {titularesList.length > 0 ? titularesList.map(v => (
                      <button 
                        key={v.id}
                        onClick={() => handleSelectVigilante(v)}
                        className="flex items-center gap-3 p-3 bg-white/5 border border-white/5 hover:border-indigo-500/30 hover:bg-indigo-500/10 rounded-2xl transition-all group text-left"
                      >
                        <div className={`size-10 rounded-xl border flex items-center justify-center text-xs font-black transition-all shadow-inner ${idsMatch(selectedVigilante?.id, v.id) ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-indigo-600/10 border-indigo-500/20 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white'}`}>
                           {v.nombre.substring(0,2).toUpperCase()}
                         </div>
                         <div className="min-w-0">
                            <p className="text-[12px] font-black text-white truncate">{v.nombre.split(' ')[0]}</p>
                            <p className="text-[9px] font-black text-indigo-500/60 uppercase tracking-widest">Titular</p>
                         </div>
                      </button>
                    )) : (
                      <div className="col-span-full py-6 text-center bg-white/[0.02] rounded-2xl border border-dashed border-white/10">
                        <span className="material-symbols-outlined text-[24px] text-slate-800 mb-1.5">person_off</span>
                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Configura titulares en el puesto</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* DOBLE COLUMNA: HORARIO Y JORNADA */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* CONFIGURACIÓN DE HORARIO CUSTOM */}
            <div className="md:col-span-7 space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Horario del Servicio</span>
                <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded text-[8px] font-black uppercase tracking-wider">Personalizable</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 bg-black/40 p-4 rounded-2xl border border-white/5 shadow-inner">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Entrada</label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500/60 z-10 text-[16px] pointer-events-none">schedule</span>
                    <input 
                      type="time"
                      value={tempAsig.inicio}
                      onChange={e => setTempAsig({ ...tempAsig, inicio: e.target.value })}
                      onClick={e => { try { (e.target as any).showPicker(); } catch {} }}
                      className="w-full h-10 bg-white/[0.03] border border-white/10 rounded-xl pl-9 pr-3 text-[14px] font-black text-white focus:border-emerald-500/40 transition-all outline-none text-center tabular-nums cursor-pointer dark-time-input"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Salida</label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-rose-500/60 z-10 text-[16px] pointer-events-none">history</span>
                    <input 
                      type="time"
                      value={tempAsig.fin}
                      onChange={e => setTempAsig({ ...tempAsig, fin: e.target.value })}
                      onClick={e => { try { (e.target as any).showPicker(); } catch {} }}
                      className="w-full h-10 bg-white/[0.03] border border-white/10 rounded-xl pl-9 pr-3 text-[14px] font-black text-white focus:border-rose-500/40 transition-all outline-none text-center tabular-nums cursor-pointer dark-time-input"
                    />
                  </div>
                </div>

                <div className="col-span-full pt-4 border-t border-white/5 mt-1">
                  <div className="flex flex-wrap gap-1.5">
                    {effectiveTurnos.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setTurnoPreset(p.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border ${
                          tempAsig.turno === p.id 
                            ? 'bg-indigo-600 border-indigo-400 text-white shadow-md'
                            : 'bg-white/5 border-white/5 text-slate-500 hover:text-white'
                        }`}
                      >
                        <span className={`material-symbols-outlined text-[13px] ${tempAsig.turno === p.id ? 'text-white' : 'text-indigo-400'}`}>
                          {p.id === 'AM' ? 'wb_sunny' : p.id === 'PM' ? 'brightness_2' : 'cached'}
                        </span>
                        {p.nombre} ({p.inicio}-{p.fin})
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ESTADO DE JORNADA */}
            <div className="md:col-span-5 space-y-3">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] px-1 block">Estado Laboral</span>
              <div className="bg-black/20 rounded-2xl p-1.5 border border-white/5 space-y-0.5 shadow-inner max-h-[190px] overflow-y-auto custom-scrollbar">
                {ESTADOS_LABORALES.map(j => {
                  const isActive = getActiveCode(tempAsig) === j.codigo;
                  return (
                    <button 
                      key={j.jornada + j.codigo}
                      onClick={() => setEstadoLaboral(j.jornada, j.codigo)}
                      className={`w-full px-4 py-2.5 rounded-xl flex items-center justify-between transition-all ${
                        isActive 
                          ? 'bg-white/10 text-white border border-white/10' 
                          : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                      }`}
                      style={isActive ? {
                        background: `${j.colorHex}18`,
                        borderColor: `${j.colorHex}44`,
                      } : {}}
                    >
                      <div className="flex items-center gap-2.5">
                         <span
                           className={`material-symbols-outlined text-[16px]`}
                           style={{ color: isActive ? j.colorHex : '#64748b' }}
                         >{j.icono}</span>
                         <div className="text-left">
                           <span
                             className={`text-[10px] font-black uppercase tracking-wider block`}
                             style={{ color: isActive ? '#fff' : '#64748b' }}
                           >{j.nombre}</span>
                           {j.esNovedad && (
                             <span className="text-[7px] text-rose-400 font-bold uppercase tracking-wider flex items-center gap-1">
                               <span className="size-1 rounded-full bg-rose-500 inline-block animate-pulse" />
                               Genera alerta
                             </span>
                           )}
                         </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[8px] font-black px-1.5 py-0.5 rounded"
                          style={isActive
                            ? { background: j.colorHex, color: '#fff' }
                            : { background: 'rgba(255,255,255,0.05)', color: '#64748b' }
                          }
                        >{j.codigo}</span>
                        <div
                          className="size-4 rounded-full border flex items-center justify-center transition-all"
                          style={isActive
                            ? { borderColor: j.colorHex, background: `${j.colorHex}20` }
                            : { borderColor: '#1e293b' }
                          }
                        >
                          {isActive && <div className="size-1.5 rounded-full shadow-lg" style={{ background: j.colorHex }} />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Elite */}
        <div className="px-6 py-4 bg-slate-950 border-t border-white/5 flex flex-col md:flex-row gap-4 items-center justify-between">
           <button 
            onClick={() => { 
                setSelectedVigilante(null);
                const cleared = { ...tempAsig, jornada: 'sin_asignar' as any, vigilanteId: null as string | null };
                setTempAsig(cleared);
                onSave({
                    ...cleared,
                    confirmado_por: (window as any).__usuario_actual || 'Operador',
                    timestamp_confirmacion: new Date().toISOString(),
                });
            }}
            className="flex items-center gap-2 text-[10px] font-black text-slate-600 hover:text-rose-500 uppercase tracking-widest transition-all group"
           >
             <div className="size-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500/40 group-hover:text-rose-500 transition-colors">
                <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
             </div>
             Remover Asignación
           </button>

           <div className="flex items-center gap-4 w-full md:w-auto">
              <button 
                onClick={onClose}
                className="flex-1 md:flex-none px-4 py-2.5 rounded-xl text-[9px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-all bg-white/5 border border-transparent hover:border-white/10"
              >Cancelar</button>
              
              <button 
                onClick={handleSave}
                className="flex-[2] md:flex-none px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-wider shadow-md shadow-indigo-600/20 hover:shadow-lg active:scale-95 transition-all border border-indigo-400/20"
              >Confirmar Despacho</button>
           </div>
        </div>
      </div>
    </div>
  );
};
