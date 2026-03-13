// RightPanel.tsx
import React, { useEffect, useState } from 'react';
import clsx from 'clsx';

interface RightPanelProps {
  collapsed: boolean;
}

const RightPanel: React.FC<RightPanelProps> = ({ collapsed }) => {
  return (
    <div className={clsx('fixed top-16 right-0 h-full bg-[#080d1a] border-l-2 border-blue-500 rounded-r-xl overflow-hidden transition-width duration-300', collapsed ? 'w-0' : 'w-64')}
         style={{ pointerEvents: collapsed ? 'none' : 'auto' }}>
      <div className="p-4 text-white">
        <h3 className="font-rajdhani text-lg font-semibold">Right Panel</h3>
        <p>Contenido del panel derecho</p>
      </div>
    </div>
  );
};

export default RightPanel;
