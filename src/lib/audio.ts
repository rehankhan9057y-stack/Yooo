/**
 * Converts Float32Array PCM data from the Web Audio API to base64 string.
 */
export function pcmToBase64(pcmData: Float32Array): string {
  // Convert float32 to int16
  const int16Data = new Int16Array(pcmData.length);
  for (let i = 0; i < pcmData.length; i++) {
    const s = Math.max(-1, Math.min(1, pcmData[i]));
    int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  
  // Convert int16 to byte array
  const buffer = new ArrayBuffer(int16Data.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < int16Data.length; i++) {
    view.setInt16(i * 2, int16Data[i], true); // true for little-endian
  }
  
  // Convert byte array to base64
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
}

/**
 * Handles gapless audio playback from base64 chunks.
 */
export class AudioStreamPlayer {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private nextStartTime: number = 0;
  private isPlaying: boolean = false;
  
  init(ctx: AudioContext) {
    this.audioCtx = ctx;
    this.nextStartTime = ctx.currentTime;
    this.isPlaying = true;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.connect(ctx.destination);
  }

  playChunk(base64Audio: string) {
    if (!this.audioCtx || !this.isPlaying || !this.analyser) return;
    
    // Decode base64 to Int16Array
    const binary = atob(base64Audio);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const int16Data = new Int16Array(bytes.buffer);
    
    // Convert to Float32Array
    const float32Data = new Float32Array(int16Data.length);
    for (let i = 0; i < int16Data.length; i++) {
      float32Data[i] = int16Data[i] / (int16Data[i] < 0 ? 0x8000 : 0x7FFF);
    }
    
    // Create AudioBuffer
    const audioBuffer = this.audioCtx.createBuffer(1, float32Data.length, 24000); // Response is 24kHz
    audioBuffer.getChannelData(0).set(float32Data);
    
    // Schedule playback
    const source = this.audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.analyser);
    
    const currentTime = this.audioCtx.currentTime;
    if (this.nextStartTime < currentTime) {
      this.nextStartTime = currentTime;
    }
    
    source.start(this.nextStartTime);
    this.nextStartTime += audioBuffer.duration;
  }

  getVolume(): number {
    if (!this.analyser) return 0;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    return (sum / dataArray.length) / 255.0;
  }

  getFrequencyData(): Uint8Array | null {
    if (!this.analyser) return null;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  interrupt() {
    this.isPlaying = false;
    // We can't easily cancel already scheduled Web Audio API buffer sources without keeping track of all of them.
    // An alternative is to suspend the context and create a new one, or just stop keeping state.
    if (this.audioCtx) {
       this.nextStartTime = this.audioCtx.currentTime;
    }
    setTimeout(() => {
        this.isPlaying = true; 
    }, 100);
  }
}
