import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { CorazaAI } from '../ai/CorazaAI';

const AppLayout = () => {
    return (
        <div className="flex h-screen overflow-hidden bg-app-bg">
            <Sidebar />
            <main className="flex-1 flex flex-col overflow-hidden relative">
                {/* Clean minimalist top header area layout */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden relative z-10 custom-scrollbar">
                    <Topbar />
                    <div className="px-5 pb-8 sm:px-8 sm:pb-10">
                        <Outlet />
                    </div>
                </div>
            </main>
            {/* Global Tactical Assistant */}
            <CorazaAI />
        </div>
    );
};

export default AppLayout;
