import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { CheckCircle2, XCircle, RefreshCw, Lock } from 'lucide-react';

interface TotemConfig {
  id: string;
  totem_id: string;
  status: boolean;
  current_allowed_event: string;
  blocked_message: string;
}

export default function MasterAdmin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [totens, setTotens] = useState<TotemConfig[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [newTotemId, setNewTotemId] = useState('');
  const [newEvent, setNewEvent] = useState('');

  const MASTER_PASSWORD = 'klimptv2026'; 

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === MASTER_PASSWORD) {
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Senha Master incorreta.');
    }
  };

  const fetchTotens = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('totens_management')
      .select('*')
      .order('totem_id', { ascending: true });

    if (data) setTotens(data);
    setLoading(false);
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchTotens();

      const channel = supabase
        .channel('realtime_master')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'totens_management' }, () => {
          fetchTotens();
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [isAuthenticated]);

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    await supabase
      .from('totens_management')
      .update({ status: !currentStatus })
      .eq('id', id);
  };

  const updateAllowedEvent = async (id: string, eventName: string) => {
    if (!eventName.trim()) return;
    await supabase
      .from('totens_management')
      .update({ current_allowed_event: eventName.trim() })
      .eq('id', id);
  };

  const registerNewTotem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTotemId.trim() || !newEvent.trim()) return alert('Preencha todos os campos.');
    
    const { error: insertError } = await supabase
      .from('totens_management')
      .insert([{ totem_id: newTotemId.trim(), current_allowed_event: newEvent.trim(), status: true }]);

    if (insertError) {
      alert('Erro ao cadastrar ou Totem ID já existente.');
    } else {
      setNewTotemId('');
      setNewEvent('');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center font-sans p-4">
        <form onSubmit={handleLogin} className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-slate-800 backdrop-blur-md shadow-2xl max-w-md w-full flex flex-col gap-6 text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto border border-red-500/20">
            <Lock className="w-8 h-8 text-red-400" />
          </div>
          <div>
            <h2 className="text-2xl font-black">Painel Master KlimpTV</h2>
            <p className="text-slate-400 text-sm mt-1">Chave Mestra de Segurança dos Totens</p>
          </div>
          {error && <p className="text-red-400 bg-red-500/10 py-2 rounded-xl text-sm font-bold border border-red-500/20">{error}</p>}
          <input 
            type="password" 
            placeholder="Digite a Senha Mestra" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-center tracking-widest outline-none focus:border-red-500 transition-all"
          />
          <button type="submit" className="w-full bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 font-black py-4 rounded-xl shadow-lg transition-all">
            DESBLOQUEAR ACESSO
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans p-6">
      <header className="max-w-6xl mx-auto flex items-center justify-between border-b border-slate-900 pb-6 mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-red-400 to-amber-400 bg-clip-text text-transparent">KLIMPTV MASTER CONTROL</h1>
          <p className="text-slate-500 font-medium text-sm">Gerenciamento Remoto de Equipamentos Alocados</p>
        </div>
        <button onClick={fetchTotens} className="p-3 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 transition-all">
          <RefreshCw className={`w-5 h-5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-slate-900/30 border border-slate-900 p-6 rounded-3xl h-fit">
          <h3 className="text-lg font-black mb-4">Cadastrar Novo Totem Físico</h3>
          <form onSubmit={registerNewTotem} className="flex flex-col gap-4">
            <input 
              type="text" 
              placeholder="Ex: totem_02" 
              value={newTotemId}
              onChange={(e) => setNewTotemId(e.target.value)}
              className="bg-slate-950 border border-slate-800 p-3 rounded-xl text-sm font-bold outline-none focus:border-blue-500"
            />
            <input 
              type="text" 
              placeholder="Evento inicial (Ex: maria)" 
              value={newEvent}
              onChange={(e) => setNewEvent(e.target.value)}
              className="bg-slate-950 border border-slate-800 p-3 rounded-xl text-sm font-bold outline-none focus:border-blue-500"
            />
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 py-3 rounded-xl font-black text-sm transition-all shadow-lg">
              CADASTRAR EQUIPAMENTO
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 flex flex-col gap-4">
          <h3 className="text-lg font-black">Máquinas sob Monitoramento</h3>
          {totens.length === 0 ? (
            <p className="text-slate-600 font-medium py-8">Nenhum totem cadastrado.</p>
          ) : (
            totens.map((t) => (
              <div key={t.id} className="bg-slate-900/40 border border-slate-900 p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="font-black text-xl text-white">{t.totem_id.toUpperCase()}</span>
                    {t.status ? (
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black px-2 py-0.5 rounded-full uppercase flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Online</span>
                    ) : (
                      <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-black px-2 py-0.5 rounded-full uppercase flex items-center gap-1"><XCircle className="w-3 h-3" /> Bloqueado</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <span className="font-bold text-slate-500">Evento Autorizado:</span>
                    <input 
                      type="text" 
                      defaultValue={t.current_allowed_event}
                      onBlur={(e) => updateAllowedEvent(t.id, e.target.value)}
                      className="bg-slate-950 border border-slate-800 px-3 py-1 rounded-lg text-xs font-black text-amber-400 outline-none focus:border-amber-500 w-32 text-center"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    type="button"
                    onClick={() => toggleStatus(t.id, t.status)}
                    className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all tracking-wider shadow-md ${t.status ? 'bg-red-600/20 text-red-400 border border-red-600/30 hover:bg-red-600 hover:text-white' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                  >
                    {t.status ? 'BLOQUEAR TOTEM' : 'DESBLOQUEAR'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}