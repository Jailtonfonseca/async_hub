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
        totalGroups: number;
        ungrouped: number;
        onlyWC: number;
        onlyML: number;
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
        medianPrice: number;
    };
    costs: {
        totalCost: number;
        avgCost: number;
        avgMargin: number;
        potentialProfit: number;
        productsWithCost: number;
        roi: number;
    };
    listings: {
        classic: number;
        premium: number;
        other: number;
    };
    inventory: {
        totalUnits: number;
        avgStock: number;
        highStock: number;
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
    costPrice?: number;
    stock: number;
    groupId?: string;
    listingType?: string;
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
            // Deduplicate products based on groupId
            // If a product has a groupId, it counts as 1 physical product (the group).
            // We take the representative with the most complete data or just the first one.
            const uniqueProductsMap = new Map<string, Product>();
            const ungroupedProducts: Product[] = [];

            productsData.forEach((p: Product) => {
                if (p.groupId) {
                    if (!uniqueProductsMap.has(p.groupId)) {
                        uniqueProductsMap.set(p.groupId, p);
                    }
                } else {
                    ungroupedProducts.push(p);
                }
            });

            const uniqueGroupedProducts = Array.from(uniqueProductsMap.values());
            const uniquePhysicalProducts = [...uniqueGroupedProducts, ...ungroupedProducts];

            // Calculate analytics based on UNIQUE PHYSICAL PRODUCTS
            const withWC = uniquePhysicalProducts.filter((p: Product) => p.woocommerceId).length;
            const withML = uniquePhysicalProducts.filter((p: Product) => p.mercadoLibreId).length;
            const withBoth = uniquePhysicalProducts.filter((p: Product) => p.woocommerceId && p.mercadoLibreId).length;
            const lowStock = uniquePhysicalProducts.filter((p: Product) => p.stock > 0 && p.stock <= 5).length;
            const outOfStock = uniquePhysicalProducts.filter((p: Product) => p.stock === 0).length;

            // Group analytics (Total Groups stays the same)
            const groupIds = new Set(productsData.filter((p: Product) => p.groupId).map((p: Product) => p.groupId));
            const totalGroups = groupIds.size;
            const ungrouped = productsData.filter((p: Product) => !p.groupId).length;

            const prices = uniquePhysicalProducts.map((p: Product) => Number(p.price)).filter((p: number) => p > 0);
            const avgPrice = prices.length > 0 ? prices.reduce((a: number, b: number) => a + b, 0) / prices.length : 0;
            // Total Value = Sum of (Price * Stock) for unique physical products
            const totalValue = uniquePhysicalProducts.reduce((sum: number, p: Product) => sum + (Number(p.price) * p.stock), 0);

            // Cost and margin calculations (Use uniquePhysicalProducts)
            const productsWithCost = uniquePhysicalProducts.filter((p: Product) => p.costPrice && Number(p.costPrice) > 0);
            const costs = productsWithCost.map((p: Product) => Number(p.costPrice));
            const avgCost = costs.length > 0 ? costs.reduce((a: number, b: number) => a + b, 0) / costs.length : 0;
            const totalCost = productsWithCost.reduce((sum: number, p: Product) => sum + (Number(p.costPrice) * p.stock), 0);

            // Calculate average margin (only for products with cost)
            let avgMargin = 0;
            if (productsWithCost.length > 0) {
                const margins = productsWithCost.map((p: Product) => {
                    const cost = Number(p.costPrice) || 0;
                    const price = Number(p.price) || 0;
                    return price > 0 ? ((price - cost) / price) * 100 : 0;
                });
                avgMargin = margins.reduce((a: number, b: number) => a + b, 0) / margins.length;
            }

            const potentialProfit = totalValue - totalCost;
            const roi = totalCost > 0 ? (potentialProfit / totalCost) * 100 : 0;

            // Marketplace exclusivity (Listing level, so use productsData)
            const onlyWC = productsData.filter((p: Product) => p.woocommerceId && !p.mercadoLibreId).length;
            const onlyML = productsData.filter((p: Product) => p.mercadoLibreId && !p.woocommerceId).length;

            // Listing types (ML) (Listing level, use productsData)
            const classic = productsData.filter((p: Product) => p.listingType === 'classic').length;
            const premium = productsData.filter((p: Product) => p.listingType === 'premium').length;
            const otherListings = productsData.filter((p: Product) => p.listingType && p.listingType !== 'classic' && p.listingType !== 'premium').length;

            // Inventory metrics (Use uniquePhysicalProducts)
            const stocks = uniquePhysicalProducts.map((p: Product) => p.stock).filter((s: number) => s > 0);
            const totalUnits = uniquePhysicalProducts.reduce((sum: number, p: Product) => sum + p.stock, 0);
            const avgStock = stocks.length > 0 ? totalUnits / stocks.length : 0;
            const highStock = uniquePhysicalProducts.filter((p: Product) => p.stock > 50).length;

            // Median price (Use uniquePhysicalProducts)
            const sortedPrices = [...prices].sort((a, b) => a - b);
            const medianPrice = sortedPrices.length > 0
                ? sortedPrices.length % 2 === 0
                    ? (sortedPrices[sortedPrices.length / 2 - 1] + sortedPrices[sortedPrices.length / 2]) / 2
                    : sortedPrices[Math.floor(sortedPrices.length / 2)]
                : 0;

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
                    outOfStock,
                    totalGroups,
                    ungrouped,
                    onlyWC,
                    onlyML
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
                    totalValue,
                    medianPrice
                },
                costs: {
                    totalCost,
                    avgCost,
                    avgMargin,
                    potentialProfit,
                    productsWithCost: productsWithCost.length,
                    roi
                },
                listings: {
                    classic,
                    premium,
                    other: otherListings
                },
                inventory: {
                    totalUnits,
                    avgStock,
                    highStock
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
            <div className="p-4 sm:p-6">
                <h1 className="text-2xl sm:text-3xl font-bold mb-6">Analytics</h1>
                <p className="text-gray-400">Carregando dados...</p>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold">📊 Analytics</h1>
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

                    {/* Margin & Profit Analysis */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        {/* Margins */}
                        <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 rounded-lg p-6 border border-purple-600/50">
                            <h2 className="text-xl font-bold mb-4">📊 Margens e Lucro</h2>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Custo Médio</span>
                                    <span className="text-white font-bold">{formatCurrency(analytics.costs.avgCost)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Margem Média</span>
                                    <span className={`font-bold ${analytics.costs.avgMargin >= 30 ? 'text-green-400' : analytics.costs.avgMargin >= 15 ? 'text-yellow-400' : 'text-red-400'}`}>
                                        {analytics.costs.avgMargin.toFixed(1)}%
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Custo Total Estoque</span>
                                    <span className="text-orange-400 font-bold">{formatCurrency(analytics.costs.totalCost)}</span>
                                </div>
                                <div className="pt-3 border-t border-purple-600/30">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400">Lucro Potencial</span>
                                        <span className={`text-xl font-bold ${analytics.costs.potentialProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {formatCurrency(analytics.costs.potentialProfit)}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-xs text-gray-500 mt-2">
                                    Baseado em {analytics.costs.productsWithCost} produtos com custo cadastrado
                                </div>
                            </div>
                        </div>

                        {/* Groups */}
                        <div className="bg-gradient-to-br from-cyan-900/50 to-cyan-800/30 rounded-lg p-6 border border-cyan-600/50">
                            <h2 className="text-xl font-bold mb-4">🔗 Agrupamentos</h2>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Total de Grupos</span>
                                    <span className="text-cyan-400 font-bold text-2xl">{analytics.products.totalGroups}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Produtos Agrupados</span>
                                    <span className="text-white">{analytics.products.total - analytics.products.ungrouped}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Produtos Sem Grupo</span>
                                    <span className="text-yellow-400">{analytics.products.ungrouped}</span>
                                </div>
                                {analytics.products.totalGroups > 0 && (
                                    <div className="pt-3 border-t border-cyan-600/30">
                                        <div className="text-xs text-gray-500">
                                            Média de {((analytics.products.total - analytics.products.ungrouped) / analytics.products.totalGroups).toFixed(1)} produtos por grupo
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Additional Metrics Row */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        {/* ROI */}
                        <div className="bg-gradient-to-br from-green-900/50 to-green-800/30 rounded-lg p-4 border border-green-600/50">
                            <div className="text-gray-400 text-sm mb-1">ROI (Retorno)</div>
                            <div className={`text-2xl font-bold ${analytics.costs.roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {analytics.costs.roi.toFixed(1)}%
                            </div>
                            <div className="text-xs text-gray-500 mt-1">Lucro / Custo Total</div>
                        </div>

                        {/* Inventory */}
                        <div className="bg-gradient-to-br from-amber-900/50 to-amber-800/30 rounded-lg p-4 border border-amber-600/50">
                            <div className="text-gray-400 text-sm mb-1">Unidades Total</div>
                            <div className="text-2xl font-bold text-amber-400">
                                {analytics.inventory.totalUnits.toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                                Média: {analytics.inventory.avgStock.toFixed(0)} • Alto: {analytics.inventory.highStock}
                            </div>
                        </div>

                        {/* Median Price */}
                        <div className="bg-gradient-to-br from-indigo-900/50 to-indigo-800/30 rounded-lg p-4 border border-indigo-600/50">
                            <div className="text-gray-400 text-sm mb-1">Preço Mediano</div>
                            <div className="text-2xl font-bold text-indigo-400">
                                {formatCurrency(analytics.pricing.medianPrice)}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">vs Média: {formatCurrency(analytics.pricing.avgPrice)}</div>
                        </div>

                        {/* Listing Types */}
                        <div className="bg-gradient-to-br from-pink-900/50 to-pink-800/30 rounded-lg p-4 border border-pink-600/50">
                            <div className="text-gray-400 text-sm mb-1">Tipos de Anúncio ML</div>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-pink-400 font-bold">⭐ {analytics.listings.premium}</span>
                                <span className="text-gray-500">|</span>
                                <span className="text-gray-300">🏷️ {analytics.listings.classic}</span>
                                {analytics.listings.other > 0 && (
                                    <>
                                        <span className="text-gray-500">|</span>
                                        <span className="text-gray-400">📦 {analytics.listings.other}</span>
                                    </>
                                )}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">Premium • Classic • Outros</div>
                        </div>
                    </div>

                    {/* Marketplace Coverage */}
                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
                        <h2 className="text-xl font-bold mb-4">🌐 Cobertura de Marketplaces</h2>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div className="text-center">
                                <div className="text-3xl font-bold text-blue-400">{analytics.products.withWC}</div>
                                <div className="text-sm text-gray-400">WooCommerce</div>
                            </div>
                            <div className="text-center">
                                <div className="text-3xl font-bold text-yellow-400">{analytics.products.withML}</div>
                                <div className="text-sm text-gray-400">MercadoLibre</div>
                            </div>
                            <div className="text-center">
                                <div className="text-3xl font-bold text-green-400">{analytics.products.withBoth}</div>
                                <div className="text-sm text-gray-400">Ambos</div>
                            </div>
                            <div className="text-center">
                                <div className="text-3xl font-bold text-cyan-400">{analytics.products.onlyWC}</div>
                                <div className="text-sm text-gray-400">Só WC</div>
                            </div>
                            <div className="text-center">
                                <div className="text-3xl font-bold text-orange-400">{analytics.products.onlyML}</div>
                                <div className="text-sm text-gray-400">Só ML</div>
                            </div>
                        </div>
                        {/* Coverage Bar */}
                        <div className="mt-4">
                            <div className="flex h-4 rounded-full overflow-hidden bg-gray-700">
                                <div
                                    className="bg-green-500"
                                    style={{ width: `${(analytics.products.withBoth / analytics.products.total) * 100}%` }}
                                    title="Ambos"
                                />
                                <div
                                    className="bg-cyan-500"
                                    style={{ width: `${(analytics.products.onlyWC / analytics.products.total) * 100}%` }}
                                    title="Só WC"
                                />
                                <div
                                    className="bg-orange-500"
                                    style={{ width: `${(analytics.products.onlyML / analytics.products.total) * 100}%` }}
                                    title="Só ML"
                                />
                            </div>
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                <span>🟢 Ambos ({((analytics.products.withBoth / analytics.products.total) * 100).toFixed(0)}%)</span>
                                <span>🔵 Só WC ({((analytics.products.onlyWC / analytics.products.total) * 100).toFixed(0)}%)</span>
                                <span>🟠 Só ML ({((analytics.products.onlyML / analytics.products.total) * 100).toFixed(0)}%)</span>
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
