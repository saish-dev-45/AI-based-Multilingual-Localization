import { useEffect, useRef, useState } from 'react';
import {
  CheckIcon,
  DownloadIcon,
  FileIcon,
  MicIcon,
  PauseIcon,
  RefreshIcon,
  SendIcon,
  SquareIcon,
  UploadIcon,
  VolumeIcon,
} from './Icons';
import { generateSpeech, transcribeAudio } from '../api/localize';
import { WavAudioRecorder } from '../utils/audioRecorder';

const INPUT_LANGUAGES = [
  { label: '✨ Auto-detect Spoken Language', value: '' },
  { label: 'English (English — en)', value: 'en' },
  { label: 'Hindi (हिन्दी — hi)', value: 'hi' },
  { label: 'Marathi (मराठी — mr)', value: 'mr' },
  { label: 'Gujarati (ગુજરાતી — gu)', value: 'gu' },
  { label: 'Bengali (বাংলা — bn)', value: 'bn' },
  { label: 'Tamil (தமிழ் — ta)', value: 'ta' },
  { label: 'Telugu (తెలుగు — te)', value: 'te' },
  { label: 'Kannada (ಕನ್ನಡ — kn)', value: 'kn' },
];

const OUTPUT_LANGUAGES = [
  { label: '🇮🇳 Hindi (हिन्दी)', value: 'Hindi' },
  { label: '🚩 Marathi (मराठी)', value: 'Marathi' },
  { label: '🇬🇧 English (English)', value: 'English' },
  { label: '📝 Original Transcript Only (No Translation)', value: '' },
];

function formatTime(seconds) {
  if (isNaN(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export default function SpeechToTextStudio({ onSendToTranslate }) {
  const [tab, setTab] = useState('record'); // 'record' | 'upload'
  const [selectedLanguage, setSelectedLanguage] = useState(''); // Input language (empty = auto-detect)
  const [targetLanguage, setTargetLanguage] = useState('Hindi'); // Output translation language
  const [tone, setTone] = useState('natural');

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);

  // File Upload State
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Processing State
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState('');

  // Results State
  const [transcribedText, setTranscribedText] = useState('');
  const [detectedLanguage, setDetectedLanguage] = useState('');
  const [localizedText, setLocalizedText] = useState('');
  const [audioDuration, setAudioDuration] = useState(0);

  // Clipboard States
  const [copiedOriginal, setCopiedOriginal] = useState(false);
  const [copiedLocalized, setCopiedLocalized] = useState(false);

  // Speech playback states
  const [isPlayingOriginalTTS, setIsPlayingOriginalTTS] = useState(false);
  const [isGeneratingOriginalTTS, setIsGeneratingOriginalTTS] = useState(false);
  const originalTtsAudioRef = useRef(null);

  const [isPlayingLocalizedTTS, setIsPlayingLocalizedTTS] = useState(false);
  const [isGeneratingLocalizedTTS, setIsGeneratingLocalizedTTS] = useState(false);
  const localizedTtsAudioRef = useRef(null);

  // Recorder and Timer refs
  const wavRecorderRef = useRef(null);
  const timerRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (wavRecorderRef.current) {
        wavRecorderRef.current.cancel();
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (originalTtsAudioRef.current) {
        originalTtsAudioRef.current.pause();
      }
      if (localizedTtsAudioRef.current) {
        localizedTtsAudioRef.current.pause();
      }
    };
  }, [audioUrl]);

  /* ── Live Recording Handlers ── */

  async function startRecording() {
    setError('');
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }

    try {
      const recorder = new WavAudioRecorder();
      await recorder.start();
      wavRecorderRef.current = recorder;

      setIsRecording(true);
      setRecordSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      setError(
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? 'Microphone permission was denied. Please allow microphone access in your browser settings.'
          : `Failed to access microphone: ${err.message}`
      );
      setIsRecording(false);
    }
  }

  async function stopRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);

    if (wavRecorderRef.current) {
      try {
        const { blob } = await wavRecorderRef.current.stop();
        wavRecorderRef.current = null;

        if (blob.size < 500) {
          setError('No audio captured. Please speak clearly into your microphone and try again.');
          return;
        }

        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);

        // Auto-transcribe once recorded
        handleTranscribe(blob);
      } catch (err) {
        setError(err.message || 'Failed to complete audio recording.');
      }
    }
  }

  function cancelRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (wavRecorderRef.current) {
      wavRecorderRef.current.cancel();
      wavRecorderRef.current = null;
    }
    setIsRecording(false);
    setRecordSeconds(0);
  }

  /* ── File Upload Handlers ── */

  function handleFileSelected(file) {
    if (!file) return;
    setError('');

    if (file.size > 25 * 1024 * 1024) {
      setError('Audio file exceeds the 25 MB limit.');
      return;
    }

    setUploadedFile(file);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    setAudioBlob(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelected(file);
  }

  /* ── Transcription Execution ── */

  async function handleTranscribe(blobToTranscribe) {
    const target = blobToTranscribe || audioBlob;
    if (!target) {
      setError('Please record audio or upload an audio file first.');
      return;
    }

    setIsTranscribing(true);
    setError('');
    try {
      const res = await transcribeAudio(
        target,
        selectedLanguage || undefined,
        targetLanguage || undefined,
        tone
      );

      setTranscribedText(res.text || '');
      setDetectedLanguage(res.detected_language || '');
      setLocalizedText(res.localized_text || '');
      setAudioDuration(res.duration || 0);
    } catch (err) {
      setError(err.message || 'Speech transcription failed. Please check your backend connection.');
    } finally {
      setIsTranscribing(false);
    }
  }

  /* ── Utility Actions ── */

  async function handleCopy(text, setCopiedFn) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFn(true);
      setTimeout(() => setCopiedFn(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  function handleDownloadTxt(text, filenamePrefix = 'transcription') {
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenamePrefix}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handlePlayOriginalTTS() {
    if (isPlayingOriginalTTS && originalTtsAudioRef.current) {
      originalTtsAudioRef.current.pause();
      setIsPlayingOriginalTTS(false);
      return;
    }

    if (!transcribedText) return;

    setIsGeneratingOriginalTTS(true);
    try {
      const lang = detectedLanguage.toLowerCase().includes('hindi')
        ? 'Hindi'
        : detectedLanguage.toLowerCase().includes('marathi')
        ? 'Marathi'
        : 'English';

      const blob = await generateSpeech(transcribedText, lang);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      originalTtsAudioRef.current = audio;

      audio.onended = () => setIsPlayingOriginalTTS(false);
      audio.onerror = () => setIsPlayingOriginalTTS(false);

      await audio.play();
      setIsPlayingOriginalTTS(true);
    } catch (err) {
      setError(err.message || 'Voice playback failed.');
    } finally {
      setIsGeneratingOriginalTTS(false);
    }
  }

  async function handlePlayLocalizedTTS() {
    if (isPlayingLocalizedTTS && localizedTtsAudioRef.current) {
      localizedTtsAudioRef.current.pause();
      setIsPlayingLocalizedTTS(false);
      return;
    }

    if (!localizedText) return;

    setIsGeneratingLocalizedTTS(true);
    try {
      const lang = targetLanguage.toLowerCase().includes('marathi') ? 'Marathi' : 'Hindi';
      const blob = await generateSpeech(localizedText, lang);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      localizedTtsAudioRef.current = audio;

      audio.onended = () => setIsPlayingLocalizedTTS(false);
      audio.onerror = () => setIsPlayingLocalizedTTS(false);

      await audio.play();
      setIsPlayingLocalizedTTS(true);
    } catch (err) {
      setError(err.message || 'Localized voice playback failed.');
    } finally {
      setIsGeneratingLocalizedTTS(false);
    }
  }

  return (
    <section className="stt-studio-container" aria-label="Speech-to-Text Studio">
      {/* ── Studio Header & Controls Card ── */}
      <div className="card">
        <div className="card-header">
          <div className="card-icon primary" aria-hidden="true">
            <MicIcon size={20} />
          </div>
          <div>
            <div className="card-title">Speech-to-Text & Localization Studio</div>
            <div className="card-subtitle">
              Transcribe spoken voice with auto-detected language and localize into your chosen output
            </div>
          </div>
        </div>

        <div className="card-body">
          {/* Top Controls: Mode Tabs + Language Selectors */}
          <div className="stt-top-controls" style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 'var(--space-2)' }}>
            {/* Left: Input Mode Pills */}
            <div className="tts-mode-pills" style={{ marginBottom: 0 }}>
              <button
                type="button"
                className={`tts-mode-pill ${tab === 'record' ? 'active' : ''}`}
                onClick={() => {
                  setTab('record');
                  setError('');
                }}
                disabled={isRecording || isTranscribing}
              >
                <MicIcon size={16} /> Live Microphone
              </button>
              <button
                type="button"
                className={`tts-mode-pill ${tab === 'upload' ? 'active' : ''}`}
                onClick={() => {
                  setTab('upload');
                  setError('');
                }}
                disabled={isRecording || isTranscribing}
              >
                <UploadIcon size={16} /> Audio File Upload
              </button>
            </div>

            {/* Right: Input & Output Language Selectors */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Spoken Language (Auto-detect) */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="stt-input-lang" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>
                  🎙️ Spoken Language:
                </label>
                <select
                  id="stt-input-lang"
                  className="form-select"
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  disabled={isRecording || isTranscribing}
                  style={{ fontSize: '0.82rem', padding: '6px 12px', minWidth: '190px' }}
                >
                  {INPUT_LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Output / Translate To Language */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="stt-output-lang" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-primary-dark)', marginBottom: '4px', display: 'block' }}>
                  🌐 Output / Translate To:
                </label>
                <select
                  id="stt-output-lang"
                  className="form-select"
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  disabled={isRecording || isTranscribing}
                  style={{ fontSize: '0.82rem', padding: '6px 12px', minWidth: '190px', borderColor: '#c4b5fd', fontWeight: 600 }}
                >
                  {OUTPUT_LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tone (visible when translation is active) */}
              {targetLanguage && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="stt-tone-select" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>
                    👔 Tone:
                  </label>
                  <select
                    id="stt-tone-select"
                    className="form-select"
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    disabled={isRecording || isTranscribing}
                    style={{ fontSize: '0.82rem', padding: '6px 10px', minWidth: '105px' }}
                  >
                    <option value="natural">Natural</option>
                    <option value="formal">Formal</option>
                    <option value="casual">Casual</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* ── Tab 1: Live Microphone Recording ── */}
          {tab === 'record' && (
            <div className="stt-record-card">
              <div className="stt-mic-visualizer-container">
                {/* Big Mic Button with Pulsing Wave */}
                <button
                  type="button"
                  className={`stt-big-record-btn ${isRecording ? 'recording' : ''}`}
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isTranscribing}
                  title={isRecording ? 'Click to stop recording' : 'Click to start recording'}
                >
                  {isRecording ? <SquareIcon size={28} /> : <MicIcon size={32} />}
                </button>

                {/* Animated Sound Wave Bars */}
                <div className={`tts-sound-bars ${isRecording ? 'active' : ''}`} style={{ height: '32px', gap: '5px' }}>
                  <span style={{ width: '4px' }} />
                  <span style={{ width: '4px' }} />
                  <span style={{ width: '4px' }} />
                  <span style={{ width: '4px' }} />
                  <span style={{ width: '4px' }} />
                  <span style={{ width: '4px' }} />
                  <span style={{ width: '4px' }} />
                  <span style={{ width: '4px' }} />
                </div>

                {/* Recording Timer / Status */}
                <div className="stt-record-status-label">
                  {isRecording ? (
                    <span style={{ color: '#dc2626', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <span className="recording-dot" /> Recording: {formatTime(recordSeconds)}
                    </span>
                  ) : audioUrl ? (
                    <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                      Audio recorded successfully. Listen below or re-record.
                    </span>
                  ) : (
                    <span>Click the microphone to start speaking</span>
                  )}
                </div>

                {/* Cancel action while recording */}
                {isRecording && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '4px 12px' }}
                    onClick={cancelRecording}
                  >
                    Cancel
                  </button>
                )}
              </div>

              {/* Recorded Audio Playback */}
              {audioUrl && !isRecording && (
                <div className="stt-preview-player">
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                    Recorded Voice Preview:
                  </span>
                  <audio controls src={audioUrl} style={{ width: '100%', height: '38px', borderRadius: '8px' }} />
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleTranscribe(audioBlob)}
                    disabled={isTranscribing}
                  >
                    {isTranscribing ? (
                      <>
                        <RefreshIcon size={14} className="spin-icon" /> Transcribing with Whisper…
                      </>
                    ) : (
                      <>
                        <RefreshIcon size={14} /> Re-Transcribe Audio
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Tab 2: Audio File Upload ── */}
          {tab === 'upload' && (
            <div className="stt-upload-card">
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg,.flac"
                hidden
                onChange={(e) => handleFileSelected(e.target.files?.[0])}
              />

              <div
                className={`dropzone ${isDragging ? 'dragging' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
              >
                <div className="dropzone-icon">
                  <UploadIcon size={32} />
                </div>
                <div className="dropzone-title">
                  {uploadedFile ? uploadedFile.name : 'Choose an audio file or drag & drop here'}
                </div>
                <div className="dropzone-hint">
                  Supports MP3, WAV, M4A, WEBM, OGG, FLAC up to 25 MB
                </div>
              </div>

              {uploadedFile && (
                <div className="stt-file-preview-row">
                  <div className="stt-file-info">
                    <FileIcon size={18} />
                    <span className="doc-name">{uploadedFile.name}</span>
                    <span className="meta-tag">{(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                  </div>

                  {audioUrl && (
                    <audio controls src={audioUrl} style={{ width: '100%', height: '36px', marginTop: '8px' }} />
                  )}

                  <div style={{ marginTop: '12px' }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-full"
                      onClick={() => handleTranscribe(uploadedFile)}
                      disabled={isTranscribing}
                    >
                      {isTranscribing ? (
                        <>
                          <RefreshIcon size={14} className="spin-icon" /> Transcribing with Whisper…
                        </>
                      ) : (
                        <>
                          <MicIcon size={16} /> Transcribe Audio File
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="status-banner error" style={{ marginTop: 'var(--space-4)' }} role="alert">
              <span>{error}</span>
            </div>
          )}

          {/* Loading Indicator */}
          {isTranscribing && (
            <div className="stt-loading-banner">
              <RefreshIcon size={18} className="spin-icon" />
              <span>Transcribing voice with auto-language detection…</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Transcribed Result Card ── */}
      {transcribedText && (
        <div className="card stt-result-card" style={{ marginTop: 'var(--space-5)' }}>
          <div className="card-header">
            <div className="card-icon success" aria-hidden="true">
              <CheckIcon size={18} />
            </div>
            <div>
              <div className="card-title">Speech-to-Text Results</div>
              <div className="card-subtitle">
                Whisper AI auto-detected language with optional cultural translation
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {detectedLanguage && (
                <span className="stt-lang-pill detected">
                  🗣️ Spoken: <strong>{detectedLanguage}</strong>
                </span>
              )}
              {targetLanguage && localizedText && (
                <span className="stt-lang-pill target">
                  🌐 Output: <strong>{targetLanguage}</strong> ({tone})
                </span>
              )}
              {audioDuration > 0 && (
                <span className="meta-tag">{audioDuration}s audio</span>
              )}
            </div>
          </div>

          <div className="card-body">
            {/* If Localized Translation is Available -> Show Dual Grid */}
            {localizedText ? (
              <div className="stt-dual-grid">
                {/* Column 1: Original Spoken Transcript */}
                <div className="stt-card-col">
                  <div className="stt-card-col-header">
                    <span>🎙️ Original Spoken Transcript</span>
                    <span className="badge-pill">{detectedLanguage || 'Original'}</span>
                  </div>
                  <textarea
                    className="form-textarea"
                    value={transcribedText}
                    onChange={(e) => setTranscribedText(e.target.value)}
                    rows={5}
                    placeholder="Transcribed text…"
                    aria-label="Original transcribed text"
                  />
                  <div style={{ display: 'flex', gap: '8px', marginTop: 'var(--space-3)', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleCopy(transcribedText, setCopiedOriginal)}
                    >
                      {copiedOriginal ? <><CheckIcon size={13} /> Copied</> : 'Copy Transcript'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleDownloadTxt(transcribedText, 'original_transcript')}
                    >
                      <DownloadIcon size={13} /> .txt
                    </button>
                    <button
                      type="button"
                      className={`btn btn-secondary btn-sm ${isPlayingOriginalTTS ? 'playing' : ''}`}
                      onClick={handlePlayOriginalTTS}
                      disabled={isGeneratingOriginalTTS}
                    >
                      {isGeneratingOriginalTTS ? (
                        <><RefreshIcon size={12} className="spin-icon" /> Generating…</>
                      ) : isPlayingOriginalTTS ? (
                        <><PauseIcon size={12} /> Stop Voice</>
                      ) : (
                        <><VolumeIcon size={13} /> Listen Original</>
                      )}
                    </button>
                  </div>
                </div>

                {/* Column 2: Localized Translation */}
                <div className="stt-card-col localized">
                  <div className="stt-card-col-header">
                    <span style={{ color: 'var(--color-primary-dark)' }}>🌐 Localized Translation</span>
                    <span className="badge-pill localized">{targetLanguage} ({tone})</span>
                  </div>
                  <textarea
                    className="form-textarea"
                    value={localizedText}
                    onChange={(e) => setLocalizedText(e.target.value)}
                    rows={5}
                    placeholder="Localized translation will appear here…"
                    aria-label="Localized translation text"
                    style={{ borderColor: '#c4b5fd' }}
                  />
                  <div style={{ display: 'flex', gap: '8px', marginTop: 'var(--space-3)', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleCopy(localizedText, setCopiedLocalized)}
                    >
                      {copiedLocalized ? <><CheckIcon size={13} /> Copied</> : 'Copy Localized'}
                    </button>
                    <button
                      type="button"
                      className={`btn btn-secondary btn-sm ${isPlayingLocalizedTTS ? 'playing' : ''}`}
                      onClick={handlePlayLocalizedTTS}
                      disabled={isGeneratingLocalizedTTS}
                      title={`Listen to this localized translation in ${targetLanguage}`}
                    >
                      {isGeneratingLocalizedTTS ? (
                        <><RefreshIcon size={12} className="spin-icon" /> Generating Voice…</>
                      ) : isPlayingLocalizedTTS ? (
                        <><PauseIcon size={12} /> Stop Voice</>
                      ) : (
                        <><VolumeIcon size={13} /> Listen in {targetLanguage}</>
                      )}
                    </button>
                    {onSendToTranslate && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => onSendToTranslate(transcribedText)}
                        title="Send this text to the Translation Studio for full deep analysis"
                      >
                        <SendIcon size={13} /> Translate Studio
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Single Card Mode (Original Only) */
              <div>
                <div className="stt-text-output-box">
                  <textarea
                    className="form-textarea"
                    value={transcribedText}
                    onChange={(e) => setTranscribedText(e.target.value)}
                    rows={5}
                    placeholder="Transcribed text will appear here…"
                    aria-label="Transcribed text"
                  />
                </div>

                <div className="stt-action-bar">
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => handleCopy(transcribedText, setCopiedOriginal)}>
                      {copiedOriginal ? <><CheckIcon size={14} /> Copied</> : 'Copy Text'}
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => handleDownloadTxt(transcribedText, 'transcript')}>
                      <DownloadIcon size={14} /> Download .txt
                    </button>
                    <button
                      type="button"
                      className={`btn btn-secondary ${isPlayingOriginalTTS ? 'playing' : ''}`}
                      onClick={handlePlayOriginalTTS}
                      disabled={isGeneratingOriginalTTS}
                    >
                      {isGeneratingOriginalTTS ? (
                        <><RefreshIcon size={13} className="spin-icon" /> Generating…</>
                      ) : isPlayingOriginalTTS ? (
                        <><PauseIcon size={13} /> Stop Voice</>
                      ) : (
                        <><VolumeIcon size={14} /> Listen with Sarvam AI</>
                      )}
                    </button>
                  </div>

                  {onSendToTranslate && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => onSendToTranslate(transcribedText)}
                      title="Switch to Simple Translation with this transcribed text prefilled"
                    >
                      <SendIcon size={15} /> Localize this Text
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
