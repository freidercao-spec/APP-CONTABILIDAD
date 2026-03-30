import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useAuditStore, setAuditUser } from '../store/auditStore';

// Animated background particles
const Particle = ({ style }: { style: React.CSSProperties }) => (
  <div
    className="absolute rounded-full bg-primary/20 pointer-events-none"
    style={style}
  />
);

const Login = () => {
    const login = useAuthStore(s => s.login);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPass, setShowPass] = useState(false);
    const [mounted, setMounted] = useState(false);
    const emailRef = useRef<HTMLInputElement>(null);
    const logAction = useAuditStore(s => s.logAction);

    useEffect(() => {
      setMounted(true);
      setTimeout(() => emailRef.current?.focus(), 600);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!email || !password) { setError('Ingrese correo y contraseña.'); return; }
        setLoading(true);
        try {
            const result = await login(email, password);
            if (result.success) {
                setAuditUser(email);
                logAction('LOGIN', 'Inicio de sesion', `Acceso concedido para: ${email}`, 'success');
            } else {
                const msg = result.message || 'Error de acceso desconocido';
                let friendly = msg;
                if (msg === 'Invalid login credentials') friendly = 'Correo o contraseña incorrectos.';
                else if (msg.includes('Email logins are disabled') || msg.includes('email_provider_disabled')) friendly = 'El proveedor de Email está desactivado. Contacte al administrador.';
                else if (msg.includes('Email not confirmed')) friendly = 'Cuenta pendiente de confirmación. Revise su correo.';
                else if (msg.includes('Too many requests')) friendly = 'Demasiados intentos. Espere unos minutos.';
                else if (msg.includes('User not found')) friendly = 'No existe un usuario con ese correo.';
                setError(friendly);
                logAction('LOGIN', 'Error de acceso', `Fallo al autenticar "${email}": ${msg}`, 'warning');
            }
        } catch {
            setError('Error de conexión. Verifique su internet.');
        } finally {
            setLoading(false);
        }
    };

    // Particle positions for animated background
    const particles = [
      { width: '300px', height: '300px', top: '-80px', left: '-80px', opacity: 0.15, animation: 'float 8s ease-in-out infinite' },
      { width: '200px', height: '200px', top: '60%', right: '-60px', opacity: 0.1, animation: 'float 12s ease-in-out infinite reverse' },
      { width: '150px', height: '150px', bottom: '5%', left: '10%', opacity: 0.08, animation: 'float 10s ease-in-out infinite 2s' },
      { width: '80px', height: '80px', top: '30%', right: '15%', opacity: 0.12, animation: 'float 6s ease-in-out infinite 1s' },
    ];

    return (
        <div className="min-h-screen bg-[#040810] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Dark Gradient Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#0a0f1e] via-[#040810] to-[#060d1a]" />
            
            {/* Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(79,70,229,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(79,70,229,0.04)_1px,transparent_1px)] bg-[size:48px_48px]" />
            
            {/* Animated Particles */}
            {particles.map((p, i) => <Particle key={i} style={p} />)}

            {/* Central Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

            <div
              className={`relative w-full max-w-[420px] transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
            >
                {/* Logo & Brand */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center mb-5 relative">
                        {/* Pulsing outer ring */}
                        <div className="absolute size-40 rounded-full border border-primary/20 animate-pulse" />
                        <div className="absolute size-32 rounded-full border border-primary/10" />
                        {/* Glow blob */}
                        <div className="absolute size-28 bg-primary/15 rounded-full blur-2xl" />
                        {/* Logo */}
                        <div className="relative size-24 rounded-[28px] bg-white p-2.5 shadow-[0_0_40px_rgba(79,70,229,0.4),0_20px_60px_rgba(0,0,0,0.6)] border border-white/20 z-10">
                            <img src="/logo.png" alt="CORAZA CTA" className="w-full h-full object-contain" />
                        </div>
                    </div>
                    <h1 className="text-[36px] font-black text-white tracking-[0.15em] uppercase leading-none">
                        CORAZA <span className="text-primary">CTA</span>
                    </h1>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-2">
                        SISTEMA DE CONTROL TÁCTICO
                    </p>
                </div>

                {/* Login Card */}
                <div className="relative bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-[36px] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)]">
                    
                    {/* Card inner glow */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-[1px] bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Label + Input - Email */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">
                                <span className="material-symbols-outlined text-[12px] text-primary">alternate_email</span>
                                USUARIO (CORREO)
                            </label>
                            <div className="relative group">
                                <input
                                    ref={emailRef}
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="correo@empresa.com"
                                    autoComplete="email"
                                    className="w-full h-[52px] bg-white/5 border border-white/10 rounded-2xl px-5 text-[13px] text-white font-semibold placeholder:text-slate-600 focus:border-primary/60 focus:bg-white/8 focus:shadow-[0_0_0_3px_rgba(79,70,229,0.15)] transition-all outline-none"
                                />
                                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none" />
                            </div>
                        </div>

                        {/* Label + Input - Password */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">
                                <span className="material-symbols-outlined text-[12px] text-primary">lock</span>
                                CONTRASEÑA DE ACCESO
                            </label>
                            <div className="relative group">
                                <input
                                    type={showPass ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••••"
                                    autoComplete="current-password"
                                    className="w-full h-[52px] bg-white/5 border border-white/10 rounded-2xl px-5 pr-14 text-[13px] text-white font-semibold placeholder:text-slate-600 focus:border-primary/60 focus:bg-white/8 focus:shadow-[0_0_0_3px_rgba(79,70,229,0.15)] transition-all outline-none"
                                />
                                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none" />
                                <button
                                    type="button"
                                    onClick={() => setShowPass(!showPass)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
                                >
                                    <span className="material-symbols-outlined text-[18px]">{showPass ? 'visibility_off' : 'visibility'}</span>
                                </button>
                            </div>
                        </div>

                        {/* Error message */}
                        {error && (
                            <div className="flex items-start gap-3 p-4 bg-danger/8 border border-danger/20 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                                <span className="material-symbols-outlined text-danger text-[18px] mt-0.5 shrink-0">error_outline</span>
                                <div className="space-y-1">
                                  <p className="text-danger text-[12px] font-bold leading-snug">{error}</p>
                                  {error.includes('conexión') && (
                                    <button 
                                      type="button"
                                      onClick={() => window.location.reload()}
                                      className="text-[10px] text-danger/70 underline uppercase font-black tracking-tighter"
                                    >
                                      Reintentar Conexión
                                    </button>
                                  )}
                                </div>
                            </div>
                        )}

                        {/* Submit button */}
                        <button
                            type="submit"
                            id="login-submit-btn"
                            disabled={loading}
                            className={`w-full h-[52px] relative rounded-2xl overflow-hidden font-black uppercase tracking-[0.2em] text-[11px] text-white transition-all duration-300 ${
                                loading
                                    ? 'opacity-60 cursor-not-allowed'
                                    : 'hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_0_40px_rgba(79,70,229,0.5)]'
                            }`}
                        >
                            {/* Button gradient bg */}
                            <div className="absolute inset-0 bg-gradient-to-r from-primary via-indigo-500 to-primary bg-[length:200%] hover:bg-right transition-all duration-500" />
                            
                            <span className="relative z-10 flex items-center justify-center gap-2">
                                {loading ? (
                                    <>
                                        <svg className="animate-spin size-4" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                        </svg>
                                        Verificando...
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-[18px]">shield_lock</span>
                                        Ingresar al Sistema
                                    </>
                                )}
                            </span>
                        </button>
                    </form>

                    {/* Security Badge */}
                    <div className="mt-6 flex flex-col items-center gap-4">
                        <div className="flex items-center w-full gap-3">
                            <div className="h-[1px] flex-1 bg-white/5" />
                            <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-600 uppercase tracking-widest">
                                <span className="material-symbols-outlined text-[11px] text-success">verified_user</span>
                                Acceso Seguro TLS/SSL
                            </div>
                            <div className="h-[1px] flex-1 bg-white/5" />
                        </div>

                        {/* Botones de Recuperación */}
                        <div className="flex flex-col items-center gap-4 w-full">
                            <button 
                              type="button"
                              onClick={() => {
                                localStorage.clear();
                                sessionStorage.clear();
                                window.location.reload();
                              }}
                              className="w-full py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-[10px] font-black text-white uppercase tracking-[0.2em] rounded-xl transition-all shadow-lg"
                            >
                              <span className="material-symbols-outlined text-[14px] mr-2">refresh</span>
                              LIMPIAR TODO Y REINICIAR APP
                            </button>

                            <button 
                              type="button"
                              onClick={async () => {
                                await useAuthStore.getState().login('admin@coraza.com', '123456');
                              }}
                              className="w-full py-3 bg-red-600/20 hover:bg-red-600/40 border border-red-500/50 text-[10px] font-black text-red-400 uppercase tracking-[0.2em] rounded-xl transition-all shadow-[0_0_20px_rgba(220,38,38,0.2)] animate-pulse"
                            >
                              <span className="material-symbols-outlined text-[14px] mr-2">exclamation</span>
                              ENTRAR AHORA (ACCESO TÁCTICO)
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer version */}
                <p className="text-center text-[9px] font-black text-slate-700 uppercase tracking-[0.4em] mt-6">
                    CORAZA CTA — SISTEMA OPERATIVO v1.5.4 · EMERGENCIA ACTIVA
                </p>
            </div>
        </div>
    );
};

export default Login;
