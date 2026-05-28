import React, { useState, useEffect, useRef } from 'react';
import { Mic, Activity, X, Bot } from 'lucide-react';
import { pcmToBase64, AudioStreamPlayer } from '../lib/audio';

export default function LiveMode() {
  const [isActive, setIsActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false); // Whether the user is speaking (approximate based on volume level later if needed)
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const playerRef = useRef<AudioStreamPlayer>(new AudioStreamPlayer());
  const agentThinkingTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      stopLiveSession();
    };
  }, []);

  const startLiveSession = async () => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/live`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      
      source.connect(processor);
      processor.connect(audioCtx.destination);
      
      playerRef.current.init(audioCtx);

      processor.onaudioprocess = (e) => {
        if (ws.readyState === WebSocket.OPEN) {
           const base64 = pcmToBase64(e.inputBuffer.getChannelData(0));
           ws.send(JSON.stringify({ audio: base64 }));
           
           // Simple volume meter logic to animate mic
           const data = e.inputBuffer.getChannelData(0);
           let sum = 0;
           for(let i=0; i<data.length; i++) {
               sum += Math.abs(data[i]);
           }
           const avg = sum / data.length;
           setIsSpeaking(avg > 0.02);
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.audio) {
            setAgentSpeaking(true);
            if(agentThinkingTimer.current) clearTimeout(agentThinkingTimer.current);
            // reset speaking later if no audio arrived
            agentThinkingTimer.current = setTimeout(() => setAgentSpeaking(false), 500); 
            playerRef.current.playChunk(msg.audio);
          }
          if (msg.interrupted) {
            playerRef.current.interrupt();
            setAgentSpeaking(false);
          }
          if (msg.turnComplete) {
            setAgentSpeaking(false);
          }
        } catch(err) {
           console.error("Failed to parse message", err);
        }
      };

      ws.onclose = () => {
        stopLiveSession();
      };
      
      setIsActive(true);
    } catch (err) {
      console.error("Error starting live session:", err);
      stopLiveSession();
    }
  };

  const stopLiveSession = () => {
    if (processorRef.current && audioCtxRef.current) {
      processorRef.current.disconnect();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(()=>{});
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }
    playerRef.current.interrupt(); // stop playing
    setIsActive(false);
    setIsSpeaking(false);
    setAgentSpeaking(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/40 rounded-2xl border border-cyan-500/20 overflow-hidden relative">
      
      {/* Decorative bg glow */}
      <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
         <div className={`w-96 h-96 border border-cyan-500/20 rounded-full transition-opacity duration-1000 ${isActive ? 'opacity-100 animate-pulse' : 'opacity-0'}`}></div>
         <div className={`absolute w-80 h-80 border border-cyan-500/10 rounded-full transition-opacity duration-1000 ${isActive ? 'opacity-100' : 'opacity-0'}`}></div>
      </div>

      <div className="flex flex-col h-full items-center justify-center z-10 p-8">
        
        {/* Core Visualization */}
        <div className="relative flex items-center justify-center mb-16">
           {/* Outer Ring */}
           <div className={`absolute w-64 h-64 rounded-full border border-cyan-500/30 transition-all duration-700 ${isActive ? 'scale-100 opacity-100 rotate-180' : 'scale-50 opacity-0'} ${agentSpeaking ? 'border-cyan-400' : ''}`}></div>
           {/* Middle Ring */}
           <div className={`absolute w-48 h-48 rounded-full border-2 border-cyan-500/40 border-dashed transition-all duration-1000 ${isActive ? 'scale-100 opacity-100 -rotate-90' : 'scale-50 opacity-0'} ${agentSpeaking ? 'animate-[spin_4s_linear_infinite]' : ''}`}></div>
           
           {/* Center Core */}
           <div className={`w-32 h-32 rounded-full border-4 transition-all duration-300 flex items-center justify-center relative overflow-hidden ${isActive ? (agentSpeaking ? 'border-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.6)]' : 'border-cyan-600') : 'border-cyan-500/30 bg-slate-900/50'}`}>
              <div className={`absolute inset-0 bg-cyan-500/20 transition-all duration-200 ${agentSpeaking ? 'scale-110 opacity-100' : 'scale-75 opacity-0'}`}></div>
              {isActive ? (
                <Activity size={32} className={`text-cyan-400 transition-all ${agentSpeaking ? 'animate-pulse scale-110' : ''}`} />
              ) : (
                <Bot size={32} className="text-cyan-600/50" />
              )}
           </div>

           {/* User speaking indicator bubbles */}
           {isActive && (
              <div className="absolute -bottom-8 flex gap-1 items-center justify-center">
                 <div className={`w-2 h-2 rounded-full bg-cyan-400 transition-all ${isSpeaking ? 'h-4' : ''}`}></div>
                 <div className={`w-2 h-2 rounded-full bg-cyan-400 transition-all ${isSpeaking ? 'h-6' : ''} delay-75`}></div>
                 <div className={`w-2 h-2 rounded-full bg-cyan-400 transition-all ${isSpeaking ? 'h-4' : ''} delay-150`}></div>
              </div>
           )}
        </div>

        {/* Info Text */}
        <div className="text-center mb-12 h-16">
           <h3 className="text-3xl font-light tracking-[0.2em] text-cyan-100 mb-2">
             {isActive ? (agentSpeaking ? "AURA RESPONDING" : "LISTENING...") : "SYSTEM STANDBY"}
           </h3>
           <p className="font-mono text-xs uppercase tracking-widest text-cyan-400/60">
             {isActive ? "Real-time Neural Link Active" : "Initialize live sequence to begin."}
           </p>
        </div>

        {/* Controls */}
        <div>
           {isActive ? (
             <button
               onClick={stopLiveSession}
               className="flex items-center gap-2 px-8 py-4 rounded-full bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors font-mono text-xs uppercase tracking-widest"
             >
               <X size={16} />
               End Session
             </button>
           ) : (
             <button
               onClick={startLiveSession}
               className="flex items-center gap-2 px-8 py-4 rounded-full bg-cyan-500/20 border border-cyan-400/40 hover:bg-cyan-500/30 text-cyan-50 transition-colors shadow-[0_0_20px_rgba(34,211,238,0.2)] font-mono text-xs uppercase tracking-widest"
             >
               <Mic size={16} />
               Initialize Connection
             </button>
           )}
        </div>
      </div>
    </div>
  );
}
