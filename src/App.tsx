import React, { useState, useRef, useEffect } from 'react';
import { 
  VolumeX,
  Sun,
  Moon,
  Landmark,
  History,
  Menu,
  LayoutGrid,
  Settings as SettingsIcon,
  MessageSquare,
  ChevronRight,
  Send,
  Globe,
  Briefcase,
  Fingerprint,
  GraduationCap,
  Scale,
  HeartPulse,
  Home,
  Plane,
  Download,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import Markdown from 'react-markdown';
import { chatWithGemini } from './services/gemini';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
}

const SERVICES = [
  { id: 'passport', title: 'Paspò & Imigrasyon', icon: Globe, description: 'Demann paspò, viza, ak pèmi rezidans.' },
  { id: 'dgi', title: 'TIN & Taks (DGI)', icon: Landmark, description: 'Matrikil fiskal, taks sou revni, ak byen fonzye.' },
  { id: 'biznis', title: 'Kreyasyon Biznis', icon: Briefcase, description: 'Anrejistreman konpayi, non komèsyal, ak patant.' },
  { id: 'idantite', title: 'Idantite (Achiv, CIN)', icon: Fingerprint, description: 'Akt de nesans, kat idantite (CIN), ak achiv nasyonal.' },
  { id: 'edikasyon', title: 'Edikasyon (MENFP)', icon: GraduationCap, description: 'Legalizasyon diplòm, sètifika bachlye, ak lekòl.' },
  { id: 'jistis', title: 'Jistis & Sekirite', icon: Scale, description: 'Kasye jidisyè (Police Record), legalizasyon papye jistis.' },
  { id: 'sante', title: 'Sante Piblik (MSPP)', icon: HeartPulse, description: 'Sètifika sante, kanè vaksen, ak klinik.' },
  { id: 'meri', title: 'Meri & Sosyal', icon: Home, description: 'Otorizasyon konstriksyon, sèvis kominal, ak MAST.' },
  { id: 'touris', title: 'Avyasyon & Touris', icon: Plane, description: 'Tikè avyon, enfòmasyon touris, ak koutim.' },
  { id: 'pwopriyete', title: 'Byen & Pwopriyete', icon: History, description: 'Titre de pwopriyete, arpantaj, ak notè.' },
];

const PROMO_MESSAGE = "\n\n---\n🚀 **PA PÈDI TAN NAN BIWO!** 🚀\nNou se ajans ki pi rapid ak pi fyab nan peyi a pou tout dosye administratif ou yo. \n✅ **Viza** | ✅ **Paspò** | ✅ **Dokiman Leta**\nNou garanti w yon sèvis serye, san tèt chaje, ak yon vitès depase sa w panse! \n\n📞 **RELE OUBYEN EKRI NOU KOUNYE A SOU: +509 37944651**\n*Solisyon w lan nan men nou!*";

const SYSTEM_INSTRUCTION = "Ou se yon asistan administratif pwofesyonèl pou yon ajans ki rele 'Asistan Piblik'. Toujou reponn an kreyòl ayisyen. Konsantre sou ede moun ak demach viza, paspò, ak dokiman leta yo. Repons ou yo dwe kout, klè, epi bay moun nan konfyans. SI OU PA KONN YON REPONS OUBYEN SI ENFÒMASYON AN PA NAN DOKIMAN AN, PA DI 'DOKIMAN AN PA GEN SA' OUBYEN 'MWEN PA JWENN SA NAN PDF LA'. Di sèlman: 'Mwen pa gen enfòmasyon sa a pou kounye a, tanpri rele nou, ekri nou nan +509 37944651, oswa klike sou bouton WhatsApp vèt ki anba a pou yon asistan ka ede w dirèkteman.'";

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [currentTab, setCurrentTab] = useState<'messages' | 'services' | 'settings'>('messages');
  const [isLoading, setIsLoading] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const checkIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(checkIOS);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  useEffect(() => {
    // Initialize Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'ht-HT';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
        setMicError(null);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setMicError("Tanpri pèmèt app a sèvi ak mikwo w la nan navigatè a.");
        } else if (event.error === 'service-not-allowed') {
          setMicError("Sèvis vwa a pa disponib sou navigatè sa a kounye a. Eseye sèvi ak Chrome.");
        } else if (event.error === 'no-speech') {
          // No speech detected, just stop listening silently or show a very brief hint
          setMicError(null);
        } else {
          setMicError("Gen yon pwoblèm ak mikwo a. Tanpri eseye ankò.");
        }
        if (event.error !== 'no-speech') {
          setTimeout(() => setMicError(null), 5000);
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setIsListening(true);
      recognitionRef.current?.start();
    }
  };

  const speakText = (text: string) => {
    // Stop any current speech
    window.speechSynthesis.cancel();
    
    // Remove markdown symbols and promo message for cleaner speech
    const cleanText = text.split('---')[0].replace(/[*_#`]/g, '').trim();
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'ht-HT';
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    synthesisRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  useEffect(() => {
    // Initial welcome message
    if (messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'model',
        content: "Bonjou! Mwen se asistan piblik ou. Kouman mwen ka ede w ak demach administratif ou jodi a? Mwen ka ede w ak paspò, TIN, oswa taks.",
        timestamp: new Date()
      }]);
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Konstwi istwa chat la ak wòl ki altène, kòmanse ak yon mesaj "user"
      let chatHistory: { role: string; content: string }[] = [];
      
      // Nou sote premye mesaj la si se yon mesaj "model" (tankou mesaj byenveni an)
      // paske ChatPDF mande pou istwa a kòmanse ak yon mesaj "user".
      const relevantMessages = messages.filter((m, index) => {
        if (index === 0 && m.role === 'model') return false;
        return true;
      }).slice(-10);

      relevantMessages.forEach(m => {
        const currentRole = m.role === 'user' ? 'user' : 'assistant';
        if (chatHistory.length === 0 || chatHistory[chatHistory.length - 1].role !== currentRole) {
          chatHistory.push({ role: currentRole, content: m.content });
        } else {
          chatHistory[chatHistory.length - 1].content += "\n" + m.content;
        }
      });

      // Ajoute mesaj aktyèl la
      if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'user') {
        chatHistory[chatHistory.length - 1].content += "\n" + input;
      } else {
        const content = chatHistory.length === 0 
          ? `${SYSTEM_INSTRUCTION}\n\nKesyon mwen an se: ${input}`
          : input;
        chatHistory.push({ role: 'user', content });
      }

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chatHistory,
          referenceSources: true
        })
      });

      if (!response.ok) {
        let errorMessage = 'Sèvis AI a gen yon pwoblèm. Tanpri eseye ankò.';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          console.error('Failed to parse error response:', e);
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      let botResponse = data.content || "Mwen pa ka reponn kesyon sa a pou kounye a.";
      
      // Speak the response (before adding promo message)
      speakText(botResponse);

      botResponse += PROMO_MESSAGE;

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: botResponse,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error: any) {
      console.error('Error:', error);
      let displayMessage = "Mwen regret sa, gen yon ti pwoblèm nan koneksyon an. Tanpri verifye entènèt ou epi eseye ankò.";
      
      if (error.message && !error.message.includes('getaddrinfo') && !error.message.includes('ENOTFOUND')) {
        displayMessage = error.message;
      }

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: displayMessage + PROMO_MESSAGE,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn(
      "flex h-screen font-sans transition-colors duration-300",
      isDarkMode ? "bg-slate-950 text-slate-100" : "bg-[#f5f5f5] text-slate-900"
    )}>
      {/* Main Chat Area */}
      <main className={cn(
        "flex-1 flex flex-col relative max-w-5xl mx-auto shadow-xl transition-colors duration-300",
        isDarkMode ? "bg-slate-900 border-x border-slate-800" : "bg-white"
      )}>
        {/* Chat Header */}
        <header className={cn(
          "h-20 border-b flex items-center px-6 justify-between z-20 transition-colors duration-300 sticky top-0 shrink-0",
          isDarkMode ? "bg-[#020617] border-slate-800" : "bg-white border-slate-100"
        )}>
          <div className="flex items-center gap-3">
            <Landmark className={cn("w-6 h-6", isDarkMode ? "text-blue-400" : "text-hda-blue")} />
            <div>
              <h1 className={cn(
                "text-sm font-black tracking-tight leading-tight",
                isDarkMode ? "text-white" : "text-hda-blue"
              )}>
                HAITIAN DIGITAL<br />ADMINISTRATION
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={cn(
                "p-2 rounded-full transition-colors",
                isDarkMode ? "text-yellow-400 hover:bg-slate-800" : "text-slate-600 hover:bg-slate-100"
              )}
              title={isDarkMode ? "Light Mode" : "Dark Mode"}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            {deferredPrompt && (
              <button 
                onClick={handleInstallClick}
                className={cn("p-2 rounded-full transition-all bg-hda-blue/10 animate-pulse-subtle", isDarkMode ? "hover:bg-hda-blue/20" : "hover:bg-hda-blue/10")}
                title="Enstale Aplikasyon"
              >
                <Download className={cn("w-5 h-5", isDarkMode ? "text-blue-400" : "text-hda-blue")} />
              </button>
            )}
            <button className={cn("p-2 rounded-full transition-colors", isDarkMode ? "hover:bg-slate-800" : "hover:bg-slate-100")}>
              <History className={cn("w-5 h-5", isDarkMode ? "text-slate-400" : "text-slate-600")} />
            </button>
            <button 
              onClick={() => setIsMenuOpen(true)}
              className={cn("p-2 rounded-full transition-colors", isDarkMode ? "hover:bg-slate-800" : "hover:bg-slate-100")}
            >
              <Menu className={cn("w-5 h-5", isDarkMode ? "text-slate-400" : "text-slate-600")} />
            </button>
          </div>
        </header>

        {/* Main Content Area (Conditional Rendering) */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {currentTab === 'messages' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth">
              {/* Welcome Hero Section */}
              <div className="py-8 text-center">
                <h2 className={cn(
                  "text-4xl font-black mb-2 tracking-tighter uppercase",
                  isDarkMode ? "text-white" : "text-slate-900"
                )}>
                  ASISTAN PIBLIK
                </h2>
                <p className={cn(
                  "text-sm max-w-[280px] mx-auto font-medium",
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                )}>
                  Byenvini nan sèvis asistans dijital Repiblik Dayiti. Kijan nou ka ede w jodi a?
                </p>
              </div>

              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "flex flex-col gap-2 max-w-[85%]",
                      msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1 px-1">
                      {msg.role === 'model' && (
                        <div className="bg-hda-blue p-1.5 rounded-sm">
                          <Landmark className="w-3.5 h-3.5 text-white" />
                        </div>
                      )}
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-widest",
                        isDarkMode ? "text-slate-500" : "text-slate-400",
                        msg.role === 'model' && (isDarkMode ? "text-blue-400" : "text-hda-blue")
                      )}>
                        {msg.role === 'user' ? "CITIZEN • KOUNYE A" : "ASISTAN PIBLIK • KOUNYE A"}
                      </span>
                    </div>

                    <div className={cn(
                      "p-5 shadow-sm border-y border-r transition-all duration-300 relative",
                      msg.role === 'user' 
                        ? (isDarkMode ? "bg-blue-600 border-blue-500 text-white rounded-l-2xl rounded-tr-sm" : "bg-hda-blue border-hda-blue text-white rounded-l-xl rounded-tr-sm")
                        : (isDarkMode ? "bg-slate-950 border-slate-800 text-slate-100 rounded-r-xl rounded-tl-sm border-l-4 border-l-blue-500" : "bg-white border-slate-100 text-slate-800 rounded-r-xl rounded-tl-sm border-l-4 border-l-hda-red")
                    )}>
                      <div className="markdown-body text-sm font-medium leading-relaxed">
                        <Markdown>{msg.content}</Markdown>
                      </div>
                    </div>

                    <div className="px-1 mt-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {isLoading && (
                <div className="flex gap-4 mr-auto max-w-sm">
                  <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 shadow-sm">
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 bg-hda-blue rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-hda-blue rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-hda-blue rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {currentTab === 'services' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="py-4">
                <h2 className={cn(
                  "text-2xl font-black tracking-tighter uppercase",
                  isDarkMode ? "text-white" : "text-slate-900"
                )}>
                  SÈVIS DISPONIB
                </h2>
                <p className={cn(
                  "text-xs font-bold uppercase tracking-widest mt-1",
                  isDarkMode ? "text-slate-500" : "text-slate-400"
                )}>
                  Eksplore kategori administratif nou yo
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {SERVICES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setInput(s.title);
                      setCurrentTab('messages');
                    }}
                    className={cn(
                      "p-5 border-y border-r rounded-xl text-left transition-all hover:scale-[1.02] active:scale-95 group relative flex items-center gap-5",
                      isDarkMode ? "bg-slate-900 border-slate-800 hover:bg-slate-800" : "bg-white border-slate-100 hover:bg-slate-50 shadow-sm"
                    )}
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-sm flex items-center justify-center shrink-0 border-l-4",
                      isDarkMode ? "bg-slate-800 border-l-blue-500" : "bg-slate-50 border-l-hda-red"
                    )}>
                      <s.icon className={cn("w-6 h-6", isDarkMode ? "text-blue-400" : "text-hda-blue")} />
                    </div>
                    <div className="flex-1">
                      <h3 className={cn("text-sm font-black uppercase tracking-tight", isDarkMode ? "text-white" : "text-hda-blue")}>
                        {s.title}
                      </h3>
                      <p className={cn("text-xs font-medium mt-1 leading-snug", isDarkMode ? "text-slate-500" : "text-slate-400")}>
                        {s.description}
                      </p>
                    </div>
                    <ChevronRight className={cn("w-5 h-5 opacity-20 group-hover:opacity-100 transition-opacity", isDarkMode ? "text-white" : "text-hda-blue")} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentTab === 'settings' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              <div className="py-4 text-center">
                <div className={cn(
                  "w-20 h-20 rounded-sm flex items-center justify-center mb-4 mx-auto",
                  isDarkMode ? "bg-slate-900 border border-slate-800" : "bg-slate-50 border border-slate-100"
                )}>
                  <LayoutGrid className={cn("w-10 h-10", isDarkMode ? "text-blue-400" : "text-hda-blue")} />
                </div>
                <h2 className={cn("text-lg font-black uppercase tracking-tighter", isDarkMode ? "text-white" : "text-slate-900")}>
                  KONFÈTI AN APLIKASYON
                </h2>
                <p className={cn("text-xs font-bold uppercase tracking-widest mt-2", isDarkMode ? "text-slate-600" : "text-slate-400")}>
                  Enstale l sou telefòn ou kounye a
                </p>
              </div>

              <div className={cn(
                "p-6 rounded-xl border-y border-r space-y-6 transition-colors duration-300",
                isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100 shadow-sm"
              )}>
                {deferredPrompt ? (
                  <button 
                    onClick={handleInstallClick}
                    className="w-full bg-hda-blue text-white py-4 rounded-sm font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-blue-800 transition-all mb-8 shadow-lg active:scale-95"
                  >
                    <Download className="w-5 h-5" />
                    INSTALE SOU TELEFÒN
                  </button>
                ) : (
                  !isIOS && (
                    <div className={cn(
                      "p-4 rounded-sm border-l-4 border-hda-blue mb-4",
                      isDarkMode ? "bg-slate-800/50" : "bg-blue-50"
                    )}>
                      <p className="text-[10px] font-black uppercase tracking-widest text-hda-blue mb-1">Enstriksyon</p>
                      <p className="text-xs font-medium leading-relaxed">
                        Si paj la poko mande w pou w enstale l, klike sou **3 ti pwen** yo anlè a epi chwazi **"Install app"**.
                      </p>
                    </div>
                  )
                )}
                
                {isIOS && (
                  <div className={cn(
                    "p-4 rounded-sm border-l-4 border-hda-red mb-4",
                    isDarkMode ? "bg-slate-800/50" : "bg-red-50"
                  )}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-hda-red mb-1">Pou iPhone (Safari)</p>
                    <p className="text-xs font-medium leading-relaxed">
                      Klike sou bouton **"Share"** anba a, epi chwazi **"Add to Home Screen"**.
                    </p>
                  </div>
                )}
                
                <div className="space-y-4">
                  <h3 className={cn("text-[10px] font-black uppercase tracking-[0.2em]", isDarkMode ? "text-blue-400" : "text-hda-blue")}>
                    POU ANDROID (CHROME)
                  </h3>
                  <p className="text-sm font-medium leading-relaxed">
                    1. Klike sou **3 ti pwen** anwo a.<br />
                    2. Chwazi **"Install app"** oswa **"Add to Home screen"**.
                  </p>
                </div>

                <div className="h-px bg-slate-200 dark:bg-slate-800" />

                <div className="space-y-4">
                  <h3 className={cn("text-[10px] font-black uppercase tracking-[0.2em]", isDarkMode ? "text-hda-red" : "text-hda-red")}>
                    POU IPHONE (SAFARI)
                  </h3>
                  <p className="text-sm font-medium leading-relaxed">
                    1. Klike sou buton **"Share"** (yon kare ak yon flèch).<br />
                    2. Desann anba epi chwazi **"Add to Home Screen"**.
                  </p>
                </div>
              </div>

              <div className="text-center pt-8 opacity-20">
                <p className="text-[10px] font-black uppercase tracking-widest">Version 1.0.0 (HDA Mobile)</p>
              </div>
            </div>
          )}
        </div>

        {/* Suggestion Pills (Only on Messages Tab) */}
        {currentTab === 'messages' && (
          <div className="px-6 py-2 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
            {["PASPÒ", "ID NASYONAL", "TAKS"].map((tag) => (
              <button
                key={tag}
                onClick={() => setInput(tag)}
                className={cn(
                  "px-6 py-2.5 rounded-sm text-[10px] font-black tracking-widest uppercase transition-all whitespace-nowrap border",
                  isDarkMode 
                    ? "bg-slate-900 border-slate-800 text-slate-400 hover:text-white" 
                    : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                )}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Input Area (Only on Messages Tab) */}
        {currentTab === 'messages' && (
          <div className={cn(
            "p-6 border-t transition-all duration-300 shrink-0",
            isDarkMode ? "bg-[#020617] border-slate-800" : "bg-white border-slate-100"
          )}>
            <form 
              onSubmit={handleSend}
              className="max-w-4xl mx-auto relative flex items-center gap-3"
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ekri mesaj ou la..."
                  className={cn(
                    "w-full rounded-sm py-4 px-6 focus:outline-none transition-all",
                    isDarkMode 
                      ? "bg-slate-900 text-slate-100 placeholder:text-slate-600 border border-slate-800" 
                      : "bg-slate-50 text-slate-900 placeholder:text-slate-400 border border-slate-100"
                  )}
                  disabled={isLoading}
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className={cn(
                  "h-14 w-16 rounded-sm transition-all flex items-center justify-center shrink-0",
                  isDarkMode ? "bg-blue-600 hover:bg-blue-500" : "bg-hda-blue hover:bg-blue-800"
                )}
              >
                <Send className="w-5 h-5 text-white" />
              </button>
            </form>
          </div>
        )}

        {/* Bottom Navigation */}
        <nav className={cn(
          "h-20 border-t flex items-center justify-around px-2 shrink-0 transition-colors duration-300",
          isDarkMode ? "bg-slate-950 border-slate-800" : "bg-white border-slate-100"
        )}>
          <button 
            onClick={() => setCurrentTab('messages')}
            className={cn(
              "flex flex-col items-center gap-1.5 transition-all",
              currentTab === 'messages' ? "scale-110 opacity-100" : "opacity-40 hover:opacity-100"
            )}
          >
            <MessageSquare className={cn("w-6 h-6", currentTab === 'messages' ? "text-hda-red" : (isDarkMode ? "text-slate-400" : "text-slate-600"))} />
            <span className={cn(
              "text-[10px] font-black uppercase tracking-widest",
              currentTab === 'messages' ? "text-hda-red" : (isDarkMode ? "text-slate-400" : "text-slate-600")
            )}>Messages</span>
          </button>
          <button 
            onClick={() => setCurrentTab('services')}
            className={cn(
              "flex flex-col items-center gap-1.5 transition-all",
              currentTab === 'services' ? "scale-110 opacity-100" : "opacity-40 hover:opacity-100"
            )}
          >
            <LayoutGrid className={cn("w-6 h-6", currentTab === 'services' ? "text-hda-red" : (isDarkMode ? "text-slate-400" : "text-slate-600"))} />
            <span className={cn(
              "text-[10px] font-black uppercase tracking-widest",
              currentTab === 'services' ? "text-hda-red" : (isDarkMode ? "text-slate-400" : "text-slate-600")
            )}>Services</span>
          </button>
          <button 
            onClick={() => setCurrentTab('settings')}
            className={cn(
              "flex flex-col items-center gap-1.5 transition-all",
              currentTab === 'settings' ? "scale-110 opacity-100" : "opacity-40 hover:opacity-100"
            )}
          >
            <SettingsIcon className={cn("w-6 h-6", currentTab === 'settings' ? "text-hda-red" : (isDarkMode ? "text-slate-400" : "text-slate-600"))} />
            <span className={cn(
              "text-[10px] font-black uppercase tracking-widest",
              currentTab === 'settings' ? "text-hda-red" : (isDarkMode ? "text-slate-400" : "text-slate-600")
            )}>Settings</span>
          </button>
        </nav>
      </main>

      {/* Side Menu Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={cn(
                "fixed top-0 right-0 bottom-0 w-[300px] shadow-2xl z-[101] flex flex-col transition-colors duration-300",
                isDarkMode ? "bg-slate-950 text-white" : "bg-white text-slate-900"
              )}
            >
              {/* Drawer Header */}
              <div className="h-20 border-b flex items-center justify-between px-6 shrink-0">
                <span className="text-[10px] font-black uppercase tracking-widest text-hda-red">
                  Meni Prensipal
                </span>
                <button 
                  onClick={() => setIsMenuOpen(false)}
                  className={cn("p-2 rounded-full transition-colors", isDarkMode ? "hover:bg-slate-800" : "hover:bg-slate-100")}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Kategori Yo</h3>
                  <div className="grid gap-2">
                    {SERVICES.slice(0, 5).map(s => (
                      <button 
                        key={s.id}
                        onClick={() => {
                          setInput(s.title);
                          setCurrentTab('messages');
                          setIsMenuOpen(false);
                        }}
                        className={cn(
                          "w-full text-left p-3 rounded-sm text-xs font-bold uppercase transition-colors flex items-center gap-3",
                          isDarkMode ? "hover:bg-slate-900 text-slate-300" : "hover:bg-slate-50 text-slate-600"
                        )}
                      >
                        <s.icon className="w-4 h-4 opacity-40" />
                        {s.title}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Enfòmasyon</h3>
                  <div className="grid gap-2">
                    <button className={cn(
                      "w-full text-left p-3 rounded-sm text-xs font-bold uppercase transition-colors flex items-center gap-3",
                      isDarkMode ? "hover:bg-slate-900 text-slate-300" : "hover:bg-slate-50 text-slate-600"
                    )}>
                      Sou Nou
                    </button>
                    <button className={cn(
                      "w-full text-left p-3 rounded-sm text-xs font-bold uppercase transition-colors flex items-center gap-3",
                      isDarkMode ? "hover:bg-slate-900 text-slate-300" : "hover:bg-slate-50 text-slate-600"
                    )}>
                      Kontakte N
                    </button>
                  </div>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-6 border-t">
                <a 
                  href="https://wa.me/50937944651"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-[#25D366] text-white py-3 rounded-sm font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-[#128C7E] transition-all"
                >
                  Ekri nou sou WhatsApp
                </a>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
