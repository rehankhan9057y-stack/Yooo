/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import ChatMode from './components/ChatMode';
import LiveMode from './components/LiveMode';
import { Mode } from './types';
import { MessageSquare, Radio, Settings, Bot } from 'lucide-react';

export default function App() {
  const [mode, setMode] = useState<Mode>('landing');

  if (mode === 'landing') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen relative w-full overflow-hidden bg-[#020617] text-cyan-50 select-none">
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #22d3ee 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(34, 211, 238, 0.05) 0%, transparent 70%)' }}></div>
        
        <div className="z-10 flex flex-col items-center text-center space-y-12 p-6">
          <div className="relative">
            <div className="absolute inset-0 rounded-full border border-cyan-500/30 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
            <div className="w-48 h-48 rounded-full border border-cyan-500/30 flex items-center justify-center shadow-[0_0_80px_rgba(34,211,238,0.2)] relative z-10 bg-[#020617]/50 backdrop-blur-sm">
              <div className="w-24 h-24 rounded-full border-2 border-cyan-400 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-cyan-400 shadow-[0_0_30px_#22d3ee]"></div>
              </div>
            </div>
          </div>
          
          <div className="space-y-6 max-w-2xl">
            <h1 className="text-5xl md:text-7xl font-light tracking-[0.3em] text-cyan-100 ml-4">AURA</h1>
            <p className="text-cyan-400/70 font-mono text-sm uppercase tracking-[0.2em] leading-relaxed">
              Advanced Neural Companion <br/> 
              <span className="opacity-60 text-xs">Voice & Text Interface System // Online</span>
            </p>
          </div>
          
          <button 
            onClick={() => setMode('live')}
            className="mt-8 px-12 py-5 border border-cyan-400/50 rounded-full font-mono text-xs uppercase tracking-[0.2em] text-cyan-50 hover:bg-cyan-900/30 hover:border-cyan-300 transition-all shadow-[0_0_20px_rgba(34,211,238,0.15)] hover:shadow-[0_0_40px_rgba(34,211,238,0.3)] relative overflow-hidden group">
            <span className="relative z-10">Initialize Sequence</span>
            <div className="absolute inset-0 bg-cyan-400/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
          </button>
        </div>

        <div className="absolute bottom-8 text-[10px] font-mono text-cyan-400/40 tracking-[0.2em] uppercase">
          Neural Sync: 99.8% // Latency: 12ms
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#020617] text-cyan-50 overflow-hidden font-sans relative select-none">
      
      {/* Background gradients */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #22d3ee 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(34, 211, 238, 0.05) 0%, transparent 70%)' }}></div>

      {/* Sidebar Nav */}
      <div className="w-20 md:w-64 border-r border-cyan-500/20 bg-slate-950/40 backdrop-blur-md flex flex-col items-center md:items-stretch py-8 z-20">
        <div className="flex items-center gap-3 px-0 md:px-6 mb-12 justify-center md:justify-start">
          <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee] flex-shrink-0"></div>
          <span className="font-mono text-xs tracking-widest text-cyan-400 hidden md:block">AURA SYSTEM // ONLINE</span>
        </div>

        <nav className="flex-1 px-4 space-y-4 font-mono text-xs tracking-widest uppercase">
          <button
            onClick={() => setMode('live')}
            className={`w-full flex items-center gap-3 px-0 justify-center md:justify-start md:px-4 py-3 rounded-xl transition-all ${
              mode === 'live' 
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-[0_0_15px_rgba(34,211,238,0.1)]' 
                : 'text-cyan-400/50 hover:text-cyan-300 hover:bg-cyan-500/5 border border-transparent'
            }`}
          >
            <Radio size={16} className={mode === 'live' ? 'animate-pulse' : ''} />
            <span className="hidden md:block">Live Dialogue</span>
          </button>
          
          <button
            onClick={() => setMode('chat')}
            className={`w-full flex items-center gap-3 px-0 justify-center md:justify-start md:px-4 py-3 rounded-xl transition-all ${
              mode === 'chat' 
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-[0_0_15px_rgba(34,211,238,0.1)]' 
                : 'text-cyan-400/50 hover:text-cyan-300 hover:bg-cyan-500/5 border border-transparent'
            }`}
          >
            <MessageSquare size={16} />
            <span className="hidden md:block">Text Interface</span>
          </button>
        </nav>

        <div className="px-4 mt-auto font-mono text-xs tracking-widest uppercase">
          <button
             className="w-full flex items-center gap-3 px-0 justify-center md:justify-start md:px-4 py-3 rounded-xl text-cyan-400/50 hover:text-cyan-300 hover:bg-cyan-500/5 transition-colors border border-transparent"
          >
            <Settings size={16} />
            <span className="hidden md:block">Preferences</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 relative p-4 md:p-8 z-10 overflow-hidden flex flex-col">
        <div className="h-full w-full max-w-5xl mx-auto">
           {mode === 'chat' ? <ChatMode /> : <LiveMode />}
        </div>
      </main>
    </div>
  );
}
