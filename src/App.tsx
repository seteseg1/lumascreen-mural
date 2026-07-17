import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { Camera, Image as ImageIcon, Send, RefreshCw, CheckCircle, Trash2, Check, Smartphone, ShieldCheck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';

function LogoLumaScreen({ className = "w-full h-auto" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 566" className={className}>
      <circle cx="316" cy="283" r="160" fill="none" stroke="#3b82f6" strokeWidth="10" opacity="0.3" />
      <circle cx="316" cy="283" r="130" fill="none" stroke="#38bdf8" strokeWidth="6" />
      <rect x="216" y="213" width="200" height="140" rx="6" fill="none" stroke="#ffffff" strokeWidth="10" />
      <circle cx="316" cy="283" r="40" fill="#1e3a8a" stroke="#38bdf8" strokeWidth="6" />
      <circle cx="386" cy="243" r="8" fill="#ffffff" />
      <text x="490" y="240" fill="#ffffff" fontSize="105" fontWeight="900" fontFamily="sans-serif" letterSpacing="2">LUMA</text>
      <text x="490" y="355" fill="#38bdf8" fontSize="105" fontWeight="900" fontFamily="sans-serif" letterSpacing="2">SCREEN</text>
      <text x="495" y="425" fill="#94a3b8" fontSize="28" fontWeight="700" fontFamily="sans-serif" letterSpacing="4">MURAL INTERATIVO DE EVENTOS</text>
    </svg>
  );
}

interface Message {
  id: string;
  guest_name: string;
  message: string;
  photo_url: string;
  created_at: string;
  approved: boolean;
  event_id: string;
}

export default function App() {
  const [view, setView] = useState<'totem' | 'mobile' | 'viewer'>('totem');
  const [isAdmin, setIsAdmin] = useState(false);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [totemUrl, setTotemUrl] = useState('');
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  
  const [showInterstellarQr, setShowInterstellarQr] = useState(false);
  const photosShownCounter = useRef(0);

  const [currentEvent, setCurrentEvent] = useState('geral');
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    const eventParam = params.get('event') || 'geral';
    setCurrentEvent(eventParam);

    const bgParam = params.get('bg');
    if (bgParam) {
      setBackgroundImageUrl(`https://lh3.googleusercontent.com/d/${bgParam}`);
    } else {
      setBackgroundImageUrl("https://images.unsplash.com/photo-1513151233558-d860c5398176?q=80&w=1200&auto=format&fit=crop");
    }

    if (params.get('admin') === 'true') setIsAdmin(true);
    
    const url = `${window.location.origin}?view=mobile&event=${eventParam}`;
    setTotemUrl(url);

    if (params.get('view') === 'mobile') setView('mobile');
  }, []);

  useEffect(() => {
    if (view !== 'totem' && view !== 'viewer') return;

    const fetchMessages = async () => {
      let query = supabase.from('guestbook_messages').select('*').eq('event_id', currentEvent);
      
      // Correção: Garante que a query saiba se é admin diretamente do link para evitar delay de estado
      const isUrlAdmin = new URLSearchParams(window.location.search).get('admin') === 'true';
      if (!isUrlAdmin) query = query.eq('approved', true);

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) {
        console.error('Erro ao buscar dados:', error.message);
        return;
      }
      
      if (data) {
        setMessages((prev) => {
          if (JSON.stringify(prev) !== JSON.stringify(data)) {
            return data as Message[];
          }
          return prev;
        });
      }
    };

    fetchMessages();
    const pollingInterval = setInterval(fetchMessages, 5000);

    const channel = supabase
      .channel(`realtime_totem_messages_${currentEvent}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'guestbook_messages' }, 
        (payload) => {
          const newMessage = payload.new as Message;
          const isUrlAdmin = new URLSearchParams(window.location.search).get('admin') === 'true';
          
          if (newMessage.event_id === currentEvent && (isUrlAdmin || newMessage.approved)) {
            setMessages((prev) => {
              if (prev.some(m => m.id === newMessage.id)) return prev;
              return [newMessage, ...prev];
            });
            setCurrentSlideIndex(0);
            setShowInterstellarQr(false);
            photosShownCounter.current = 0;
          }
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'guestbook_messages' },
        (payload) => {
          const updatedMessage = payload.new as Message;
          if (updatedMessage.event_id !== currentEvent) return;

          const isUrlAdmin = new URLSearchParams(window.location.search).get('admin') === 'true';

          if (isUrlAdmin) {
            setMessages((prev) => prev.map((msg) => msg.id === updatedMessage.id ? updatedMessage : msg));
          } else {
            if (updatedMessage.approved) {
              setMessages((prev) => {
                const exists = prev.some((msg) => msg.id === updatedMessage.id);
                if (exists) return prev.map((msg) => msg.id === updatedMessage.id ? updatedMessage : msg);
                return [updatedMessage, ...prev];
              });
              setCurrentSlideIndex(0);
              setShowInterstellarQr(false);
              photosShownCounter.current = 0;
            } else {
              setMessages((prev) => prev.filter((msg) => msg.id !== updatedMessage.id));
            }
          }
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'guestbook_messages' },
        (payload) => {
          setMessages((prev) => prev.filter((msg) => msg.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => { 
      supabase.removeChannel(channel); 
      clearInterval(pollingInterval);
    };
  }, [view, currentEvent]);

  useEffect(() => {
    if ((view !== 'totem' && view !== 'viewer') || messages.length === 0 || isAdmin) return;

    let timeout: NodeJS.Timeout;

    const handleRotation = () => {
      if (showInterstellarQr) {
        timeout = setTimeout(() => {
          setShowInterstellarQr(false);
          photosShownCounter.current = 0;
        }, 20000);
      } else {
        timeout = setTimeout(() => {
          photosShownCounter.current += 1;

          if (photosShownCounter.current >= 5 || photosShownCounter.current >= messages.length) {
            setShowInterstellarQr(true);
          } else {
            setCurrentSlideIndex((prevIndex) => (prevIndex + 1) % messages.length);
          }
        }, 6000);
      }
    };

    handleRotation();
    return () => clearTimeout(timeout);
  }, [view, messages.length, isAdmin, showInterstellarQr, currentSlideIndex]);

  const handleApproveMessage = async (id: string) => {
    try {
      const { error } = await supabase.from('guestbook_messages').update({ approved: true }).eq('id', id);
      if (error) throw error;
    } catch (err: any) { alert(`Erro: ${err.message}`); }
  };

  const handleDeleteMessage = async (id: string) => {
    if (!confirm('Deseja apagar esta foto do telão?')) return;
    try {
      const { error } = await supabase.from('guestbook_messages').delete().eq('id', id);
      if (error) throw error;
    } catch (err: any) { alert(`Erro: ${err.message}`); }
  };

  const handleFileChange = () => {
    const file = fileInputRef.current?.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPreviewUrl(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleMobileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return alert('Por favor, digite seu nome.');
    setLoading(true);
    try {
      let photoUrl = '';
      const file = fileInputRef.current?.files?.[0];
      if (file) {
        const fileExt = file.name.split('.').pop() || 'jpg';
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('guestbook-photos').upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('guestbook-photos').getPublicUrl(fileName);
        photoUrl = data.publicUrl;
      }
      
      const { error: dbError } = await supabase.from('guestbook_messages').insert([
        { guest_name: name, message: message, photo_url: photoUrl, approved: false, event_id: currentEvent }
      ]);
      
      if (dbError) throw dbError;
      setSuccess(true);
      setName(''); setMessage(''); setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) { alert(`Erro: ${err.message}`); } finally { setLoading(false); }
  };

  const handleFinishMobile = () => {
    setSuccess(false);
    setView('viewer');
  };

  // ================= TELA DO CELULAR DO CONVIDADO (FORMULÁRIO) =================
  if (view === 'mobile') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center p-4 font-sans">
        <div className="w-full max-w-md flex-1 py-8">
          {success ? (
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-10 rounded-[3rem] shadow-2xl text-center border border-slate-100 mt-12">
              <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-12 h-12 text-emerald-500 animate-bounce" />
              </div>
              <h2 className="text-3xl font-black mb-4">Enviado!</h2>
              <p className="text-slate-500 mb-8 font-medium">Sua foto foi para a moderação e logo aparecerá no telão da festa.</p>
              
              <div className="flex flex-col gap-3">
                <button onClick={() => setSuccess(false)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-2xl transition shadow-lg shadow-blue-100">
                  ENVIAR OUTRA FOTO
                </button>
                <button onClick={handleFinishMobile} className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-black py-4 rounded-2xl transition flex items-center justify-center gap-2">
                  VER MURAL NO CELULAR
                </button>
              </div>
            </motion.div>
          ) : (
            <form onSubmit={handleMobileSubmit} className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col gap-6">
              <div className="text-center mb-2 flex flex-col items-center">
                <div className="max-w-[220px] mb-2 bg-slate-900 rounded-2xl p-3 shadow-inner">
                  <LogoLumaScreen />
                </div>
                <h2 className="text-2xl font-black text-slate-900 leading-tight mt-2">Deixe sua Lembrança! 📸</h2>
                <p className="text-slate-400 font-bold mt-1 uppercase tracking-tighter text-xs">Apareça ao vivo no telão</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase ml-2 mb-1 block">Quem é você?</label>
                  <input type="text" placeholder="Seu nome aqui" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl focus:border-emerald-400 outline-none font-bold transition-all" required />
                </div>

                <div>
                  <label className="text-xs font-black text-slate-400 uppercase ml-2 mb-1 block">Recado especial</label>
                  <textarea placeholder="Sua mensagem..." rows={3} value={message} onChange={(e) => setMessage(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl focus:border-emerald-400 outline-none font-bold transition-all resize-none" />
                </div>
              </div>

              <div className="space-y-3">
                <input type="file" accept="image/*" capture="user" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                {previewUrl ? (
                  <div className="relative rounded-3xl overflow-hidden h-56 group">
                    <img src={previewUrl} alt="Preview" className="w-full max-h-64 object-cover" />
                    <button type="button" onClick={() => {setPreviewUrl(null); if (fileInputRef.current) fileInputRef.current.value = '';}} className="absolute top-4 right-4 bg-red-500 text-white p-2 rounded-xl font-bold shadow-lg">Remover</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full border-4 border-dashed border-slate-100 rounded-[2rem] py-10 bg-slate-50 hover:bg-slate-100 flex flex-col items-center gap-3 transition-all">
                    <Camera className="w-12 h-12 text-slate-300" />
                    <span className="font-black text-slate-400">TIRAR SELFIE</span>
                  </button>
                )}
              </div>

              <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-black py-5 rounded-[2rem] flex items-center justify-center gap-3 shadow-xl shadow-blue-100 transition-all text-xl mt-2">
                {loading ? <RefreshCw className="animate-spin" /> : <><Send /> ENVIAR AGORA</>}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ================= TELA DO CELULAR DO CONVIDADO (VIEWER/MURAL NO CELULAR) =================
  if (view === 'viewer') {
    const activeSlide = messages[currentSlideIndex];

    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col font-sans p-4 justify-between">
        <header className="flex items-center justify-between py-4 border-b border-slate-900">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-emerald-400 animate-pulse" />
            <span className="text-sm font-black tracking-widest uppercase text-slate-300">Mural no Celular</span>
          </div>
          <span className="text-xs bg-slate-800 text-slate-400 px-3 py-1 rounded-full font-bold">
            {messages.length} {messages.length === 1 ? 'Foto' : 'Fotos'}
          </span>
        </header>

        <main className="flex-1 flex items-center justify-center my-6 overflow-hidden">
          {messages.length === 0 ? (
            <div className="text-center space-y-4">
              <ImageIcon className="w-16 h-16 text-slate-800 mx-auto" />
              <p className="text-slate-500 font-medium">Nenhuma foto aprovada ainda.</p>
            </div>
          ) : (
            <div className="w-full max-w-sm flex flex-col items-center relative">
              <AnimatePresence mode="wait">
                {activeSlide && (
                  <motion.div
                    key={activeSlide.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.5 }}
                    className="bg-white p-4 pb-6 rounded-sm shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] flex flex-col w-full border border-slate-200"
                  >
                    <div className="w-full h-[40vh] bg-slate-100 overflow-hidden relative shadow-inner flex items-center justify-center">
                      {activeSlide.photo_url ? (
                        <img key={activeSlide.photo_url} src={activeSlide.photo_url} alt="Selfie" className="w-full h-full object-contain bg-[#0a0a0a]" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-300">
                          <ImageIcon className="w-20 h-20" />
                          <span className="text-sm font-bold text-slate-400">Recado da Festa</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 px-2 text-center">
                      <p className="text-slate-800 text-lg md:text-xl font-medium italic line-clamp-3 leading-snug">
                        "{activeSlide.message || 'Curtindo muito a festa! 🎉'}"
                      </p>
                      <div className="mt-4 border-t border-slate-100 pt-3">
                        <span className="text-blue-600 font-black uppercase text-sm tracking-wider">{activeSlide.guest_name}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </main>

        <footer className="pb-4">
          <button
            onClick={() => setView('mobile')}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-emerald-950/30 flex items-center justify-center gap-2 text-md transition-all"
          >
            <Camera className="w-5 h-5" /> QUERO MANDAR MAIS UMA!
          </button>
        </footer>
      </div>
    );
  }

  const LargeQrCodeScreen = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-4 text-center relative w-full h-full overflow-hidden bg-slate-950">
      {backgroundImageUrl && (
        <div className="absolute inset-0 w-full h-full z-0">
          <img 
            src={backgroundImageUrl} 
            alt="Cartaz do Evento" 
            className="w-full h-full object-cover opacity-80" 
          />
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />
        </div>
      )}

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }} 
        animate={{ opacity: 1, scale: 1 }} 
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-12 w-[92%] max-w-[720px] bg-slate-950/70 p-8 py-16 rounded-[4.5rem] border border-slate-800/80 backdrop-blur-lg shadow-[0_45px_150px_rgba(0,0,0,0.95)] relative z-10"
      >
        <div className="w-full max-w-[540px]">
          <LogoLumaScreen />
        </div>
        
        <div className="space-y-4">
          <h2 className="text-5xl font-black leading-tight tracking-tight text-white">Participe do Mural!</h2>
          <p className="text-slate-300 text-2xl font-semibold">Sua foto e mensagem aparecem aqui ao vivo!</p>
        </div>

        <div className="bg-white p-8 rounded-[3.5rem] shadow-[0_35px_80px_rgba(255,255,255,0.08)]">
          {totemUrl && <QRCodeSVG value={totemUrl} size={580} level="H" />}
        </div>

        <p className="text-base text-blue-400 font-black uppercase tracking-widest animate-pulse mt-2">
          Aponte a câmera do celular para participar
        </p>
      </motion.div>
    </div>
  );

  // ================= TELA DO TOTEM (TELÃO DO SALÃO) =================
  const activeSlide = messages[currentSlideIndex];

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col font-sans overflow-hidden">
      {/* Correção: Se for Administrador, ignora a trava do QR Code gigante para abrir o painel direto */}
      {(!isAdmin && (messages.length === 0 || showInterstellarQr)) ? (
        <LargeQrCodeScreen />
      ) : (
        <>
          <header className="bg-[#0f172a] border-b border-slate-800 p-6 flex items-center justify-between shadow-2xl relative z-20">
            <div className="flex items-center gap-6">
              <div className="max-w-[280px]">
                <LogoLumaScreen />
              </div>
              {isAdmin && (
                <div className="border-l border-slate-800 pl-6 hidden lg:block">
                  <span className="inline-block bg-red-600 text-[10px] font-black px-3 py-1 rounded-full uppercase">
                    Moderação: {currentEvent.toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-8 bg-black/50 p-5 rounded-[2.5rem] border border-slate-700 backdrop-blur-md">
              <div className="text-right">
                <p className="text-3xl font-black text-white leading-none mb-1">PARTICIPE!</p>
                <p className="text-slate-400 font-bold text-sm">Aponte a câmera do celular</p>
              </div>
              <div className="bg-white p-4 rounded-[1.8rem] shadow-[0_0_50px_rgba(255,255,255,0.15)]">
                {totemUrl && <QRCodeSVG value={totemUrl} size={130} level="H" />}
              </div>
            </div>
          </header>

          <main className="flex-1 p-6 bg-[radial-gradient(circle_at_50%_-20%,_#1e293b,_#050505)] flex items-center justify-center overflow-hidden">
            {isAdmin ? (
              // Correção: Mostra um aviso amigável de espera dentro do painel se o evento estiver vazio
              messages.length === 0 ? (
                <div className="text-center py-20 space-y-4 relative z-20">
                  <RefreshCw className="w-12 h-12 text-slate-600 animate-spin mx-auto" />
                  <p className="text-slate-400 text-xl font-medium">Aguardando as primeiras fotos do evento "{currentEvent}"...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 w-full max-h-full overflow-y-auto p-4">
                  <AnimatePresence initial={false}>
                    {messages.map((msg) => (
                      <motion.div
                        key={msg.id} layout
                        initial={{ opacity: 0, scale: 0.5, y: 100 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className={`bg-white p-4 pb-8 rounded-sm shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] flex flex-col w-full max-w-[320px] mx-auto relative group ${!msg.approved ? 'ring-4 ring-amber-500' : ''}`}
                      >
                        {!msg.approved && (
                          <div className="absolute -top-4 -left-4 bg-amber-500 text-black text-[10px] font-black px-4 py-2 rounded-full uppercase shadow-xl z-50 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4" /> Aguardando
                          </div>
                        )}

                        <div className="absolute -top-3 -right-3 flex gap-2 z-50 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!msg.approved && (
                            <button onClick={() => handleApproveMessage(msg.id)} className="bg-emerald-500 hover:bg-emerald-600 text-white p-3 rounded-2xl shadow-xl transition-all">
                              <Check className="w-6 h-6" />
                            </button>
                          )}
                          <button onClick={() => handleDeleteMessage(msg.id)} className="bg-red-600 hover:bg-red-700 text-white p-3 rounded-2xl shadow-xl transition-all">
                            <Trash2 className="w-6 h-6" />
                          </button>
                        </div>

                        <div className="aspect-square w-full bg-slate-100 overflow-hidden border border-slate-100">
                          {msg.photo_url ? (
                            <img key={msg.photo_url} src={msg.photo_url} alt="Selfie" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-300">
                              <ImageIcon className="w-20 h-20" />
                            </div>
                          )}
                        </div>

                        <div className="mt-6 px-2 text-center flex-1 flex flex-col justify-between min-h-[120px]">
                          <p className="text-slate-700 text-2xl font-medium tracking-tight leading-snug italic overflow-hidden">
                            "{msg.message || 'Sem palavras para essa festa!'}"
                          </p>
                          <div className="mt-6 flex flex-col border-t border-slate-100 pt-4">
                            <span className="text-blue-600 font-black uppercase text-sm tracking-widest">{msg.guest_name}</span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )
            ) : (
              <div className="relative w-full max-w-[920px] h-[82vh] flex flex-col items-center justify-center p-2">
                <AnimatePresence mode="wait">
                  {activeSlide && (
                    <motion.div
                      key={activeSlide.id}
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.6 }}
                      className="bg-white p-6 pb-10 rounded-sm shadow-[0_60px_120px_rgba(0,0,0,0.95)] flex flex-col w-full border border-slate-200 max-h-full overflow-hidden"
                    >
                      <div className="w-full h-[68vh] bg-[#0d0d0d] overflow-hidden border border-slate-100 relative shadow-inner flex items-center justify-center">
                        {activeSlide.photo_url ? (
                          <img 
                            key={activeSlide.photo_url} 
                            src={activeSlide.photo_url} 
                            alt="Selfie" 
                            className="w-full h-full object-contain max-w-full max-h-full" 
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-300">
                            <ImageIcon className="w-32 h-32" />
                            <span className="text-lg font-bold text-slate-400">Recado da Festa</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-6 px-4 text-center flex-1 flex flex-col justify-center">
                        <p className="text-slate-800 text-3xl md:text-4xl font-semibold tracking-tight leading-normal italic line-clamp-2">
                          "{activeSlide.message || 'Curtindo muito a festa! 🎉'}"
                        </p>
                        <div className="mt-4 flex flex-col border-t border-slate-100 pt-3">
                          <span className="text-blue-600 font-black uppercase text-xl tracking-widest">{activeSlide.guest_name}</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </main>
        </>
      )}
    </div>
  );
}