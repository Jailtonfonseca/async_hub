import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';

export default function AmazonCallback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('Conectando com Amazon...');

    useEffect(() => {
        const handleCallback = async () => {
            const code = searchParams.get('code');
            const state = searchParams.get('state');
            const error = searchParams.get('error');

            if (error) {
                setStatus('error');
                setMessage(`Erro no processo de autorização: ${error}`);
                return;
            }

            if (!code) {
                setStatus('error');
                setMessage('Código de autorização não encontrado.');
                return;
            }

            try {
                const redirectUri = window.location.origin + '/callback/amazon';
                const result = await api.completeAmazonAuth(code, redirectUri);

                if (result.success) {
                    setStatus('success');
                    setMessage('Amazon conectado com sucesso! Redirecionando...');
                    setTimeout(() => navigate('/settings'), 2000);
                } else {
                    setStatus('error');
                    setMessage(`Falha na autenticação: ${result.error || 'Erro desconhecido'}`);
                }
            } catch (err: any) {
                setStatus('error');
                setMessage(`Erro: ${err.message || 'Erro ao conectar com Amazon'}`);
            }
        };

        handleCallback();
    }, [searchParams, navigate]);

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900">
            <div className="bg-gray-800 p-8 rounded-lg border border-gray-700 max-w-md w-full">
                <h1 className="text-2xl font-bold mb-4 text-center">
                    {status === 'loading' && '⏳ Conectando...'}
                    {status === 'success' && '✅ Sucesso!'}
                    {status === 'error' && '❌ Erro'}
                </h1>
                <p className="text-gray-300 text-center mb-4">{message}</p>
                {status === 'error' && (
                    <button
                        onClick={() => navigate('/settings')}
                        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
                    >
                        Voltar para Configurações
                    </button>
                )}
            </div>
        </div>
    );
}
