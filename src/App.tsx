import { PROHIBITED_WORDS } from "./badWords";
import React, { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";
import { Camera, Image as ImageIcon, Send, RefreshCw, CheckCircle, Trash2, Check, Smartphone, ShieldCheck, ShieldAlert } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { motion, AnimatePresence } from "framer-motion";
import AdminLogin from "./AdminLogin"; 
import MasterAdmin from "./MasterAdmin"; 
import JSZip from "jszip";
import { saveAs } from "file-saver";

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
  const [view, setView] = useState<"totem" | "mobile" | "viewer" | "gallery">("totem");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMaster, setIsMaster] = useState(false); 
  const [isUrlAdminAuthenticated, setIsUrlAdminAuthenticated] = useState(false); 
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [totemUrl, setTotemUrl] = useState("");
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [showInterstellarQr, setShowInterstellarQr] = useState(false);
  const photosShownCounter = useRef(0);
  const [currentEvent, setCurrentEvent] = useState("geral");
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
  const [isHardwareBlocked, setIsHardwareBlocked] = useState(false);
  const [hardwareBlockMessage, setHardwareBlockMessage] = useState("");
  const [isEventInvalid, setIsEventInvalid] = useState(false);
  const [invalidEventMessage, setInvalidEventMessage] = useState("");
  const masterChannelRef = useRef<any>(null);

  useEffect(() => {
    const fetchEventConfig = async () => {
      const params = new URLSearchParams(window.location.search);
      const eventParam = params.get("event") || "geral";
      const totemParam = params.get("totem");
      setCurrentEvent(eventParam);
      if (params.get("admin") === "true") setIsAdmin(true);
      if (params.get("master") === "true") setIsMaster(true);
      if (params.get("view") === "mobile") setView("mobile");
      if (params.get("view") === "gallery") setView("gallery");
      const url = `${window.location.origin}?view=mobile&event=${eventParam}${totemParam ? `&totem=${totemParam}` : ""}`;
      setTotemUrl(url);
    };
    fetchEventConfig();
  }, []);

  const handleMobileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return alert("Por favor, digite seu nome.");
    setLoading(true);
    try {
      let photoUrl = "";
      const file = fileInputRef.current?.files?.[0];
      if (file) {
        const fileExt = file.name.split(".").pop() || "jpg";
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from("guestbook-photos").upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from("guestbook-photos").getPublicUrl(fileName);
        photoUrl = data.publicUrl;
      }
      const { error: dbError } = await supabase.from("guestbook_messages").insert([
        { guest_name: name, message: message, whatsapp: whatsapp, photo_url: photoUrl, approved: false, event_id: currentEvent }
      ]);
      if (dbError) throw dbError;
      setSuccess(true);
      setName(""); setMessage(""); setWhatsapp(""); setPreviewUrl(null);
    } catch (err: any) { alert(`Erro: ${err.message}`); } finally { setLoading(false); }
  };

  if (view === "mobile") {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center p-4 font-sans">
        <div className="w-full max-w-md flex-1 py-8">
          <form onSubmit={handleMobileSubmit} className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col gap-6">
            <h2 className="text-2xl font-black text-slate-900 text-center">Deixe sua Lembrança! ??</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-black text-slate-400 uppercase ml-2 mb-1 block">Quem é você?</label>
                <input type="text" placeholder="Seu nome aqui" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl outline-none font-bold" required />
              </div>
              <div>
                <label className="text-xs font-black text-slate-400 uppercase ml-2 mb-1 block">Recado especial</label>
                <textarea placeholder="Sua mensagem..." rows={3} value={message} onChange={(e) => setMessage(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl outline-none font-bold resize-none" />
              </div>
              <div>
                <label className="text-xs font-black text-slate-400 uppercase ml-2 mb-1 block">WhatsApp (Opcional)</label>
                <input type="tel" placeholder="(00) 90000-0000" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl outline-none font-bold" />
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl text-xl">ENVIAR AGORA</button>
          </form>
        </div>
      </div>
    );
  }
  return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">LumaScreen Ativo</div>;
}
