import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2 } from 'lucide-react';
import { ChatMessage } from '../types';

export default function ChatMode() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [interactionId, setInteractionId] = useState<string | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
      const res = await fetch(`${backendUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.text, previousInteractionId: interactionId })
      });
      const data = await res.json();
      
      if (data.error) {
         throw new Error(data.error);
      }

      setInteractionId(data.interactionId);
      
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: data.text,
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'ai',
        text: 'Sorry, I encountered an error. Please check the connection.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/60 rounded-2xl border-l border-b border-r border-cyan-500/20 overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="px-6 py-4 border-b border-cyan-500/10 bg-slate-950/50 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 border border-cyan-400/30 shadow-[0_0_10px_rgba(34,211,238,0.2)]">
          <Bot size={24} />
        </div>
        <div>
          <h2 className="font-mono text-xs tracking-wider text-cyan-400">LIVE DIALOGUE STREAM</h2>
          <p className="text-[10px] font-mono text-cyan-400/50 flex items-center gap-2 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block animate-pulse shadow-[0_0_5px_#22d3ee]"></span>
            SECURE LINK ESTABLISHED
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-cyan-500/50 space-y-4">
            <Bot size={48} className="opacity-20" />
            <p className="font-mono text-xs tracking-widest uppercase">Awaiting input sequence...</p>
          </div>
        )}
        
        {messages.map(msg => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} space-y-2`}>
            <div className={`text-[10px] font-mono opacity-50 uppercase tracking-widest ${msg.role === 'user' ? 'text-slate-400' : 'text-cyan-400'}`}>
              {msg.role === 'user' ? 'USER' : 'AURA'} • {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </div>
            <div className={`text-sm leading-relaxed max-w-[85%] ${
              msg.role === 'user' 
                ? 'bg-cyan-500/20 border border-cyan-400/40 rounded-2xl rounded-tr-none p-4 text-cyan-50 shadow-[0_0_15px_rgba(34,211,238,0.1)]' 
                : 'bg-slate-800/80 border border-cyan-500/20 rounded-2xl rounded-tl-none p-4 text-cyan-50/90'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex flex-col items-start space-y-2">
            <div className="text-[10px] font-mono opacity-50 uppercase tracking-widest text-cyan-400">
              AURA • {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </div>
            <div className="bg-slate-800/80 border border-cyan-500/20 rounded-2xl rounded-tl-none p-4 flex items-center">
              <span className="flex gap-1.5 opacity-60">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{animationDelay: '0ms'}}></span>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{animationDelay: '150ms'}}></span>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{animationDelay: '300ms'}}></span>
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-slate-950/80 border-t border-cyan-500/20">
        <form onSubmit={handleSubmit} className="flex gap-3 max-w-4xl mx-auto relative">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder="Command Aura..."
            className="w-full bg-slate-900 border border-cyan-500/30 rounded-xl py-3 pl-4 pr-14 text-sm focus:outline-none focus:border-cyan-400 placeholder-cyan-900 text-cyan-100 disabled:opacity-50"
          />
          <button 
            type="submit" 
            disabled={!input.trim() || loading}
            className="absolute right-2 top-1.5 w-9 h-9 rounded-lg bg-cyan-500/20 border border-cyan-400/40 hover:bg-cyan-500/30 flex items-center justify-center text-cyan-400 disabled:opacity-50 disabled:hover:bg-cyan-500/20 transition-colors"
          >
            <Send size={16} className="-translate-x-0.5 translate-y-0.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
