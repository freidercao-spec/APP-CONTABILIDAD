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

const GestionPuestos = () => {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(new Date().getMonth());
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<'cards' | 'master_grid'>('cards');
  const [isNewPuestoModalOpen, setIsNewPuestoModalOpen] = useState(false);
  const [puestoToEdit, setPuestoToEdit] = useState<any>(null);
  const [selectedPuesto, setSelectedPuesto] = useState<any>(null);

  const { puestos, fetchPuestos, loaded: puestosLoaded } = usePuestoStore();
  const { programaciones, fetchProgramaciones, loaded: progLoaded } = useProgramacionStore();
  const { vigilantes, fetchVigilantes } = useVigilanteStore();

  const isInitialLoading = !puestosLoaded || !progLoaded;

  useEffect(() => {
    const bootstrap = async () => {
      await fetchVigilantes();
      await fetchPuestos();
      await fetchProgramaciones();
    };
    bootstrap();
  }, [fetchPuestos, fetchProgramaciones, fetchVigilantes]);

  const [filterTab, setFilterTab] = useState<'todos' | 'alerta' | 'sin_personal' | 'publicados'>('todos');
  const [visibleCount, setVisibleCount] = useState(60);
  
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

  const renderMasterGrid = () => {
    const totalDias = new Date(anio, mes + 1, 0).getDate();
    if (isInitialLoading) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 rounded-[45px] border border-white/5 animate-pulse">
           <div className="size-24 rounded-[32px] bg-indigo-500/10 flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-[56px] text-primary animate-spin">sync</span>
           </div>
           <p className="text-[12px] font-black text-primary-light uppercase tracking-[0.5em]">Reconstruyendo Red Táctica...</p>
        </div>
      );
    }
    return (
      <div className="flex-1 overflow-hidden flex flex-col bg-slate-950/40 backdrop-blur-xl rounded-[45px] border border-white/10 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] relative">
        <div className="overflow-auto custom-scrollbar flex-1">
          <table className="border-collapse border-none select-none" style={{ width: 'max-content', tableLayout: 'fixed' }}>
            <thead className="sticky top-0 z-50">
              <tr>
                <th className="sticky left-0 z-50 bg-slate-900 border-r-2 border-indigo-500/30 p-8 text-left shadow-[10px_0_40px_rgba(0,0,0,0.5)]" style={{ width: 320 }}>
                  <div className="flex items-center gap-4">
                    <div className="size-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary-light text-[24px]">terminal</span>
                    </div>
                    <div>
                      <span className="text-[13px] font-black text-white uppercase tracking-[0.3em] block leading-none">Matriz de Objetivos</span>
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1.5 block">Nivel Ops: 1</span>
                    </div>
                  </div>
                </th>
                {Array.from({ length: totalDias }, (_, i) => i + 1).map(d => {
                  const date = new Date(anio, mes, d);
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  return (
                    <th key={d} className={`px-2 py-6 border-r border-white/5 text-center transition-all ${isWeekend ? 'bg-indigo-950/20' : 'bg-slate-900/80'}`} style={{ width: 70 }}>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 opacity-60">
                        {date.toLocaleDateString('es', { weekday: 'short' }).substring(0, 1)}
                      </p>
                      <p className={`text-lg font-black italic ${isWeekend ? 'text-primary-light' : 'text-slate-200'}`}>{d}</p>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredPuestos.map((p) => (
                <tr key={p.id} className="group hover:bg-white/[0.02] transition-colors border-b border-white/5">
                  <td className="sticky left-0 z-40 bg-slate-950 group-hover:bg-[#111c31] border-r-2 border-white/5 px-8 py-6 shadow-[10px_0_40px_rgba(0,0,0,0.3)] transition-all">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-primary/70 uppercase tracking-[0.3em]">{p.id}</span>
                        <button 
                          onClick={() => { setPuestoToEdit(p); setIsNewPuestoModalOpen(true); }}
                          className="size-8 rounded-xl bg-white/5 hover:bg-indigo-500 text-slate-500 hover:text-white transition-all flex items-center justify-center border border-white/5 shadow-xl"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit_note</span>
                        </button>
                      </div>
                      <span 
                        onClick={() => setSelectedPuesto({ dbId: p.dbId || p.id, nombre: p.nombre })}
                        className="text-[15px] font-black text-slate-200 tracking-tight truncate hover:text-primary-light cursor-pointer transition-colors uppercase italic"
                      >
                        {p.nombre}
                      </span>
                    </div>
                  </td>
                  {Array.from({ length: totalDias }, (_, i) => i + 1).map(d => {
                    const prog = programaciones.find(pg => pg.puestoId === (p.dbId || p.id) && pg.anio === anio && pg.mes === mes);
                    const asig = prog?.asignaciones?.find(a => a.dia === d);
                    return (
                      <td 
                        key={d} 
                        className="p-1 border-r border-white/5 cursor-pointer hover:bg-indigo-500/10 transition-all"
                        onClick={() => setSelectedPuesto({ dbId: p.dbId || p.id, nombre: p.nombre })}
                      >
                        <div className={`h-12 w-full rounded-xl flex items-center justify-center text-[11px] font-black border transition-all ${
                          asig ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-900/40 border-indigo-400 scale-[0.85]' : 'bg-white/5 border-white/5 text-slate-700 hover:border-white/20'
                        }`}>
                          {asig ? asig.jornada.substring(0,1).toUpperCase() : '·'}
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

  return (
    <div className="h-screen flex flex-col bg-[#050b16]">
      <header className="bg-[#0a1120] text-white px-10 py-6 border-b border-white/5 shrink-0 flex items-center justify-between shadow-2xl z-30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-indigo-500/5 blur-[100px] pointer-events-none"></div>
        
        <div className="flex items-center gap-8 flex-1">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-0.5">
              <div className="size-2 bg-primary rounded-full animate-pulse shadow-[0_0_8px_#4318ff]"></div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">SISTEMA DE CONTROL TÁCTICO</span>
            </div>
            <h1 className="text-3xl font-black text-white uppercase tracking-tighter leading-none italic flex items-baseline gap-3">
              GESTIÓN <span className="text-primary text-[28px] not-italic">DE</span> <span className="bg-gradient-to-r from-white to-slate-500 bg-clip-text text-transparent not-italic">PUESTOS</span>
            </h1>
          </div>

          <div className="flex items-center bg-black/50 border border-white/5 rounded-3xl p-1 ml-6 shadow-2xl backdrop-blur-xl">
            <button 
              onClick={() => { const d = new Date(anio, mes - 1); setAnio(d.getFullYear()); setMes(d.getMonth()); }}
              className="p-3 text-slate-500 hover:text-white transition-all transform active:scale-90"
            >
              <span className="material-symbols-outlined text-2xl">arrow_back_ios_new</span>
            </button>
            <div className="px-5 py-0.5 text-center min-w-[130px] border-x border-white/5">
              <p className="text-[9px] font-black text-primary uppercase tracking-[0.4em] mb-0">{anio}</p>
              <p className="text-[16px] font-black text-white uppercase tracking-[0.1em] italic">{MONTH_NAMES[mes]}</p>
            </div>
            <button 
              onClick={() => { const d = new Date(anio, mes + 1); setAnio(d.getFullYear()); setMes(d.getMonth()); }}
              className="p-3 text-slate-500 hover:text-white transition-all transform active:scale-90"
            >
              <span className="material-symbols-outlined text-2xl">arrow_forward_ios</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="flex bg-black/40 border border-white/5 rounded-3xl p-1.5 shadow-xl">
            <button 
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-3 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'cards' ? 'bg-primary text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <span className="material-symbols-outlined text-[18px]">grid_view</span>
              <span>CARPETAS</span>
            </button>
            <button 
              onClick={() => setViewMode('master_grid')}
              className={`flex items-center gap-3 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'master_grid' ? 'bg-primary text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <span className="material-symbols-outlined text-[18px]">table_chart</span>
              <span>MAESTRO</span>
            </button>
          </div>

          <button 
            onClick={() => setIsNewPuestoModalOpen(true)}
            className="flex items-center gap-3 bg-white text-black h-[54px] px-6 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-primary hover:text-white transition-all transform hover:-translate-y-1 active:scale-95 shadow-2xl relative overflow-hidden group"
          >
            <span className="material-symbols-outlined text-[20px]">add_location</span>
            <span>Nuevo Objetivo</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col" style={{ background: '#050b16' }}>
        {viewMode === 'cards' ? (
          <div className="flex-1 flex flex-col overflow-hidden px-10 pt-8 pb-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10 shrink-0">
              {[
                { label: 'Total Puestos', value: (puestos||[]).filter(p=>(p as any).estado!=='inactivo').length, icon: 'shield', color: '#6366f1' },
                { label: 'Cubiertos',     value: (puestos||[]).filter(p=>(p as any).estado==='cubierto').length, icon: 'verified', color: '#10b981' },
                { label: 'Con Alertas',   value: programaciones.filter(pg => pg.anio===anio && pg.mes===mes && ((useProgramacionStore.getState() as any).getAlertas(pg.id)||[]).length>0).length, icon: 'priority_high', color: '#f43f5e' },
                { label: 'Sin Asignar',   value: programaciones.filter(pg => pg.anio===anio && pg.mes===mes && pg.personal.filter((x:any)=>x.vigilanteId).length===0).length, icon: 'person_search', color: '#f59e0b' },
              ].map((s, i) => (
                <div key={i} className="group rounded-[35px] p-6 flex items-center gap-6 border border-white/5 transition-all duration-500 hover:bg-white/[0.02] shadow-xl"
                  style={{ background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(10px)' }}>
                  <div className="size-16 rounded-2xl flex items-center justify-center shrink-0 relative"
                    style={{ background: `${s.color}10`, border: `1px solid ${s.color}25` }}>
                    <span className="material-symbols-outlined text-[32px]" style={{ color: s.color }}>{s.icon}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[36px] font-black text-white leading-none mb-1 tracking-tighter italic">{s.value}</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40" style={{ color: s.color }}>{s.label}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col xl:flex-row gap-6 mb-8 shrink-0">
              <div className="relative flex-1 group">
                <span className="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within:text-primary transition-colors text-2xl">search</span>
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Localizar puesto o código táctico..."
                  className="w-full h-16 pl-16 pr-8 rounded-2xl text-[16px] font-black text-white outline-none transition-all placeholder:text-slate-700 border border-white/5 bg-white/5 focus:border-primary/50"
                  style={{ backdropFilter: 'blur(10px)' }}
                />
              </div>

              <div className="flex bg-white/5 border border-white/5 rounded-2xl p-1.5 backdrop-blur-md gap-1">
                {[
                  { id: 'todos',        label: 'TODOS',      icon: 'list_alt'    },
                  { id: 'alerta',       label: 'ALERTAS',    icon: 'warning'     },
                  { id: 'sin_personal', label: 'VACÍOS',     icon: 'person_off'  },
                  { id: 'publicados',   label: 'OK',         icon: 'task_alt'    },
                ].map(t => (
                  <button key={t.id} onClick={() => setFilterTab(t.id as any)}
                    className={`flex items-center gap-3 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
                      filterTab === t.id ? 'bg-primary text-white shadow-lg' : 'text-slate-600 hover:text-white'
                    }`}>
                    <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
                    <span className="hidden lg:inline">{t.label}</span>
                  </button>
                ))}
              </div>

              <button onClick={() => useProgramacionStore.getState().forceSync()} disabled={!progLoaded}
                className="h-16 px-8 flex items-center gap-3 rounded-2xl text-[11px] font-black uppercase transition-all bg-white/5 border border-white/5 text-slate-500 hover:text-primary hover:border-primary/30">
                <span className={`material-symbols-outlined text-[24px] ${!progLoaded ? 'animate-spin' : ''}`}>sync_alt</span>
                <span className="hidden xl:inline tracking-widest">ACTUALIZAR RED</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
              {isInitialLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-pulse">
                  {[1,2,3,4,5,6,7,8].map(i => (
                    <div key={i} className="h-48 rounded-[35px] bg-white/[0.02]" />
                  ))}
                </div>
              ) : pagedPuestos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 border border-white/5 rounded-[35px] bg-black/20">
                  <span className="material-symbols-outlined text-[48px] text-slate-800 mb-4 font-light">find_in_page</span>
                  <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Señal perdida - No hay objetivos que coincidan</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
                  {pagedPuestos.map(p => (
                    <PuestoCard key={p.id} puesto={p} anio={anio} mes={mes} onClick={() => setSelectedPuesto({ dbId: p.dbId || p.id, nombre: p.nombre })} />
                  ))}
                </div>
              )}
              {visibleCount < filteredPuestos.length && (
                <div className="flex justify-center pt-8 pb-12">
                  <button onClick={() => setVisibleCount(v => v + 60)} className="px-12 py-4 bg-primary hover:bg-indigo-500 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all shadow-2xl">
                    Expandir Red
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          renderMasterGrid()
        )}
      </main>

      <PuestoModal isOpen={isNewPuestoModalOpen} puestoId={puestoToEdit?.id} onClose={() => { setIsNewPuestoModalOpen(false); setPuestoToEdit(null); }} onCreated={() => fetchPuestos()} />
    </div>
  );
};

export default GestionPuestos;
