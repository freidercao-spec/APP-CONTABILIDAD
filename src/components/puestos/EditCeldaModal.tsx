import React, { useState, useMemo, useEffect } from 'react';
import { type AsignacionDia, type TipoJornada, type TurnoHora, ESTADOS_LABORALES, getEstadoLaboral } from '../../store/programacionStore';
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
    return vigilantes.find(v => v.id === vid || v.dbId === vid) || null;
  });

  const [tempAsig, setTempAsig] = useState<AsignacionDia>(() => {
    // Buscar configuración de turno predeterminada para este rol/turno
    const config = effectiveTurnos.find(t => t.id === asig.turno) || effectiveTurnos[0];
    return { 
      ...asig,
      vigilanteId: asig.vigilanteId || initialVigilanteId || '',
      jornada: asig.jornada && asig.jornada !== 'sin_asignar' ? asig.jornada : 'normal',
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
      const found = vigilantes.find(v => v.id === id || v.dbId === id);
      if (found) return found;
      // RECUPERACIÓN SINTÉTICA: Si no está en el store global pero sí en el tablero, crear perfil temporal
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
    // CORRECCIÓN ATÓMICA: Asegurar que las horas siempre tengan formato HH:mm para el input del navegador
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
      inicio: formatTime(config?.inicio || prev.inicio || '06:00'),
      fin: formatTime(config?.fin || prev.fin || '18:00')
    }));
  };

  const handleSave = async () => {
    const updated: AsignacionDia = {
      ...tempAsig,
      vigilanteId: selectedVigilante?.dbId || selectedVigilante?.id || tempAsig.vigilanteId || null,
      confirmado_por: (window as any).__usuario_actual || 'Operador',
      timestamp_confirmacion: new Date().toISOString(),
    };
    await onSave(updated);
    // onClose() is called by the parent after successful save
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Background Overlay with Blur */}
      <div 
        className="absolute inset-0 bg-[#020617]/90 backdrop-blur-md transition-opacity duration-500"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div 
        className="relative w-full max-w-3xl bg-[#0f172a]/95 border border-white/10 rounded-[48px] shadow-[0_32px_128px_-12px_rgba(0,0,0,0.8)] overflow-hidden animate-in fade-in zoom-in duration-300"
        style={{ backdropFilter: 'blur(32px)' }}
      >
        {/* Header Elite */}
        <div className="relative px-12 py-10 bg-gradient-to-r from-indigo-500/10 via-transparent to-transparent border-b border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="size-16 rounded-3xl bg-indigo-600 flex items-center justify-center shadow-[0_0_40px_rgba(79,70,229,0.5)] border border-indigo-400/30">
                <span className="material-symbols-outlined text-white text-[36px]">event_available</span>
              </div>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-lg text-[10px] font-black uppercase tracking-[0.3em]">Operaciones</span>
                  <span className="text-white/20 text-[10px]">•</span>
                  <span className="text-indigo-400 text-[12px] font-black uppercase tracking-[0.2em]">{diaLabel || `Día ${asig.dia}`}</span>
                </div>
                <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic">
                  PERSONALIZAR <span className="text-indigo-500 not-italic">JORNADA</span>
                </h2>
              </div>
            </div>
            <button onClick={onClose} className="size-12 rounded-2xl bg-white/5 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-all flex items-center justify-center border border-white/10">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        <div className="px-12 py-10 space-y-10 max-h-[70vh] overflow-y-auto custom-scrollbar">
          
          {/* SELECCIÓN DE PERSONAL */}
          <div className="space-y-5">
            <div className="flex items-center justify-between px-2">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em]">Efectivo de Seguridad</span>
              <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5">
                <button 
                  onClick={() => setActiveTab('quick')}
                  className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'quick' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                >Titulares</button>
                <button 
                  onClick={() => setActiveTab('search')}
                  className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'search' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                >Global</button>
              </div>
            </div>

            {selectedVigilante ? (
              <div className="relative group p-8 rounded-[36px] bg-indigo-500/[0.03] border border-indigo-500/20 flex items-center justify-between shadow-2xl overflow-hidden transition-all hover:border-indigo-500/40">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[100px] pointer-events-none" />
                <div className="flex items-center gap-6 relative">
                  <div className="size-20 rounded-3xl bg-indigo-600/10 border-2 border-indigo-500/30 flex items-center justify-center text-3xl font-black text-indigo-400 shadow-inner">
                    {selectedVigilante.nombre.substring(0,2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-[22px] font-black text-white uppercase tracking-tight leading-none mb-2">{selectedVigilante.nombre}</h4>
                    <div className="flex items-center gap-4">
                       <p className="text-[13px] font-bold text-indigo-400/80 tracking-wide">{selectedVigilante.documento || 'Sin Cédula'}</p>
                       <span className="size-1.5 rounded-full bg-indigo-500/30" />
                       <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1.5">
                         <span className="size-2 bg-emerald-500 rounded-full animate-pulse" /> Disponible
                       </span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => { setSelectedVigilante(null); setTempAsig(prev => ({ ...prev, vigilanteId: '' })); setActiveTab('search'); }}
                  className="px-8 py-3.5 bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/30 text-[11px] font-black text-slate-400 hover:text-rose-400 rounded-2xl uppercase tracking-widest transition-all shadow-lg"
                >Reasignar</button>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-top-2 duration-400">
                {activeTab === 'search' ? (
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-slate-600 text-[28px]">search</span>
                    <input 
                      autoFocus
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Identificación o nombres completos..."
                      className="w-full h-20 pl-16 pr-8 bg-black/40 border border-white/10 rounded-[32px] text-[18px] font-bold text-white outline-none focus:border-indigo-500/40 transition-all placeholder:text-slate-700 shadow-inner"
                    />
                    {filteredVigilantes.length > 0 && (
                      <div className="mt-4 p-3 bg-[#0c1425] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl divide-y divide-white/5">
                        {filteredVigilantes.map(v => (
                          <div 
                            key={v.id} 
                            onClick={() => handleSelectVigilante(v)}
                            className="flex items-center justify-between p-5 hover:bg-indigo-600/10 cursor-pointer rounded-2xl transition-all group"
                          >
                            <div className="flex items-center gap-5">
                              <div className="size-12 rounded-xl bg-white/5 flex items-center justify-center text-sm font-black text-slate-500 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                {v.nombre[0]}
                              </div>
                              <div>
                                 <p className="text-[15px] font-black text-white group-hover:text-indigo-400">{v.nombre}</p>
                                 <p className="text-[11px] font-bold text-slate-600 uppercase tracking-widest">{v.documento}</p>
                              </div>
                            </div>
                            <span className="material-symbols-outlined text-slate-700 group-hover:text-indigo-500 transition-colors">add_circle</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    {titularesList.length > 0 ? titularesList.map(v => (
                      <button 
                        key={v.id}
                        onClick={() => handleSelectVigilante(v)}
                        className="flex items-center gap-5 p-5 bg-white/5 border border-white/5 hover:border-indigo-500/30 hover:bg-indigo-500/10 rounded-[28px] transition-all group text-left"
                      >
                         <div className="size-14 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-lg font-black group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner">
                           {v.nombre.substring(0,2).toUpperCase()}
                         </div>
                         <div className="min-w-0">
                            <p className="text-[13px] font-black text-white truncate">{v.nombre.split(' ')[0]}</p>
                            <p className="text-[10px] font-black text-indigo-500/60 uppercase tracking-widest">Titular</p>
                         </div>
                      </button>
                    )) : (
                      <div className="col-span-full py-12 text-center bg-white/[0.02] rounded-[36px] border border-dashed border-white/10">
                        <span className="material-symbols-outlined text-[40px] text-slate-800 mb-3">person_off</span>
                        <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Configura titulares en el puesto</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* DOBLE COLUMNA: HORARIO Y JORNADA */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
            {/* CONFIGURACIÓN DE HORARIO CUSTOM (EL CORAZÓN) */}
            <div className="xl:col-span-7 space-y-6">
              <div className="flex items-center justify-between px-2">
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em]">Horario del Servicio</span>
                <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-lg text-[9px] font-black uppercase tracking-widest">Personalizable</span>
              </div>
              
              <div className="grid grid-cols-2 gap-6 bg-black/40 p-8 rounded-[40px] border border-white/5 shadow-inner">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Hora de Entrada</label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500/60 z-10">schedule</span>
                    <input 
                      list="horas-comunes"
                      type="text"
                      value={tempAsig.inicio}
                      onChange={e => {
                        const val = e.target.value;
                        if (val.length === 4 && val.includes(':') && !val.endsWith(':')) setTempAsig({ ...tempAsig, inicio: formatTime(val) });
                        else setTempAsig({ ...tempAsig, inicio: val });
                      }}
                      onBlur={() => setTempAsig({ ...tempAsig, inicio: formatTime(tempAsig.inicio || '') })}
                      placeholder="00:00"
                      className="w-full h-16 bg-white/[0.03] border border-white/10 rounded-2xl pl-12 pr-4 text-[20px] font-black text-white focus:border-emerald-500/40 transition-all outline-none text-center tabular-nums cursor-pointer"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Hora de Salida</label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-rose-500/60 z-10">history</span>
                    <input 
                      list="horas-comunes"
                      type="text"
                      value={tempAsig.fin}
                      onChange={e => {
                        const val = e.target.value;
                        if (val.length === 4 && val.includes(':') && !val.endsWith(':')) setTempAsig({ ...tempAsig, fin: formatTime(val) });
                        else setTempAsig({ ...tempAsig, fin: val });
                      }}
                      onBlur={() => setTempAsig({ ...tempAsig, fin: formatTime(tempAsig.fin || '') })}
                      placeholder="00:00"
                      className="w-full h-16 bg-white/[0.03] border border-white/10 rounded-2xl pl-12 pr-4 text-[20px] font-black text-white focus:border-rose-500/40 transition-all outline-none text-center tabular-nums cursor-pointer"
                    />
                  </div>
                </div>

                <datalist id="horas-comunes">
                  <option value="06:00" />
                  <option value="07:00" />
                  <option value="08:00" />
                  <option value="18:00" />
                  <option value="19:00" />
                  <option value="20:00" />
                </datalist>

                <div className="col-span-full pt-6 border-t border-white/5 mt-2">
                  <div className="flex flex-wrap gap-2.5">
                    {effectiveTurnos.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setTurnoPreset(p.id)}
                        className={`flex items-center gap-2.5 px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all border ${
                          tempAsig.turno === p.id 
                            ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg'
                            : 'bg-white/5 border-white/5 text-slate-500 hover:text-white'
                        }`}
                      >
                        <span className={`material-symbols-outlined text-[18px] ${tempAsig.turno === p.id ? 'text-white' : 'text-indigo-400'}`}>
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
            <div className="xl:col-span-5 space-y-6">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em] px-2">Estado Laboral</span>
              <div className="bg-black/20 rounded-[40px] p-2 border border-white/5 space-y-1 shadow-inner">
                {ESTADOS_LABORALES.map(j => (
                  <button 
                    key={j.jornada + j.codigo}
                    onClick={() => setTempAsig({ ...tempAsig, jornada: j.jornada as any, codigo_personalizado: j.codigo })}
                    className={`w-full px-6 py-4 rounded-[24px] flex items-center justify-between transition-all ${
                      tempAsig.jornada === j.jornada 
                        ? 'bg-white/10 text-white border border-white/10' 
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                    }`}
                    style={tempAsig.jornada === j.jornada ? {
                      background: `${j.colorHex}18`,
                      borderColor: `${j.colorHex}44`,
                    } : {}}
                  >
                    <div className="flex items-center gap-4">
                       <span
                         className={`material-symbols-outlined text-[20px]`}
                         style={{ color: tempAsig.jornada === j.jornada ? j.colorHex : '#64748b' }}
                       >{j.icono}</span>
                       <div className="text-left">
                         <span
                           className={`text-[11px] font-black uppercase tracking-wider block`}
                           style={{ color: tempAsig.jornada === j.jornada ? '#fff' : '#64748b' }}
                         >{j.nombre}</span>
                         {j.esNovedad && (
                           <span className="text-[8px] text-rose-400 font-bold uppercase tracking-wider flex items-center gap-1">
                             <span className="size-1.5 rounded-full bg-rose-500 inline-block animate-pulse" />
                             Genera alerta
                           </span>
                         )}
                       </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className="text-[9px] font-black px-2 py-0.5 rounded-md"
                        style={tempAsig.jornada === j.jornada
                          ? { background: j.colorHex, color: '#fff' }
                          : { background: 'rgba(255,255,255,0.05)', color: '#64748b' }
                        }
                      >{j.codigo}</span>
                      <div className={`size-5 rounded-full border-2 flex items-center justify-center transition-all`}
                        style={tempAsig.jornada === j.jornada
                          ? { borderColor: j.colorHex, background: `${j.colorHex}20` }
                          : { borderColor: '#1e293b' }
                        }
                      >
                        {tempAsig.jornada === j.jornada && <div className="size-2 rounded-full shadow-lg" style={{ background: j.colorHex }} />}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Elite */}
        <div className="px-12 py-10 bg-slate-950 border-t border-white/5 flex flex-col md:flex-row gap-6 items-center justify-between">
           <button 
            onClick={() => { setTempAsig({ ...tempAsig, jornada: 'sin_asignar', vigilanteId: '' }); handleSave(); }}
            className="flex items-center gap-2.5 text-[12px] font-black text-slate-600 hover:text-rose-500 uppercase tracking-[0.2em] transition-all group"
           >
             <div className="size-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500/40 group-hover:text-rose-500 transition-colors">
                <span className="material-symbols-outlined text-[22px]">delete_sweep</span>
             </div>
             Remover Asignación
           </button>

           <div className="flex items-center gap-6 w-full md:w-auto">
              <button 
                onClick={onClose}
                className="flex-1 md:flex-none px-10 py-5 rounded-2xl text-[12px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-all bg-white/5 border border-transparent hover:border-white/10"
              >Cancelar</button>
              
              <button 
                onClick={handleSave}
                className="flex-[2] md:flex-none px-16 py-5 bg-indigo-600 text-white rounded-[26px] text-[12px] font-black uppercase tracking-[0.2em] shadow-[0_20px_40px_rgba(79,70,229,0.3)] hover:shadow-[0_25px_60px_rgba(79,70,229,0.5)] hover:-translate-y-1.5 active:translate-y-0 transition-all border border-indigo-400/30"
              >Confirmar Despacho</button>
           </div>
        </div>
      </div>
    </div>
  );
};

