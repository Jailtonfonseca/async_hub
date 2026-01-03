import { useState, useEffect } from 'react';
import { api } from '../api';

interface Product {
    id: number;
    sku: string;
    title: string;
    price: number;
    stock: number;
    images?: string[];
}

interface AdSuggestion {
    id: number;
    productId: number;
    product?: Product;
    type: string;
    status: string;
    suggestedTitle: string;
    suggestedDescription?: string;
    suggestedPrice: number;
    reasoning?: string;
    targetNiche?: string;
    stockRequired: number;
    generatedBy?: string;
    createdAt: string;
}

const typeLabels: Record<string, { label: string; icon: string; color: string }> = {
    classico: { label: 'Clássico', icon: '🏷️', color: 'bg-blue-600' },
    premium: { label: 'Premium', icon: '⭐', color: 'bg-purple-600' },
    kit_2: { label: 'Kit 2un', icon: '📦', color: 'bg-green-600' },
    kit_3: { label: 'Kit 3un', icon: '📦', color: 'bg-green-700' },
    kit_accessory: { label: 'Kit + Acessório', icon: '🎁', color: 'bg-teal-600' },
    seo_variant: { label: 'SEO Variant', icon: '🎯', color: 'bg-orange-600' },
};

export default function AIAds() {
    const [products, setProducts] = useState<Product[]>([]);
    const [suggestions, setSuggestions] = useState<AdSuggestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState<number | null>(null);
    const [selectedProduct, setSelectedProduct] = useState<number | null>(null);
    const [aiStatus, setAIStatus] = useState<any>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [prods, sugs, status] = await Promise.all([
                api.getProducts(),
                api.getPendingSuggestions(),
                api.getAIStatus(),
            ]);
            setProducts(prods);
            setSuggestions(sugs);
            setAIStatus(status);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const handleGenerate = async (productId: number) => {
        setGenerating(productId);
        try {
            const result = await api.generateSuggestions(productId);
            if (result.success) {
                alert(`Geradas ${result.count} sugestões!`);
                loadData();
            } else {
                alert('Erro: ' + result.error);
            }
        } catch (e: any) {
            alert('Erro: ' + e.message);
        }
        setGenerating(null);
    };

    const handleApprove = async (id: number) => {
        try {
            await api.approveSuggestion(id);
            loadData();
        } catch (e: any) {
            alert('Erro: ' + e.message);
        }
    };

    const handleReject = async (id: number) => {
        try {
            await api.rejectSuggestion(id);
            loadData();
        } catch (e: any) {
            alert('Erro: ' + e.message);
        }
    };

    const handleApproveAll = async () => {
        for (const sug of suggestions.filter(s => s.status === 'pending')) {
            await api.approveSuggestion(sug.id);
        }
        loadData();
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    if (loading) {
        return (
            <div className="p-6">
                <h1 className="text-3xl font-bold mb-6">🤖 AI Ads</h1>
                <p className="text-gray-400">Carregando...</p>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold">🤖 AI Ads</h1>
                    <p className="text-gray-400 text-sm">Multiplicador de Anúncios com IA</p>
                </div>
                {aiStatus && (
                    <div className="text-right text-sm">
                        <span className="text-gray-400">Providers: </span>
                        {aiStatus.configuredProviders?.map((p: string) => (
                            <span key={p} className="ml-1 px-2 py-1 bg-gray-700 rounded text-xs">
                                {p}
                            </span>
                        )) || <span className="text-yellow-400">Nenhum configurado</span>}
                    </div>
                )}
            </div>

            {/* Product Selector */}
            <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700">
                <h2 className="text-lg font-bold mb-3">📦 Selecione um Produto</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {products.map(product => (
                        <div
                            key={product.id}
                            className={`p-3 rounded border cursor-pointer transition ${selectedProduct === product.id
                                    ? 'border-blue-500 bg-blue-900/30'
                                    : 'border-gray-600 hover:border-gray-500 bg-gray-700'
                                }`}
                            onClick={() => setSelectedProduct(product.id)}
                        >
                            <div className="flex gap-3">
                                {product.images && product.images.length > 0 ? (
                                    <img src={product.images[0]} className="w-12 h-12 object-cover rounded" />
                                ) : (
                                    <div className="w-12 h-12 bg-gray-600 rounded flex items-center justify-center">📦</div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate">{product.title}</div>
                                    <div className="text-sm text-gray-400">
                                        {formatCurrency(product.price)} • Estoque: {product.stock}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {selectedProduct && (
                    <div className="mt-4 flex gap-3">
                        <button
                            onClick={() => handleGenerate(selectedProduct)}
                            disabled={generating !== null}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
                        >
                            {generating === selectedProduct ? '⏳ Gerando...' : '✨ Gerar Sugestões com IA'}
                        </button>
                    </div>
                )}
            </div>

            {/* Pending Suggestions */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold">📋 Sugestões Pendentes ({suggestions.filter(s => s.status === 'pending').length})</h2>
                    {suggestions.filter(s => s.status === 'pending').length > 0 && (
                        <button
                            onClick={handleApproveAll}
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
                        >
                            ✓ Aprovar Todas
                        </button>
                    )}
                </div>

                {suggestions.length === 0 ? (
                    <p className="text-gray-400">Nenhuma sugestão pendente. Selecione um produto e clique em "Gerar Sugestões".</p>
                ) : (
                    <div className="space-y-3">
                        {suggestions.map(sug => {
                            const typeInfo = typeLabels[sug.type] || { label: sug.type, icon: '📄', color: 'bg-gray-600' };
                            const product = sug.product || products.find(p => p.id === sug.productId);

                            return (
                                <div key={sug.id} className="p-4 bg-gray-700 rounded-lg">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`${typeInfo.color} px-2 py-1 rounded text-sm`}>
                                                {typeInfo.icon} {typeInfo.label}
                                            </span>
                                            {sug.targetNiche && (
                                                <span className="text-xs text-gray-400">Nicho: {sug.targetNiche}</span>
                                            )}
                                        </div>
                                        <span className="text-lg font-bold text-green-400">
                                            {formatCurrency(sug.suggestedPrice)}
                                        </span>
                                    </div>

                                    <div className="mb-2">
                                        <span className="text-gray-400 text-xs">Produto Original:</span>
                                        <span className="text-gray-300 text-sm ml-2">{product?.title}</span>
                                    </div>

                                    <div className="mb-2">
                                        <span className="text-gray-400 text-xs">Título Sugerido:</span>
                                        <div className="text-white font-medium">{sug.suggestedTitle}</div>
                                    </div>

                                    {sug.reasoning && (
                                        <div className="text-sm text-gray-400 mb-3 italic">
                                            💡 {sug.reasoning}
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleApprove(sug.id)}
                                            className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
                                        >
                                            ✓ Aprovar
                                        </button>
                                        <button
                                            onClick={() => handleReject(sug.id)}
                                            className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                                        >
                                            ✗ Rejeitar
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
