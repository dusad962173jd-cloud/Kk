export class AudioRecorder {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  async start(onData: (base64: string) => void) {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      
      this.context = new AudioContext({ sampleRate: 16000 });
      await this.context.resume();
      
      this.source = this.context.createMediaStreamSource(this.stream);
      
      // Use AudioWorklet instead of ScriptProcessorNode for much better performance
      // especially on mobile devices (runs off the main thread).
      const workletCode = `
        class PCMProcessor extends AudioWorkletProcessor {
          constructor() {
            super();
            this.buffer = new Int16Array(2048);
            this.offset = 0;
          }
          process(inputs, outputs, parameters) {
            const input = inputs[0];
            if (input && input.length > 0) {
              const channelData = input[0];
              for (let i = 0; i < channelData.length; i++) {
                this.buffer[this.offset++] = Math.max(-1, Math.min(1, channelData[i])) * 0x7FFF;
                if (this.offset >= this.buffer.length) {
                  const copy = new Int16Array(this.buffer);
                  this.port.postMessage(copy.buffer, [copy.buffer]);
                  this.offset = 0;
                }
              }
            }
            return true;
          }
        }
        registerProcessor('pcm-processor', PCMProcessor);
      `;
      
      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      
      await this.context.audioWorklet.addModule(workletUrl);
      this.workletNode = new AudioWorkletNode(this.context, 'pcm-processor');
      
      this.workletNode.port.onmessage = (e) => {
        const buffer = new Uint8Array(e.data);
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < buffer.length; i += chunkSize) {
          binary += String.fromCharCode.apply(null, Array.from(buffer.subarray(i, i + chunkSize)));
        }
        onData(btoa(binary));
      };

      this.source.connect(this.workletNode);
      this.workletNode.connect(this.context.destination);
    } catch (error) {
      console.error("Error starting audio capture:", error);
      throw error;
    }
  }

  stop() {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.context) {
      this.context.close();
      this.context = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
  }
}

export class AudioPlayer {
  private context: AudioContext | null = null;
  private nextTime: number = 0;
  private sources: AudioBufferSourceNode[] = [];

  constructor() {
    this.context = new AudioContext({ sampleRate: 24000 });
  }

  async play(base64: string) {
    if (!this.context) return;
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
    
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    const pcm = new Int16Array(bytes.buffer);
    const floats = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) {
      floats[i] = pcm[i] / 0x7FFF;
    }

    const buffer = this.context.createBuffer(1, floats.length, 24000);
    buffer.getChannelData(0).set(floats);

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);

    // Tighter jitter buffer for lower latency
    if (this.nextTime < this.context.currentTime) {
      this.nextTime = this.context.currentTime + 0.02;
    }
    
    source.start(this.nextTime);
    this.nextTime += buffer.duration;
    this.sources.push(source);

    source.onended = () => {
      this.sources = this.sources.filter(s => s !== source);
    };
  }

  stop() {
    this.sources.forEach(s => {
      try { s.stop(); } catch (e) {}
    });
    this.sources = [];
    this.nextTime = 0;
  }

  close() {
    this.stop();
    if (this.context) {
      this.context.close();
      this.context = null;
    }
  }
}
