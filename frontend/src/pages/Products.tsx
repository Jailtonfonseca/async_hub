import { useState, useEffect } from 'react';
import { api } from '../api';

interface Product {
    id: number;
    sku: string;
    title: string;
    price: number;
    stock: number;
    woocommerceId?: string;
    mercadoLibreId?: string;
    lastSyncedAt?: string;
}

export default function Products() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState<string | null>(null);

    const loadProducts = async () => {
        setLoading(true);
        try {
            const data = await api.getProducts();
            setProducts(data);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadProducts();
    }, []);

    const handleImport = async (marketplace: string) => {
        setImporting(marketplace);
        try {
            const result = await api.importProducts(marketplace);
            alert(`Importado: ${result.imported} novos, ${result.updated} atualizados`);
            loadProducts();
        } catch (e: any) {
            alert('Erro ao importar: ' + e.message);
        }
        setImporting(null);
    };

    const handleSync = async (productId: number, marketplace: string) => {
        try {
            await api.syncProduct(productId, marketplace);
            alert('Produto sincronizado!');
            loadProducts();
        } catch (e: any) {
            alert('Erro ao sincronizar: ' + e.message);
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Produtos</h1>
                <div className="flex gap-2">
                    <button
                        onClick={() => handleImport('woocommerce')}
                        disabled={!!importing}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded disabled:opacity-50"
                    >
                        {importing === 'woocommerce' ? 'Importando...' : 'Importar WooCommerce'}
                    </button>
                    <button
                        onClick={() => handleImport('mercadolibre')}
                        disabled={!!importing}
                        className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded disabled:opacity-50"
                    >
                        {importing === 'mercadolibre' ? 'Importando...' : 'Importar Mercado Livre'}
                    </button>
                </div>
            </div>

            {loading ? (
                <p className="text-gray-400">Carregando...</p>
            ) : products.length === 0 ? (
                <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
                    <p className="text-gray-400 mb-4">Nenhum produto cadastrado.</p>
                    <p className="text-gray-500">Use os botões acima para importar produtos dos marketplaces.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full bg-gray-800 rounded-lg overflow-hidden">
                        <thead className="bg-gray-700">
                            <tr>
                                <th className="px-4 py-3 text-left">SKU</th>
                                <th className="px-4 py-3 text-left">Título</th>
                                <th className="px-4 py-3 text-right">Preço</th>
                                <th className="px-4 py-3 text-right">Estoque</th>
                                <th className="px-4 py-3 text-center">WooCommerce</th>
                                <th className="px-4 py-3 text-center">Mercado Livre</th>
                                <th className="px-4 py-3 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map(product => (
                                <tr key={product.id} className="border-t border-gray-700 hover:bg-gray-750">
                                    <td className="px-4 py-3 font-mono text-sm">{product.sku}</td>
                                    <td className="px-4 py-3">{product.title}</td>
                                    <td className="px-4 py-3 text-right">R$ {Number(product.price).toFixed(2)}</td>
                                    <td className="px-4 py-3 text-right">{product.stock}</td>
                                    <td className="px-4 py-3 text-center">
                                        {product.woocommerceId ? (
                                            <span className="text-green-400">✓</span>
                                        ) : (
                                            <span className="text-gray-500">-</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {product.mercadoLibreId ? (
                                            <span className="text-green-400">✓</span>
                                        ) : (
                                            <span className="text-gray-500">-</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex justify-center gap-2">
                                            <button
                                                onClick={() => handleSync(product.id, 'woocommerce')}
                                                className="px-2 py-1 bg-green-700 hover:bg-green-600 rounded text-xs"
                                                title="Sincronizar com WooCommerce"
                                            >
                                                WC
                                            </button>
                                            <button
                                                onClick={() => handleSync(product.id, 'mercadolibre')}
                                                className="px-2 py-1 bg-yellow-700 hover:bg-yellow-600 rounded text-xs"
                                                title="Sincronizar com Mercado Livre"
                                            >
                                                ML
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
