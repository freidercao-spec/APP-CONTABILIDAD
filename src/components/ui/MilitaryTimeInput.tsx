import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../store/appStore';

interface MilitaryTimeInputProps {
    value: string;
    onChange: (value: string) => void;
    className?: string;
}

/**
 * 100% PERSONALIZABLE: Entrada de tiempo militar con presets dinamicos y selector tactico.
 */
export const MilitaryTimeInput: React.FC<MilitaryTimeInputProps> = ({ value, onChange, className }) => {
    const [localValue, setLocalValue] = useState(value);
    const [isOpen, setIsOpen] = useState(false);
    const [view, setView] = useState<'presets' | 'hours' | 'minutes'>('presets');
    const containerRef = useRef<HTMLDivElement>(null);
    const { shiftPresets, topbarConfig } = useAppStore();

    useEffect(() => { setLocalValue(value); }, [value]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setView('presets');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/[^0-9:]/g, '');
        if (val.length === 4 && !val.includes(':')) val = `${val.slice(0, 2)}:${val.slice(2, 4)}`;
        if (val.length > 5) val = val.slice(0, 5);
        setLocalValue(val);
        if (/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(val)) onChange(val);
    };

    const handleBlur = () => {
        if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(localValue)) setLocalValue(value);
        else onChange(localValue);
    };

    const selectPreset = (val: string) => {
        setLocalValue(val);
        onChange(val);
        setIsOpen(false);
    };

    const selectHour = (h: string) => {
        const currentM = localValue.split(':')[1] || '00';
        const newVal = `${h}:${currentM}`;
        setLocalValue(newVal);
        setView('minutes');
    };

    const selectMinute = (m: string) => {
        const currentH = localValue.split(':')[0] || '00';
        const newVal = `${currentH}:${m}`;
        setLocalValue(newVal);
        onChange(newVal);
        setIsOpen(false);
        setView('presets');
    };

    const isValid = /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(localValue);

    return (
        <div className="relative flex-1" ref={containerRef}>
            {/* Input Principal */}
            <div className="relative group">
                <input
                    type="text"
                    value={localValue}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onFocus={() => setIsOpen(true)}
                    placeholder="HH:mm"
                    maxLength={5}
                    className={[
                        'w-full h-10 rounded-xl px-3 pr-9 text-sm font-mono font-bold outline-none transition-all text-center',
                        'bg-slate-50 border-2 text-slate-800 placeholder:text-slate-300',
                        isValid
                            ? 'border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/10'
                            : 'border-slate-200 focus:border-primary/40 focus:ring-2 focus:ring-primary/5',
                        className ?? '',
                    ].join(' ')}
                    style={isValid ? { borderColor: `${topbarConfig.accentColor}66` } : {}}
                />
                <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setIsOpen((o) => !o)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                >
                    <span
                        className="material-symbols-outlined text-[20px] block transition-transform duration-200"
                        style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', color: isOpen ? topbarConfig.accentColor : undefined }}
                    >
                        expand_more
                    </span>
                </button>
            </div>

            {/* Dropdown 100% Personalizable */}
            {isOpen && (
                <div className="absolute left-0 z-50 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Header Adaptable */}
                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setView('presets')}
                                className={`material-symbols-outlined text-[18px] ${view === 'presets' ? 'text-primary' : 'text-slate-300'}`}
                                style={{ color: view === 'presets' ? topbarConfig.accentColor : undefined }}
                            >
                                star
                            </button>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                {view === 'presets' ? 'Turnos Empresa' : view === 'hours' ? 'Seleccionar Hora' : 'Seleccionar Minutos'}
                            </span>
                        </div>
                        <div className="flex gap-1">
                            <button 
                                onClick={() => setView('hours')}
                                className={`size-6 rounded-md flex items-center justify-center text-[10px] font-black border transition-all ${view === 'hours' ? 'bg-primary text-white border-primary' : 'bg-white text-slate-400 border-slate-200 hover:border-primary/30'}`}
                                style={view === 'hours' ? { backgroundColor: topbarConfig.accentColor, borderColor: topbarConfig.accentColor } : {}}
                            >
                                HH
                            </button>
                            <button 
                                onClick={() => setView('minutes')}
                                className={`size-6 rounded-md flex items-center justify-center text-[10px] font-black border transition-all ${view === 'minutes' ? 'bg-primary text-white border-primary' : 'bg-white text-slate-400 border-slate-200 hover:border-primary/30'}`}
                                style={view === 'minutes' ? { backgroundColor: topbarConfig.accentColor, borderColor: topbarConfig.accentColor } : {}}
                            >
                                MM
                            </button>
                        </div>
                    </div>

                    <div className="p-3 max-h-[220px] overflow-y-auto custom-scrollbar">
                        {/* Vista: Presets de Empresa */}
                        {view === 'presets' && (
                            <div className="grid grid-cols-2 gap-2">
                                {shiftPresets.map((shift) => (
                                    <button
                                        key={shift.id}
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => selectPreset(shift.value)}
                                        className="flex flex-col items-center justify-center py-3 px-2 rounded-xl border-2 border-slate-100 hover:border-primary/30 hover:bg-slate-50 transition-all group"
                                    >
                                        <span className="text-[14px] font-black font-mono text-slate-700 leading-none mb-1 group-hover:text-primary transition-colors" style={{ color: localValue === shift.value ? topbarConfig.accentColor : undefined }}>
                                            {shift.value}
                                        </span>
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest truncate w-full text-center">
                                            {shift.label}
                                        </span>
                                    </button>
                                ))}
                                <button 
                                    onClick={() => setView('hours')}
                                    className="col-span-2 py-2 mt-1 border-2 border-dashed border-slate-200 rounded-xl text-[9px] font-black text-slate-400 uppercase hover:border-primary/30 hover:text-primary transition-all flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-[14px]">edit_calendar</span>
                                    Personalizar Hora Manual
                                </button>
                            </div>
                        )}

                        {/* Vista: Selector de Hora (HH) */}
                        {view === 'hours' && (
                            <div className="grid grid-cols-4 gap-1.5">
                                {Array.from({ length: 24 }).map((_, i) => {
                                    const h = i.toString().padStart(2, '0');
                                    const isSelected = localValue.startsWith(h);
                                    return (
                                        <button
                                            key={h}
                                            onClick={() => selectHour(h)}
                                            className={`h-10 rounded-lg text-sm font-black transition-all ${isSelected ? 'bg-primary text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                                            style={isSelected ? { backgroundColor: topbarConfig.accentColor } : {}}
                                        >
                                            {h}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Vista: Selector de Minutos (MM) */}
                        {view === 'minutes' && (
                            <div className="grid grid-cols-4 gap-1.5">
                                {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((m) => {
                                    const isSelected = localValue.endsWith(m);
                                    return (
                                        <button
                                            key={m}
                                            onClick={() => selectMinute(m)}
                                            className={`h-10 rounded-lg text-sm font-black transition-all ${isSelected ? 'bg-primary text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                                            style={isSelected ? { backgroundColor: topbarConfig.accentColor } : {}}
                                        >
                                            {m}
                                        </button>
                                    );
                                })}
                                <button 
                                    onClick={() => setView('hours')}
                                    className="col-span-4 h-8 mt-2 text-[9px] font-black text-slate-400 uppercase hover:text-primary"
                                >
                                    ← Volver a Horas
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Footer con comando de texto */}
                    <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[9px] font-bold text-slate-400">
                        <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">bolt</span>
                            SMART FORM: {localValue}
                        </span>
                        <code className="bg-slate-200 px-1 rounded text-slate-500">24H OPS</code>
                    </div>
                </div>
            )}
        </div>
    );
};
