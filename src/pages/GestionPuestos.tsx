import React, { useState, useEffect, useMemo } from 'react';
import { usePuestoStore } from '../store/puestoStore';
import { useProgramacionStore } from '../store/programacionStore';
import { useVigilanteStore } from '../store/vigilanteStore';
import { PuestoCard } from '../components/puestos/PuestoCard';
import PuestoModal from '../components/puestos/PuestoModal';
import { PanelMensualPuesto } from '../components/puestos/CoordinationPanel';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// ─── STAT CARD ────────────────────────────────────────────────────────────────
const StatCard = ({
  label, value, icon, color, trend,
}: {
  label: string; value: number; icon: string; color: string; trend?: string;
}) => (
  <div
    className="relative group overflow-hidden rounded-[30px] border border-white/5 p-6 transition-all duration-500 hover:border-white/10"
    style={{ background: 'rgba(10, 15, 28, 0.4)', backdropFilter: 'blur(20px)' }}
  >
    <div className="absolute -right-4 -top-4 size-32 opacity-10 blur-3xl pointer-events-none" style={{ backgroundColor: color }} />
    <div className="flex items-start justify-between relative z-10">
      <div className="flex flex-col">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 opacity-40" style={{ color }}>{label}</span>
        <div className="flex items-baseline gap-2">
          <h4 className="text-[42px] font-black text-white leading-none tracking-tighter italic">{value}</h4>
          {trend && (
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">{trend}</span>
          )}
        </div>
      </div>
      <div className="size-14 rounded-2xl flex items-center justify-center border border-white/5 bg-white/5 group-hover:scale-110 transition-transform duration-500 shadow-2xl">
        <span className="material-symbols-outlined text-[32px] opacity-60" style={{ color }}>{icon}</span>
      </div>
    </div>
  </div>
);

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────────
const GestionPuestos = () => {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(new Date().getMonth());
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'master_grid'>('cards');
  const [isNewPuestoModalOpen, setIsNewPuestoModalOpen] = useState(false);
  const [puestoToEdit, setPuestoToEdit] = useState<any>(null);
  const [selectedPuesto, setSelectedPuesto] = useState<any>(null);
  const [filterTab, setFilterTab] = useState<'todos' | 'alerta' | 'sin_personal' | 'publicados'>('todos');
  const [visibleCount, setVisibleCount] = useState(60);

  const { puestos, fetchPuestos, loaded: puestosLoaded } = usePuestoStore();
  const { programaciones, fetchProgramaciones, loaded: progLoaded } = useProgramacionStore();
  const { fetchVigilantes } = useVigilanteStore();

  const isInitialLoading = !puestosLoaded || !progLoaded;

  useEffect(() => {
    const bootstrap = async () => {
      await fetchVigilantes();
      await fetchPuestos();
      await fetchProgramaciones();
    };
    bootstrap();
  }, [fetchPuestos, fetchProgramaciones, fetchVigilantes]);

  // ── Filtros ────────────────────────────────────────────────────────────────
  const filteredPuestos = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const store = useProgramacionStore.getState();
    let base = (puestos || []).filter(p => (p as any).estado !== 'inactivo');

    if (q) {
      base = base.filter(p =>
        p.nombre?.toLowerCase().includes(q) ||
        p.id?.toLowerCase().includes(q) ||
        (p as any).direccion?.toLowerCase().includes(q)
      );
    }

    if (filterTab === 'alerta') {
      base = base.filter(p => {
        const prog = store.getProgramacionRapid?.(p.id || p.dbId, anio, mes);
        if (!prog) return false;
        return (store.getAlertas(prog.id) || []).length > 0;
      });
    } else if (filterTab === 'sin_personal') {
      base = base.filter(p => {
        const prog = store.getProgramacionRapid?.(p.id || p.dbId, anio, mes);
        return !prog?.personal || prog.personal.filter((x: any) => x.vigilanteId).length === 0;
      });
    } else if (filterTab === 'publicados') {
      base = base.filter(p => {
        const prog = store.getProgramacionRapid?.(p.id || p.dbId, anio, mes);
        return prog?.estado === 'publicado';
      });
    }

    return base;
  }, [puestos, searchQuery, filterTab, anio, mes]);

  const pagedPuestos = useMemo(() => filteredPuestos.slice(0, visibleCount), [filteredPuestos, visibleCount]);

  // ── Estadísticas ───────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const active = (puestos || []).filter(p => (p as any).estado !== 'inactivo').length;
    const alertCount = programaciones.filter(pg =>
      pg.anio === anio && pg.mes === mes &&
      ((useProgramacionStore.getState() as any).getAlertas(pg.id) || []).length > 0
    ).length;
    const emptyCount = programaciones.filter(pg =>
      pg.anio === anio && pg.mes === mes &&
      pg.personal.filter((x: any) => x.vigilanteId).length === 0
    ).length;
    const covered = active - emptyCount;
    return { active, covered, alertCount, emptyCount };
  }, [puestos, programaciones, anio, mes]);

  // ── Matriz Maestra ─────────────────────────────────────────────────────────
  const renderMasterGrid = () => {
    const totalDias = new Date(anio, mes + 1, 0).getDate();

    if (isInitialLoading) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-[#020617] rounded-[45px] border border-white/5 animate-pulse py-40">
          <div className="size-24 rounded-[32px] bg-indigo-500/10 flex items-center justify-center mb-6 border border-indigo-500/20">
            <span className="material-symbols-outlined text-[56px] text-primary animate-spin">sync</span>
          </div>
          <p className="text-[12px] font-black text-primary-light uppercase tracking-[0.5em]">Reconstruyendo Red Táctica...</p>
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-hidden flex flex-col bg-slate-950/40 backdrop-blur-xl rounded-[40px] border border-white/10 shadow-2xl relative">
        <div className="overflow-auto custom-scrollbar flex-1">
          <table className="border-collapse border-none select-none" style={{ width: 'max-content', tableLayout: 'fixed' }}>
            <thead className="sticky top-0 z-50">
              <tr>
                {/* Columna nombre puesto */}
                <th className="sticky left-0 z-50 bg-[#0a1120] border-r border-white/10 p-8 text-left" style={{ width: 340 }}>
                  <div className="flex items-center gap-4">
                    <div className="size-11 rounded-xl bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(67,24,255,0.4)]">
                      <span className="material-symbols-outlined text-white text-[24px]">terminal</span>
                    </div>
                    <div>
                      <span className="text-[14px] font-black text-white uppercase tracking-[0.2em] block leading-none">Matriz Ops</span>
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mt-2 block opacity-50">Sincronización Activa</span>
                    </div>
                  </div>
                </th>

                {/* Columnas de días */}
                {Array.from({ length: totalDias }, (_, i) => i + 1).map(d => {
                  const date = new Date(anio, mes, d);
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  return (
                    <th
                      key={d}
                      className={`px-2 py-6 border-r border-white/5 text-center transition-all ${isWeekend ? 'bg-indigo-950/20' : 'bg-slate-900/40'}`}
                      style={{ width: 75 }}
                    >
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 opacity-40">
                        {date.toLocaleDateString('es', { weekday: 'short' }).toUpperCase()}
                      </p>
                      <p className={`text-[19px] font-black italic ${isWeekend ? 'text-primary-light' : 'text-slate-200'}`}>{d}</p>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {filteredPuestos.map((p) => (
                <tr key={p.id} className="group hover:bg-white/[0.03] transition-colors border-b border-white/5">
                  {/* Celda nombre */}
                  <td className="sticky left-0 z-40 bg-[#050b16] group-hover:bg-[#0c152a] border-r border-white/10 px-8 py-7 transition-all">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-primary/70 uppercase tracking-[0.3em] font-mono">{p.id}</span>
                        {(p as any).tipo && (
                          <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-white/5 uppercase">
                            {(p as any).tipo}
                          </span>
                        )}
                      </div>
                      <span
                        onClick={() => setSelectedPuesto({ dbId: p.dbId || p.id, nombre: p.nombre })}
                        className="text-[16px] font-black text-slate-200 tracking-tight truncate hover:text-white cursor-pointer transition-colors uppercase italic"
                      >
                        {p.nombre}
                      </span>
                    </div>
                  </td>

                  {/* Celdas de días */}
                  {Array.from({ length: totalDias }, (_, i) => i + 1).map(d => {
                    const prog = programaciones.find(pg =>
                      pg.puestoId === (p.dbId || p.id) && pg.anio === anio && pg.mes === mes
                    );
                    const asig = prog?.asignaciones?.find(a => a.dia === d);
                    const isWeekend = new Date(anio, mes, d).getDay() === 0 || new Date(anio, mes, d).getDay() === 6;

                    return (
                      <td
                        key={d}
                        className={`p-1 border-r border-white/5 cursor-pointer hover:bg-primary/10 transition-all ${isWeekend ? 'bg-indigo-950/5' : ''}`}
                        onClick={() => setSelectedPuesto({ dbId: p.dbId || p.id, nombre: p.nombre })}
                      >
                        <div className={`h-14 w-full rounded-2xl flex items-center justify-center text-[12px] font-black border-2 transition-all ${
                          asig && asig.vigilanteId
                            ? 'bg-primary/20 border-primary/40 text-primary-light shadow-sm'
                            : asig
                            ? 'bg-white/5 border-white/10 text-slate-600'
                            : 'bg-transparent border-transparent text-slate-800'
                        }`}>
                          {asig?.jornada ? asig.jornada.substring(0, 1).toUpperCase() : '·'}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ── Panel detalle puesto seleccionado ──────────────────────────────────────
  if (selectedPuesto) {
    return (
      <PanelMensualPuesto
        puestoId={selectedPuesto.dbId || selectedPuesto.id}
        puestoNombre={selectedPuesto.nombre}
        anio={anio}
        mes={mes}
        onClose={() => setSelectedPuesto(null)}
      />
    );
  }

  // ── RENDER PRINCIPAL ───────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-[#020617] overflow-hidden text-slate-300">

      {/* ═══ HEADER ═══════════════════════════════════════════════════════════ */}
      <header className="bg-[#050b16] px-10 py-7 border-b border-white/10 shrink-0 flex items-center justify-between shadow-2xl z-50">
        <div className="flex items-center gap-10">

          {/* Título */}
          <div className="flex flex-col">
            <div className="flex items-center gap-3 mb-1.5 opacity-40">
              <span className="text-[10px] font-black tracking-[0.5em] uppercase">Control Operativo</span>
              <div className="h-[1px] w-12 bg-slate-700" />
            </div>
            <h1 className="text-[34px] font-black text-white italic tracking-tighter leading-none flex items-baseline gap-4">
              GESTIÓN <span className="text-primary not-italic">DE</span>{' '}
              <span className="text-slate-500 font-bold not-italic">PUESTOS</span>
            </h1>
          </div>

          {/* Selector mes/año */}
          <div className="h-14 flex items-center bg-black/40 rounded-2xl border border-white/10 p-1 divide-x divide-white/5 shadow-inner">
            <button
              onClick={() => { const d = new Date(anio, mes - 1); setAnio(d.getFullYear()); setMes(d.getMonth()); }}
              className="px-4 text-slate-500 hover:text-primary transition-all active:scale-90"
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <div className="px-8 flex flex-col items-center justify-center min-w-[140px]">
              <span className="text-[18px] font-black text-white uppercase italic leading-none">{MONTH_NAMES[mes]}</span>
              <span className="text-[9px] font-bold text-primary tracking-[0.3em] mt-1">{anio}</span>
            </div>
            <button
              onClick={() => { const d = new Date(anio, mes + 1); setAnio(d.getFullYear()); setMes(d.getMonth()); }}
              className="px-4 text-slate-500 hover:text-primary transition-all active:scale-90"
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </div>

        {/* Acciones header */}
        <div className="flex items-center gap-6">
          {/* Toggle vista */}
          <div className="flex bg-black/40 p-1.5 rounded-[20px] border border-white/5 shadow-xl">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-6 py-3 rounded-[15px] flex items-center gap-3 text-[11px] font-black uppercase tracking-widest transition-all ${
                viewMode === 'cards'
                  ? 'bg-primary text-white shadow-[0_0_20px_rgba(67,24,255,0.4)]'
                  : 'text-slate-600 hover:text-slate-400'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">grid_view</span>
              <span>Visión</span>
            </button>
            <button
              onClick={() => setViewMode('master_grid')}
              className={`px-6 py-3 rounded-[15px] flex items-center gap-3 text-[11px] font-black uppercase tracking-widest transition-all ${
                viewMode === 'master_grid'
                  ? 'bg-primary text-white shadow-[0_0_20px_rgba(67,24,255,0.4)]'
                  : 'text-slate-600 hover:text-slate-400'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">table_chart</span>
              <span>Matriz</span>
            </button>
          </div>

          {/* Nuevo puesto */}
          <button
            onClick={() => setIsNewPuestoModalOpen(true)}
            className="h-14 px-8 bg-white text-black rounded-[20px] font-black text-[12px] uppercase tracking-widest hover:bg-primary hover:text-white transition-all transform hover:-translate-y-1 active:scale-95 shadow-[0_15px_30px_rgba(0,0,0,0.3)] flex items-center gap-3"
          >
            <span className="material-symbols-outlined text-[22px]">add_task</span>
            <span>Nuevo Puesto</span>
          </button>
        </div>
      </header>

      {/* ═══ CONTENIDO PRINCIPAL ═══════════════════════════════════════════════ */}
      <main className="flex-1 overflow-hidden" style={{ background: 'radial-gradient(circle at 50% -20%, #0c152a 0%, #020617 70%)' }}>
        <div className="h-full flex flex-col overflow-hidden px-10 py-8">

          {/* ── ESTADÍSTICAS ── */}
          <div className="grid grid-cols-4 gap-6 mb-8 shrink-0">
            <StatCard label="Total Objetivos"       value={stats.active}     icon="military_tech" color="#6366f1" />
            <StatCard label="Puestos Operativos"    value={stats.covered}    icon="shield"        color="#10b981" trend="+2% Hoy" />
            <StatCard label="Alertas Críticas"      value={stats.alertCount} icon="error"         color="#f43f5e" />
            <StatCard label="Vacantes / Pendientes" value={stats.emptyCount} icon="pending"       color="#f59e0b" />
          </div>

          {/* ── BARRA DE BÚSQUEDA Y FILTROS ── */}
          <div className="flex items-center gap-6 mb-8 shrink-0">
            {/* Búsqueda */}
            <div className="flex-1 relative group bg-white/[0.03] border border-white/10 rounded-[25px] flex items-center h-14 transition-all focus-within:border-primary/50 focus-within:bg-white/[0.06] pr-4">
              <span className="material-symbols-outlined px-6 text-slate-600 transition-colors group-focus-within:text-primary text-[26px]">
                search_insights
              </span>
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Localizar puesto por nombre o código táctico..."
                className="flex-1 bg-transparent outline-none text-[15px] font-bold text-white placeholder:text-slate-700 tracking-tight"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="size-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-slate-500 hover:text-white transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </div>

            {/* Tabs de filtro */}
            <div className="flex bg-black/40 border border-white/10 p-1.5 rounded-[22px] backdrop-blur-3xl shadow-2xl">
              {[
                { id: 'todos',        label: 'TODOS',    icon: 'all_inclusive' },
                { id: 'alerta',       label: 'ALERTAS',  icon: 'notifications_active' },
                { id: 'sin_personal', label: 'VACÍOS',   icon: 'person_off' },
                { id: 'publicados',   label: 'OK',       icon: 'verified' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => { setFilterTab(t.id as any); setVisibleCount(60); }}
                  className={`flex items-center gap-2 px-5 py-3 rounded-[18px] text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                    filterTab === t.id
                      ? 'bg-primary text-white shadow-2xl'
                      : 'text-slate-600 hover:text-slate-400'
                  }`}
                >
                  <span className="material-symbols-outlined text-[17px]">{t.icon}</span>
                  <span>{t.label}</span>
                  {filterTab === t.id && (
                    <span className="ml-1 text-[9px] bg-white/20 px-1.5 py-0.5 rounded-full font-black">
                      {filteredPuestos.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ── CONTENIDO: CARDS O MATRIZ ── */}
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-10">
            {viewMode === 'cards' ? (
              <>
                {isInitialLoading ? (
                  /* Skeleton loading */
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-64 rounded-[35px] bg-white/[0.02] border border-white/5 animate-pulse"
                        style={{ animationDelay: `${i * 80}ms` }}
                      />
                    ))}
                  </div>
                ) : pagedPuestos.length === 0 ? (
                  /* Estado vacío */
                  <div className="flex flex-col items-center justify-center py-40 border-2 border-dashed border-white/5 rounded-[40px] bg-white/[0.01]">
                    <div className="size-20 rounded-full bg-slate-900 flex items-center justify-center mb-6 border border-white/5">
                      <span className="material-symbols-outlined text-[42px] text-slate-700">radar</span>
                    </div>
                    <p className="text-[13px] font-black text-slate-600 uppercase tracking-[0.4em] mb-2">Señal perdida</p>
                    <p className="text-[11px] text-slate-700 uppercase tracking-wider">No hay puestos para los filtros seleccionados</p>
                    <button
                      onClick={() => { setSearchQuery(''); setFilterTab('todos'); }}
                      className="mt-8 px-8 py-3 bg-white/5 hover:bg-primary rounded-xl font-black text-[11px] uppercase tracking-widest text-slate-400 hover:text-white transition-all border border-white/5"
                    >
                      Limpiar Filtros
                    </button>
                  </div>
                ) : (
                  /* Grid de tarjetas */
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                    {pagedPuestos.map(p => (
                      <PuestoCard
                        key={p.id}
                        puesto={p}
                        anio={anio}
                        mes={mes}
                        onClick={() => setSelectedPuesto({ dbId: p.dbId || p.id, nombre: p.nombre })}
                      />
                    ))}
                  </div>
                )}

                {/* Cargar más */}
                {visibleCount < filteredPuestos.length && (
                  <div className="flex justify-center pt-16">
                    <button
                      onClick={() => setVisibleCount(v => v + 60)}
                      className="px-16 py-5 bg-white text-black hover:bg-primary hover:text-white rounded-2xl font-black uppercase text-[12px] tracking-[0.2em] transition-all transform hover:-translate-y-1 shadow-2xl flex items-center gap-3"
                    >
                      <span className="material-symbols-outlined">expand_more</span>
                      Expandir Conexión ({filteredPuestos.length - visibleCount} más)
                    </button>
                  </div>
                )}
              </>
            ) : (
              /* Vista Matriz */
              renderMasterGrid()
            )}
          </div>

        </div>
      </main>

      {/* ═══ MODALES ══════════════════════════════════════════════════════════ */}
      <PuestoModal
        isOpen={isNewPuestoModalOpen}
        puestoId={puestoToEdit?.id}
        onClose={() => { setIsNewPuestoModalOpen(false); setPuestoToEdit(null); }}
        onCreated={() => fetchPuestos()}
      />
    </div>
  );
};

export default GestionPuestos;
