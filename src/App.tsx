import { PROHIBITED_WORDS } from './badWords';
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { Camera, Image as ImageIcon, Send, RefreshCw, CheckCircle, Trash2, Check, Smartphone, ShieldCheck, ShieldAlert } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminLogin from './AdminLogin'; 
import MasterAdmin from './MasterAdmin'; 
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

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
  whatsapp?: string;
  photo_url: string;
  created_at: string;
  approved: boolean;
  event_id: string;
}

export default function App() {
  const [view, setView] = useState<'totem' | 'mobile' | 'viewer' | 'gallery'>('totem');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMaster, setIsMaster] = useState(false); 
  const [isUrlAdminAuthenticated, setIsUrlAdminAuthenticated] = useState(false); 
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
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

  const [isHardwareBlocked, setIsHardwareBlocked] = useState(false);
  const [hardwareBlockMessage, setHardwareBlockMessage] = useState('');

  const [isEventInvalid, setIsEventInvalid] = useState(false);
  const [invalidEventMessage, setInvalidEventMessage] = useState('');
  
  const masterChannelRef = useRef<any>(null);

  useEffect(() => {
    const fetchEventConfig = async () => {
      const params = new URLSearchParams(window.location.search);
      const eventParam = params.get('event') || 'geral';
      const totemParam = params.get('totem');
      const viewParam = params.get('view');
      setCurrentEvent(eventParam);
      
      if (params.get('admin') === 'true') setIsAdmin(true);
      if (params.get('master') === 'true') setIsMaster(true);
      if (viewParam === 'mobile') setView('mobile');
      else if (viewParam === 'totem') setView('totem');
      else if (viewParam === 'gallery') setView('gallery');
      else setView('totem');

      const url = `${window.location.origin}?view=mobile&event=${eventParam}${totemParam ? `&totem=${totemParam}` : ''}`;
      setTotemUrl(url);

      if (totemParam && viewParam === 'mobile') {
        try {
          const { data: totemData } = await supabase
            .from('totens_management')
            .select('*')
            .ilike('totem_id', totemParam)
            .single();

          if (!totemData) {
            setIsEventInvalid(true);
            setInvalidEventMessage(`O identificador "${totemParam}" não está cadastrado no sistema.`);
            return;
          }
        } catch (err) {
          console.error("Erro ao validar totem:", err);
        }
      }

      try {
        const { data: themeData } = await supabase
          .from('events_config')
          .select('primary_color, card_radius')
          .eq('event_id', eventParam)
          .single();

        if (themeData) {
          if (themeData.primary_color) {
            document.documentElement.style.setProperty('--primary-color', themeData.primary_color);
          }
          if (themeData.card_radius) {
            document.documentElement.style.setProperty('--card-radius', themeData.card_radius);
          }
        }
      } catch (e) {
        console.error("Erro ao aplicar tema dinâmico:", e);
      }

      if (viewParam !== 'mobile' && viewParam !== 'gallery' && !params.get('master') && totemParam) {
        const { data } = await supabase
          .from('totens_management')
          .select('*');

        if (data) {
          const activeTotem = data.find(t => t.totem_id.toLowerCase() === totemParam.toLowerCase());
          
          if (activeTotem) {
            if (!activeTotem.status || activeTotem.current_allowed_event.toLowerCase() !== eventParam.toLowerCase()) {
              setIsHardwareBlocked(true);
              setHardwareBlockMessage(activeTotem.blocked_message);
            } else {
              setIsHardwareBlocked(false);
            }
          } else {
            setIsHardwareBlocked(true);
            setHardwareBlockMessage('Equipamento não homologado no sistema master.');
          }
        }

        masterChannelRef.current = supabase
          .channel('hardware_safety')
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'totens_management' }, (payload: any) => {
            const updated = payload.new;
            if (updated.totem_id.toLowerCase() === totemParam.toLowerCase()) {
              if (!updated.status || updated.current_allowed_event.toLowerCase() !== eventParam.toLowerCase()) {
                setIsHardwareBlocked(true);
                setHardwareBlockMessage(updated.blocked_message);
              } else {
                setIsHardwareBlocked(false);
              }
            }
          })
          .subscribe();
      }

      try {
        const { data: configData } = await supabase
          .from('events_config')
          .select('*')
          .eq('event_id', eventParam)
          .single();

        if (configData && configData.bg_drive_id) {
          setBackgroundImageUrl(`https://lh3.googleusercontent.com/d/${configData.bg_drive_id}`);
        } else {
          const bgParam = params.get('bg');
          if (bgParam) {
            setBackgroundImageUrl(`https://lh3.googleusercontent.com/d/${bgParam}`);
          } else {
            setBackgroundImageUrl("https://images.unsplash.com/photo-1513151233558-d860c5398176?q=80&w=1200&auto=format&fit=crop");
          }
        }
      } catch (err: any) {
        console.error("Erro ao buscar configuração do evento:", err);
      }
    };

    fetchEventConfig();

    return () => {
      if (masterChannelRef.current) {
        supabase.removeChannel(masterChannelRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!currentEvent) return;

    const fetchMessages = async () => {
      let query = supabase.from('guestbook_messages').select('*').eq('event_id', currentEvent);
      
      const isUrlAdmin = new URLSearchParams(window.location.search).get('admin') === 'true';
      if (!isUrlAdmin && view !== 'gallery') query = query.eq('approved', true);

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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'guestbook_messages', filter: `event_id=eq.${currentEvent}` }, 
        (payload) => {
          const newMessage = payload.new as Message;
          const isUrlAdmin = new URLSearchParams(window.location.search).get('admin') === 'true';
          
          if (newMessage.event_id === currentEvent && (isUrlAdmin || view === 'gallery' || newMessage.approved)) {
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
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'guestbook_messages', filter: `event_id=eq.${currentEvent}` },
        (payload) => {
          const updatedMessage = payload.new as Message;
          if (updatedMessage.event_id !== currentEvent) return;

          const isUrlAdmin = new URLSearchParams(window.location.search).get('admin') === 'true';

          if (isUrlAdmin || view === 'gallery') {
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
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'guestbook_messages', filter: `event_id=eq.${currentEvent}` },
        (payload) => {
          setMessages((prev) => prev.filter((msg) => msg.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => { 
      supabase.removeChannel(channel); 
      clearInterval(pollingInterval);
    };
  }, [view, currentEvent, isHardwareBlocked, isEventInvalid, isAdmin]);

  useEffect(() => {
    if ((view !== 'totem' && view !== 'viewer') || messages.length === 0 || isAdmin || isHardwareBlocked || isEventInvalid) return;

    let timeout: any;

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
  }, [view, messages.length, isAdmin, showInterstellarQr, currentSlideIndex, isHardwareBlocked, isEventInvalid]);

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

    const fullText = `${name} ${message} ${whatsapp}`.toLowerCase();
    const wordsInInput = fullText.split(/\s+/);
    const hasProhibitedWord = PROHIBITED_WORDS.some(prohibited => 
      wordsInInput.includes(prohibited.toLowerCase())
    );

    if (hasProhibitedWord) {
      alert("⚠️ Ops! Sua mensagem ou nome contém termos não permitidos. Por favor, envie uma mensagem positiva!");
      return; 
    }

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
        { 
          guest_name: name, 
          message: message, 
          whatsapp: whatsapp, 
          photo_url: photoUrl, 
          approved: false, 
          event_id: currentEvent 
        }
      ]);
      
      if (dbError) throw dbError;
      setSuccess(true);
      setName(''); setMessage(''); setWhatsapp(''); setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) { alert(`Erro: ${err.message}`); } finally { setLoading(false); }
  };

  const handleFinishMobile = () => {
    setSuccess(false);
    setView('viewer');
  };

  if (isMaster) {
    return <MasterAdmin />;
  }

  if (isHardwareBlocked) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-xl bg-slate-900/50 p-10 rounded-[3rem] border border-red-500/20 shadow-2xl backdrop-blur-md flex flex-col gap-6">
          <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto border border-red-500/30 animate-pulse">
            <ShieldAlert className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-3xl font-black text-red-400 tracking-tight">DISPOSITIVO SUSPENSO</h2>
          <p className="text-slate-300 text-lg font-bold leading-relaxed">{hardwareBlockMessage}</p>
          <div className="border-t border-slate-800 pt-4 mt-2">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">KlimpTV Enterprise Services</p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (isEventInvalid) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-xl bg-slate-900/50 p-10 rounded-[3rem] border border-amber-500/20 shadow-2xl backdrop-blur-md flex flex-col gap-6">
          <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mx-auto border border-amber-500/30">
            <ShieldAlert className="w-10 h-10 text-amber-500" />
          </div>
          <h2 className="text-3xl font-black text-amber-400 tracking-tight">EVENTO NÃO ENCONTRADO</h2>
          <p className="text-slate-300 text-lg font-bold leading-relaxed">{invalidEventMessage}</p>
          <div className="border-t border-slate-800 pt-4 mt-2">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">LumaScreen Enterprise Services</p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (isAdmin && !isUrlAdminAuthenticated) {
    return <AdminLogin onLoginSuccess={() => setIsUrlAdminAuthenticated(true)} currentEvent={currentEvent} />;
  }

  if (view === 'gallery') {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-8 font-sans">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center border-b border-slate-800 pb-6 mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black text-blue-400 tracking-wider font-mono">LUMASCREEN GALLERY</h1>
            <p className="text-slate-400 mt-1 font-medium">Pack de fotos do evento: <span className="text-white font-bold uppercase">{currentEvent}</span></p>
          </div>
          <button 
            onClick={async () => {
              try {
                const validPhotos = messages.filter(m => m.approved && m.photo_url);

                if (validPhotos.length === 0) {
                  alert("Não há fotos aprovadas neste evento para baixar.");
                  return;
                }

                alert("Iniciando a compactação das fotos. Aguarde um instante...");
                const zip = new JSZip();
                
                await Promise.all(
                  validPhotos.map(async (msg, index) => {
                    try {
                      const response = await fetch(msg.photo_url);
                      const blob = await response.blob();
                      const fileName = `${msg.guest_name.replace(/[/\\?%*:|"<>\s]/g, '_')}_${index + 1}.jpg`;
                      zip.file(fileName, blob);
                    } catch (fetchErr) {
                      console.error(`Erro ao baixar a foto ${index + 1}:`, fetchErr);
                    }
                  })
                );

                const zipContent = await zip.generateAsync({ type: 'blob' });
                saveAs(zipContent, `pack-fotos-${currentEvent}.zip`);
                
              } catch (err: any) {
                alert(`Erro ao gerar o arquivo ZIP: ${err.message}`);
              }
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-4 rounded-2xl shadow-lg transition-all transform active:scale-95 text-md"
          >
            📦 BAIXAR TODAS AS FOTOS (.ZIP)
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {messages.filter(m => m.approved).length === 0 ? (
            <p className="text-slate-500 font-medium col-span-full text-center py-10">Nenhuma foto aprovada disponível neste pack ainda.</p>
          ) : (
            messages.filter(m => m.approved).map((msg) => (
              <div key={msg.id} className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800/60 shadow-xl group relative">
                <div className="aspect-square w-full bg-slate-950 overflow-hidden">
                  {msg.photo_url ? (
                    <img src={msg.photo_url} alt="Selfie" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-700">
                      <ImageIcon className="w-12 h-12" />
                    </div>
                  )}
                </div>
                <div className="p-4 bg-slate-900 border-t border-slate-800/40">
                  <p className="text-xs text-blue-400 font-black uppercase truncate">De: {msg.guest_name}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

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

                <div>
                  <label className="text-xs font-black text-slate-400 uppercase ml-2 mb-1 block">WhatsApp (Opcional)</label>
                  <input type="tel" placeholder="(00) 90000-0000" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl focus:border-emerald-400 outline-none font-bold transition-all" />
                </div>
              </div>

              <div className="space-y-3">
                <input 
                  type="file" 
                  accept="image/*" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                />
                
                {previewUrl ? (
                  <div className="relative rounded-3xl overflow-hidden h-56 group">
                    <img src={previewUrl} alt="Preview" className="w-full max-h-64 object-cover" />
                    <button type="button" onClick={() => {setPreviewUrl(null); if (fileInputRef.current) fileInputRef.current.value = '';}} className="absolute top-4 right-4 bg-red-500 text-white p-2 rounded-xl font-bold shadow-lg">Remover</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      type="button" 
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.setAttribute('capture', 'user');
                          fileInputRef.current.click();
                        }
                      }} 
                      className="border-4 border-dashed border-slate-200 rounded-[2rem] py-8 bg-slate-50 hover:bg-slate-100 flex flex-col items-center gap-2 transition-all text-center p-2"
                    >
                      <Camera className="w-10 h-10 text-blue-500" />
                      <span className="font-black text-slate-600 text-xs uppercase">Tirar Selfie</span>
                    </button>

                    <button 
                      type="button" 
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.removeAttribute('capture');
                          fileInputRef.current.click();
                        }
                      }} 
                      className="border-4 border-dashed border-slate-200 rounded-[2rem] py-8 bg-slate-50 hover:bg-slate-100 flex flex-col items-center gap-2 transition-all text-center p-2"
                    >
                      <ImageIcon className="w-10 h-10 text-emerald-500" />
                      <span className="font-black text-slate-600 text-xs uppercase">Escolher Galeria</span>
                    </button>
                  </div>
                )}
              </div>

              <button type="submit" disabled={loading} className="w-full bg-theme-primary hover:opacity-90 disabled:bg-slate-300 rounded-theme text-white font-black py-5 flex items-center justify-center gap-3 shadow-xl transition-all text-xl mt-2">
                {loading ? <RefreshCw className="animate-spin" /> : <><Send /> ENVIAR AGORA</>}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  const LargeQrCodeScreen = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center relative w-full h-full overflow-hidden bg-slate-950">
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
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col md:flex-row items-center justify-between gap-10 w-full max-w-[1300px] bg-slate-950/80 p-10 md:p-14 rounded-[3.5rem] border border-slate-800/80 backdrop-blur-xl shadow-[0_45px_150px_rgba(0,0,0,0.95)] relative z-10"
      >
        <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-6 w-full md:w-3/5">
          <div className="w-full max-w-[420px]">
            <LogoLumaScreen />
          </div>
          <div className="space-y-3">
            <h2 className="text-4xl md:text-6xl font-black leading-tight tracking-tight text-white">Participe do Mural!</h2>
            <p className="text-slate-300 text-xl md:text-2xl font-semibold">Sua foto e mensagem aparecem aqui ao vivo na tela!</p>
          </div>
          <p className="text-sm md:text-base text-blue-400 font-black uppercase tracking-widest animate-pulse pt-2">
            Aponte a câmera do celular para participar
          </p>
        </div>

        <div className="w-full md:w-2/5 flex items-center justify-center">
          <div className="bg-white p-6 md:p-8 rounded-[3rem] shadow-[0_35px_80px_rgba(255,255,255,0.08)]">
            {totemUrl && <QRCodeSVG value={totemUrl} size={320} level="H" />}
          </div>
        </div>
      </motion.div>
    </div>
  );

  const activeSlide = messages[currentSlideIndex];

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col font-sans overflow-hidden">
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
                <div className="border-l border-slate-800 pl-6 hidden lg:flex items-center gap-2">
                  <span className="inline-block bg-red-600 text-[10px] font-black px-3 py-1 rounded-full uppercase">
                    Moderação: {currentEvent.toUpperCase()}
                  </span>
                  
                  <button
                    onClick={() => {
                      const galleryUrl = `${window.location.origin}/?view=gallery&event=${currentEvent}`;
                      navigator.clipboard.writeText(galleryUrl);
                      alert(`Link do Pack de Fotos copiado! Envie para o cliente: ${galleryUrl}`);
                    }}
                    className="ml-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black px-4 py-2 rounded-xl transition-all shadow-md active:scale-95"
                  >
                    🔗 COPIAR LINK DO PACK
                  </button>

                  <button
                    onClick={() => {
                      const validLeads = messages.filter(m => m.whatsapp && m.whatsapp.trim() !== '');
                      if (validLeads.length === 0) {
                        alert("Nenhum lead com WhatsApp cadastrado neste evento ainda.");
                        return;
                      }

                      let csvContent = "data:text/csv;charset=utf-8,Nome,WhatsApp,Mensagem,Data\n";
                      validLeads.forEach(lead => {
                        const row = `"${lead.guest_name}","${lead.whatsapp}","${lead.message || ''}","${new Date(lead.created_at).toLocaleString()}"`;
                        csvContent += row + "\n";
                      });

                      const encodedUri = encodeURI(csvContent);
                      const link = document.createElement("a");
                      link.setAttribute("href", encodedUri);
                      link.setAttribute("download", `leads-whatsapp-${currentEvent}.csv`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="ml-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-4 py-2 rounded-xl transition-all shadow-md active:scale-95"
                  >
                    📥 BAIXAR LEADS (CSV)
                  </button>
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

                        <div className="absolute -top-3 -right-3 flex gap-2 z-50 transition-opacity">
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
                            {msg.whatsapp && <span className="text-xs text-slate-400 font-bold mt-1">Wpp: {msg.whatsapp}</span>}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )
            ) : view === 'totem' ? (
              <div className="relative w-full h-full flex flex-col items-center justify-center p-2">
                <AnimatePresence mode="wait">
                  {activeSlide && (
                    <motion.div
                      key={activeSlide.id}
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.6 }}
                      className="bg-white p-6 rounded-[2.5rem] shadow-2xl flex flex-col w-full h-full border border-slate-200 justify-between items-center text-center"
                    >
                      <div className="w-full flex-1 bg-slate-900 overflow-hidden rounded-2xl relative shadow-inner flex items-center justify-center my-1">
                        {activeSlide.photo_url ? (
                          <img 
                            key={activeSlide.photo_url} 
                            src={activeSlide.photo_url} 
                            alt="Selfie" 
                            className="w-full h-full object-cover" 
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-300">
                            <ImageIcon className="w-24 h-24" />
                          </div>
                        )}
                      </div>

                      <div className="w-full flex flex-col items-center justify-center pt-2 pb-1">
                        <p className="text-slate-800 text-2xl sm:text-3xl font-semibold tracking-tight leading-snug italic">
                          "{activeSlide.message || 'Curtindo muito a festa! 🎉'}"
                        </p>
                        <div className="mt-3 border-t border-slate-200 pt-3 w-full">
                          <span className="text-blue-600 font-black uppercase text-2xl tracking-wider block">{activeSlide.guest_name}</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="relative w-full max-w-[1400px] h-[85vh] flex flex-col items-center justify-center p-2">
                <AnimatePresence mode="wait">
                  {activeSlide && (
                    <motion.div
                      key={activeSlide.id}
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.6 }}
                      className="bg-white p-10 rounded-3xl shadow-[0_60px_120px_rgba(0,0,0,0.95)] flex flex-col md:flex-row w-full border border-slate-200 max-h-full overflow-hidden gap-10 items-center"
                    >
                      <div className="w-full md:w-2/3 h-[72vh] bg-[#0d0d0d] overflow-hidden rounded-2xl border border-slate-100 relative shadow-inner flex items-center justify-center">
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

                      <div className="w-full md:w-1/3 flex flex-col justify-center text-left">
                        <p className="text-slate-800 text-3xl md:text-5xl font-semibold tracking-tight leading-normal italic">
                          "{activeSlide.message || 'Curtindo muito a festa! 🎉'}"
                        </p>
                        <div className="mt-8 border-t border-slate-200 pt-6">
                          <span className="text-blue-600 font-black uppercase text-2xl tracking-widest block">{activeSlide.guest_name}</span>
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