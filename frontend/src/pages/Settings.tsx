import { useState, useEffect } from 'react';
import { api } from '../api';

export default function Settings() {
    const [woo, setWoo] = useState({ apiUrl: '', apiKey: '', apiSecret: '' });
    const [ml, setMl] = useState({ apiKey: '', apiSecret: '' });
    const [connections, setConnections] = useState<any[]>([]);
    const [saving, setSaving] = useState<string | null>(null);

    useEffect(() => {
        api.getConnections().then(setConnections).catch(() => { });
    }, []);

    const handleSaveWoo = async () => {
        setSaving('woo');
        try {
            const result = await api.saveWooCommerceConnection(woo);
            if (result.isConnected) {
                alert('WooCommerce conectado com sucesso!');
            } else {
                alert('Credenciais salvas, mas a conexão falhou. Verifique os dados.');
            }
            api.getConnections().then(setConnections);
        } catch (e: any) {
            alert('Erro: ' + e.message);
        }
        setSaving(null);
    };

    const handleSaveML = async () => {
        setSaving('ml');
        try {
            await api.saveMercadoLibreCredentials(ml);
            alert('Credenciais salvas! Clique em "Autorizar" para conectar.');
            api.getConnections().then(setConnections);
        } catch (e: any) {
            alert('Erro: ' + e.message);
        }
        setSaving(null);
    };

    const handleAuthML = async () => {
        try {
            const redirectUri = window.location.origin + '/callback/mercadolibre';
            const result = await api.getMercadoLibreAuthUrl(redirectUri);
            window.location.href = result.authUrl;
        } catch (e: any) {
            alert('Erro: ' + e.message);
        }
    };

    const handleDisconnect = async (marketplace: string) => {
        if (!confirm('Tem certeza que deseja desconectar?')) return;
        try {
            await api.deleteConnection(marketplace);
            api.getConnections().then(setConnections);
        } catch (e: any) {
            alert('Erro: ' + e.message);
        }
    };

    const isConnected = (marketplace: string) =>
        connections.find(c => c.marketplace === marketplace)?.isConnected;

    return (
        <div className="p-6 max-w-4xl">
            <h1 className="text-3xl font-bold mb-6">Configurações</h1>

            {/* WooCommerce */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">WooCommerce</h2>
                    {isConnected('woocommerce') && (
                        <span className="px-3 py-1 bg-green-900 text-green-300 rounded text-sm">Conectado</span>
                    )}
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">URL da Loja</label>
                        <input
                            type="url"
                            placeholder="https://minhaloja.com"
                            value={woo.apiUrl}
                            onChange={e => setWoo({ ...woo, apiUrl: e.target.value })}
                            className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 outline-none"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Consumer Key</label>
                            <input
                                type="text"
                                placeholder="ck_..."
                                value={woo.apiKey}
                                onChange={e => setWoo({ ...woo, apiKey: e.target.value })}
                                className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Consumer Secret</label>
                            <input
                                type="password"
                                placeholder="cs_..."
                                value={woo.apiSecret}
                                onChange={e => setWoo({ ...woo, apiSecret: e.target.value })}
                                className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 outline-none"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleSaveWoo}
                            disabled={saving === 'woo'}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
                        >
                            {saving === 'woo' ? 'Salvando...' : 'Salvar e Testar'}
                        </button>
                        {isConnected('woocommerce') && (
                            <button
                                onClick={() => handleDisconnect('woocommerce')}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
                            >
                                Desconectar
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Mercado Libre */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">Mercado Livre</h2>
                    {isConnected('mercadolibre') && (
                        <span className="px-3 py-1 bg-green-900 text-green-300 rounded text-sm">Conectado</span>
                    )}
                </div>

                <div className="bg-blue-900/30 border border-blue-700 rounded p-4 mb-4">
                    <h3 className="font-semibold text-blue-300 mb-2">📘 Como Configurar no Mercado Livre</h3>
                    <ol className="text-sm text-blue-200 space-y-2 list-decimal list-inside">
                        <li>
                            Acesse o{' '}
                            <a
                                href="https://developers.mercadolivre.com.br/devcenter"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline font-medium"
                            >
                                DevCenter do Mercado Livre
                            </a>
                        </li>
                        <li>Clique em <strong>"Criar nova aplicação"</strong></li>
                        <li>
                            <strong>Solução:</strong> Selecione <em>"Gerencie seu negócio"</em> ou <em>"Gerencie negócios de outros vendedores"</em>
                        </li>
                        <li>
                            <strong>URI de Redirect:</strong><br />
                            <code className="bg-gray-800 px-2 py-1 rounded text-xs block mt-1">
                                {window.location.origin}/callback/mercadolibre
                            </code>
                            <span className="text-xs text-gray-400">(Copie exatamente este URL)</span>
                        </li>
                        <li><strong>PKCE:</strong> Deixe desabilitado (nosso app não usa)</li>
                        <li>
                            <strong>Negócios:</strong> Marque <em>"Mercado Livre"</em>
                        </li>
                    </ol>

                    <div className="mt-4 p-3 bg-yellow-900/30 border border-yellow-700 rounded">
                        <h4 className="font-semibold text-yellow-300 mb-2">⚠️ Permissões Necessárias</h4>
                        <ul className="text-sm text-yellow-200 space-y-1">
                            <li>✅ <strong>Usuários:</strong> Leitura e escrita</li>
                            <li>✅ <strong>Publicação e sincronização:</strong> Leitura e escrita</li>
                            <li>✅ <strong>Venda e envios:</strong> Leitura e escrita (para sincronizar estoque)</li>
                            <li>⚪ Outros: Opcional conforme sua necessidade</li>
                        </ul>
                    </div>

                    <div className="mt-4 p-3 bg-purple-900/30 border border-purple-700 rounded">
                        <h4 className="font-semibold text-purple-300 mb-2">📬 Tópicos (Webhooks)</h4>
                        <p className="text-sm text-purple-200 mb-2">Marque estes para receber notificações automáticas:</p>
                        <div className="grid grid-cols-2 gap-2 text-xs text-purple-200">
                            <span>☑️ items</span>
                            <span>☑️ orders_v2</span>
                            <span>☑️ questions</span>
                            <span>☑️ shipments</span>
                            <span>☑️ stock-locations</span>
                            <span>☑️ items prices</span>
                        </div>
                    </div>

                    <div className="mt-4 p-3 bg-green-900/30 border border-green-700 rounded">
                        <h4 className="font-semibold text-green-300 mb-2">🔔 URL de Notificações (Opcional)</h4>
                        <code className="bg-gray-800 px-2 py-1 rounded text-xs block">
                            {window.location.origin.replace('3000', '4000')}/api/webhooks/mercadolibre
                        </code>
                        <p className="text-xs text-green-200 mt-1">
                            Configure esta URL para receber atualizações em tempo real.
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">App ID</label>
                            <input
                                type="text"
                                placeholder="123456789"
                                value={ml.apiKey}
                                onChange={e => setMl({ ...ml, apiKey: e.target.value })}
                                className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Secret Key</label>
                            <input
                                type="password"
                                placeholder="..."
                                value={ml.apiSecret}
                                onChange={e => setMl({ ...ml, apiSecret: e.target.value })}
                                className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 outline-none"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleSaveML}
                            disabled={saving === 'ml'}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
                        >
                            {saving === 'ml' ? 'Salvando...' : 'Salvar Credenciais'}
                        </button>
                        {connections.find(c => c.marketplace === 'mercadolibre') && !isConnected('mercadolibre') && (
                            <button
                                onClick={handleAuthML}
                                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded"
                            >
                                Autorizar no Mercado Livre
                            </button>
                        )}
                        {isConnected('mercadolibre') && (
                            <button
                                onClick={() => handleDisconnect('mercadolibre')}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
                            >
                                Desconectar
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
