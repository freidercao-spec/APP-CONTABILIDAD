import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { CorazaAI } from '../ai/CorazaAI';
import { useUIStore } from '../../store/uiStore';

const AppLayout = ({ children }: { children?: React.ReactNode }) => {
    const { isSidebarOpen, closeSidebar } = useUIStore();
    const location = useLocation();

    // Cerrar drawer mobile al cambiar de ruta
    useEffect(() => {
        closeSidebar();
    }, [location.pathname, closeSidebar]);

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-[#f8fafc]">

            {/* Mobile overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
                    onClick={closeSidebar}
                    aria-hidden="true"
                />
            )}

            {/* Sidebar */}
            <Sidebar />

            {/* Main ? flex-1 se ajusta autom?ticamente al ancho del sidebar */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                <Topbar />
                <div
                    className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar"
                    style={{ scrollbarGutter: 'stable' }}
                >
                    <div className="px-4 pb-10 sm:px-6 lg:px-8 pt-2">
                        {children || <Outlet />}
                    </div>
                </div>
            </main>

            {/* AI Widget global */}
            <CorazaAI />
        </div>
    );
};

export default AppLayout;
