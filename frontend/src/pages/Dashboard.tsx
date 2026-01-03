import { useState, useEffect } from 'react';
import { api } from '../api';
import { Link } from 'react-router-dom';

interface Connection {
    marketplace: string;
    isConnected: boolean;
}

export default function Dashboard() {
    const [status, setStatus] = useState('Checking...');
    const [connections, setConnections] = useState<Connection[]>([]);
    const [productCount, setProductCount] = useState(0);

    useEffect(() => {
        api.health()
            .then(data => setStatus(data.message))
            .catch(() => setStatus('Backend offline'));

        api.getConnections()
            .then(data => setConnections(data))
            .catch(() => { });

        api.getProducts()
            .then(data => setProductCount(data.length))
            .catch(() => { });
    }, []);

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h3 className="text-gray-400 text-sm mb-2">Backend Status</h3>
                    <p className={`text-2xl font-bold ${status === 'Back-end is running!' ? 'text-green-400' : 'text-red-400'}`}>
                        {status === 'Back-end is running!' ? '🟢 Online' : '🔴 Offline'}
                    </p>
                </div>

                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h3 className="text-gray-400 text-sm mb-2">Conexões Ativas</h3>
                    <p className="text-2xl font-bold text-blue-400">
                        {connections.filter(c => c.isConnected).length} / {connections.length}
                    </p>
                </div>

                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h3 className="text-gray-400 text-sm mb-2">Produtos Cadastrados</h3>
                    <p className="text-2xl font-bold text-purple-400">{productCount}</p>
                </div>
            </div>

            {/* Connections Status */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
                <h2 className="text-xl font-semibold mb-4">Integrações</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {['woocommerce', 'mercadolibre'].map(mp => {
                        const conn = connections.find(c => c.marketplace === mp);
                        return (
                            <div key={mp} className="flex items-center justify-between bg-gray-700 rounded p-4">
                                <div className="flex items-center gap-3">
                                    <span className={`w-3 h-3 rounded-full ${conn?.isConnected ? 'bg-green-400' : 'bg-gray-500'}`}></span>
                                    <span className="font-medium capitalize">{mp === 'woocommerce' ? 'WooCommerce' : 'Mercado Livre'}</span>
                                </div>
                                <span className={`px-3 py-1 rounded text-sm ${conn?.isConnected ? 'bg-green-900 text-green-300' : 'bg-gray-600 text-gray-300'}`}>
                                    {conn?.isConnected ? 'Conectado' : 'Desconectado'}
                                </span>
                            </div>
                        );
                    })}
                </div>
                <Link to="/settings" className="inline-block mt-4 text-blue-400 hover:underline">
                    Gerenciar Conexões →
                </Link>
            </div>

            {/* Quick Actions */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h2 className="text-xl font-semibold mb-4">Ações Rápidas</h2>
                <div className="flex flex-wrap gap-4">
                    <Link to="/products" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition">
                        Ver Produtos
                    </Link>
                    <Link to="/settings" className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded transition">
                        Configurar Integrações
                    </Link>
                </div>
            </div>
        </div>
    );
}
