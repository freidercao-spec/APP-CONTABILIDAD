import { useState } from 'react';
import { createPortal } from 'react-dom';

interface SecurityPinModalProps {
    isOpen: boolean;
    title?: string;
    description?: string;
    onClose: () => void;
    onSuccess: () => void;
}

const MASTER_PIN = '1234'; // PIN de Autorización Táctica

export const SecurityPinModal = ({
    isOpen,
    title = 'AUTORIZACIÓN DE SEGURIDAD',
    description = 'Ingrese el PIN Maestro de 4 dígitos para autorizar esta operación crítica.',
    onClose,
    onSuccess,
}: SecurityPinModalProps) => {
    const [pin, setPin] = useState('');
    const [error, setError] = useState(false);

    if (!isOpen) return null;

    const handleNumber = (num: string) => {
        if (pin.length < 4) {
            const next = pin + num;
            setPin(next);
            setError(false);
            if (next.length === 4) {
                if (next === MASTER_PIN) {
                    setPin('');
                    onSuccess();
                } else {
                    setError(true);
                    setTimeout(() => setPin(''), 600);
                }
            }
        }
    };

    const handleDelete = () => {
        setPin(prev => prev.slice(0, -1));
        setError(false);
    };

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose} />
            <div className="relative w-full max-w-[380px] bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl overflow-hidden text-center">
                {/* Header Icon */}
                <div className="size-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
                    <span className="material-symbols-outlined text-[28px] text-indigo-400">shield_lock</span>
                </div>

                <h3 className="text-[14px] font-black text-white uppercase tracking-widest mb-1">{title}</h3>
                <p className="text-[10px] text-slate-400 font-semibold mb-6 px-2">{description}</p>

                {/* PIN Display Dots */}
                <div className="flex justify-center items-center gap-4 mb-6">
                    {[0, 1, 2, 3].map(i => (
                        <div
                            key={i}
                            className={`size-4 rounded-full border transition-all duration-200 ${
                                pin.length > i
                                    ? error
                                        ? 'bg-rose-500 border-rose-400 scale-110 shadow-[0_0_12px_rgba(244,63,94,0.6)]'
                                        : 'bg-indigo-500 border-indigo-400 scale-110 shadow-[0_0_12px_rgba(99,102,241,0.6)]'
                                    : 'bg-slate-800 border-slate-700'
                            }`}
                        />
                    ))}
                </div>

                {error && (
                    <p className="text-[10px] font-black text-rose-400 uppercase tracking-wider mb-4 animate-bounce">
                        PIN Incorrecto — Acceso Denegado
                    </p>
                )}

                {/* Keypad Grid */}
                <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto mb-6">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                        <button
                            key={num}
                            onClick={() => handleNumber(num)}
                            className="h-12 bg-slate-800/80 hover:bg-indigo-600/30 border border-slate-700/60 hover:border-indigo-500/40 rounded-2xl text-[18px] font-black text-white transition-all active:scale-95 flex items-center justify-center"
                        >
                            {num}
                        </button>
                    ))}
                    <button
                        onClick={() => setPin('')}
                        className="h-12 bg-slate-800/40 hover:bg-slate-700/60 text-slate-400 rounded-2xl text-[10px] font-bold uppercase transition-all flex items-center justify-center"
                    >
                        Borrar
                    </button>
                    <button
                        onClick={() => handleNumber('0')}
                        className="h-12 bg-slate-800/80 hover:bg-indigo-600/30 border border-slate-700/60 hover:border-indigo-500/40 rounded-2xl text-[18px] font-black text-white transition-all active:scale-95 flex items-center justify-center"
                    >
                        0
                    </button>
                    <button
                        onClick={handleDelete}
                        className="h-12 bg-slate-800/40 hover:bg-slate-700/60 text-slate-400 rounded-2xl transition-all flex items-center justify-center"
                    >
                        <span className="material-symbols-outlined text-[20px]">backspace</span>
                    </button>
                </div>

                <button
                    onClick={onClose}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all border border-slate-700"
                >
                    Cancelar
                </button>
            </div>
        </div>,
        document.body
    );
};
