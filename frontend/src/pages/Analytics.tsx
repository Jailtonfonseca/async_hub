import { useState, useEffect } from 'react';
import { api } from '../api';

interface AnalyticsData {
    products: {
        total: number;
        withWC: number;
        withML: number;
        withBoth: number;
        lowStock: number;
        outOfStock: number;
    };
    sync: {
        lastSync: string | null;
        nextSync: string | null;
        intervalMinutes: number;
    };
    pricing: {
        avgPrice: number;
        minPrice: number;
        maxPrice: number;
        totalValue: number;
    };
    webhooks: {
        total: number;
        today: number;
    };
}

interface Product {
    id: number;
    sku: string;
    title: string;
    price: number;
    stock: number;
    woocommerceId?: string;
    mercadoLibreId?: string;
    images?: string[];
}

export default function Analytics() {
    const [loading, setLoading] = useState(true);
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);

    useEffect(() => {
        loadAnalytics();
    }, []);

    const loadAnalytics = async () => {
        setLoading(true);
        try {
            // Fetch products
            const productsData = await api.getProducts();
            setProducts(productsData);

            // Fetch sync status
            const syncStatus = await api.getSyncStatus();

            // Fetch webhook logs
            const webhookLogs = await api.getWebhookLogs(100);

            // Calculate analytics
            const withWC = productsData.filter((p: Product) => p.woocommerceId).length;
            const withML = productsData.filter((p: Product) => p.mercadoLibreId).length;
            const withBoth = productsData.filter((p: Product) => p.woocommerceId && p.mercadoLibreId).length;
            const lowStock = productsData.filter((p: Product) => p.stock > 0 && p.stock <= 5).length;
            const outOfStock = productsData.filter((p: Product) => p.stock === 0).length;

            const prices = productsData.map((p: Product) => Number(p.price)).filter((p: number) => p > 0);
            const avgPrice = prices.length > 0 ? prices.reduce((a: number, b: number) => a + b, 0) / prices.length : 0;
            const totalValue = productsData.reduce((sum: number, p: Product) => sum + (Number(p.price) * p.stock), 0);

            const today = new Date().toISOString().split('T')[0];
            const todayWebhooks = webhookLogs.filter((w: any) =>
                w.timestamp && w.timestamp.startsWith(today)
            ).length;

            setAnalytics({
                products: {
                    total: productsData.length,
                    withWC,
                    withML,
                    withBoth,
                    lowStock,
                    outOfStock
                },
                sync: {
                    lastSync: syncStatus.lastSync,
                    nextSync: syncStatus.nextSync,
                    intervalMinutes: syncStatus.intervalMinutes
                },
                pricing: {
                    avgPrice,
                    minPrice: prices.length > 0 ? Math.min(...prices) : 0,
                    maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
                    totalValue
                },
                webhooks: {
                    total: webhookLogs.length,
                    today: todayWebhooks
                }
            });

            // Get low stock products
            setLowStockProducts(
                productsData
                    .filter((p: Product) => p.stock <= 5)
                    .sort((a: Product, b: Product) => a.stock - b.stock)
                    .slice(0, 10)
            );

        } catch (e) {
            console.error('Error loading analytics:', e);
        }
        setLoading(false);
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleString('pt-BR');
    };

    if (loading) {
        return (
            <div className="p-6">
                <h1 className="text-3xl font-bold mb-6">Analytics</h1>
                <p className="text-gray-400">Carregando dados...</p>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">📊 Analytics</h1>
                <button
                    onClick={loadAnalytics}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
                >
                    🔄 Atualizar
                </button>
            </div>

            {analytics && (
                <>
                    {/* Main Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <StatCard
                            title="Total Produtos"
                            value={analytics.products.total}
                            icon="📦"
                            color="blue"
                        />
                        <StatCard
                            title="No WooCommerce"
                            value={analytics.products.withWC}
                            icon="🛒"
                            color="green"
                            subtitle={`${Math.round((analytics.products.withWC / analytics.products.total) * 100 || 0)}%`}
                        />
                        <StatCard
                            title="No Mercado Livre"
                            value={analytics.products.withML}
                            icon="🏷️"
                            color="yellow"
                            subtitle={`${Math.round((analytics.products.withML / analytics.products.total) * 100 || 0)}%`}
                        />
                        <StatCard
                            title="Em Ambos"
                            value={analytics.products.withBoth}
                            icon="🔗"
                            color="purple"
                            subtitle={`${Math.round((analytics.products.withBoth / analytics.products.total) * 100 || 0)}%`}
                        />
                    </div>

                    {/* Stock & Pricing */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        {/* Stock Status */}
                        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                            <h2 className="text-xl font-bold mb-4">📊 Status do Estoque</h2>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Estoque Baixo (≤5)</span>
                                    <span className="text-yellow-400 font-bold">{analytics.products.lowStock}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Sem Estoque</span>
                                    <span className="text-red-400 font-bold">{analytics.products.outOfStock}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Em Estoque</span>
                                    <span className="text-green-400 font-bold">
                                        {analytics.products.total - analytics.products.lowStock - analytics.products.outOfStock}
                                    </span>
                                </div>

                                {/* Stock Bar */}
                                <div className="mt-4">
                                    <div className="flex h-3 rounded-full overflow-hidden bg-gray-700">
                                        <div
                                            className="bg-green-500"
                                            style={{ width: `${((analytics.products.total - analytics.products.lowStock - analytics.products.outOfStock) / analytics.products.total) * 100}%` }}
                                        />
                                        <div
                                            className="bg-yellow-500"
                                            style={{ width: `${(analytics.products.lowStock / analytics.products.total) * 100}%` }}
                                        />
                                        <div
                                            className="bg-red-500"
                                            style={{ width: `${(analytics.products.outOfStock / analytics.products.total) * 100}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                                        <span>🟢 Normal</span>
                                        <span>🟡 Baixo</span>
                                        <span>🔴 Zerado</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Pricing Stats */}
                        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                            <h2 className="text-xl font-bold mb-4">💰 Preços</h2>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Preço Médio</span>
                                    <span className="text-white font-bold">{formatCurrency(analytics.pricing.avgPrice)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Menor Preço</span>
                                    <span className="text-green-400">{formatCurrency(analytics.pricing.minPrice)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Maior Preço</span>
                                    <span className="text-blue-400">{formatCurrency(analytics.pricing.maxPrice)}</span>
                                </div>
                                <div className="pt-3 border-t border-gray-700">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400">Valor Total em Estoque</span>
                                        <span className="text-xl font-bold text-green-400">{formatCurrency(analytics.pricing.totalValue)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sync & Webhooks */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        {/* Sync Status */}
                        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                            <h2 className="text-xl font-bold mb-4">🔄 Sincronização</h2>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Última Sync</span>
                                    <span className="text-white">{formatDate(analytics.sync.lastSync)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Próxima Sync</span>
                                    <span className="text-blue-400">{formatDate(analytics.sync.nextSync)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Intervalo</span>
                                    <span className="text-white">{analytics.sync.intervalMinutes} minutos</span>
                                </div>
                            </div>
                        </div>

                        {/* Webhooks */}
                        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                            <h2 className="text-xl font-bold mb-4">📡 Webhooks</h2>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Recebidos Hoje</span>
                                    <span className="text-green-400 font-bold text-xl">{analytics.webhooks.today}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Total (últimos 100)</span>
                                    <span className="text-white">{analytics.webhooks.total}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Low Stock Products Table */}
                    {lowStockProducts.length > 0 && (
                        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                            <h2 className="text-xl font-bold mb-4">⚠️ Produtos com Estoque Baixo</h2>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="text-left text-gray-400 text-sm">
                                        <tr>
                                            <th className="pb-3">Foto</th>
                                            <th className="pb-3">SKU</th>
                                            <th className="pb-3">Produto</th>
                                            <th className="pb-3 text-right">Estoque</th>
                                            <th className="pb-3 text-center">WC</th>
                                            <th className="pb-3 text-center">ML</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lowStockProducts.map(product => (
                                            <tr key={product.id} className="border-t border-gray-700">
                                                <td className="py-2">
                                                    {product.images && product.images.length > 0 ? (
                                                        <img src={product.images[0]} className="w-10 h-10 object-cover rounded" />
                                                    ) : (
                                                        <div className="w-10 h-10 bg-gray-700 rounded flex items-center justify-center">📦</div>
                                                    )}
                                                </td>
                                                <td className="py-2 font-mono text-sm">{product.sku}</td>
                                                <td className="py-2">{product.title}</td>
                                                <td className="py-2 text-right">
                                                    <span className={`font-bold ${product.stock === 0 ? 'text-red-400' : 'text-yellow-400'}`}>
                                                        {product.stock}
                                                    </span>
                                                </td>
                                                <td className="py-2 text-center">
                                                    {product.woocommerceId ? '✅' : '➖'}
                                                </td>
                                                <td className="py-2 text-center">
                                                    {product.mercadoLibreId ? '✅' : '➖'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// Stat Card Component
function StatCard({ title, value, icon, color, subtitle }: {
    title: string;
    value: number | string;
    icon: string;
    color: string;
    subtitle?: string;
}) {
    const colors: Record<string, string> = {
        blue: 'from-blue-600 to-blue-800',
        green: 'from-green-600 to-green-800',
        yellow: 'from-yellow-600 to-yellow-800',
        purple: 'from-purple-600 to-purple-800',
        red: 'from-red-600 to-red-800',
    };

    return (
        <div className={`bg-gradient-to-br ${colors[color]} rounded-lg p-4 border border-gray-600`}>
            <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{icon}</span>
                <span className="text-gray-200 text-sm">{title}</span>
            </div>
            <div className="text-3xl font-bold">{value}</div>
            {subtitle && <div className="text-sm text-gray-300 mt-1">{subtitle}</div>}
        </div>
    );
}
