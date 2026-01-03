import { useState, useEffect } from 'react';
import { api } from '../api';

interface LogEntry {
    timestamp: string;
    type: 'info' | 'success' | 'error' | 'warning';
    source: string;
    message: string;
    data?: any;
}

export default function Logs() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(false);

    const addLog = (type: LogEntry['type'], source: string, message: string, data?: any) => {
        const entry: LogEntry = {
            timestamp: new Date().toLocaleTimeString(),
            type,
            source,
            message,
            data
        };
        setLogs(prev => [entry, ...prev]);
    };

    const runDiagnostics = async () => {
        setLoading(true);
        setLogs([]);

        // Test 1: Health Check
        addLog('info', 'Health', 'Checking backend health...');
        try {
            const health = await api.health();
            addLog('success', 'Health', 'Backend is reachable', health);
        } catch (e: any) {
            addLog('error', 'Health', `Backend unreachable: ${e.message}`);
        }

        // Test 2: Get Connections
        addLog('info', 'Connections', 'Fetching marketplace connections...');
        try {
            const connections = await api.getConnections();
            addLog('success', 'Connections', `Found ${connections.length} connection(s)`, connections);

            // Check each connection
            for (const conn of connections) {
                addLog('info', conn.marketplace, `Status: ${conn.isConnected ? 'Connected' : 'Disconnected'}`, conn);
            }
        } catch (e: any) {
            addLog('error', 'Connections', `Failed to fetch: ${e.message}`);
        }

        // Test 3: Get Products
        addLog('info', 'Products', 'Fetching local products...');
        try {
            const products = await api.getProducts();
            addLog('success', 'Products', `Found ${products.length} product(s) in database`,
                products.length > 0 ? products.slice(0, 3) : 'No products');
        } catch (e: any) {
            addLog('error', 'Products', `Failed to fetch: ${e.message}`);
        }

        // Test 4: Test MercadoLibre Connection
        addLog('info', 'MercadoLibre', 'Testing MercadoLibre connection...');
        try {
            const result = await api.testConnection('mercadolibre');
            if (result.isConnected) {
                addLog('success', 'MercadoLibre', 'Connection test passed', result);
            } else {
                addLog('warning', 'MercadoLibre', 'Connection test failed - may need reauthorization', result);
            }
        } catch (e: any) {
            addLog('error', 'MercadoLibre', `Test failed: ${e.message}`);
        }

        // Test 5: Test WooCommerce Connection
        addLog('info', 'WooCommerce', 'Testing WooCommerce connection...');
        try {
            const result = await api.testConnection('woocommerce');
            if (result.isConnected) {
                addLog('success', 'WooCommerce', 'Connection test passed', result);
            } else {
                addLog('warning', 'WooCommerce', 'Connection test failed - check credentials', result);
            }
        } catch (e: any) {
            addLog('error', 'WooCommerce', `Test failed: ${e.message}`);
        }

        // Test 6: Check Token Status
        addLog('info', 'Token ML', 'Checking MercadoLibre token status...');
        try {
            const tokenStatus = await api.getTokenStatus('mercadolibre');
            if (tokenStatus.hasToken) {
                if (tokenStatus.isValid) {
                    addLog('success', 'Token ML', `Token válido - expira em ${tokenStatus.hoursUntilExpiry}h`, tokenStatus);
                } else {
                    addLog('warning', 'Token ML', 'Token expirado ou inválido', tokenStatus);
                }
            } else {
                addLog('warning', 'Token ML', 'Nenhum token encontrado - autorize o app', tokenStatus);
            }
        } catch (e: any) {
            addLog('error', 'Token ML', `Erro ao verificar token: ${e.message}`);
        }

        // Test 7: Try importing from MercadoLibre
        addLog('info', 'Import', 'Attempting to import products from MercadoLibre...');
        try {
            const result = await api.importProducts('mercadolibre');
            addLog('success', 'Import', `Import result: ${result.imported} new, ${result.updated} updated`, result);
        } catch (e: any) {
            addLog('error', 'Import', `Import failed: ${e.message}`, e);
        }

        setLoading(false);
        addLog('info', 'Diagnostics', 'All tests completed');
    };

    const getLogColor = (type: LogEntry['type']) => {
        switch (type) {
            case 'success': return 'text-green-400 bg-green-900/30 border-green-700';
            case 'error': return 'text-red-400 bg-red-900/30 border-red-700';
            case 'warning': return 'text-yellow-400 bg-yellow-900/30 border-yellow-700';
            default: return 'text-blue-400 bg-blue-900/30 border-blue-700';
        }
    };

    const getIcon = (type: LogEntry['type']) => {
        switch (type) {
            case 'success': return '✅';
            case 'error': return '❌';
            case 'warning': return '⚠️';
            default: return 'ℹ️';
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Logs & Diagnóstico</h1>
                <button
                    onClick={runDiagnostics}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
                >
                    {loading ? 'Executando...' : '▶️ Executar Diagnóstico'}
                </button>
            </div>

            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 mb-6">
                <h2 className="text-lg font-semibold mb-2">Sobre esta página</h2>
                <p className="text-gray-400 text-sm">
                    Clique em "Executar Diagnóstico" para testar todas as conexões e ver o que está acontecendo.
                    Os logs mostram cada etapa do processo com os dados retornados pela API.
                </p>
            </div>

            {logs.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                    <p className="text-6xl mb-4">🔍</p>
                    <p>Nenhum log ainda. Clique em "Executar Diagnóstico" para começar.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {logs.map((log, index) => (
                        <div
                            key={index}
                            className={`p-3 rounded border ${getLogColor(log.type)}`}
                        >
                            <div className="flex items-start gap-3">
                                <span className="text-xl">{getIcon(log.type)}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-mono text-xs text-gray-500">{log.timestamp}</span>
                                        <span className="font-semibold">[{log.source}]</span>
                                    </div>
                                    <p>{log.message}</p>
                                    {log.data && (
                                        <pre className="mt-2 p-2 bg-gray-900 rounded text-xs overflow-x-auto">
                                            {JSON.stringify(log.data, null, 2)}
                                        </pre>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-6 flex gap-2">
                <button
                    onClick={() => setLogs([])}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
                >
                    🗑️ Limpar Logs
                </button>
                <button
                    onClick={() => {
                        const text = logs.map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] [${l.source}] ${l.message}\n${l.data ? JSON.stringify(l.data, null, 2) : ''}`).join('\n\n');
                        navigator.clipboard.writeText(text);
                        alert('Logs copiados!');
                    }}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
                >
                    📋 Copiar Logs
                </button>
            </div>
        </div>
    );
}
