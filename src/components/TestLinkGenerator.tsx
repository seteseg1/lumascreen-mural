import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

export function TestLinkGenerator() {
  const [clientName, setClientName] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerateTestLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return;

    setLoading(true);
    try {
      // Cria um slug único baseado no nome do cliente e timestamp
      const slug = `${clientName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-4)}`;

      // Insere exclusivamente na tabela de testes isolados
      const { error } = await supabase
        .from('mural_tests')
        .insert([{ session_slug: slug, client_name: clientName, is_active: true }]);

      if (error) throw error;

      // URL oficial do seu servidor na Vercel (Altere se o domínio do seu projeto for diferente)
      const baseUrl = 'https://totem-guestbook.vercel.app'; 
      const testUrl = `${baseUrl}/test/${slug}`;
      
      setGeneratedLink(testUrl);
    } catch (err) {
      console.error('Erro ao gerar link de teste:', err);
      alert('Erro ao gerar o link de teste.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', background: '#111827', color: '#fff', borderRadius: '8px', maxWidth: '500px', margin: '20px auto', border: '1px solid #374151' }}>
      <h3 style={{ color: '#38bdf8', marginBottom: '15px', textAlign: 'center' }}>Gerador de Link de Teste - Servidor Vercel</h3>
      <form onSubmit={handleGenerateTestLink} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <input
          type="text"
          placeholder="Nome do Cliente / Salão (ex: Salão do Mesquita)"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          style={{ padding: '10px', borderRadius: '4px', border: '1px solid #374151', background: '#1f2937', color: '#fff', width: '100%', boxSizing: 'border-box' }}
          required
        />
        <button
          type="submit"
          disabled={loading}
          style={{ padding: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
        >
          {loading ? 'Gerando...' : 'Gerar Novo Link de Teste no Servidor'}
        </button>
      </form>

      {generatedLink && (
        <div style={{ marginTop: '20px', padding: '15px', background: '#1f2937', borderRadius: '6px', wordBreak: 'break-all', border: '1px solid #38bdf8' }}>
          <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '5px' }}>Link exclusivo gerado no servidor Vercel:</p>
          <a href={generatedLink} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline', fontWeight: '500' }}>
            {generatedLink}
          </a>
        </div>
      )}
    </div>
  );
}