import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Activity, X, Bot, Maximize, Minimize, Settings2 } from 'lucide-react';
import { pcmToBase64, AudioStreamPlayer } from '../lib/audio';

export default function LiveMode() {
  const [isActive, setIsActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [micVolume, setMicVolume] = useState<number>(0);
  const [voice, setVoice] = useState('Aoede');
  const [avatarImage, setAvatarImage] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const visualizerRef = useRef<SVGSVGElement>(null);
  const avatarContainerRef = useRef<HTMLDivElement>(null);
  const isMutedRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const playerRef = useRef<AudioStreamPlayer>(new AudioStreamPlayer());
  const agentThinkingTimer = useRef<NodeJS.Timeout | null>(null);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const agentSpeakingRef = useRef(false);

  useEffect(() => {
    agentSpeakingRef.current = agentSpeaking;
  }, [agentSpeaking]);

  useEffect(() => {
    let animationFrameId: number;

    const updateVisualizer = () => {
      if (isActive) {
        if (visualizerRef.current) {
          const data = playerRef.current.getFrequencyData();
          const bars = visualizerRef.current.querySelectorAll('.bar');
          
          let targetHeights = Array(bars.length).fill(10);
          
          if (agentSpeaking && data) {
             for (let i = 0; i < bars.length; i++) {
                const val = data[i % data.length];
                targetHeights[i] = 10 + (val / 255) * 80; // Max outward height 90
             }
          }
          
          for (let i = 0; i < bars.length; i++) {
             const currentHeight = Math.abs(parseFloat((bars[i] as SVGLineElement).getAttribute('y2') || '-10'));
             const newHeight = currentHeight + (targetHeights[i] - currentHeight) * 0.25;
             (bars[i] as SVGLineElement).setAttribute('y2', `${-newHeight}`);
          }
        }

        if (avatarContainerRef.current) {
           if (agentSpeaking) {
             const volume = playerRef.current.getVolume();
             const intensity = 0.3 + (volume * 0.7); // 0.3 to 1.0
             const spread = 20 + (volume * 60); // 20px to 80px
             avatarContainerRef.current.style.boxShadow = `0 0 ${spread}px rgba(34, 211, 238, ${intensity})`;
             avatarContainerRef.current.style.borderColor = `rgba(34, 211, 238, ${0.4 + volume * 0.6})`;
           } else {
             avatarContainerRef.current.style.boxShadow = '';
             avatarContainerRef.current.style.borderColor = '';
           }
        }
      }
      animationFrameId = requestAnimationFrame(updateVisualizer);
    };

    if (isActive) {
      updateVisualizer();
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [isActive, agentSpeaking]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      stopLiveSession();
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current) {
          await containerRef.current.requestFullscreen();
        }
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("Error attempting to toggle fullscreen:", err);
    }
  };

  const sendVideoFrames = () => {
    if (!videoRef.current || !canvasRef.current || !wsRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    frameIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN && video.readyState === video.HAVE_ENOUGH_DATA) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
        const base64 = dataUrl.split(',')[1];
        wsRef.current.send(JSON.stringify({ image: base64 }));
      }
    }, 2000); // Send a frame every 2 seconds
  };

  const startLiveSession = async () => {
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || window.location.origin;
      const wsUrl = backendUrl.replace(/^http/, 'ws') + `/live?voice=${voice}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true, 
          autoGainControl: true 
        }, 
        video: { width: { max: 320 }, height: { max: 240 }, facingMode: "user" } 
      });
      streamRef.current = stream;
      
      // Setup hidden video for frame reading
      if (!videoRef.current) {
        const video = document.createElement('video');
        video.autoplay = true;
        video.playsInline = true;
        videoRef.current = video;
      }
      if (!canvasRef.current) {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 240;
        canvasRef.current = canvas;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
      }
      
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      
      const dummyGain = audioCtx.createGain();
      dummyGain.gain.value = 0;

      source.connect(processor);
      processor.connect(dummyGain);
      dummyGain.connect(audioCtx.destination);
      
      playerRef.current.init(audioCtx);

      processor.onaudioprocess = (e) => {
        // Zero out the output buffer to prevent local echo
        const outBuffer = e.outputBuffer.getChannelData(0);
        outBuffer.fill(0);

        if (ws.readyState === WebSocket.OPEN) {
           // Mute the user's mic completely when the AI is speaking to prevent feedback loops
           if (!isMutedRef.current && !agentSpeakingRef.current) {
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
             setMicVolume(Math.min(1, avg * 10)); // Scale for visualizer
           } else {
             setIsSpeaking(false);
             setMicVolume(0);
           }
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
          if (msg.generatedPhoto) {
             setAvatarImage(`data:image/jpeg;base64,${msg.generatedPhoto}`);
          }
        } catch(err) {
           console.error("Failed to parse message", err);
        }
      };

      ws.onopen = () => {
         sendVideoFrames();
      };

      ws.onclose = () => {
        stopLiveSession();
      };
      
      setIsActive(true);
    } catch (err: any) {
      console.error("Error starting live session:", err);
      if (err.name === "NotAllowedError" || err.message?.includes("Permission denied")) {
         alert("Microphone permission denied. Please allow microphone access in your browser to use Live Mode.");
      } else {
         alert(`Connection error: ${err.message || 'Could not start live session'}`);
      }
      stopLiveSession();
    }
  };

  const stopLiveSession = () => {
    if (frameIntervalRef.current) {
       clearInterval(frameIntervalRef.current);
       frameIntervalRef.current = null;
    }
    if (videoRef.current) {
       videoRef.current.pause();
       videoRef.current.srcObject = null;
    }
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
    setIsMuted(false);
    setMicVolume(0);
    isMutedRef.current = false;
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    isMutedRef.current = newMuted;
  };

  const changePose = (pose: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ text: `Please change your pose and show me a picture of you ${pose}.` }));
    }
  };

  return (
    <div ref={containerRef} className={`flex flex-col h-full bg-slate-900/40 border-cyan-500/20 overflow-hidden relative ${isFullscreen ? 'fixed inset-0 z-50 w-full h-full rounded-none border-none bg-slate-950' : 'rounded-2xl border'}`}>
      
      {/* Decorative bg glow */}
      <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
         <div className={`w-96 h-96 border border-cyan-500/20 rounded-full transition-opacity duration-1000 ${isActive ? 'opacity-100 animate-pulse' : 'opacity-0'}`}></div>
         <div className={`absolute w-80 h-80 border border-cyan-500/10 rounded-full transition-opacity duration-1000 ${isActive ? 'opacity-100' : 'opacity-0'}`}></div>
      </div>

      <button
        onClick={toggleFullscreen}
        className="absolute top-4 right-4 z-50 p-2 rounded-lg bg-slate-900/60 border border-cyan-500/30 text-cyan-500/70 hover:text-cyan-400 hover:bg-slate-800/80 transition-colors"
        title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
      >
        {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
      </button>

      <div className="flex flex-col h-full items-center justify-center z-10 p-8 relative">
        
        {/* Mini Face Box at the top */}
        <div 
          className={`absolute top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 overflow-hidden rounded-xl border-2 ${isActive ? (agentSpeaking ? 'border-cyan-400 shadow-[0_0_25px_rgba(34,211,238,0.6)] scale-110' : (isSpeaking ? 'border-green-400 shadow-[0_0_15px_rgba(74,222,128,0.4)] scale-[1.02] translate-y-[-2px]' : 'border-cyan-500/50 scale-100')) : 'opacity-0 scale-50 pointer-events-none'} w-24 h-24 bg-slate-900 flex items-center justify-center`}
          style={{ transform: isActive && isSpeaking ? `translate(-50%, ${-micVolume * 10}px) scale(${1 + micVolume * 0.1})` : 'translateX(-50%)' }}
        >
            {avatarImage ? (
                <img src={avatarImage} alt="Face" className={`w-full h-full object-cover transition-transform duration-300 ${agentSpeaking ? 'scale-125' : 'scale-110'}`} style={{ objectPosition: 'center 15%' }} />
            ) : (
                <Bot className={`w-10 h-10 text-cyan-400 transition-all duration-300 ${agentSpeaking ? 'scale-125' : 'scale-100'}`} />
            )}
            
            {/* User Speaking Indicator under the face */}
            {isSpeaking && (
               <div className="absolute bottom-0 inset-x-0 h-1 bg-green-400"></div>
            )}
        </div>

        {/* Core Visualization */}
        <div className="relative flex items-center justify-center mb-16">
           {/* Outer Ring */}
           <div className={`absolute w-64 h-64 rounded-full border border-cyan-500/30 transition-all duration-700 ${isActive ? 'scale-100 opacity-100 rotate-180' : 'scale-50 opacity-0'} ${agentSpeaking ? 'border-cyan-400' : ''}`}></div>
           {/* Middle Ring */}
           <div className={`absolute w-48 h-48 rounded-full border-2 border-cyan-500/40 border-dashed transition-all duration-1000 ${isActive ? 'scale-100 opacity-100 -rotate-90' : 'scale-50 opacity-0'} ${agentSpeaking ? 'animate-[spin_4s_linear_infinite]' : ''}`}></div>
           
           {/* Dynamic Circular Audio Visualizer */}
           <svg 
             ref={visualizerRef} 
             className={`absolute pointer-events-none transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-0'}`} 
             style={{ width: '800px', height: '800px', zIndex: 0 }}
             viewBox="-400 -400 800 800"
           >
             {Array.from({ length: 90 }).map((_, i) => {
               const angle = (i / 90) * 360;
               // Adjust radius if rectangular avatar Image is present
               const isImage = !!avatarImage;
               // A rounded rectangle might need an elliptical radius, or just a large enough circular radius
               let radius = isImage ? 260 : 80;
               // For a rectangle (320x448), diagonal is ~550. Radius of 260 is diameter 520, which is enough
               // to be somewhat outside most of it, but maybe we adjust it dynamically using CSS or just keep it simple.
               return (
                 <g key={i} transform={`rotate(${angle}) translate(0, ${-radius})`} className="transition-transform duration-500">
                   <line
                     className="bar transition-colors duration-300"
                     x1="0"
                     y1="0"
                     x2="0"
                     y2="-10"
                     stroke="currentColor"
                     strokeWidth="4"
                     strokeLinecap="round"
                     style={{ color: agentSpeaking ? '#22d3ee' : 'rgba(34, 211, 238, 0.2)' }}
                   />
                 </g>
               )
             })}
           </svg>

           {/* Center Core / Character Viewer */}
           <div 
             ref={avatarContainerRef}
             className={`avatar-container z-10 transition-colors duration-200 relative overflow-hidden flex items-center justify-center ${isActive ? (agentSpeaking ? 'animate-heartbeat-fast' : 'animate-heartbeat border-cyan-600') : 'border-cyan-500/30 bg-slate-900/50'} ${avatarImage ? 'h-[28rem] w-[20rem] rounded-3xl border-2' : 'w-32 h-32 rounded-full border-4'}`}
           >
              <div className={`absolute inset-0 bg-gradient-to-t from-cyan-900/40 to-transparent transition-all duration-500 ${agentSpeaking ? 'opacity-100' : 'opacity-0'}`}></div>
              {isActive ? (
                avatarImage ? (
                   <img 
                      src={avatarImage} 
                      className={`w-full h-full object-cover transition-all duration-300 ${agentSpeaking ? 'animate-speaking scale-105' : 'animate-breathing scale-100'} ${isSpeaking ? '-translate-y-1' : ''}`}
                      alt="Aura Avatar" 
                   />
                ) : (
                  <Activity size={32} className={`text-cyan-400 transition-all ${agentSpeaking ? 'animate-pulse scale-110' : ''}`} />
                )
              ) : (
                <Bot size={32} className="text-cyan-600/50" />
              )}
           </div>

           {/* User Input Visualizer */}
           {isActive && (
              <div className="absolute -bottom-16 flex gap-1 items-end justify-center h-12">
                 {[...Array(7)].map((_, i) => {
                    const factor = 1 - Math.abs(i - 3) * 0.25; 
                    const height = Math.max(8, micVolume * 48 * factor);
                    return (
                        <div 
                          key={i} 
                          className={`w-2 rounded-full transition-all duration-75 ${isMuted ? 'bg-amber-500/50' : 'bg-cyan-400'}`} 
                          style={{ height: `${isMuted ? 4 : height}px` }}
                        ></div>
                    );
                 })}
              </div>
           )}
        </div>

        {/* Info Text */}
        <div className="text-center mb-12 h-16">
           <h3 className="text-3xl font-light tracking-[0.2em] text-cyan-100 mb-2">
             {isActive ? (agentSpeaking ? "AURA RESPONDING" : (isMuted ? "MIC MUTEX" : "LISTENING...")) : "SYSTEM STANDBY"}
           </h3>
           <p className="font-mono text-xs uppercase tracking-widest text-cyan-400/60">
             {isActive ? (isMuted ? "Input transmission paused" : "Real-time Neural Link Active") : "Initialize live sequence to begin."}
           </p>
        </div>

        {/* Controls */}
        <div>
           {isActive ? (
             <div className="flex flex-col items-center gap-6">
               <div className="flex items-center gap-4">
                 <button
                   onClick={toggleMute}
                   className={`flex items-center gap-2 px-8 py-4 rounded-full border transition-colors font-mono text-xs uppercase tracking-widest ${
                     isMuted 
                       ? 'bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.2)]' 
                       : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/20'
                   }`}
                 >
                   {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                   {isMuted ? "Muted" : "Mute"}
                 </button>
                 <button
                   onClick={stopLiveSession}
                   className="flex items-center gap-2 px-8 py-4 rounded-full bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors font-mono text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(239,68,68,0.2)]"
                 >
                   <X size={16} />
                   End Session
                 </button>
               </div>
               <div className="flex items-center gap-3">
                 <span className="text-cyan-500/60 font-mono text-xs uppercase">Pose:</span>
                 <div className="flex items-center gap-2">
                   <select 
                     onChange={(e) => {
                       if (e.target.value) changePose(e.target.value);
                       e.target.value = "";
                     }}
                     className="bg-slate-900/80 border border-cyan-500/30 rounded-lg px-3 py-1.5 text-cyan-400 font-mono text-xs uppercase focus:outline-none focus:border-cyan-400/60 appearance-none text-center"
                   >
                     <option value="">Presets...</option>
                     <option value="standing and smiling">Standing</option>
                     <option value="sitting relaxed">Sitting</option>
                     <option value="waving hello">Waving</option>
                     <option value="thinking deeply">Thinking</option>
                   </select>
                   <form 
                     onSubmit={(e) => {
                       e.preventDefault();
                       const form = e.target as HTMLFormElement;
                       const input = form.elements.namedItem('customPose') as HTMLInputElement;
                       if (input.value.trim()) {
                         changePose(input.value.trim());
                         input.value = "";
                       }
                     }}
                     className="flex items-center gap-2"
                   >
                     <input 
                       type="text"
                       name="customPose"
                       placeholder="Custom pose..."
                       className="bg-slate-900/80 border border-cyan-500/30 rounded-lg px-3 py-1.5 text-cyan-400 font-mono text-xs placeholder:text-cyan-500/40 focus:outline-none focus:border-cyan-400/60 w-48"
                     />
                     <button type="submit" className="px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 font-mono text-xs uppercase transition-colors">
                       Send
                     </button>
                   </form>
                 </div>
               </div>
             </div>
           ) : (
             <div className="flex flex-col items-center gap-6">
               <button
                 onClick={startLiveSession}
                 className="flex items-center gap-2 px-8 py-4 rounded-full bg-cyan-500/20 border border-cyan-400/40 hover:bg-cyan-500/30 text-cyan-50 transition-colors shadow-[0_0_20px_rgba(34,211,238,0.2)] font-mono text-xs uppercase tracking-widest"
               >
                 <Mic size={16} />
                 Initialize Connection
               </button>
               
               <div className="flex items-center gap-3">
                 <Settings2 size={16} className="text-cyan-500/60" />
                 <select 
                   value={voice}
                   onChange={(e) => setVoice(e.target.value)}
                   className="bg-slate-900/80 border border-cyan-500/30 rounded-lg px-3 py-1.5 text-cyan-400 font-mono text-xs uppercase focus:outline-none focus:border-cyan-400/60 appearance-none text-center"
                 >
                   <option value="Aoede">Voice: Aoede</option>
                   <option value="Puck">Voice: Puck</option>
                   <option value="Charon">Voice: Charon</option>
                   <option value="Kore">Voice: Kore</option>
                   <option value="Fenrir">Voice: Fenrir</option>
                   <option value="Zephyr">Voice: Zephyr</option>
                 </select>
               </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
