import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { LayoutDashboard, Users, Camera, CheckCircle, Clock, FileDown, Palette, Save } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function MasterAdmin() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState({ primaryColor: '#3b82f6', borderRadius: '16px' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      // Busca métricas
      const { data: messages } = await supabase.from('guestbook_messages').select('created_at, approved, guest_name');
      
      // Busca configurações de tema (assumindo um evento padrão ou buscando do primeiro registro)
      const { data: config } = await supabase.from('events_config').select('primary_color, card_radius').limit(1).single();

      if (messages) {
        const total = messages.length;
        const approved = messages.filter(m => m.approved).length;
        const dailyData = messages.reduce((acc: any, curr) => {
          const date = new Date(curr.created_at).toLocaleDateString();
          acc[date] = (acc[date] || 0) + 1;
          return acc;
        }, {});
        const chartData = Object.keys(dailyData).map(date => ({ date, count: dailyData[date] }));
        
        setMetrics({ total, approved, pending: total - approved, chartData, raw: messages });
      }

      if (config) {
        setTheme({ primaryColor: config.primary_color, borderRadius: config.card_radius });
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const saveTheme = async () => {
    setSaving(true);
    await supabase.from('events_config').update({ primary_color: theme.primaryColor, card_radius: theme.borderRadius }).eq('event_id', 'geral');
    alert("Tema atualizado com sucesso!");
    setSaving(false);
  };

  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(22);
      doc.text("Relatorio de Engajamento - LumaScreen", 14, 20);
      const tableData = metrics.raw.map((m: any) => [new Date(m.created_at).toLocaleDateString(), m.guest_name, m.approved ? 'Aprovada' : 'Pendente']);
      autoTable(doc, { head: [['Data', 'Convidado', 'Status']], body: tableData, startY: 30 });
      doc.save("relatorio-engajamento.pdf");
    } catch (e) { alert("Erro ao gerar PDF: " + e); }
  };

  if (loading) return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Carregando...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans">
      <header className="mb-10 flex justify-between items-center">
        <h1 className="text-4xl font-black text-white">MASTER DASHBOARD</h1>
        <button onClick={handleDownloadPDF} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-8 py-4 rounded-2xl flex items-center gap-3">
          <FileDown /> EXPORTAR PDF
        </button>
      </header>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl">
            <p className="text-sm font-bold text-slate-400 uppercase">Total de Fotos</p>
            <p className="text-5xl font-black">{metrics.total}</p>
        </div>
      </div>

      {/* Configuração de Tema White Label */}
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl mb-10">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><Palette className="text-pink-500" /> Customização White Label</h3>
        <div className="flex gap-6 items-center">
            <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">COR PRIMÁRIA</label>
                <input type="color" value={theme.primaryColor} onChange={(e) => setTheme({...theme, primaryColor: e.target.value})} className="w-16 h-16 rounded-xl cursor-pointer bg-transparent" />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">ARREDONDAMENTO (BORDAS)</label>
                <select value={theme.borderRadius} onChange={(e) => setTheme({...theme, borderRadius: e.target.value})} className="bg-slate-800 p-4 rounded-xl font-bold">
                    <option value="8px">Quadrado (8px)</option>
                    <option value="16px">Médio (16px)</option>
                    <option value="32px">Arredondado (32px)</option>
                </select>
            </div>
            <button onClick={saveTheme} disabled={saving} className="bg-emerald-600 px-6 py-4 rounded-xl font-black flex items-center gap-2 hover:bg-emerald-700 ml-auto">
                <Save /> {saving ? 'SALVANDO...' : 'SALVAR TEMA'}
            </button>
        </div>
      </div>
      
      {/* Gráfico */}
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl h-80">
         <ResponsiveContainer width="100%" height="100%">
            <BarChart data={metrics.chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }} />
              <Bar dataKey="count" fill={theme.primaryColor} radius={[10, 10, 0, 0]} />
            </BarChart>
         </ResponsiveContainer>
      </div>
    </div>
  );
}