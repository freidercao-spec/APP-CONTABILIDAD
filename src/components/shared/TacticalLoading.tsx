import React from 'react';

interface TacticalLoadingProps {
  onBypass?: () => void;
  logs?: string[];
  progress?: number;
}

const TacticalLoading: React.FC<TacticalLoadingProps> = ({ onBypass, logs = [], progress }) => (
  <div className="fixed inset-0 bg-[#020617] flex flex-col items-center justify-center z-[9999] p-6 font-sans overflow-hidden">
    {/* Background Grid */}
    <div className="absolute inset-0 bg-[linear-gradient(rgba(79,70,229,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(79,70,229,0.05)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)]" />

    {/* Radar Icon & Animation */}
    <div className="relative mb-12">
      <div className="w-28 h-28 border-2 border-primary/20 rounded-full animate-[spin_4s_linear_infinite]" />
      <div className="absolute inset-0 w-28 h-28 border-t-2 border-primary rounded-full animate-[spin_1.5s_linear_infinite]" />
      <div className="absolute inset-4 bg-primary/10 rounded-full animate-pulse flex items-center justify-center">
        <span className="material-symbols-outlined text-primary text-4xl">radar</span>
      </div>
      
      {/* Dynamic scan line */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[1px] bg-primary/30 blur-[2px] animate-[spin_3s_linear_infinite]" />
    </div>

    <div className="text-center space-y-4 max-w-md w-full relative z-10">
      <h2 className="text-2xl font-black text-white tracking-[0.2em] uppercase animate-pulse">Sincronizando</h2>
      <p className="text-slate-400 text-[11px] font-bold tracking-widest uppercase opacity-70">Enlazando con Supabase • Protocolo Operativo</p>
      
      {/* Activity Log Terminal */}
      <div className="bg-[#040810]/80 backdrop-blur-xl rounded-[24px] border border-white/5 p-6 h-60 overflow-hidden relative shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-primary/20 animate-[scan_2s_linear_infinite]" />
        
        <div className="flex flex-col gap-2 text-left font-mono text-[9px] uppercase tracking-tighter">
          {logs.slice(-8).map((log, i) => (
            <div key={i} className={`flex gap-3 items-start ${i === logs.slice(-8).length - 1 ? 'text-primary' : 'text-slate-500'}`}>
              <span className="opacity-40 shrink-0">[{new Date().toLocaleTimeString()}]</span>
              <span className="font-bold">{log}</span>
            </div>
          ))}
          {logs.length === 0 && (
            <div className="animate-pulse flex items-center gap-2 text-primary/60">
              <span className="material-symbols-outlined text-[12px]">terminal</span>
              Iniciando terminal del sistema...
            </div>
          )}
        </div>

        {/* Progress Bar (if provided) */}
        {progress !== undefined && (
           <div className="absolute bottom-6 left-6 right-6 space-y-2">
             <div className="flex justify-between text-[8px] font-black tracking-widest text-slate-400 uppercase">
               <span>Progreso de Carga</span>
               <span>{Math.round(progress)}%</span>
             </div>
             <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
               <div 
                 className="h-full bg-primary transition-all duration-300 shadow-[0_0_10px_#4f46e5]"
                 style={{ width: `${progress}%` }}
               />
             </div>
           </div>
        )}
      </div>

      {onBypass && (
        <button 
          onClick={onBypass}
          className="group flex items-center gap-2 mx-auto text-[9px] text-slate-600 hover:text-danger uppercase font-black tracking-widest mt-6 transition-all bg-white/5 px-4 py-2 rounded-full border border-white/5 hover:border-danger/20"
        >
          <span className="material-symbols-outlined text-[14px]">bolt</span>
          Bypass por Emergencia
        </button>
      )}
    </div>

    {/* Styles for scanlines and animations */}
    <style dangerouslySetInnerHTML={{ __html: `
      @keyframes scan {
        0% { transform: translateY(-100%); }
        100% { transform: translateY(500%); }
      }
    `}} />
  </div>
);

export default TacticalLoading;
