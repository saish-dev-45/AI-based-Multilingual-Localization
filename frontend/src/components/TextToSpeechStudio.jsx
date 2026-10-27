import { useEffect, useRef, useState } from 'react';
import {
  CheckIcon,
  DownloadIcon,
  EditIcon,
  PauseIcon,
  PlayIcon,
  RefreshIcon,
  SendIcon,
  SparkIcon,
  VolumeIcon,
  XCircleIcon,
} from './Icons';
import { generateContextualSpeech, generateSpeech } from '../api/localize';
import VoiceInputButton from './VoiceInputButton';

const CONTEXT_PURPOSES = [
  { label: 'Customer Support & IVR', value: 'Customer Support and IVR assistance' },
  { label: 'Educational & Explainer', value: 'Educational lesson explaining concept clearly' },
  { label: 'E-Commerce & Product Overview', value: 'Product showcase and e-commerce guidance' },
  { label: 'Public Announcement & Travel', value: 'Clear public airport/train station announcement' },
  { label: 'Healthcare & Patient Advice', value: 'Healthcare guidance and medical reassurance' },
  { label: 'Storytelling & Audiobook', value: 'Engaging narrative storytelling' },
  { label: 'Marketing & Promotional', value: 'High-energy marketing campaign' },
  { label: 'News & Broadcasting', value: 'Objective journalistic news report' },
  { label: 'Custom Purpose…', value: '' },
];

const TONE_PRESETS = [
  { label: 'Friendly & Professional', value: 'Friendly, warm, and professional' },
  { label: 'Empathetic & Caring', value: 'Empathetic, reassuring, and comforting' },
  { label: 'Formal & Authoritative', value: 'Formal, polite, and authoritative' },
  { label: 'Conversational & Casual', value: 'Casual, conversational, and natural' },
  { label: 'Urgent & Alert', value: 'Clear, urgent, and attention-grabbing' },
  { label: 'Enthusiastic & Energetic', value: 'Enthusiastic, lively, and optimistic' },
  { label: 'Calm & Reassuring', value: 'Calm, soothing, and steady' },
  { label: 'Custom Tone…', value: '' },
];

const LANGUAGES = [
  { label: 'Hindi (हिन्दी — hi-IN)', value: 'Hindi' },
  { label: 'Marathi (मराठी — mr-IN)', value: 'Marathi' },
  { label: 'English (English — en-IN)', value: 'English' },
  { label: 'Gujarati (ગુજરાતી — gu-IN)', value: 'Gujarati' },
  { label: 'Bengali (বাংলা — bn-IN)', value: 'Bengali' },
  { label: 'Tamil (தமிழ் — ta-IN)', value: 'Tamil' },
  { label: 'Telugu (తెలుగు — te-IN)', value: 'Telugu' },
  { label: 'Kannada (ಕನ್ನಡ — kn-IN)', value: 'Kannada' },
];

const SPEAKERS = [
  { label: 'Shubh (Male — Balanced & Clear)', value: 'shubh' },
  { label: 'Priya (Female — Friendly & Warm)', value: 'priya' },
  { label: 'Rohan (Male — Energetic & Dynamic)', value: 'rohan' },
  { label: 'Neha (Female — Expressive & Natural)', value: 'neha' },
  { label: 'Aditya (Male — Confident & Authoritative)', value: 'aditya' },
  { label: 'Simran (Female — Polite & Conversational)', value: 'simran' },
];

const SAMPLE_PROMPTS = {
  answer_and_speak: [
    'How do I track my order delivery?',
    'What are the health benefits of drinking warm water with lemon?',
    'Explain how solar panels generate electricity.',
    'How do I reset my banking password safely?',
  ],
  adapt_and_speak: [
    'Attention passengers: The flight to Mumbai has been rescheduled by 30 minutes due to weather.',
    'Thank you for calling customer care. All our agents are currently assisting other callers.',
    'Welcome to LinguaAI! Experience seamless multilingual AI localization today.',
  ],
  direct_speak: [
    'नमस्ते, LinguaAI में आपका स्वागत है। हम आपकी क्या सहायता कर सकते हैं?',
    'नमस्कार, आमच्या ग्राहक सेवा केंद्रात आपले स्वागत आहे.',
    'Good morning! Thank you for tuning in to our daily broadcast.',
  ],
};

function formatTime(seconds) {
  if (isNaN(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export default function TextToSpeechStudio() {
  const [mode, setMode] = useState('answer_and_speak');
  const [query, setQuery] = useState('');
  const [contextPreset, setContextPreset] = useState(CONTEXT_PURPOSES[0].value);
  const [customContext, setCustomContext] = useState('');
  const [tonePreset, setTonePreset] = useState(TONE_PRESETS[0].value);
  const [customTone, setCustomTone] = useState('');
  const [language, setLanguage] = useState('Hindi');
  const [speaker, setSpeaker] = useState('shubh');
  const [autoLocalize, setAutoLocalize] = useState(true);

  // Generation state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  // Audio playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef(null);

  // Script editing & regeneration state
  const [isEditingScript, setIsEditingScript] = useState(false);
  const [editedScript, setEditedScript] = useState('');
  const [isRegeneratingAudio, setIsRegeneratingAudio] = useState(false);
  const [copied, setCopied] = useState(false);

  const isCustomContext = contextPreset === '';
  const finalContext = isCustomContext ? customContext : contextPreset;

  const isCustomTone = tonePreset === '';
  const finalTone = isCustomTone ? customTone : tonePreset;

  // Cleanup audio object URLs on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioUrl && audioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Handle Play/Pause
  function handleTogglePlay() {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => setError(err.message || 'Playback failed.'));
    }
  }

  // Handle time seek
  function handleSeek(e) {
    if (!audioRef.current) return;
    const nextTime = Number(e.target.value);
    audioRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  // Handle playback rate change
  function handleRateChange(rate) {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  }

  // Set up audio instance from base64
  function setupAudio(base64Data) {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);

    setAudioUrl(url);
    const audio = new Audio(url);
    audio.playbackRate = playbackRate;
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      setDuration(audio.duration || 0);
    };

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime || 0);
    };

    audio.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.onerror = () => {
      setIsPlaying(false);
      setError('Audio playback error occurred.');
    };

    audio
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => {
        /* Autoplay may be blocked by browser until user gesture */
        setIsPlaying(false);
      });
  }

  // Main Submit: Generate contextual speech
  async function handleSubmit(e) {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError('');
    setIsPlaying(false);
    setIsEditingScript(false);

    try {
      const data = await generateContextualSpeech({
        query: query.trim(),
        context_purpose: finalContext.trim() || 'General purpose',
        tone: finalTone.trim() || 'Friendly and professional',
        target_language: language,
        speaker: speaker,
        mode: mode,
        auto_localize: autoLocalize,
      });

      setResult(data);
      setEditedScript(data.generated_text);
      setupAudio(data.audio_base64);
    } catch (err) {
      setError(err.message || 'Speech generation failed.');
    } finally {
      setIsLoading(false);
    }
  }

  // Re-synthesize speech from modified script
  async function handleResynthesizeScript() {
    if (!editedScript.trim()) return;
    setIsRegeneratingAudio(true);
    setError('');
    setIsPlaying(false);

    try {
      const blob = await generateSpeech(editedScript.trim(), language, speaker);
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const audio = new Audio(url);
      audio.playbackRate = playbackRate;
      audioRef.current = audio;

      audio.onloadedmetadata = () => {
        setDuration(audio.duration || 0);
      };
      audio.ontimeupdate = () => {
        setCurrentTime(audio.currentTime || 0);
      };
      audio.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };

      setResult((prev) => ({
        ...prev,
        generated_text: editedScript.trim(),
      }));

      await audio.play();
      setIsPlaying(true);
      setIsEditingScript(false);
    } catch (err) {
      setError(err.message || 'Failed to re-synthesize audio.');
    } finally {
      setIsRegeneratingAudio(false);
    }
  }

  // Copy script to clipboard
  async function handleCopy() {
    if (!result?.generated_text) return;
    try {
      await navigator.clipboard.writeText(result.generated_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unallowed */
    }
  }

  return (
    <div className="workspace">
      {/* Input Configuration Card */}
      <section className="card" aria-label="Text to Speech Studio Input">
        <div className="card-header">
          <div className="card-icon primary" aria-hidden="true">
            <VolumeIcon size={20} />
          </div>
          <div>
            <div className="card-title">Text-to-Speech &amp; Voice Studio</div>
            <div className="card-subtitle">
              Answer questions or synthesize voice tailored to domain context, tone, and speaker preferences.
            </div>
          </div>
        </div>

        <div className="card-body">
          {/* Mode Selector Tabs */}
          <div className="tts-mode-pills" role="tablist">
            <button
              type="button"
              className={`tts-mode-pill ${mode === 'answer_and_speak' ? 'active' : ''}`}
              onClick={() => setMode('answer_and_speak')}
              disabled={isLoading}
            >
              <SparkIcon size={15} />
              <span>AI Answer &amp; Speak</span>
            </button>
            <button
              type="button"
              className={`tts-mode-pill ${mode === 'adapt_and_speak' ? 'active' : ''}`}
              onClick={() => setMode('adapt_and_speak')}
              disabled={isLoading}
            >
              <EditIcon size={15} />
              <span>Contextual Script &amp; Speak</span>
            </button>
            <button
              type="button"
              className={`tts-mode-pill ${mode === 'direct_speak' ? 'active' : ''}`}
              onClick={() => setMode('direct_speak')}
              disabled={isLoading}
            >
              <VolumeIcon size={15} />
              <span>Direct Text-to-Speech</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-grid">
              {/* Query/Text Input */}
              <div className="form-group">
                <div className="form-label-row">
                  <label htmlFor="tts-query" className="form-label">
                    {mode === 'answer_and_speak'
                      ? 'Question or Prompt to Answer & Speak'
                      : mode === 'adapt_and_speak'
                      ? 'Text to Adapt for Voice Delivery'
                      : 'Text to Synthesize into Speech'}{' '}
                    <span className="required" aria-hidden="true">*</span>
                  </label>
                  <VoiceInputButton
                    disabled={isLoading}
                    onTranscribed={(spokenText) => {
                      setQuery((prev) => (prev && prev.trim() ? `${prev.trim()} ${spokenText}` : spokenText));
                    }}
                  />
                </div>
                <textarea
                  id="tts-query"
                  className="form-textarea"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    mode === 'answer_and_speak'
                      ? 'e.g. How do I reset my bank password, or explain what mutual funds are...'
                      : mode === 'adapt_and_speak'
                      ? 'e.g. Type or paste your announcement or script to be adapted...'
                      : 'e.g. Type or paste text to directly speak in Hindi, Marathi, etc...'
                  }
                  maxLength={2500}
                  disabled={isLoading}
                  style={{ minHeight: '120px' }}
                />

                <div className="tts-prompt-suggestions">
                  <span className="tts-suggestions-label">Try asking:</span>
                  {(SAMPLE_PROMPTS[mode] || []).map((sample, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="tts-sample-chip"
                      onClick={() => setQuery(sample)}
                      disabled={isLoading}
                    >
                      {sample}
                    </button>
                  ))}
                </div>
              </div>

              {/* Context/Purpose & Tone (Only needed if in AI modes) */}
              {mode !== 'direct_speak' && (
                <div className="form-row">
                  {/* Context / Purpose */}
                  <div className="form-group">
                    <label htmlFor="tts-context" className="form-label">
                      Context / Purpose of translation &amp; answer
                    </label>
                    <select
                      id="tts-context"
                      className="form-select"
                      value={contextPreset}
                      onChange={(e) => setContextPreset(e.target.value)}
                      disabled={isLoading}
                    >
                      {CONTEXT_PURPOSES.map((cp) => (
                        <option key={cp.label} value={cp.value}>
                          {cp.label}
                        </option>
                      ))}
                    </select>
                    <span className="form-hint">
                      Dictates domain vocabulary (e.g. IVR, classroom, hospital).
                    </span>
                  </div>

                  {/* Tone */}
                  <div className="form-group">
                    <label htmlFor="tts-tone" className="form-label">
                      Tone of Voice
                    </label>
                    <select
                      id="tts-tone"
                      className="form-select"
                      value={tonePreset}
                      onChange={(e) => setTonePreset(e.target.value)}
                      disabled={isLoading}
                    >
                      {TONE_PRESETS.map((t) => (
                        <option key={t.label} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <span className="form-hint">
                      Sets the emotional warmth, formality, and attitude.
                    </span>
                  </div>
                </div>
              )}

              {/* Custom Context or Tone fields if user selected "Custom" */}
              {mode !== 'direct_speak' && (isCustomContext || isCustomTone) && (
                <div className="form-row">
                  {isCustomContext && (
                    <div className="form-group">
                      <label htmlFor="tts-custom-context" className="form-label">
                        Custom Purpose / Context Details
                      </label>
                      <input
                        id="tts-custom-context"
                        type="text"
                        className="form-input"
                        value={customContext}
                        onChange={(e) => setCustomContext(e.target.value)}
                        placeholder="e.g. Metro station ticket counter announcement"
                        disabled={isLoading}
                      />
                    </div>
                  )}
                  {isCustomTone && (
                    <div className="form-group">
                      <label htmlFor="tts-custom-tone" className="form-label">
                        Custom Tone Details
                      </label>
                      <input
                        id="tts-custom-tone"
                        type="text"
                        className="form-input"
                        value={customTone}
                        onChange={(e) => setCustomTone(e.target.value)}
                        placeholder="e.g. Warm, soothing, and respectful"
                        disabled={isLoading}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Target Language & Voice Speaker */}
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="tts-language" className="form-label">
                    Target Language
                  </label>
                  <select
                    id="tts-language"
                    className="form-select"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    disabled={isLoading}
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="tts-speaker" className="form-label">
                    Voice Speaker
                  </label>
                  <select
                    id="tts-speaker"
                    className="form-select"
                    value={speaker}
                    onChange={(e) => setSpeaker(e.target.value)}
                    disabled={isLoading}
                  >
                    {SPEAKERS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Auto-localize option for Direct Text-to-Speech mode */}
              {mode === 'direct_speak' && (
                <div className="tts-auto-localize-card">
                  <label htmlFor="tts-auto-localize-checkbox" className="tts-auto-localize-label">
                    <input
                      id="tts-auto-localize-checkbox"
                      type="checkbox"
                      checked={autoLocalize}
                      onChange={(e) => setAutoLocalize(e.target.checked)}
                      disabled={isLoading}
                      className="tts-checkbox"
                    />
                    <div className="tts-auto-localize-text">
                      <span className="tts-auto-localize-title">
                        🌐 Auto-Localize English into {language}
                      </span>
                      <span className="tts-auto-localize-desc">
                        Translates and culturally adapts English input into natural spoken {language} before synthesizing voice.
                      </span>
                    </div>
                  </label>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                className="btn btn-primary btn-full"
                disabled={isLoading || !query.trim()}
              >
                {isLoading ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    Generating tailored response &amp; voice…
                  </>
                ) : (
                  <>
                    <SendIcon size={16} />
                    {mode === 'answer_and_speak'
                      ? 'Answer Question & Generate Voice'
                      : mode === 'adapt_and_speak'
                      ? 'Adapt Script & Generate Voice'
                      : 'Synthesize Audio'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Error Banner */}
      {error && (
        <div className="status-banner error" role="alert">
          <span className="status-icon" aria-hidden="true">
            <XCircleIcon size={20} />
          </span>
          <span>{error}</span>
        </div>
      )}

      {/* Results Section */}
      {result && (
        <section className="results-section" aria-label="Speech Output">
          {/* Audio Player Card */}
          <div className="card tts-player-card">
            <div className="card-header">
              <div className="card-icon success" aria-hidden="true">
                <VolumeIcon size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="card-title">Generated Audio Playback</div>
                <div className="card-subtitle">
                  Synthesized in {result.target_language} with speaker {result.speaker} (Sarvam bulbul:v3)
                </div>
              </div>

              {/* Download WAV button */}
              {audioUrl && (
                <a
                  href={audioUrl}
                  download={`tts_${result.target_language.toLowerCase()}_${Date.now()}.wav`}
                  className="btn-secondary"
                  style={{ textDecoration: 'none' }}
                  title="Download WAV Audio"
                >
                  <DownloadIcon size={14} /> Download WAV
                </a>
              )}
            </div>

            <div className="card-body">
              <div className="tts-player-wrapper">
                {/* Main Play/Pause Button */}
                <button
                  type="button"
                  className={`tts-big-play-btn ${isPlaying ? 'playing' : ''}`}
                  onClick={handleTogglePlay}
                  title={isPlaying ? 'Pause' : 'Play audio'}
                >
                  {isPlaying ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
                </button>

                {/* Scrubber & Waveform */}
                <div className="tts-scrubber-group">
                  <div className="tts-scrubber-top">
                    {/* Animated sound wave bars when playing */}
                    <div className={`tts-sound-bars ${isPlaying ? 'active' : ''}`} aria-hidden="true">
                      <span /><span /><span /><span /><span /><span />
                    </div>
                    <span className="tts-time-display">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>

                  <input
                    type="range"
                    className="tts-progress-slider"
                    min={0}
                    max={duration || 1}
                    step={0.1}
                    value={currentTime}
                    onChange={handleSeek}
                    aria-label="Audio progress slider"
                  />
                </div>

                {/* Playback speed buttons */}
                <div className="tts-speed-selector">
                  {[0.75, 1, 1.25, 1.5].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      className={`tts-speed-btn ${playbackRate === rate ? 'active' : ''}`}
                      onClick={() => handleRateChange(rate)}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Generated Text & Script Card */}
          <div className="card">
            <div className="card-header">
              <div className="card-icon accent" aria-hidden="true">
                <SparkIcon size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="card-title">
                  {mode === 'answer_and_speak'
                    ? 'AI Answer Script'
                    : mode === 'adapt_and_speak'
                    ? 'Adapted Voice Script'
                    : 'Spoken Text'}
                </div>
                <div className="card-subtitle">
                  Tailored specifically for speech delivery and pronunciation
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="copy-btn"
                  onClick={() => setIsEditingScript(!isEditingScript)}
                >
                  <EditIcon size={14} />
                  {isEditingScript ? 'Cancel edit' : 'Edit text'}
                </button>
                <button type="button" className="copy-btn" onClick={handleCopy}>
                  {copied ? (
                    <>
                      <CheckIcon size={14} /> Copied
                    </>
                  ) : (
                    'Copy script'
                  )}
                </button>
              </div>
            </div>

            <div className="card-body">
              {/* Context & Tone applied badges */}
              <div className="meta-tags" style={{ marginBottom: '16px' }}>
                <span className="meta-tag">🗣️ Language: {result.target_language}</span>
                {result.was_localized && (
                  <span className="meta-tag success" style={{ background: '#dcfce7', color: '#15803d', borderColor: '#bbf7d0' }}>
                    ✨ Culturally Localized
                  </span>
                )}
                {mode !== 'direct_speak' && (
                  <>
                    <span className="meta-tag">🎯 Purpose: {result.context_purpose}</span>
                    <span className="meta-tag">🎭 Tone: {result.tone}</span>
                  </>
                )}
                <span className="meta-tag">🎙️ Speaker: {result.speaker}</span>
              </div>

              {result.was_localized && result.original_text && (
                <div className="tts-original-source-callout">
                  <span className="tts-source-label">Original English Input:</span>
                  <p className="tts-source-quote">&ldquo;{result.original_text}&rdquo;</p>
                </div>
              )}

              {/* Editable or Display Script */}
              {isEditingScript ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <textarea
                    className="form-textarea"
                    value={editedScript}
                    onChange={(e) => setEditedScript(e.target.value)}
                    style={{ minHeight: '120px' }}
                    disabled={isRegeneratingAudio}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ alignSelf: 'flex-start' }}
                    onClick={handleResynthesizeScript}
                    disabled={isRegeneratingAudio || !editedScript.trim()}
                  >
                    {isRegeneratingAudio ? (
                      <>
                        <RefreshIcon size={14} className="spin-icon" /> Regenerating Audio…
                      </>
                    ) : (
                      <>
                        <VolumeIcon size={14} /> Re-synthesize Speech from Edited Text
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="text-display" style={{ fontSize: '1.05rem', lineHeight: '1.8' }}>
                  {result.generated_text}
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
