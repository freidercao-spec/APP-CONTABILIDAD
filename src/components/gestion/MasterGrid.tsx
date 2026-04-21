import React from 'react';
import { usePuestoStore } from '../../store/puestoStore';
import { useProgramacionStore } from '../../store/programacionStore';

interface Props {
    anio: number;
    mes: number;
}

export const MasterGrid: React.FC<Props> = ({ anio, mes }) => {
    const { puestos } = usePuestoStore();
    return (
        <table className="w-full border-collapse">
            <thead>
                <tr>
                    <th className="p-4 text-left border-b border-white/10">Puesto</th>
                    {Array.from({ length: 31 }, (_, i) => (
                        <th key={i} className="p-2 border-b border-white/10 text-[10px]">{i + 1}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {puestos.map(p => (
                    <tr key={p.id}>
                        <td className="p-4 border-b border-white/5 font-bold">{p.nombre}</td>
                        {Array.from({ length: 31 }, (_, i) => (
                            <td key={i} className="p-2 border-b border-white/5">
                                <div className="size-4 bg-white/5 rounded-sm" />
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
};
