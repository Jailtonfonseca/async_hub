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

                <div className="bg-green-900/30 border border-green-700 rounded p-4 mb-4">
                    <h3 className="font-semibold text-green-300 mb-2">📘 Como Obter as Credenciais WooCommerce</h3>
                    <ol className="text-sm text-green-200 space-y-2 list-decimal list-inside">
                        <li>
                            Acesse o painel admin do WordPress: <code className="bg-gray-800 px-1 rounded">seusite.com/wp-admin</code>
                        </li>
                        <li>
                            Vá para <strong>WooCommerce → Configurações → Avançado → REST API</strong>
                        </li>
                        <li>
                            Clique em <strong>"Adicionar chave"</strong>
                        </li>
                        <li>
                            Preencha:
                            <ul className="ml-4 mt-1 space-y-1">
                                <li>• <strong>Descrição:</strong> ASync Hub</li>
                                <li>• <strong>Usuário:</strong> Seu usuário admin</li>
                                <li>• <strong>Permissões:</strong> <span className="text-yellow-300">Leitura/Escrita</span></li>
                            </ul>
                        </li>
                        <li>
                            Clique em <strong>"Gerar chave de API"</strong>
                        </li>
                        <li>
                            Copie a <strong>Consumer Key</strong> (ck_...) e <strong>Consumer Secret</strong> (cs_...)
                        </li>
                    </ol>

                    <div className="mt-4 p-3 bg-yellow-900/30 border border-yellow-700 rounded">
                        <h4 className="font-semibold text-yellow-300 mb-2">⚠️ Importante</h4>
                        <ul className="text-sm text-yellow-200 space-y-1">
                            <li>• A Consumer Secret só é mostrada <strong>uma vez</strong>. Salve em um lugar seguro!</li>
                            <li>• Seu site <strong>deve ter HTTPS</strong> para a API funcionar corretamente</li>
                            <li>• Use a URL completa com https:// (ex: https://minhaloja.com.br)</li>
                        </ul>
                    </div>

                    <div className="mt-4 p-3 bg-blue-900/30 border border-blue-700 rounded">
                        <h4 className="font-semibold text-blue-300 mb-2">🔌 Testando a Conexão</h4>
                        <p className="text-sm text-blue-200">
                            Após preencher os campos, clique em "Salvar e Testar". O sistema vai tentar
                            acessar a API do WooCommerce e verificar se as credenciais estão corretas.
                        </p>
                    </div>
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

            {/* AI Providers */}
            <AISettingsSection />
        </div>
    );
}

// AI Settings Component
function AISettingsSection() {
    const [settings, setSettings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [testing, setTesting] = useState<string | null>(null);

    const [openai, setOpenai] = useState({ apiKey: '', model: 'gpt-4o' });
    const [gemini, setGemini] = useState({ apiKey: '', model: 'gemini-2.0-flash' });
    const [openrouter, setOpenrouter] = useState({ apiKey: '', model: 'anthropic/claude-3.5-sonnet' });

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const data = await api.getAISettings();
            setSettings(data);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const handleSave = async (provider: string) => {
        setSaving(provider);
        try {
            let data;
            switch (provider) {
                case 'openai': data = openai; break;
                case 'gemini': data = gemini; break;
                case 'openrouter': data = openrouter; break;
                default: return;
            }
            const result = await api.saveAISettings(provider, data);
            if (result.success) {
                alert(`${provider} configurado!`);
                loadSettings();
            } else {
                alert('Erro: ' + result.error);
            }
        } catch (e: any) {
            alert('Erro: ' + e.message);
        }
        setSaving(null);
    };

    const handleTest = async (provider: string) => {
        setTesting(provider);
        try {
            const result = await api.testAIProvider(provider);
            alert(result.message);
        } catch (e: any) {
            alert('Erro: ' + e.message);
        }
        setTesting(null);
    };

    const getProviderStatus = (provider: string) => {
        const s = settings.find(x => x.provider === provider);
        return s?.apiKey ? '✅ Configurado' : '⚪ Não configurado';
    };

    if (loading) return <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mt-6">Carregando...</div>;

    return (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mt-6">
            <h2 className="text-xl font-semibold mb-4">🤖 Configurações de IA</h2>
            <p className="text-gray-400 text-sm mb-4">
                Configure as API keys dos provedores de IA para usar o multiplicador de anúncios.
            </p>

            <div className="space-y-4">
                {/* OpenAI */}
                <div className="bg-gray-700 rounded p-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-medium">OpenAI</h3>
                        <span className="text-sm">{getProviderStatus('openai')}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-2">
                        <input
                            type="password"
                            placeholder="sk-..."
                            value={openai.apiKey}
                            onChange={e => setOpenai({ ...openai, apiKey: e.target.value })}
                            className="px-3 py-2 bg-gray-600 rounded border border-gray-500 text-sm"
                        />
                        <input
                            type="text"
                            placeholder="gpt-4o, o1, o3, gpt-4.5..."
                            value={openai.model}
                            onChange={e => setOpenai({ ...openai, model: e.target.value })}
                            className="px-3 py-2 bg-gray-600 rounded border border-gray-500 text-sm"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleSave('openai')}
                            disabled={saving === 'openai'}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm disabled:opacity-50"
                        >
                            {saving === 'openai' ? 'Salvando...' : 'Salvar'}
                        </button>
                        <button
                            onClick={() => handleTest('openai')}
                            disabled={testing === 'openai'}
                            className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm disabled:opacity-50"
                        >
                            {testing === 'openai' ? 'Testando...' : 'Testar'}
                        </button>
                    </div>
                </div>

                {/* Gemini */}
                <div className="bg-gray-700 rounded p-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-medium">Google Gemini</h3>
                        <span className="text-sm">{getProviderStatus('gemini')}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-2">
                        <input
                            type="password"
                            placeholder="AI..."
                            value={gemini.apiKey}
                            onChange={e => setGemini({ ...gemini, apiKey: e.target.value })}
                            className="px-3 py-2 bg-gray-600 rounded border border-gray-500 text-sm"
                        />
                        <input
                            type="text"
                            placeholder="gemini-2.0-flash, gemini-1.5-pro..."
                            value={gemini.model}
                            onChange={e => setGemini({ ...gemini, model: e.target.value })}
                            className="px-3 py-2 bg-gray-600 rounded border border-gray-500 text-sm"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleSave('gemini')}
                            disabled={saving === 'gemini'}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm disabled:opacity-50"
                        >
                            {saving === 'gemini' ? 'Salvando...' : 'Salvar'}
                        </button>
                        <button
                            onClick={() => handleTest('gemini')}
                            disabled={testing === 'gemini'}
                            className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm disabled:opacity-50"
                        >
                            {testing === 'gemini' ? 'Testando...' : 'Testar'}
                        </button>
                    </div>
                </div>

                {/* OpenRouter */}
                <div className="bg-gray-700 rounded p-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-medium">OpenRouter (Claude, Mixtral, etc.)</h3>
                        <span className="text-sm">{getProviderStatus('openrouter')}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-2">
                        <input
                            type="password"
                            placeholder="sk-or-..."
                            value={openrouter.apiKey}
                            onChange={e => setOpenrouter({ ...openrouter, apiKey: e.target.value })}
                            className="px-3 py-2 bg-gray-600 rounded border border-gray-500 text-sm"
                        />
                        <input
                            type="text"
                            placeholder="anthropic/claude-3.5-sonnet, openai/gpt-4o..."
                            value={openrouter.model}
                            onChange={e => setOpenrouter({ ...openrouter, model: e.target.value })}
                            className="px-3 py-2 bg-gray-600 rounded border border-gray-500 text-sm"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleSave('openrouter')}
                            disabled={saving === 'openrouter'}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm disabled:opacity-50"
                        >
                            {saving === 'openrouter' ? 'Salvando...' : 'Salvar'}
                        </button>
                        <button
                            onClick={() => handleTest('openrouter')}
                            disabled={testing === 'openrouter'}
                            className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm disabled:opacity-50"
                        >
                            {testing === 'openrouter' ? 'Testando...' : 'Testar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
