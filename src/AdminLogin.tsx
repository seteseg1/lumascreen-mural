import React, { useState } from 'react';
import { Shield, Lock, RefreshCw } from 'lucide-react';
import { supabase } from './supabaseClient';

interface AdminLoginProps {
  onLoginSuccess: () => void;
  currentEvent: string;
}

export default function AdminLogin({ onLoginSuccess, currentEvent }: AdminLoginProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('Senha incorreta para este evento.');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);

    try {
      // Consulta a tabela events_config no Supabase para o evento atual
      const { data, error: dbError } = await supabase
        .from('events_config')
        .select('admin_password')
        .eq('event_id', currentEvent)
        .single();

      if (dbError || !data) {
        // Se o evento não estiver cadastrado na tabela events_config, usa uma senha padrão ou avisa
        setErrorMessage('Evento não configurado no banco de dados.');
        setError(true);
        setLoading(false);
        return;
      }

      // Compara a senha digitada com a senha salva no banco de dados do Supabase
      if (password.trim() === data.admin_password) {
        setError(false);
        onLoginSuccess();
      } else {
        setErrorMessage('Senha incorreta para este evento.');
        setError(true);
      }
    } catch (err: any) {
      console.error('Erro ao validar login:', err);
      setErrorMessage('Erro ao conectar com o banco de dados.');
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-4 font-sans">
      <div className="bg-slate-900/90 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl backdrop-blur-xl w-full max-w-md text-center">
        <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-blue-500/30">
          <Shield className="w-8 h-8 text-blue-400" />
        </div>
        <h2 className="text-2xl font-black mb-1">Área Administrativa</h2>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-6">Evento: {currentEvent.toUpperCase()}</p>
        
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs font-bold">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 text-left">
          <div>
            <label className="text-xs font-black text-slate-400 uppercase ml-2 mb-1 block">Senha do Painel</label>
            <input
              type="password"
              placeholder="Digite a senha..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border-2 border-slate-800 p-4 rounded-2xl focus:border-blue-500 outline-none font-bold text-white transition-all text-center tracking-widest text-lg"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-800 text-white font-black py-4 rounded-2xl transition shadow-lg text-base mt-2 flex items-center justify-center gap-2"
          >
            {loading ? <RefreshCw className="animate-spin w-5 h-5" /> : <><Lock className="w-4 h-4" /> ENTRAR NO PAINEL</>}
          </button>
        </form>
      </div>
    </div>
  );
}