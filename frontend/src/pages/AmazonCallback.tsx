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
    \u003cdiv className = "flex items-center justify-center min-h-screen bg-gray-900"\u003e
    \u003cdiv className = "bg-gray-800 p-8 rounded-lg border border-gray-700 max-w-md w-full"\u003e
    \u003ch1 className = "text-2xl font-bold mb-4 text-center"\u003e
    { status === 'loading' && '⏳ Conectando...' }
    { status === 'success' && '✅ Sucesso!' }
    { status === 'error' && '❌ Erro' }
    \u003c / h1\u003e
    \u003cp className = "text-gray-300 text-center mb-4"\u003e{ message } \u003c / p\u003e
    {
        status === 'error' && (
        \u003cbutton
        onClick = {() => navigate('/settings')
    }
    className = "w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
    \u003e
                        Voltar para Configurações
    \u003c / button\u003e
                )
}
\u003c / div\u003e
\u003c / div\u003e
    );
}
