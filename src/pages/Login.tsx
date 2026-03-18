import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useAuditStore, setAuditUser } from '../store/auditStore';

const Login = () => {
    const login = useAuthStore(s => s.login);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPass, setShowPass] = useState(false);

    const logAction = useAuditStore(s => s.logAction);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!email || !password) { setError('Por favor ingrese correo y contraseña.'); return; }
        
        setLoading(true);

        try {
            const result = await login(email, password);
            if (result.success) {
                setAuditUser(email);
                logAction('LOGIN', 'Inicio de sesión', `Acceso concedido para: ${email}`, 'success');
            } else {
                const msg = result.message || 'Error de acceso desconocido';
                // Traducir errores comunes de Supabase a mensajes amigables
                let friendly = msg;
                if (msg === 'Invalid login credentials') {
                    friendly = 'Correo o contraseña incorrectos.';
                } else if (msg.includes('Email logins are disabled') || msg.includes('email_provider_disabled')) {
                    friendly = '⚠️ El sistema de login está temporalmente desactivado. Contacte al administrador para activar el proveedor de Email en Supabase.';
                } else if (msg.includes('Email not confirmed')) {
                    friendly = 'Cuenta pendiente de confirmación. Revise su correo.';
                } else if (msg.includes('Too many requests')) {
                    friendly = 'Demasiados intentos. Espere unos minutos e intente de nuevo.';
                } else if (msg.includes('User not found')) {
                    friendly = 'No existe un usuario con ese correo.';
                }
                setError(friendly);
                logAction('LOGIN', 'Error de acceso', `Fallo al autenticar "${email}": ${msg}`, 'warning');
            }
        } catch (err: any) {
            setError('Error de conexión con el servidor. Verifique su internet.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#050A14] flex items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:60px_60px] opacity-30" />
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] animate-pulse" />
            
            <div className="relative w-full max-w-md">
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center mb-6 relative">
                        <div className="absolute inset-0 rounded-full bg-primary/20 blur-3xl scale-150 pointer-events-none" />
                        <div className="relative size-32 rounded-full bg-white p-1 border-4 border-white/50 overflow-hidden shadow-2xl">
                            <img src="/logo_premium.png" alt="CORAZA CTA" className="w-full h-full object-contain" />
                        </div>
                    </div>
                    <h1 className="text-4xl font-black text-white tracking-widest uppercase">CORAZA</h1>
                    <p className="text-primary-light text-[11px] font-black uppercase tracking-[0.3em] mt-3">SISTEMA DE PROGRAMACIÓN</p>
                </div>

                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-10 shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">USUARIO (CORREO)</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="ejemplo@correo.com"
                                className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-6 text-[14px] text-white font-bold focus:border-primary transition-all outline-none"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">CONTRASEÑA</label>
                            <div className="relative">
                                <input
                                    type={showPass ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-6 pr-12 text-[14px] text-white font-bold focus:border-primary transition-all outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPass(!showPass)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"
                                >
                                    <span className="material-symbols-outlined">{showPass ? 'visibility_off' : 'visibility'}</span>
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="p-4 bg-danger/10 border border-danger/30 rounded-2xl text-danger text-[12px] font-bold text-center">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full h-14 bg-primary text-white font-black rounded-2xl uppercase tracking-widest text-[12px] transition-all flex items-center justify-center gap-3 ${loading ? 'opacity-50' : 'hover:scale-105 shadow-lg'}`}
                        >
                            {loading ? 'Validando...' : 'Entrar ahora'}
                        </button>
                    </form>
                </div>
                <div className="absolute inset-x-0 bottom-8 text-center text-[10px] font-black text-primary/30 uppercase tracking-[0.4em] pointer-events-none">
            MOD v1.3.5 · DATABASE SYNC FIX
          </div>
            </div>
        </div>
    );
};

export default Login;
