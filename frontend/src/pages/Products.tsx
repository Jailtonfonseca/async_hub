import { useState, useEffect } from 'react';
import { api } from '../api';

interface Product {
    id: number;
    sku: string;
    title: string;
    description?: string;
    price: number;
    salePrice?: number;
    costPrice?: number;
    groupId?: string;
    listingType?: string;
    stock: number;
    images?: string[];
    category?: string;
    brand?: string;
    condition?: string;
    woocommerceId?: string;
    mercadoLibreId?: string;
    lastSyncedAt?: string;
}

const emptyProduct: Partial<Product> = {
    sku: '',
    title: '',
    description: '',
    price: 0,
    salePrice: undefined,
    costPrice: undefined,
    groupId: '',
    stock: 0,
    images: [],
    category: '',
    brand: '',
    condition: 'new'
};

export default function Products() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
    const [saving, setSaving] = useState(false);
    const [viewMode, setViewMode] = useState<'flat' | 'grouped'>('flat');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [syncingAll, setSyncingAll] = useState(false);

    const toggleGroup = (groupId: string) => {
        const newExpanded = new Set(expandedGroups);
        if (newExpanded.has(groupId)) {
            newExpanded.delete(groupId);
        } else {
            newExpanded.add(groupId);
        }
        setExpandedGroups(newExpanded);
    };

    // Grouping Logic
    const groupedProducts = products.reduce((acc: Record<string, Product[]>, product) => {
        if (product.groupId) {
            if (!acc[product.groupId]) {
                acc[product.groupId] = [];
            }
            acc[product.groupId].push(product);
        }
        return acc;
    }, {} as Record<string, Product[]>);

    // Prepare display list
    const getDisplayItems = () => {
        if (viewMode === 'flat') return products;

        const displayed: (Product | { type: 'group', id: string, products: Product[] })[] = [];
        const processedGroups = new Set<string>();

        products.forEach(p => {
            if (p.groupId) {
                if (!processedGroups.has(p.groupId)) {
                    displayed.push({
                        type: 'group',
                        id: p.groupId,
                        products: groupedProducts[p.groupId]
                    });
                    processedGroups.add(p.groupId);
                }
            } else {
                displayed.push(p);
            }
        });
        return displayed;
    };

    const displayItems = getDisplayItems();

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

    const handleEdit = (product: Product) => {
        setEditingProduct({ ...product });
        setShowModal(true);
    };

    const handleNew = () => {
        setEditingProduct({ ...emptyProduct });
        setShowModal(true);
    };

    const handleDelete = async (product: Product) => {
        if (!confirm(`Tem certeza que deseja excluir "${product.title}"?`)) return;
        try {
            await api.deleteProduct(product.id);
            alert('Produto excluído!');
            loadProducts();
        } catch (e: any) {
            alert('Erro ao excluir: ' + e.message);
        }
    };

    const handleSave = async () => {
        if (!editingProduct) return;
        setSaving(true);

        try {
            if (editingProduct.id) {
                // Update existing
                await api.updateProduct(editingProduct.id, editingProduct);
                alert('Produto atualizado!');
            } else {
                // Create new
                await api.createProduct(editingProduct);
                alert('Produto criado!');
            }
            setShowModal(false);
            setEditingProduct(null);
            loadProducts();
        } catch (e: any) {
            alert('Erro ao salvar: ' + e.message);
        }
        setSaving(false);
    };

    const handleSyncAll = async (marketplace: string) => {
        setSyncingAll(true);
        try {
            const result = await api.triggerSync(marketplace);
            if (result.success) {
                const r = result.result;
                alert(`Sync ${marketplace}: ${r.imported} importados, ${r.updated} atualizados, ${r.failed} falhas`);
            } else {
                alert('Erro: ' + result.error);
            }
            loadProducts();
        } catch (e: any) {
            alert('Erro ao sincronizar: ' + e.message);
        }
        setSyncingAll(false);
    };

    const updateField = (field: keyof Product, value: any) => {
        if (!editingProduct) return;
        setEditingProduct({ ...editingProduct, [field]: value });
    };

    // Helper to render a Product Row (reusable for flat or group child)
    const renderProductRow = (product: Product, isChild = false) => (
        <tr key={product.id} className={`border-t border-gray-700 hover:bg-gray-750 ${isChild ? 'bg-gray-800/50' : ''}`}>
            <td className={`px-2 py-2 text-center ${isChild ? 'pl-8' : ''}`}>
                <div className="flex items-center justify-center">
                    {isChild && <span className="text-gray-500 mr-2">└</span>}
                    {product.images && product.images.length > 0 ? (
                        <img
                            src={product.images[0]}
                            alt={product.title}
                            className="w-12 h-12 object-cover rounded"
                            onError={(e: any) => {
                                (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23374151" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%239CA3AF" font-size="30">📦</text></svg>';
                            }}
                        />
                    ) : (
                        <div className="w-12 h-12 bg-gray-700 rounded flex items-center justify-center">
                            <span className="text-2xl">📦</span>
                        </div>
                    )}
                </div>
            </td>
            <td className="px-4 py-3 font-mono text-sm">
                {product.sku}
                {product.listingType && (
                    <span className={`block text-xs ${product.listingType === 'premium' ? 'text-yellow-400' : 'text-gray-500'}`}>
                        {product.listingType.toUpperCase()}
                    </span>
                )}
            </td>
            <td className="px-4 py-3">
                {product.title}
                {isChild && product.groupId && (
                    <span className="ml-2 text-xs text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded">
                        {product.groupId}
                    </span>
                )}
            </td>
            <td className="px-4 py-3 text-right">
                R$ {Number(product.price).toFixed(2)}
                {product.salePrice && (
                    <span className="text-green-400 text-xs ml-1">
                        → R$ {Number(product.salePrice).toFixed(2)}
                    </span>
                )}
            </td>
            <td className="px-4 py-3 text-right">
                {product.costPrice ? (
                    <span className="text-yellow-400">R$ {Number(product.costPrice).toFixed(2)}</span>
                ) : (
                    <span className="text-gray-500">-</span>
                )}
            </td>
            <td className="px-4 py-3 text-right">{product.stock}</td>
            <td className="px-4 py-3 text-right">
                {product.costPrice ? (
                    <span className="text-blue-400 font-medium">
                        R$ {(Number(product.costPrice) * product.stock).toFixed(2)}
                    </span>
                ) : (
                    <span className="text-gray-500">-</span>
                )}
            </td>
            <td className="px-4 py-3 text-center">
                {product.woocommerceId ? (
                    <span className="text-green-400" title={product.woocommerceId}>✓</span>
                ) : (
                    <span className="text-gray-500">-</span>
                )}
            </td>
            <td className="px-4 py-3 text-center">
                {product.mercadoLibreId ? (
                    <span className="text-green-400" title={product.mercadoLibreId}>✓</span>
                ) : (
                    <span className="text-gray-500">-</span>
                )}
            </td>
            <td className="px-4 py-3 text-center">
                <div className="flex justify-center gap-1">
                    <button
                        onClick={() => handleEdit(product)}
                        className="px-2 py-1 bg-blue-700 hover:bg-blue-600 rounded text-xs"
                        title="Editar"
                    >
                        ✏️
                    </button>
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
                    <button
                        onClick={() => handleDelete(product)}
                        className="px-2 py-1 bg-red-700 hover:bg-red-600 rounded text-xs"
                        title="Excluir"
                    >
                        🗑️
                    </button>
                </div>
            </td>
        </tr>
    );

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Produtos</h1>
                <div className="flex gap-2 items-center">
                    {/* View Mode Toggle */}
                    <div className="bg-gray-700 rounded-lg p-1 flex mr-4">
                        <button
                            onClick={() => setViewMode('flat')}
                            className={`px-3 py-1 rounded text-sm ${viewMode === 'flat' ? 'bg-gray-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                        >
                            Lista
                        </button>
                        <button
                            onClick={() => setViewMode('grouped')}
                            className={`px-3 py-1 rounded text-sm ${viewMode === 'grouped' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                        >
                            Agrupado
                        </button>
                    </div>

                    <button
                        onClick={handleNew}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
                    >
                        + Novo Produto
                    </button>
                    <button
                        onClick={() => handleImport('woocommerce')}
                        disabled={!!importing}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded disabled:opacity-50"
                    >
                        {importing === 'woocommerce' ? 'Importando...' : '↓ WC'}
                    </button>
                    <button
                        onClick={() => handleImport('mercadolibre')}
                        disabled={!!importing}
                        className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded disabled:opacity-50"
                    >
                        {importing === 'mercadolibre' ? 'Importando...' : '↓ ML'}
                    </button>
                </div>
            </div>

            {/* Sync All buttons */}
            <div className="mb-4 flex gap-2">
                <button
                    onClick={() => handleSyncAll('woocommerce')}
                    disabled={syncingAll}
                    className="px-3 py-1 bg-green-800 hover:bg-green-700 rounded text-sm disabled:opacity-50"
                >
                    {syncingAll ? 'Sincronizando...' : '🔄 Sync All → WC'}
                </button>
                <button
                    onClick={() => handleSyncAll('mercadolibre')}
                    disabled={syncingAll}
                    className="px-3 py-1 bg-yellow-800 hover:bg-yellow-700 rounded text-sm disabled:opacity-50"
                >
                    {syncingAll ? 'Sincronizando...' : '🔄 Sync All → ML'}
                </button>
            </div>

            {loading ? (
                <p className="text-gray-400">Carregando...</p>
            ) : products.length === 0 ? (
                <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
                    <p className="text-gray-400 mb-4">Nenhum produto cadastrado.</p>
                    <p className="text-gray-500">Use os botões acima para importar ou criar produtos.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full bg-gray-800 rounded-lg overflow-hidden">
                        <thead className="bg-gray-700">
                            <tr>
                                <th className="px-2 py-3 text-center w-16">Foto</th>
                                <th className="px-4 py-3 text-left">SKU / Grupo</th>
                                <th className="px-4 py-3 text-left">Título</th>
                                <th className="px-4 py-3 text-right">Preço</th>
                                <th className="px-4 py-3 text-right">Custo</th>
                                <th className="px-4 py-3 text-right">Estoque</th>
                                <th className="px-4 py-3 text-right">Valor Estoque</th>
                                <th className="px-4 py-3 text-center">WC</th>
                                <th className="px-4 py-3 text-center">ML</th>
                                <th className="px-4 py-3 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayItems.map((item: any, index: number) => {
                                // Check if item is a group
                                if ('type' in item && item.type === 'group') {
                                    const group = item as { type: 'string', id: string, products: Product[] };
                                    const isExpanded = expandedGroups.has(group.id);
                                    // Use the first product as representative for some fields
                                    const rep = group.products[0];
                                    const totalStock = group.products[0].stock; // Shared stock concept
                                    // Or sum? No, "Shared Stock". So it is just rep.stock.
                                    // But wait, if they share stock, the total physical inventory is just rep.stock.

                                    const totalValue = group.products.reduce((acc, p) => acc + (Number(p.costPrice || 0) * 0), 0) + (Number(rep.costPrice || 0) * rep.stock);
                                    // Actually, value of the group in inventory is Cost * Stock. Since stock is shared, it is Cost * Stock ONCE.

                                    return (
                                        <>
                                            {/* Group Master Row */}
                                            <tr key={`group-${group.id}`} className="border-t border-gray-600 bg-gray-750 hover:bg-gray-700 cursor-pointer" onClick={() => toggleGroup(group.id)}>
                                                <td className="px-2 py-2 text-center">
                                                    <span className="text-xl">{isExpanded ? '📂' : '📁'}</span>
                                                </td>
                                                <td className="px-4 py-3 font-mono text-sm font-bold text-blue-300">
                                                    {group.id} <span className="text-gray-500 text-xs font-normal">({group.products.length} itens)</span>
                                                </td>
                                                <td className="px-4 py-3 font-medium text-gray-300">
                                                    {rep.title.split('-')[0]} <span className="text-gray-500 text-xs">(Agrupado)</span>
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-400">
                                                    Varia
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-400">
                                                    {rep.costPrice ? `R$ ${Number(rep.costPrice).toFixed(2)}` : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-white">
                                                    {rep.stock}
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-blue-400">
                                                    {rep.costPrice ? `R$ ${(Number(rep.costPrice) * rep.stock).toFixed(2)}` : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-center" colSpan={3}>
                                                    <span className="text-xs text-gray-500">Clique para expandir</span>
                                                </td>
                                            </tr>
                                            {/* Children Rows */}
                                            {isExpanded && group.products.map(p => renderProductRow(p, true))}
                                        </>
                                    );
                                } else {
                                    // Single product
                                    return renderProductRow(item as Product);
                                }
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Edit Modal */}
            {showModal && editingProduct && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-600">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold">
                                {editingProduct.id ? 'Editar Produto' : 'Novo Produto'}
                            </h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-gray-400 hover:text-white text-2xl"
                            >
                                ×
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* SKU */}
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">SKU</label>
                                <input
                                    type="text"
                                    value={editingProduct.sku || ''}
                                    onChange={e => updateField('sku', e.target.value)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                                    placeholder="SKU-001"
                                />
                            </div>

                            {/* Group ID */}
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">
                                    ID do Grupo
                                    <span className="text-xs text-blue-400 ml-2">(agrupa anúncios com mesmo estoque)</span>
                                </label>
                                <input
                                    type="text"
                                    value={editingProduct.groupId || ''}
                                    onChange={e => updateField('groupId', e.target.value)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                                    placeholder="Ex: WIDGET-001"
                                />
                            </div>

                            {/* Title */}
                            <div className="md:col-span-2">
                                <label className="block text-sm text-gray-400 mb-1">Título</label>
                                <input
                                    type="text"
                                    value={editingProduct.title || ''}
                                    onChange={e => updateField('title', e.target.value)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                                    placeholder="Nome do Produto"
                                />
                            </div>

                            {/* Description */}
                            <div className="md:col-span-2">
                                <label className="block text-sm text-gray-400 mb-1">Descrição</label>
                                <textarea
                                    value={editingProduct.description || ''}
                                    onChange={e => updateField('description', e.target.value)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                                    rows={3}
                                    placeholder="Descrição do produto..."
                                />
                            </div>

                            {/* Price */}
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Preço (R$)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={editingProduct.price || ''}
                                    onChange={e => updateField('price', parseFloat(e.target.value) || 0)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                                    placeholder="0.00"
                                />
                            </div>

                            {/* Sale Price */}
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Preço Promocional (R$)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={editingProduct.salePrice || ''}
                                    onChange={e => updateField('salePrice', parseFloat(e.target.value) || undefined)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                                    placeholder="0.00"
                                />
                            </div>

                            {/* Stock */}
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Estoque</label>
                                <input
                                    type="number"
                                    value={editingProduct.stock || 0}
                                    onChange={e => updateField('stock', parseInt(e.target.value) || 0)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                                />
                            </div>

                            {/* Cost Price */}
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Custo Unitário (R$)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={editingProduct.costPrice || ''}
                                    onChange={e => updateField('costPrice', parseFloat(e.target.value) || undefined)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                                    placeholder="0.00"
                                />
                            </div>

                            {/* Stock Value Display */}
                            {editingProduct.costPrice && editingProduct.stock ? (
                                <div className="md:col-span-2 bg-blue-900/30 border border-blue-700 rounded p-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-300">💰 Valor Total em Estoque:</span>
                                        <span className="text-2xl font-bold text-blue-400">
                                            R$ {(Number(editingProduct.costPrice) * (editingProduct.stock || 0)).toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="text-sm text-gray-400 mt-1">
                                        {editingProduct.stock} unidades × R$ {Number(editingProduct.costPrice).toFixed(2)}
                                    </div>
                                </div>
                            ) : null}

                            {/* Condition */}
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Condição</label>
                                <select
                                    value={editingProduct.condition || 'new'}
                                    onChange={e => updateField('condition', e.target.value)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                                >
                                    <option value="new">Novo</option>
                                    <option value="used">Usado</option>
                                    <option value="refurbished">Recondicionado</option>
                                </select>
                            </div>

                            {/* Category */}
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Categoria</label>
                                <input
                                    type="text"
                                    value={editingProduct.category || ''}
                                    onChange={e => updateField('category', e.target.value)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                                    placeholder="Categoria"
                                />
                            </div>

                            {/* Brand */}
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Marca</label>
                                <input
                                    type="text"
                                    value={editingProduct.brand || ''}
                                    onChange={e => updateField('brand', e.target.value)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                                    placeholder="Marca"
                                />
                            </div>

                            {/* Marketplace IDs (read-only) */}
                            {editingProduct.id && (
                                <>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">WooCommerce ID</label>
                                        <input
                                            type="text"
                                            value={editingProduct.woocommerceId || '-'}
                                            readOnly
                                            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-gray-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Mercado Livre ID</label>
                                        <input
                                            type="text"
                                            value={editingProduct.mercadoLibreId || '-'}
                                            readOnly
                                            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-gray-500"
                                        />
                                    </div>
                                </>
                            )}

                            {/* Images */}
                            {editingProduct.images && editingProduct.images.length > 0 && (
                                <div className="md:col-span-2">
                                    <label className="block text-sm text-gray-400 mb-2">Imagens ({editingProduct.images.length})</label>
                                    <div className="flex flex-wrap gap-2">
                                        {editingProduct.images.map((img, index) => (
                                            <div key={index} className="relative group">
                                                <img
                                                    src={img}
                                                    alt={`Imagem ${index + 1}`}
                                                    className="w-20 h-20 object-cover rounded border border-gray-600"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                    }}
                                                />
                                                <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-xs text-center py-0.5 rounded-b">
                                                    {index + 1}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-700">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
                            >
                                {saving ? 'Salvando...' : 'Salvar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
