import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
    children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const navItems = [
        { path: '/', label: 'Dashboard', icon: '🏠' },
        { path: '/products', label: 'Produtos', icon: '📦' },
        { path: '/ai-ads', label: 'AI Ads', icon: '🤖' },
        { path: '/analytics', label: 'Analytics', icon: '📊' },
        { path: '/settings', label: 'Configurações', icon: '⚙️' },
        { path: '/logs', label: 'Logs', icon: '📋' },
    ];

    const closeSidebar = () => setSidebarOpen(false);

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col lg:flex-row">
            {/* Mobile Header */}
            <header className="lg:hidden flex items-center justify-between bg-gray-800 border-b border-gray-700 p-4">
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
                    ASync Hub
                </h1>
                <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition"
                    aria-label="Toggle menu"
                >
                    {sidebarOpen ? '✕' : '☰'}
                </button>
            </header>

            {/* Overlay for mobile */}
            {sidebarOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/50 z-40"
                    onClick={closeSidebar}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
                    fixed lg:static inset-y-0 left-0 z-50
                    w-64 bg-gray-800 border-r border-gray-700 p-4
                    transform transition-transform duration-300 ease-in-out
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                    lg:translate-x-0 lg:block
                `}
            >
                {/* Logo - Hidden on mobile (already in header) */}
                <div className="hidden lg:block mb-8">
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
                        ASync Hub
                    </h1>
                    <p className="text-xs text-gray-500 mt-1">Multi-Marketplace Integration</p>
                </div>

                {/* Mobile close button inside sidebar */}
                <div className="lg:hidden flex justify-end mb-4">
                    <button
                        onClick={closeSidebar}
                        className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600"
                    >
                        ✕
                    </button>
                </div>

                <nav className="space-y-2">
                    {navItems.map(item => (
                        <Link
                            key={item.path}
                            to={item.path}
                            onClick={closeSidebar}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${location.pathname === item.path
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                                }`}
                        >
                            <span>{item.icon}</span>
                            <span>{item.label}</span>
                        </Link>
                    ))}
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto min-h-0">
                {children}
            </main>
        </div>
    );
}
