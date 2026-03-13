import toast from 'react-hot-toast';
import React from 'react';

interface ToastProps {
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning' | 'ai';
  id?: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  duration?: number;
}

export const showTacticalToast = ({ title, message, type, id, action, duration = 5000 }: ToastProps) => {
  const t = toast.custom(
    (t) => (
      <div
        className={`${
          t.visible ? 'animate-in fade-in slide-in-from-right-10' : 'animate-out fade-out slide-out-to-right-10'
        } max-w-sm w-full bg-[#0B1441]/90 backdrop-blur-2xl border border-white/10 rounded-[24px] pointer-events-auto flex flex-col overflow-hidden shadow-[0_25px_100px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.05)]`}
        style={{ minWidth: '320px' }}
      >
        {/* Top accent line */}
        <div className={`h-1 w-full ${
            type === 'success' ? 'bg-success/50' :
            type === 'error' ? 'bg-danger/50' :
            type === 'warning' ? 'bg-warning/50' :
            'bg-primary/50'
        }`} />

        <div className="flex items-start p-5 gap-4 relative overflow-hidden">
          {/* Subtle accent glow */}
          <div className={`absolute top-0 left-0 w-32 h-32 blur-[80px] opacity-20 -translate-x-1/2 -translate-y-1/2 pointer-events-none ${
              type === 'success' ? 'bg-success' :
              type === 'error' ? 'bg-danger' :
              'bg-primary'
          }`} />

          <div className={`mt-0.5 size-11 shrink-0 rounded-[18px] flex items-center justify-center border relative overflow-hidden ${
            type === 'success' ? 'bg-success/10 border-success/20 text-success' :
            type === 'error' ? 'bg-danger/10 border-danger/20 text-danger' :
            type === 'warning' ? 'bg-warning/10 border-warning/20 text-warning' :
            type === 'ai' ? 'bg-primary/20 border-primary/30 text-primary animate-pulse' :
            'bg-primary/10 border-primary/20 text-primary'
          }`}>
            <span className="material-symbols-outlined text-[20px] relative z-10">
              {type === 'success' ? 'verified' : 
               type === 'error' ? 'report' : 
               type === 'warning' ? 'warning' : 
               type === 'ai' ? 'auto_awesome' : 'notifications_active'}
            </span>
            <div className={`absolute inset-0 opacity-20 ${type === 'success' ? 'bg-success' : type === 'error' ? 'bg-danger' : 'bg-primary'}`} />
          </div>

          <div className="flex-1 min-w-0">
            <div className={`text-[10px] font-black uppercase tracking-[0.25em] mb-1.5 flex items-center gap-2 ${
               type === 'success' ? 'text-success' :
               type === 'error' ? 'text-danger' :
               type === 'warning' ? 'text-warning' :
               'text-[#9BA1B7]'
            }`}>
              {title}
              {type === 'ai' && <span className="px-1.5 py-0.5 rounded-full bg-primary/20 text-[8px] border border-primary/30 text-primary animate-pulse">CORAZA AI</span>}
            </div>
            <p className="text-[13px] font-bold text-white leading-snug">
              {message}
            </p>
          </div>

          <button 
            onClick={() => toast.dismiss(t.id)}
            className="shrink-0 size-7 rounded-xl hover:bg-white/5 flex items-center justify-center text-white/20 hover:text-white transition-all active:scale-90"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
        
        {action && (
          <div className="px-5 pb-5 mt-[-4px]">
            {action.href ? (
              <a 
                href={action.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={action.onClick}
                className={`w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:brightness-110 active:scale-[0.98] shadow-lg ${
                  type === 'success' ? 'bg-success text-white shadow-success/20' :
                  type === 'error' || type === 'ai' ? 'bg-danger text-white shadow-danger/20' :
                  'bg-primary text-white shadow-primary/20'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">send</span>
                {action.label}
              </a>
            ) : (
              <button 
                onClick={() => {
                  action.onClick?.();
                  toast.dismiss(t.id);
                }}
                className={`w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:brightness-110 active:scale-[0.98] shadow-lg ${
                  type === 'success' ? 'bg-success text-white shadow-success/20' :
                  'bg-primary text-white shadow-primary/20'
                }`}
              >
                {action.label}
              </button>
            )}
          </div>
        )}
        
        {/* Animated Scanline / Progress */}
        <div className="h-[2px] w-full bg-white/5 relative overflow-hidden">
          <div 
            className={`absolute inset-0 h-full w-40 blur-sm ${
              type === 'success' ? 'bg-success' :
              type === 'error' ? 'bg-danger' :
              type === 'warning' ? 'bg-warning' :
              'bg-primary'
            }`}
            style={{ 
              animation: 'scanline-progress 5s linear infinite',
            }}
          />
        </div>
      </div>
    ),
    { 
      id,
      duration,
      position: 'bottom-right'
    }
  );
  return t;
};
