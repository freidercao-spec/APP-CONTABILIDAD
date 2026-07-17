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
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div 
        className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-150"
      >
        {/* Header Elite */}
        <div className="relative px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="size-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-[20px]">event_available</span>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[8px] font-bold uppercase tracking-wider">Operaciones</span>
                  <span className="text-slate-300 text-[8px]">•</span>
                  <span className="text-primary text-[10px] font-bold uppercase tracking-wide">{diaLabel || `Día ${asig.dia}`}</span>
                </div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight uppercase leading-none">
                  PERSONALIZAR <span className="text-primary font-bold">JORNADA</span>
                </h2>
              </div>
            </div>
            <button onClick={onClose} className="size-8 rounded-lg bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-all flex items-center justify-center border border-slate-200 shadow-sm">
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar bg-white">
          {/* SELECCIÓN DE PERSONAL */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Efectivo de Seguridad</span>
              <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 shadow-sm">
                <button 
                  onClick={() => setActiveTab('quick')}
                  className={`px-4 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all ${activeTab === 'quick' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'}`}
                >Titulares</button>
                <button 
                  onClick={() => setActiveTab('search')}
                  className={`px-4 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all ${activeTab === 'search' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'}`}
                >Global</button>
              </div>
            </div>

            {selectedVigilante ? (
              <div className="relative group p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between transition-all hover:border-slate-350">
                <div className="flex items-center gap-4 relative">
                  <div className="size-11 rounded-lg bg-primary-soft border border-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                    {selectedVigilante.nombre.substring(0,2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-[13px] font-bold text-slate-900 uppercase tracking-tight leading-none mb-1">{selectedVigilante.nombre}</h4>
                    <div className="flex items-center gap-3">
                       <p className="text-[11px] font-medium text-slate-500 tracking-wide">{selectedVigilante.documento || 'Sin Cédula'}</p>
                       <span className="size-1 rounded-full bg-slate-300" />
                       <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                         <span className="size-1.5 bg-emerald-500 rounded-full" /> Disponible
                       </span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => { setSelectedVigilante(null); setTempAsig(prev => ({ ...prev, vigilanteId: '' })); setActiveTab('search'); }}
                  className="px-3.5 py-2 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 text-[9px] font-bold text-slate-600 hover:text-red-600 rounded-lg uppercase tracking-wider transition-all shadow-sm"
                >Reasignar</button>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                {activeTab === 'search' ? (
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                    <input 
                      autoFocus
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Identificación o nombres completos..."
                      className="w-full h-11 pl-11 pr-4 bg-white border border-slate-200 rounded-lg text-[12px] font-semibold text-slate-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-slate-400 shadow-sm"
                    />
                    {filteredVigilantes.length > 0 && (
                      <div className="mt-2 p-1.5 bg-white border border-slate-200 rounded-lg overflow-hidden shadow-lg divide-y divide-slate-100">
                        {filteredVigilantes.map(v => (
                          <div 
                            key={v.id} 
                            onClick={() => handleSelectVigilante(v)}
                            className="flex items-center justify-between p-2.5 hover:bg-slate-50 cursor-pointer rounded-md transition-all group"
                          >
                            <div className="flex items-center gap-3">
                              <div className="size-8 rounded bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 group-hover:bg-primary group-hover:text-white transition-all">
                                {v.nombre[0]}
                              </div>
                              <div>
                                 <p className="text-[12px] font-bold text-slate-900 group-hover:text-primary">{v.nombre}</p>
                                 <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{v.documento}</p>
                              </div>
                            </div>
                            <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors text-[18px]">add_circle</span>
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
                        className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-250 hover:border-slate-350 hover:bg-slate-100 rounded-xl transition-all group text-left shadow-xs"
                      >
                        <div className={`size-9 rounded-lg border flex items-center justify-center text-xs font-bold transition-all ${idsMatch(selectedVigilante?.id, v.id) ? 'bg-primary border-primary text-white shadow-sm' : 'bg-slate-200 border-slate-300 text-slate-700'}`}>
                           {v.nombre.substring(0,2).toUpperCase()}
                         </div>
                          <div className="min-w-0">
                            <p className="text-[12px] font-bold text-slate-800 truncate">{v.nombre.split(' ')[0]}</p>
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Titular</p>
                          </div>
                      </button>
                    )) : (
                      <div className="col-span-full py-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <span className="material-symbols-outlined text-[24px] text-slate-400 mb-1.5">person_off</span>
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Configura titulares en el puesto</p>
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
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Horario del Servicio</span>
                <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-600 rounded text-[8px] font-bold uppercase tracking-wider">Personalizable</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-250 shadow-xs">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide ml-1">Entrada</label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 z-10 text-[15px] pointer-events-none">schedule</span>
                    <input 
                      type="time"
                      value={tempAsig.inicio}
                      onChange={e => setTempAsig({ ...tempAsig, inicio: e.target.value })}
                      onClick={e => { try { (e.target as any).showPicker(); } catch {} }}
                      className="w-full h-9 bg-white border border-slate-200 rounded-lg pl-9 pr-2 text-[12px] font-bold text-slate-900 focus:border-primary outline-none text-center tabular-nums cursor-pointer"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide ml-1">Salida</label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 z-10 text-[15px] pointer-events-none">history</span>
                    <input 
                      type="time"
                      value={tempAsig.fin}
                      onChange={e => setTempAsig({ ...tempAsig, fin: e.target.value })}
                      onClick={e => { try { (e.target as any).showPicker(); } catch {} }}
                      className="w-full h-9 bg-white border border-slate-200 rounded-lg pl-9 pr-2 text-[12px] font-bold text-slate-900 focus:border-primary outline-none text-center tabular-nums cursor-pointer"
                    />
                  </div>
                </div>

                <div className="col-span-full pt-3.5 border-t border-slate-200 mt-1">
                  <div className="flex flex-wrap gap-1.5">
                    {effectiveTurnos.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setTurnoPreset(p.id)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border ${
                          tempAsig.turno === p.id 
                            ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <span className={`material-symbols-outlined text-[12px] ${tempAsig.turno === p.id ? 'text-white' : 'text-slate-500'}`}>
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
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1 block">Estado Laboral</span>
              <div className="bg-slate-50 rounded-xl p-1 border border-slate-200 space-y-0.5 shadow-xs max-h-[190px] overflow-y-auto custom-scrollbar">
                {ESTADOS_LABORALES.map(j => {
                  const isActive = getActiveCode(tempAsig) === j.codigo;
                  return (
                    <button 
                      key={j.jornada + j.codigo}
                      onClick={() => setEstadoLaboral(j.jornada, j.codigo)}
                      className={`w-full px-3 py-2 rounded-lg flex items-center justify-between transition-all border ${
                        isActive 
                          ? 'border-slate-300 font-bold' 
                          : 'border-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                      }`}
                      style={isActive ? {
                        background: `${j.colorHex}15`,
                        borderColor: `${j.colorHex}30`,
                      } : {}}
                    >
                      <div className="flex items-center gap-2">
                         <span
                           className={`material-symbols-outlined text-[15px]`}
                           style={{ color: isActive ? j.colorHex : '#64748b' }}
                         >{j.icono}</span>
                         <div className="text-left">
                           <span
                             className={`text-[9px] font-bold uppercase tracking-wide block`}
                             style={{ color: isActive ? j.colorHex : '#334155' }}
                           >{j.nombre}</span>
                           {j.esNovedad && (
                             <span className="text-[6.5px] text-rose-600 font-bold uppercase tracking-wider flex items-center gap-0.5">
                               <span className="size-1 rounded-full bg-rose-500 inline-block animate-pulse" />
                               Genera novedad
                             </span>
                           )}
                         </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="text-[7.5px] font-bold px-1 py-0.5 rounded"
                          style={isActive
                            ? { background: j.colorHex, color: '#fff' }
                            : { background: '#cbd5e1', color: '#475569' }
                          }
                        >{j.codigo}</span>
                        <div
                          className="size-3.5 rounded-full border flex items-center justify-center transition-all"
                          style={isActive
                            ? { borderColor: j.colorHex, background: `${j.colorHex}10` }
                            : { borderColor: '#cbd5e1' }
                          }
                        >
                          {isActive && <div className="size-1.5 rounded-full" style={{ background: j.colorHex }} />}
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
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
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
            className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 hover:text-red-600 uppercase tracking-widest transition-all group"
           >
             <div className="size-8 rounded-lg bg-red-50 border border-slate-200 flex items-center justify-center text-red-500 group-hover:bg-red-600 group-hover:text-white transition-colors shadow-xs">
                <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
             </div>
             Remover Asignación
           </button>

           <div className="flex items-center gap-3 w-full md:w-auto">
              <button 
                onClick={onClose}
                className="flex-1 md:flex-none px-4 py-2.5 rounded-lg text-[9px] font-bold text-slate-600 uppercase tracking-widest hover:bg-slate-100 hover:text-slate-900 transition-all bg-white border border-slate-200 shadow-sm"
              >Cancelar</button>
              
              <button 
                onClick={handleSave}
                className="flex-[2] md:flex-none px-5 py-2.5 bg-success hover:bg-success-dark text-white rounded-lg text-[9px] font-bold uppercase tracking-wider shadow-sm transition-all"
              >Confirmar Despacho</button>
           </div>
        </div>
      </div>
    </div>
  );
};
