import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useAuditStore, setAuditUser } from '../store/auditStore';

const Login = () => {
    const login = useAuthStore(s => s.login);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPass, setShowPass] = useState(false);

    const logAction = useAuditStore(s => s.logAction);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username || !password) { setError('Ingrese usuario y contraseña.'); return; }
        setLoading(true);
        setError('');
        await new Promise(r => setTimeout(r, 800));
        const ok = await login(username, password);
        if (ok) {
            setAuditUser(username);
            logAction('LOGIN', 'Inicio de sesión', `Usuario "${username}" autenticado exitosamente.`, 'success');
        } else {
            logAction('LOGIN', 'Intento fallido', `Credenciales incorrectas para usuario "${username}".`, 'warning');
            setError('Credenciales incorrectas. Verifique e intente de nuevo.');
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-[#050A14] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Animated background grid */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:60px_60px] opacity-30" />
            {/* Glow orbs */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-700/10 rounded-full blur-[100px]" style={{ animationDelay: '1s' }} />

            <div className="relative w-full max-w-md animate-in fade-in slide-in-from-bottom-8 duration-700">
                {/* Logo / Brand */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center relative mb-6">
                        {/* Glow ring */}
                        <div className="absolute inset-0 rounded-full bg-primary/20 blur-3xl scale-150 pointer-events-none" />
                        <div className="relative size-32 rounded-full bg-white p-1 shadow-[0_20px_60px_rgba(0,0,0,0.3)] border-4 border-white/50 overflow-hidden">
                            <img src="/logo_premium.png" alt="CORAZA CTA" className="w-full h-full object-contain" />
                        </div>
                        <div className="absolute top-2 right-2 size-6 bg-success rounded-full border-[3px] border-[#050A14] shadow-[0_0_12px_rgba(0,179,119,0.9)] animate-pulse z-10" />
                    </div>
                    <h1 className="text-4xl font-black text-white tracking-[0.05em] uppercase leading-tight drop-shadow-[0_0_15px_rgba(255,255,255,0.6)] relative z-10">
                        CORAZA
                        <span className="block text-primary-light text-2xl drop-shadow-[0_0_20px_rgba(139,92,246,0.6)] mt-1">SEGURIDAD PRIVADA</span>
                    </h1>
                    <p className="text-slate-300 font-black text-[12px] uppercase tracking-[0.2em] mt-3 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] relative z-10">COOPERATIVA DE VIGILANCIA C.T.A</p>
                    <p className="text-primary-light text-[11px] font-black uppercase tracking-[0.3em] mt-5 drop-shadow-[0_0_15px_rgba(139,92,246,0.8)] animate-pulse relative z-10">PROGRAMACIÓN</p>
                </div>


                {/* Login Card */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-10 shadow-[0_30px_100px_rgba(0,0,0,0.5)]">
                    <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
                        <span className="h-px flex-1 bg-white/10" />
                        Autenticación de Operador
                        <span className="h-px flex-1 bg-white/10" />
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Usuario</label>
                            <div className="relative group">
                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-[20px] group-focus-within:text-primary transition-colors">person</span>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    placeholder="Ingrese su código de operador"
                                    autoComplete="username"
                                    className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 text-[14px] text-white font-bold placeholder:text-slate-700 focus:outline-none focus:border-primary/50 focus:bg-white/10 focus:ring-4 focus:ring-primary/10 transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Contraseña</label>
                            <div className="relative group">
                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-[20px] group-focus-within:text-primary transition-colors">lock</span>
                                <input
                                    type={showPass ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="•••••••••••"
                                    autoComplete="current-password"
                                    className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-12 text-[14px] text-white font-bold placeholder:text-slate-600 focus:outline-none focus:border-primary/50 focus:bg-white/10 focus:ring-4 focus:ring-primary/10 transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPass(!showPass)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[20px]">{showPass ? 'visibility_off' : 'visibility'}</span>
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-center gap-3 p-4 bg-danger/10 border border-danger/30 rounded-2xl animate-in slide-in-from-top-2 duration-300">
                                <span className="material-symbols-outlined text-danger text-[18px] shrink-0">error</span>
                                <p className="text-[12px] font-bold text-danger">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-14 bg-gradient-to-r from-primary to-indigo-600 text-white font-black rounded-2xl uppercase tracking-[0.2em] text-[12px] hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_10px_40px_rgba(67,24,255,0.4)] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3 mt-2"
                        >
                            {loading ? (
                                <>
                                    <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                                    Autenticando...
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-[20px]">login</span>
                                    Ingresar al Sistema
                                </>
                            )}
                        </button>
                    </form>

                    {/* Credentials hint */}
                    <div className="mt-8 pt-6 border-t border-white/5 text-center space-y-1">
                        <p className="text-[9px] font-black text-slate-700 uppercase tracking-[0.3em]">Acceso Demo</p>
                        <p className="text-[10px] text-slate-600 font-mono">admin / coraza2026</p>
                    </div>
                </div>

                <p className="text-center text-[9px] text-slate-700 uppercase tracking-widest font-bold mt-8">
                    © 2026 Coraza CTA · VERSIÓN 3.0.1 (SUPABASE) · Todos los derechos reservados
                </p>
            </div>
        </div>
    );
};

export default Login;
