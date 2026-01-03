import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function MercadoLibreCallback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
    const [message, setMessage] = useState('Processando autorização...');
    const [details, setDetails] = useState<any>(null);

    useEffect(() => {
        const processCallback = async () => {
            const code = searchParams.get('code');
            const error = searchParams.get('error');

            console.log('OAuth Callback - Code:', code);
            console.log('OAuth Callback - Error:', error);

            if (error) {
                setStatus('error');
                setMessage(`Erro do Mercado Livre: ${error}`);
                setDetails({ error, description: searchParams.get('error_description') });
                return;
            }

            if (!code) {
                setStatus('error');
                setMessage('Código de autorização não encontrado na URL');
                setDetails({ url: window.location.href, searchParams: Object.fromEntries(searchParams) });
                return;
            }

            try {
                const redirectUri = `${window.location.origin}/callback/mercadolibre`;
                console.log('Sending to backend:', { code, redirectUri });

                const result = await api.completeMercadoLibreAuth(code, redirectUri);
                console.log('Backend response:', result);

                if (result.success && result.isConnected) {
                    setStatus('success');
                    setMessage('Mercado Livre conectado com sucesso!');
                    setDetails(result);

                    // Redirect to settings after 2 seconds
                    setTimeout(() => navigate('/settings'), 2000);
                } else {
                    setStatus('error');
                    setMessage(result.error || 'Falha ao completar autorização');
                    setDetails(result);
                }
            } catch (err: any) {
                console.error('Callback error:', err);
                setStatus('error');
                setMessage(`Erro ao processar: ${err.message}`);
                setDetails({ error: err.message, stack: err.stack });
            }
        };

        processCallback();
    }, [searchParams, navigate]);

    const getStatusColor = () => {
        switch (status) {
            case 'success': return 'text-green-400 bg-green-900/30 border-green-700';
            case 'error': return 'text-red-400 bg-red-900/30 border-red-700';
            default: return 'text-blue-400 bg-blue-900/30 border-blue-700';
        }
    };

    const getIcon = () => {
        switch (status) {
            case 'success': return '✅';
            case 'error': return '❌';
            default: return '⏳';
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6">
            <div className={`max-w-lg w-full p-6 rounded-lg border ${getStatusColor()}`}>
                <div className="text-center mb-4">
                    <span className="text-6xl">{getIcon()}</span>
                </div>

                <h1 className="text-2xl font-bold text-center mb-2">
                    OAuth Callback - Mercado Livre
                </h1>

                <p className="text-center text-lg mb-4">{message}</p>

                {status === 'processing' && (
                    <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                    </div>
                )}

                {details && (
                    <div className="mt-4 p-3 bg-gray-800 rounded">
                        <p className="text-sm text-gray-400 mb-2">Detalhes técnicos:</p>
                        <pre className="text-xs overflow-x-auto">
                            {JSON.stringify(details, null, 2)}
                        </pre>
                    </div>
                )}

                {status === 'error' && (
                    <div className="mt-4 flex justify-center gap-2">
                        <button
                            onClick={() => navigate('/settings')}
                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
                        >
                            Voltar para Configurações
                        </button>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
                        >
                            Tentar Novamente
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
