import React, { useState } from 'react';
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
  { id: "normal", nombre: "Jornada Normal", short: "N", color: "#4318FF", textColor: "#fff" },
  { id: "descanso_remunerado", nombre: "Descanso Remunerado", short: "DR", color: "#00b377", textColor: "#fff" },
  { id: "descanso_no_remunerado", nombre: "Descanso No Remunerado", short: "DNR", color: "#ff9500", textColor: "#fff" },
  { id: "vacacion", nombre: "Vacación", short: "VAC", color: "#8b5cf6", textColor: "#fff" },
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

  const checkConflict = (vid: string, t: string): string | null => {
    if (!vid) return null;
    const slots = ocupados.get(vid) || [];
    const match = slots.find((s) => s.slot === `${asig.dia}-${t}`);
    if (match) return `🚫 Ocupado en "${match.puesto}" (Día ${asig.dia} ${t})`;
    return null;
  };

  const conflicto = checkConflict(vigilanteId, turno);

  const filteredVigilantes = React.useMemo(() => {
    const q = vigSearch.toLowerCase().trim();
    if (!q) {
      // Sin búsqueda: mostrar titulares primero
      const titulares = vigilantes.filter(v => titularesId.includes(v.id));
      
      // Obtener el resto de vigilantes (que no son titulares)
      const nonTitulares = vigilantes.filter(v => !titularesId.includes(v.id));
      
      const disponibles = nonTitulares.filter(v => v.estado === 'disponible');
      const activos = nonTitulares.filter(v => v.estado !== 'disponible');
      
      let finalOtros = [...disponibles];
      
      // Si hay menos de 20 disponibles, rellenamos con activos para no dejar la lista vacía
      if (finalOtros.length < 20) {
          finalOtros = [...finalOtros, ...activos];
      }
      
      return [...titulares, ...finalOtros.slice(0, 30)]; // Mostramos máximo unos 30 iniciales
    }
    return vigilantes.filter(v =>
      v.nombre?.toLowerCase().includes(q) || v.id?.toLowerCase().includes(q)
    ).slice(0, 60);
  }, [vigSearch, vigilantes, titularesId]);

  // Buscar nombre del vigilante seleccionado directamente en la lista
  const selectedVig = vigilantes.find(v => v.id === vigilanteId);

  const handleGuardar = () => {
    if (!vigilanteId) {
      // si no hay vigilante, guardamos como vacante
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
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-black text-slate-800 uppercase tracking-tight">
                Asignar Turno · Día {asig.dia}
              </h2>
              <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-black rounded-lg uppercase">
                {getRolLabel(asig.rol)}
              </span>
            </div>
            <button onClick={onClose} className="size-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* CONFLICTO */}
          {conflicto && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-[11px] font-bold text-red-700 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">warning</span>
              {conflicto}
            </div>
          )}

          {/* VIGILANTE SELECCIONADO */}
          {selectedVig && (
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl flex items-center gap-3">
              <div className="size-9 rounded-xl bg-primary flex items-center justify-center text-white font-black text-sm">
                {selectedVig.nombre?.[0] || '?'}
              </div>
              <div>
                <p className="text-[12px] font-black text-slate-800">{selectedVig.nombre}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase">
                  {titularesId.includes(selectedVig.id) ? '★ Titular' : 'Personal externo'} · {selectedVig.estado || 'activo'}
                </p>
              </div>
            </div>
          )}

          {/* TURNO */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Turno</label>
              <button
                onClick={() => setShowCustomHours(!showCustomHours)}
                className="text-[9px] font-black text-primary uppercase"
              >
                {showCustomHours ? 'Usar horario del turno' : 'Personalizar hora'}
              </button>
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
                  className={`py-2.5 px-3 rounded-xl text-[10px] font-black border-2 transition-all ${
                    turno === t.id
                      ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20'
                      : 'border-slate-100 text-slate-500 hover:border-primary/30'
                  }`}
                >
                  {t.nombre}
                  <span className="block text-[8px] opacity-70">{t.inicio} – {t.fin}</span>
                </button>
              ))}
            </div>
          </div>

          {showCustomHours && (
            <div className="flex gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex-1">
                <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">Entrada</span>
                <input
                  type="time"
                  value={horaInicio}
                  onChange={e => setHoraInicio(e.target.value)}
                  className="w-full text-xs font-bold p-2 rounded-lg border border-slate-200 outline-none focus:border-primary/50"
                />
              </div>
              <div className="flex-1">
                <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">Salida</span>
                <input
                  type="time"
                  value={horaFin}
                  onChange={e => setHoraFin(e.target.value)}
                  className="w-full text-xs font-bold p-2 rounded-lg border border-slate-200 outline-none focus:border-primary/50"
                />
              </div>
            </div>
          )}

          {/* JORNADA */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
              Tipo de Jornada
            </label>
            <div className="grid grid-cols-2 gap-2">
              {jList.map(j => (
                <button
                  key={j.id}
                  onClick={() => setJornada(j.id as TipoJornada)}
                  className={`py-2 px-3 rounded-xl text-[10px] font-black border-2 transition-all flex items-center gap-2 ${
                    jornada === j.id
                      ? 'border-transparent text-white shadow-md'
                      : 'border-slate-100 text-slate-500 hover:border-slate-200'
                  }`}
                  style={jornada === j.id ? { backgroundColor: j.color, borderColor: j.color } : {}}
                >
                  <span
                    className="size-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: jornada === j.id ? 'rgba(255,255,255,0.5)' : j.color }}
                  />
                  {j.nombre}
                </button>
              ))}
            </div>
          </div>

          {/* VIGILANTE */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
              Vigilante
            </label>
            <input
              type="text"
              placeholder="Buscar vigilante por nombre o ID..."
              value={vigSearch}
              onChange={e => setVigSearch(e.target.value)}
              className="w-full h-10 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none mb-2 focus:border-primary/50 transition-colors"
            />
            <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-xl p-1 bg-white custom-scrollbar">
              {/* Opción vacante */}
              <button
                onClick={() => setVigilanteId("")}
                className={`w-full text-left px-3 py-2 text-[10px] font-bold rounded-lg transition-all ${!vigilanteId ? 'bg-primary/10 text-primary' : 'hover:bg-slate-50 text-slate-400'}`}
              >
                — Vacante / Sin asignar —
              </button>
              {filteredVigilantes.length === 0 && (
                <p className="text-center text-[10px] text-slate-400 py-4">No se encontraron vigilantes</p>
              )}
              {filteredVigilantes.map(v => (
                <button
                  key={v.id}
                  onClick={() => setVigilanteId(v.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-all flex justify-between items-center ${
                    vigilanteId === v.id ? 'bg-primary/10 text-primary' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-black truncate">{v.nombre}</p>
                    <p className="text-[8px] opacity-60 uppercase">
                      {v.id}
                      {titularesId.includes(v.id) && <span className="ml-1 text-amber-500">★ Titular</span>}
                    </p>
                  </div>
                  {checkConflict(v.id, turno) && (
                    <span className="material-symbols-outlined text-orange-400 text-[16px] flex-shrink-0">warning</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="p-6 pt-3 flex gap-2 border-t border-slate-100">
          <button
            onClick={() => onSave({ vigilanteId: null, turno, jornada: 'sin_asignar', rol: asig.rol })}
            className="px-4 py-3 bg-red-50 text-red-500 rounded-2xl font-black text-[10px] uppercase hover:bg-red-100 transition-colors"
          >
            Limpiar
          </button>
          <button
            onClick={handleGuardar}
            disabled={!vigilanteId && jornada !== 'sin_asignar'}
            className="flex-1 py-3 bg-primary text-white rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {vigilanteId ? `Asignar ${selectedVig?.nombre?.split(' ')[0] || ''}` : 'Guardar vacante'}
          </button>
        </div>
      </div>
    </div>
  );
};
