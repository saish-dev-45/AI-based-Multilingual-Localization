/**
 * AudioRecorder: High-fidelity microphone recorder producing standard 16-bit 16kHz mono WAV audio.
 *
 * Why WAV:
 * 1. Groq Whisper / OpenAI models natively operate on 16kHz PCM audio.
 * 2. Avoids WebM container issues (missing duration, EBML cue header flaws in Chrome MediaRecorder).
 * 3. Guarantees 100% compatibility across Chrome, Edge, Firefox, and Safari without 'invalid_media_file' errors.
 * 4. HTML5 <audio> element correctly displays length, scrubber, and playback.
 */

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function floatTo16BitPCM(view, offset, input) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
}

function downsampleBuffer(buffer, sampleRate, outSampleRate) {
  if (outSampleRate === sampleRate) {
    return buffer;
  }
  if (outSampleRate > sampleRate) {
    return buffer;
  }
  const sampleRateRatio = sampleRate / outSampleRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

export function encodeWAV(samples, sampleRate = 16000) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* file length */
  view.setUint32(4, 36 + samples.length * 2, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw PCM = 1) */
  view.setUint16(20, 1, true);
  /* channel count (mono = 1) */
  view.setUint16(22, 1, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * 2, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, 2, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, samples.length * 2, true);

  floatTo16BitPCM(view, 44, samples);

  return new Blob([buffer], { type: 'audio/wav' });
}

export class WavAudioRecorder {
  constructor() {
    this.audioContext = null;
    this.mediaStream = null;
    this.sourceNode = null;
    this.scriptProcessor = null;
    this.muteGain = null;
    this.chunks = [];
    this.targetSampleRate = 16000;
    this.recording = false;
  }

  async start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone audio recording is not supported in this browser.');
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error('Web Audio API is not supported in this browser.');
    }

    this.audioContext = new AudioContextClass();
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    const sourceSampleRate = this.audioContext.sampleRate;
    this.chunks = [];

    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    // Buffer size 4096 gives smooth streaming (~90ms per buffer at 44.1kHz)
    this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.scriptProcessor.onaudioprocess = (e) => {
      if (!this.recording) return;
      const inputData = e.inputBuffer.getChannelData(0);
      const downsampled = downsampleBuffer(inputData, sourceSampleRate, this.targetSampleRate);
      this.chunks.push(new Float32Array(downsampled));
    };

    // Mute gain to prevent microphone feedback loop through speakers
    this.muteGain = this.audioContext.createGain();
    this.muteGain.gain.value = 0;

    this.sourceNode.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.muteGain);
    this.muteGain.connect(this.audioContext.destination);

    this.recording = true;
  }

  async stop() {
    this.recording = false;

    // Disconnect audio nodes
    try {
      if (this.scriptProcessor) {
        this.scriptProcessor.disconnect();
        this.scriptProcessor.onaudioprocess = null;
        this.scriptProcessor = null;
      }
      if (this.muteGain) {
        this.muteGain.disconnect();
        this.muteGain = null;
      }
      if (this.sourceNode) {
        this.sourceNode.disconnect();
        this.sourceNode = null;
      }
    } catch {
      /* ignore disconnect errors */
    }

    // Stop microphone tracks so browser mic indicator turns off
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        await this.audioContext.close();
      } catch {
        /* ignore close errors */
      }
      this.audioContext = null;
    }

    // Concatenate chunks
    const totalLength = this.chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    if (totalLength === 0) {
      throw new Error('No audio was captured. Please speak into your microphone and try again.');
    }

    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    this.chunks = [];

    // Encode to 16kHz mono 16-bit PCM WAV
    const wavBlob = encodeWAV(merged, this.targetSampleRate);
    const duration = totalLength / this.targetSampleRate;

    return {
      blob: wavBlob,
      duration,
      sampleRate: this.targetSampleRate,
    };
  }

  cancel() {
    this.recording = false;
    this.chunks = [];

    try {
      if (this.scriptProcessor) {
        this.scriptProcessor.disconnect();
        this.scriptProcessor.onaudioprocess = null;
        this.scriptProcessor = null;
      }
      if (this.muteGain) {
        this.muteGain.disconnect();
        this.muteGain = null;
      }
      if (this.sourceNode) {
        this.sourceNode.disconnect();
        this.sourceNode = null;
      }
    } catch {
      /* ignore */
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }
}
