import React, { useState, useEffect } from 'react';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'success' | 'info';
    requireInput?: boolean;
    inputPlaceholder?: string;
    onConfirm: (val: string | true) => void;
    onCancel: () => void;
}

const VARIANT_CONFIG = {
    danger: {
        icon: 'delete_forever',
        iconBg: 'bg-danger/15',
        iconColor: 'text-danger',
        btnClass: 'bg-danger hover:bg-danger/90 shadow-lg shadow-danger/20',
        borderColor: 'border-danger/20',
    },
    warning: {
        icon: 'warning',
        iconBg: 'bg-warning/15',
        iconColor: 'text-warning',
        btnClass: 'bg-warning hover:bg-warning/90 shadow-lg shadow-warning/20',
        borderColor: 'border-warning/20',
    },
    success: {
        icon: 'check_circle',
        iconBg: 'bg-success/15',
        iconColor: 'text-success',
        btnClass: 'bg-success hover:bg-success/90 shadow-lg shadow-success/20',
        borderColor: 'border-success/20',
    },
    info: {
        icon: 'info',
        iconBg: 'bg-primary/15',
        iconColor: 'text-primary',
        btnClass: 'bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20',
        borderColor: 'border-primary/20',
    },
};

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    title,
    message,
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    variant = 'info',
    requireInput = false,
    inputPlaceholder = 'Escriba aqui...',
    onConfirm,
    onCancel,
}) => {
    const [inputValue, setInputValue] = useState('');



    if (!isOpen) return null;

    const cfg = VARIANT_CONFIG[variant];

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onCancel}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
            <div
                className={`relative w-full max-w-sm bg-white rounded-[28px] shadow-[0_30px_80px_rgba(0,0,0,0.25)] border-2 ${cfg.borderColor} animate-in zoom-in-95 fade-in duration-200`}
                onClick={e => e.stopPropagation()}
            >
                {/* Icon */}
                <div className="flex flex-col items-center pt-8 pb-5 px-8 text-center">
                    <div className={`size-16 ${cfg.iconBg} rounded-full flex items-center justify-center mb-4`}>
                        <span className={`material-symbols-outlined text-[36px] ${cfg.iconColor} notranslate`}>{cfg.icon}</span>
                    </div>
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-2">{title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed font-medium">{message}</p>

                    {/* Security badge */}
                    <div className="mt-4 flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5">
                        <span className="material-symbols-outlined text-[13px] text-slate-400 notranslate">security</span>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Operacion Sensible - Confirme antes de continuar</span>
                    </div>

                    {requireInput && (
                        <div className="w-full mt-4 text-left border-t border-slate-100 pt-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">Justificacion requerida *</label>
                            <textarea
                                value={inputValue}
                                onChange={e => setInputValue(e.target.value)}
                                placeholder={inputPlaceholder}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-primary/50 resize-none h-20"
                            />
                        </div>
                    )}
                </div>

                {/* Buttons */}
                <div className="grid grid-cols-2 gap-3 px-6 pb-6">
                    <button
                        onClick={() => {
                            onCancel();
                            setInputValue('');
                        }}
                        className="py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all active:scale-95"
                    >
                        <span className="material-symbols-outlined text-[14px] mr-1 align-middle notranslate">close</span>
                        {cancelLabel}
                    </button>
                    <button
                        onClick={() => {
                            onConfirm(requireInput ? inputValue : true);
                            setInputValue('');
                        }}
                        disabled={requireInput && !inputValue.trim()}
                        className={`py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${cfg.btnClass}`}
                    >
                        <span className="material-symbols-outlined text-[14px] mr-1 align-middle notranslate">check</span>
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Hook for easy use
import { useCallback } from 'react';

interface ConfirmOptions {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: ConfirmDialogProps['variant'];
    requireInput?: boolean;
    inputPlaceholder?: string;
}

export const useConfirm = () => {
    const [state, setState] = useState<{ isOpen: boolean; resolve?: (val: boolean | string) => void } & ConfirmOptions>({
        isOpen: false,
        title: '',
        message: '',
    });

    const confirm = useCallback((opts: ConfirmOptions): Promise<boolean | string> => {
        return new Promise(resolve => {
            setState({ isOpen: true, resolve, ...opts });
        });
    }, []);

    const handleConfirm = useCallback((val: string | true) => {
        state.resolve?.(val);
        setState(s => ({ ...s, isOpen: false }));
    }, [state]);

    const handleCancel = useCallback(() => {
        state.resolve?.(false);
        setState(s => ({ ...s, isOpen: false }));
    }, [state]);

    const dialogProps = {
        isOpen: state.isOpen,
        title: state.title,
        message: state.message,
        confirmLabel: state.confirmLabel,
        cancelLabel: state.cancelLabel,
        variant: state.variant,
        requireInput: state.requireInput,
        inputPlaceholder: state.inputPlaceholder,
        onConfirm: handleConfirm,
        onCancel: handleCancel,
    };

    return { confirm, dialogProps };
};
