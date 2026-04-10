import React, { useState, useMemo } from 'react';
import { type AsignacionDia, type TipoJornada, type TurnoHora } from '../../store/programacionStore';
import { type TurnoConfig, type JornadaCustom } from '../../store/puestoStore';

interface EditCeldaModalProps {
  asig: AsignacionDia;
  vigilantes: any[];
  titularesId: string[];
  ocupados: Map<string, any[]>;
  turnosConfig: TurnoConfig[];
  jornadasCustom: JornadaCustom[];
  onSave: (data: Partial<AsignacionDia>) => void;
  onClose: () => void;
  initialVigilanteId?: string;
}

const getRolLabel = (rol: string) => {
  const base: Record<string, string> = { titular_a: "Titular A", titular_b: "Titular B", relevante: "Relevante" };
  return base[rol] || rol.replace(/_/g, " ").toUpperCase();
};

const DEFAULT_TURNOS: TurnoConfig[] = [
  { id: "AM", nombre: "Turno AM", inicio: "06:00", fin: "18:00" },
  { id: "PM", nombre: "Turno PM", inicio: "18:00", fin: "06:00" },
];

const DEFAULT_JORNADAS: JornadaCustom[] = [
  { id: "normal", nombre: "Turno Laboral", short: "D", color: "#4f46e5", textColor: "#fff" },
  { id: "descanso_remunerado", nombre: "Descanso Pagado", short: "DR", color: "#10b981", textColor: "#fff" },
  { id: "descanso_no_remunerado", nombre: "Descanso Libre", short: "DNR", color: "#f59e0b", textColor: "#fff" },
  { id: "vacacion", nombre: "Vacaciones", short: "VAC", color: "#8b5cf6", textColor: "#fff" },
];

export const EditCeldaModal = ({
  asig,
  vigilantes,
  titularesId,
  ocupados,
  turnosConfig,
  jornadasCustom,
  onSave,
  onClose,
  initialVigilanteId,
}: EditCeldaModalProps) => {
  const [vigilanteId, setVigilanteId] = useState(initialVigilanteId || asig.vigilanteId || "");
  const [turno, setTurno] = useState<TurnoHora>(asig.turno as TurnoHora || "AM");
  const [jornada, setJornada] = useState<TipoJornada>(
    asig.jornada === 'sin_asignar' ? 'normal' : asig.jornada
  );
  const [vigSearch, setVigSearch] = useState("");

  const tList = turnosConfig.length ? turnosConfig : DEFAULT_TURNOS;
  const jList = jornadasCustom.length ? jornadasCustom : DEFAULT_JORNADAS;
  const turnoConf = tList.find((t) => t.id === turno) || tList[0];

  const [horaInicio, setHoraInicio] = useState(asig.inicio || turnoConf?.inicio || "06:00");
  const [horaFin, setHoraFin] = useState(asig.fin || turnoConf?.fin || "18:00");
  const [showCustomHours, setShowCustomHours] = useState(!!asig.inicio);

  const getConflict = (vid: string, t: string): { puesto: string; slot: string } | null => {
    if (!vid) return null;
    const slots = ocupados.get(vid) || [];
    return slots.find((s) => s.slot === `${asig.dia}-${t}`) || null;
  };

  const conflicto = getConflict(vigilanteId, turno);

  const filteredVigilantes = useMemo(() => {
    const q = vigSearch.toLowerCase().trim();
    
    // Filtro base: Titulares siempre arriba si no hay búsqueda
    let list = [...vigilantes];
    
    if (q) {
      list = list.filter(v =>
        v.nombre?.toLowerCase().includes(q) || 
        v.cedula?.includes(q) || 
        v.id?.toLowerCase().includes(q)
      );
    }

    // Ordenar: Titulares -> Disponibles -> Resto
    return list.sort((a, b) => {
      const isTitA = titularesId.includes(a.id) ? -1 : 1;
      const isTitB = titularesId.includes(b.id) ? -1 : 1;
      if (isTitA !== isTitB) return isTitA;
      
      const isDispA = a.estado === 'disponible' ? -1 : 1;
      const isDispB = b.estado === 'disponible' ? -1 : 1;
      return isDispA - isDispB;
    }).slice(0, 50);
  }, [vigSearch, vigilantes, titularesId]);

  const selectedVig = vigilantes.find(v => v.id === vigilanteId);

  const handleGuardar = () => {
    if (!vigilanteId) {
      onSave({ vigilanteId: null, turno, jornada: 'sin_asignar', rol: asig.rol });
      return;
    }
    onSave({
      vigilanteId,
      turno,
      jornada,
      rol: asig.rol,
      inicio: showCustomHours ? horaInicio : undefined,
      fin: showCustomHours ? horaFin : undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-white/10 rounded-[40px] w-full max-w-2xl shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* TOP BAR TÁCTICA */}
        <div className="px-8 py-6 border-b border-white/5 bg-gradient-to-r from-slate-900 to-indigo-950/30 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-indigo-400 text-[28px]">edit_calendar</span>
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tighter leading-none">
                Gestión de Despacho
              </h2>
              <div className="flex gap-2 mt-2">
                <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-[9px] font-black rounded-lg uppercase tracking-widest border border-indigo-500/30">
                  Día {asig.dia}
                </span>
                <span className="px-2 py-0.5 bg-white/5 text-slate-400 text-[9px] font-black rounded-lg uppercase tracking-widest border border-white/10">
                  {getRolLabel(asig.rol)}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="size-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/15 transition-all group">
            <span className="material-symbols-outlined text-white/50 group-hover:text-white text-[22px]">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
          
          {/* SECTOR 1: VIGILANTE SELECCIONADO / BUSCADOR */}
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Seleccionar Personal</label>
              {vigilanteId && (
                <button onClick={() => setVigilanteId("")} className="text-[10px] font-black text-rose-400 hover:text-rose-300 uppercase underline decoration-rose-400/30">Liberar Turno</button>
              )}
            </div>
            
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors">person_search</span>
              <input
                type="text"
                placeholder="Busca por nombre, cédula o ID..."
                value={vigSearch}
                onChange={e => setVigSearch(e.target.value)}
                autoFocus
                className="w-full pl-12 pr-4 py-4 bg-white/[0.03] border border-white/10 rounded-2xl text-sm font-bold text-white outline-none focus:border-indigo-500/50 focus:bg-white/[0.05] transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar p-1">
              {filteredVigilantes.map(v => {
                const isSelected = vigilanteId === v.id;
                const isTitular = titularesId.includes(v.id);
                const conflict = getConflict(v.id, turno);
                
                return (
                  <button
                    key={v.id}
                    onClick={() => setVigilanteId(v.id)}
                    className={`group relative text-left p-3 rounded-2xl border transition-all flex items-center gap-3 ${
                      isSelected 
                        ? 'bg-indigo-600 border-indigo-500 shadow-lg shadow-indigo-600/20' 
                        : 'bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className={`size-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-inner ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700'
                    }`}>
                      {v.nombre?.[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[12px] font-black truncate ${isSelected ? 'text-white' : 'text-slate-200'}`}>{v.nombre}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {isTitular && <span className="text-[8px] font-black text-amber-500 uppercase tracking-tighter">★ Titular</span>}
                        {!isTitular && <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">Externo</span>}
                        {conflict && <span className="text-[8px] font-black text-rose-400 uppercase tracking-tighter">• Ocupado</span>}
                        {!conflict && v.estado === 'disponible' && <span className="text-[8px] font-black text-emerald-500 uppercase tracking-tighter">• Disponible</span>}
                      </div>
                    </div>
                    {conflict && (
                      <div className="absolute top-2 right-2 size-2 bg-rose-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.5)]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* SECTOR 2: CONFIGURACIÓN DE TURNO */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Configuración de Horario</label>
                <div onClick={() => setShowCustomHours(!showCustomHours)} className="flex items-center gap-2 cursor-pointer group">
                  <span className={`text-[9px] font-black uppercase transition-colors ${showCustomHours ? 'text-indigo-400' : 'text-slate-600 group-hover:text-slate-400'}`}>Personalizar</span>
                  <div className={`w-6 h-3 rounded-full relative transition-colors ${showCustomHours ? 'bg-indigo-600' : 'bg-slate-700'}`}>
                    <div className={`absolute top-0.5 size-2 rounded-full bg-white transition-all ${showCustomHours ? 'left-3.5' : 'left-0.5'}`} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {tList.map(t => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTurno(t.id as TurnoHora);
                      if (!showCustomHours) {
                        setHoraInicio(t.inicio);
                        setHoraFin(t.fin);
                      }
                    }}
                    className={`p-3 rounded-2xl text-[10px] font-black border transition-all text-center group ${
                      turno === t.id
                        ? 'bg-white/10 border-white/20 text-white'
                        : 'bg-white/[0.02] border-white/5 text-slate-500 hover:border-white/10'
                    }`}
                  >
                    <span className={`size-1.5 rounded-full inline-block mr-2 mb-0.5 transition-colors ${turno === t.id ? 'bg-indigo-400' : 'bg-slate-700 group-hover:bg-slate-500'}`} />
                    {t.nombre}
                    <p className="text-[8px] opacity-40 mt-1">{t.inicio} — {t.fin}</p>
                  </button>
                ))}
              </div>

              {showCustomHours && (
                <div className="grid grid-cols-2 gap-3 p-4 bg-white/[0.03] border border-white/5 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                  <div>
                    <span className="text-[8px] font-black text-slate-500 uppercase block mb-1.5 ml-1">Inicio Custom</span>
                    <input
                      type="time"
                      value={horaInicio}
                      onChange={e => setHoraInicio(e.target.value)}
                      className="w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-xs font-black text-white outline-none focus:border-indigo-500/30 transition-all"
                    />
                  </div>
                  <div>
                    <span className="text-[8px] font-black text-slate-500 uppercase block mb-1.5 ml-1">Fin Custom</span>
                    <input
                      type="time"
                      value={horaFin}
                      onChange={e => setHoraFin(e.target.value)}
                      className="w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-xs font-black text-white outline-none focus:border-indigo-500/30 transition-all"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* SECTOR 3: TIPO DE JORNADA */}
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Estado de la Jornada</label>
              <div className="grid grid-cols-1 gap-2">
                {jList.map(j => (
                  <button
                    key={j.id}
                    onClick={() => setJornada(j.id as TipoJornada)}
                    className={`flex items-center gap-3 p-3 rounded-2xl border transition-all text-left group ${
                      jornada === j.id
                        ? 'bg-white/10 border-white/20 text-white'
                        : 'bg-white/[0.02] border-white/5 text-slate-500 hover:border-white/10'
                    }`}
                  >
                    <div 
                      className="size-4 rounded-full border-2 border-slate-700 flex items-center justify-center shrink-0"
                      style={jornada === j.id ? { borderColor: j.color } : {}}
                    >
                      {jornada === j.id && <div className="size-2 rounded-full" style={{ backgroundColor: j.color }} />}
                    </div>
                    <div>
                      <p className={`text-[11px] font-black transition-colors ${jornada === j.id ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'}`}>{j.nombre}</p>
                      <p className="text-[8px] opacity-40 uppercase tracking-widest">{j.short}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* MENSAJE DE ADVERTENCIA DE CARGA DUPLICADA */}
          {conflicto && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-3xl flex items-center gap-4 animate-in pulse duration-500">
               <div className="size-10 rounded-2xl bg-amber-500/20 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-amber-500 text-[20px]">notification_important</span>
               </div>
               <div className="pr-4">
                  <p className="text-[11px] font-black text-amber-200 uppercase tracking-wide">Aviso de Carga Duplicada</p>
                  <p className="text-[10px] font-medium text-amber-400 mt-0.5">El vigilante ya tiene un turno en <b>{conflicto.puesto}</b>. ¿Deseas confirmar este despacho?</p>
               </div>
            </div>
          )}

          {!conflicto && selectedVig && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl flex items-center gap-4">
               <div className="size-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-emerald-500 text-[20px]">check_circle</span>
               </div>
               <div>
                  <p className="text-[11px] font-black text-emerald-200 uppercase tracking-wide">Personal Verificado</p>
                  <p className="text-[10px] font-medium text-emerald-400 mt-0.5">{selectedVig.nombre} está disponible para este despacho táctico.</p>
               </div>
            </div>
          )}

        </div>

        {/* ACCIONES FINALES */}
        <div className="px-8 py-8 border-t border-white/5 bg-slate-950/50 flex flex-col sm:flex-row gap-4">
          <button
            onClick={onClose}
            className="px-8 py-4 bg-white/5 hover:bg-white/10 text-slate-400 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all"
          >
            Cancelar
          </button>
          
          <button
            onClick={handleGuardar}
            disabled={!vigilanteId && jornada !== 'sin_asignar'}
            className={`flex-1 py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-2xl relative overflow-hidden group ${
              !vigilanteId 
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-600/40'
            }`}
          >
            {/* Efecto de brillo al pasar el mouse por el botón */}
            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            
            <span className="material-symbols-outlined text-[18px]">
              {conflicto ? 'priority_high' : 'verified_user'}
            </span>
            {vigilanteId 
              ? (conflicto ? `Confirmar Doble Turno` : `Asignar a ${selectedVig?.nombre?.split(' ')[0]}`) 
              : 'Confirmar Registro de Vacante'
            }
          </button>
        </div>
      </div>
    </div>
  );
};
