import { useRef, useState } from 'react';
import { extractDocumentText, suggestLocalizationContext } from '../api/localize';
import { EditIcon, FileIcon, SendIcon, SparkIcon, UploadIcon, CheckIcon, ChevronDownIcon, ChevronUpIcon } from './Icons';
import VoiceInputButton from './VoiceInputButton';

const LOCALES = [
  { locale: 'hi-IN', language: 'Hindi', label: 'Hindi — India (hi-IN)' },
  { locale: 'mr-IN', language: 'Marathi', label: 'Marathi — India (mr-IN)' },
];

const DOMAINS = [
  { id: 'General', label: '🌐 General', desc: 'Everyday communication & dialogue' },
  { id: 'App & Tech UI', label: '📱 App & Tech UI', desc: 'Buttons, modals, alerts, microcopy' },
  { id: 'E-Commerce & Retail', label: '🛒 E-Commerce', desc: 'Orders, delivery, carts, discounts' },
  { id: 'FinTech & Banking', label: '💳 FinTech & Banking', desc: 'OTP, accounts, KYC, transactions' },
  { id: 'Healthcare & Wellness', label: '🏥 Healthcare', desc: 'Medical advice, wellness, symptoms' },
  { id: 'Customer Support', label: '🎧 Support', desc: 'Troubleshooting, tickets, helpdesk' },
  { id: 'Marketing & Ads', label: '📢 Marketing & Ads', desc: 'Campaigns, social promos, taglines' },
  { id: 'Legal & Official', label: '⚖️ Legal & Official', desc: 'Disclaimers, terms, compliance notices' },
];

const AUDIENCES = [
  { id: 'General Public', label: '👥 General Public', desc: 'Accessible, pan-Indian mass audience' },
  { id: 'Youth & Tech-Savvy', label: '⚡ Youth & Tech-Savvy', desc: 'Gen Z, digital natives & students' },
  { id: 'Corporate & B2B', label: '💼 Corporate & B2B', desc: 'Business professionals & enterprises' },
  { id: 'Elders & Traditional', label: '🧓 Elders & Traditional', desc: 'Older generation, classic deference' },
];

const FORMALITY_LEVELS = [
  {
    id: 'Formal & Respectful',
    label: '👑 Formal & Respectful',
    desc: 'आप / तुम्ही + polite imperative verbs (कीजिए / करा)',
  },
  {
    id: 'Warm & Conversational',
    label: '🤝 Warm & Conversational',
    desc: 'Friendly आप / तुम्ही, welcoming yet polite',
  },
  {
    id: 'Casual & Direct',
    label: '💬 Casual & Direct',
    desc: 'Informal तुम / तू, friendly peer-to-peer buddy tone',
  },
];

const VOCABULARY_STYLES = [
  {
    id: 'Modern Contemporary',
    label: '🇮🇳 Modern Contemporary',
    desc: 'Natural vernacular with common transliterated loanwords (पासवर्ड, अकाउंट, लॉगिन)',
  },
  {
    id: 'Pure Vernacular',
    label: '📚 Pure Vernacular',
    desc: 'Strict Shuddh Hindi / Shuddha Marathi, avoiding English/Latin loanwords',
  },
  {
    id: 'Tech Terms Preserved',
    label: '⚙️ Tech Terms Preserved',
    desc: 'Keep technical nouns in English script (OTP, KYC, Login, UPI, PIN)',
  },
];

const TONE_PRESETS = [
  { label: '😊 Friendly & Professional', value: 'friendly and professional' },
  { label: '🚀 Urgent & Persuasive', value: 'urgent and persuasive' },
  { label: '🛡️ Reassuring & Empathetic', value: 'reassuring and empathetic' },
  { label: '⚡ Concise & Direct', value: 'concise and direct' },
  { label: '🏛️ Authoritative & Official', value: 'authoritative and official' },
  { label: '✍️ Custom Tone…', value: '__custom__' },
];

const MAX_LEN = 10000;

export default function LocalizationForm({
  onSubmit,
  isLoading,
  allowFile = false,
  initialText = '',
}) {
  const fileRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [fileError, setFileError] = useState('');
  const [isReading, setIsReading] = useState(false);
  const [sourceText, setSourceText] = useState(initialText);
  const [prevInitialText, setPrevInitialText] = useState(initialText);
  const [targetLocale, setTargetLocale] = useState('hi-IN');

  // Cultural Questionnaire State
  const [domain, setDomain] = useState('General');
  const [targetAudience, setTargetAudience] = useState('General Public');
  const [formality, setFormality] = useState('Formal & Respectful');
  const [vocabularyStyle, setVocabularyStyle] = useState('Modern Contemporary');
  const [tonePreset, setTonePreset] = useState(TONE_PRESETS[0].value);
  const [customTone, setCustomTone] = useState('');
  const [additionalInstructions, setAdditionalInstructions] = useState('');

  // AI Auto-Detect Context State
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestionRationale, setSuggestionRationale] = useState('');
  const [suggestError, setSuggestError] = useState('');
  const [showDirectives, setShowDirectives] = useState(false);

  if (initialText && initialText !== prevInitialText) {
    setPrevInitialText(initialText);
    setSourceText(initialText);
  }

  const isCustomTone = tonePreset === '__custom__';
  const effectiveTone = isCustomTone ? customTone : tonePreset;
  const charCount = sourceText.length;
  const charClass =
    charCount > MAX_LEN
      ? 'danger'
      : charCount > MAX_LEN * 0.85
      ? 'warning'
      : '';

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsReading(true);
    setFileError('');
    try {
      const res = await extractDocumentText(file);
      setSourceText(res.text);
      setFileName(res.filename);
    } catch (err) {
      setFileError(err.message);
    } finally {
      setIsReading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleAutoDetectContext() {
    if (!sourceText.trim()) {
      setSuggestError('Please enter some English source text first to auto-detect its context.');
      return;
    }
    setIsSuggesting(true);
    setSuggestError('');
    setSuggestionRationale('');
    try {
      const selectedLocale = LOCALES.find((item) => item.locale === targetLocale);
      const res = await suggestLocalizationContext(sourceText.trim(), selectedLocale.language);

      // Match and update Domain
      if (res.domain) {
        const foundDomain = DOMAINS.find(
          (d) => d.id.toLowerCase() === res.domain.toLowerCase() || res.domain.toLowerCase().includes(d.id.toLowerCase())
        );
        if (foundDomain) setDomain(foundDomain.id);
        else setDomain(res.domain);
      }

      // Match and update Target Audience
      if (res.target_audience) {
        const foundAudience = AUDIENCES.find(
          (a) => a.id.toLowerCase() === res.target_audience.toLowerCase() || res.target_audience.toLowerCase().includes(a.id.toLowerCase())
        );
        if (foundAudience) setTargetAudience(foundAudience.id);
        else setTargetAudience(res.target_audience);
      }

      // Match and update Formality
      if (res.formality) {
        const foundFormality = FORMALITY_LEVELS.find(
          (f) => f.id.toLowerCase() === res.formality.toLowerCase() || res.formality.toLowerCase().includes(f.id.toLowerCase())
        );
        if (foundFormality) setFormality(foundFormality.id);
        else setFormality(res.formality);
      }

      // Match and update Vocabulary Style
      if (res.vocabulary_style) {
        const foundVocab = VOCABULARY_STYLES.find(
          (v) => v.id.toLowerCase() === res.vocabulary_style.toLowerCase() || res.vocabulary_style.toLowerCase().includes(v.id.toLowerCase())
        );
        if (foundVocab) setVocabularyStyle(foundVocab.id);
        else setVocabularyStyle(res.vocabulary_style);
      }

      // Match and update Tone
      if (res.tone) {
        const foundTone = TONE_PRESETS.find(
          (t) => t.value.toLowerCase() === res.tone.toLowerCase() || res.tone.toLowerCase().includes(t.value.toLowerCase())
        );
        if (foundTone && foundTone.value !== '__custom__') {
          setTonePreset(foundTone.value);
        } else {
          setTonePreset('__custom__');
          setCustomTone(res.tone);
        }
      }

      if (res.rationale) {
        setSuggestionRationale(res.rationale);
      }
    } catch (err) {
      setSuggestError(err.message || 'Failed to auto-detect context.');
    } finally {
      setIsSuggesting(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!sourceText.trim() || charCount > MAX_LEN) return;
    const finalTone = effectiveTone.trim() || 'friendly and professional';
    const selectedLocale = LOCALES.find((item) => item.locale === targetLocale);

    onSubmit({
      source_text: sourceText.trim(),
      target_language: selectedLocale.language,
      target_locale: targetLocale,
      tone: finalTone,
      domain: domain,
      target_audience: targetAudience,
      formality: formality,
      vocabulary_style: vocabularyStyle,
      additional_instructions: additionalInstructions.trim() || undefined,
    });
  }

  return (
    <section aria-label="Localization Input">
      <div className="card">
        <div className="card-header">
          <div className="card-icon primary" aria-hidden="true"><EditIcon /></div>
          <div>
            <div className="card-title">Cultural Localization Studio</div>
            <div className="card-subtitle">
              Ask detailed persona &amp; context questions for authentic Devanagari localization
            </div>
          </div>
        </div>

        <div className="card-body">
          <form id="localize-form" onSubmit={handleSubmit} noValidate>
            <div className="form-grid">

              {/* ── 1. Source Text Input ── */}
              <div className="form-group">
                <div className="form-label-row">
                  <label htmlFor="source-text" className="form-label">
                    English Text to Localize <span className="required" aria-hidden="true">*</span>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <VoiceInputButton
                      disabled={isLoading}
                      onTranscribed={(spokenText) => {
                        setSourceText((prev) => (prev && prev.trim() ? `${prev.trim()} ${spokenText}` : spokenText));
                      }}
                    />
                  </div>
                </div>

                {allowFile && (
                  <div className="file-pick">
                    <input
                      ref={fileRef}
                      id="localize-file-input"
                      type="file"
                      accept=".txt,.md,.docx,.pdf"
                      hidden
                      onChange={handleFile}
                    />
                    <button
                      id="localize-file-btn"
                      type="button"
                      className="btn-secondary"
                      onClick={() => fileRef.current?.click()}
                      disabled={isLoading || isReading}
                    >
                      {isReading ? (
                        <><span className="spinner dark" aria-hidden="true" /> Reading…</>
                      ) : (
                        <><UploadIcon size={16} /> Upload document to localize</>
                      )}
                    </button>
                    {fileName && !fileError && (
                      <span className="file-chip">
                        <FileIcon size={14} /> {fileName}
                      </span>
                    )}
                    <span className="file-hint">TXT, MD, DOCX or PDF, or type below</span>
                  </div>
                )}
                {fileError && <div className="field-error" role="alert">{fileError}</div>}

                <textarea
                  id="source-text"
                  className="form-textarea"
                  value={sourceText}
                  onChange={(e) => {
                    setSourceText(e.target.value);
                    if (suggestError) setSuggestError('');
                  }}
                  placeholder="Type or paste your English text here (e.g. 'Please enter the 6-digit OTP sent to your registered mobile number to confirm payment')..."
                  aria-required="true"
                  aria-describedby="char-count"
                  maxLength={MAX_LEN + 1}
                  disabled={isLoading}
                  rows={4}
                />

                <div className="source-text-meta-row">
                  <div
                    id="char-count"
                    className={`char-count ${charClass}`}
                    aria-live="polite"
                  >
                    {charCount.toLocaleString()} / {MAX_LEN.toLocaleString()}
                  </div>

                  {/* AI Smart Auto-Detect Button */}
                  <button
                    type="button"
                    className="btn-ai-autodetect"
                    onClick={handleAutoDetectContext}
                    disabled={isLoading || isSuggesting || !sourceText.trim()}
                    title="Analyze your text to automatically choose domain, audience, honorifics, and tone"
                  >
                    {isSuggesting ? (
                      <>
                        <span className="spinner dark" style={{ width: 14, height: 14 }} aria-hidden="true" />
                        Analyzing Cultural Context…
                      </>
                    ) : (
                      <>
                        <SparkIcon size={15} /> 🪄 AI Auto-Detect Context
                      </>
                    )}
                  </button>
                </div>

                {suggestError && (
                  <div className="field-error" style={{ marginTop: '8px' }} role="alert">
                    {suggestError}
                  </div>
                )}

                {/* AI Rationale Banner */}
                {suggestionRationale && (
                  <div className="ai-rationale-callout" role="status">
                    <div className="ai-rationale-header">
                      <SparkIcon size={16} className="spark-pulse" />
                      <strong>AI Context Recommendation Applied</strong>
                      <button
                        type="button"
                        className="close-rationale-btn"
                        onClick={() => setSuggestionRationale('')}
                        title="Dismiss"
                      >
                        ✕
                      </button>
                    </div>
                    <p className="ai-rationale-body">{suggestionRationale}</p>
                    <div className="ai-rationale-tags">
                      <span className="rationale-tag">Domain: <strong>{domain}</strong></span>
                      <span className="rationale-tag">Audience: <strong>{targetAudience}</strong></span>
                      <span className="rationale-tag">Register: <strong>{formality.split('&')[0].trim()}</strong></span>
                      <span className="rationale-tag">Style: <strong>{vocabularyStyle.split(' ')[0]}</strong></span>
                    </div>
                  </div>
                )}
              </div>

              {/* ── 2. Target Locale & Language ── */}
              <div className="form-group">
                <label htmlFor="target-locale" className="form-label">
                  Target Language &amp; Locale <span className="required" aria-hidden="true">*</span>
                </label>
                <div className="locale-toggle-grid">
                  {LOCALES.map((item) => {
                    const isSelected = targetLocale === item.locale;
                    return (
                      <button
                        key={item.locale}
                        type="button"
                        className={`locale-card-option ${isSelected ? 'selected' : ''}`}
                        onClick={() => setTargetLocale(item.locale)}
                        disabled={isLoading}
                      >
                        <div className="locale-option-indicator">
                          {isSelected ? <CheckIcon size={14} /> : <span className="circle-dot" />}
                        </div>
                        <div className="locale-option-text">
                          <span className="locale-option-name">{item.language}</span>
                          <span className="locale-option-sub">
                            {item.locale === 'hi-IN' ? 'भारत (hi-IN) • Devanagari' : 'महाराष्ट्र (mr-IN) • Devanagari'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── 3. Cultural Persona & Context Questionnaire ── */}
              <div className="questionnaire-container">
                <div className="questionnaire-header">
                  <div className="questionnaire-title-group">
                    <span className="q-badge">CULTURAL CONTEXT</span>
                    <h3 className="questionnaire-title">Audience Persona &amp; Linguistic Context</h3>
                  </div>
                  <div className="questionnaire-summary-pills">
                    <span className="summary-pill">{domain}</span>
                    <span className="summary-pill">{targetAudience}</span>
                    <span className="summary-pill">{formality.split(' ')[0]}</span>
                  </div>
                </div>

                <div className="questions-stack">

                  {/* Question A: Content Domain / Industry */}
                  <div className="question-block">
                    <div className="question-label-row">
                      <span className="question-number">1</span>
                      <div>
                        <label className="question-title">Content Domain &amp; Industry</label>
                        <p className="question-desc">In what context will this localized content appear?</p>
                      </div>
                    </div>
                    <div className="options-chip-grid">
                      {DOMAINS.map((d) => {
                        const isSelected = domain === d.id;
                        return (
                          <button
                            key={d.id}
                            type="button"
                            className={`option-chip ${isSelected ? 'selected' : ''}`}
                            onClick={() => setDomain(d.id)}
                            disabled={isLoading}
                            title={d.desc}
                          >
                            <span className="option-chip-label">{d.label}</span>
                            {isSelected && <CheckIcon size={12} className="check-indicator" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Question B: Target Audience Persona */}
                  <div className="question-block">
                    <div className="question-label-row">
                      <span className="question-number">2</span>
                      <div>
                        <label className="question-title">Target Audience Persona</label>
                        <p className="question-desc">Who is reading or listening to this translation?</p>
                      </div>
                    </div>
                    <div className="options-card-grid">
                      {AUDIENCES.map((a) => {
                        const isSelected = targetAudience === a.id;
                        return (
                          <button
                            key={a.id}
                            type="button"
                            className={`option-card ${isSelected ? 'selected' : ''}`}
                            onClick={() => setTargetAudience(a.id)}
                            disabled={isLoading}
                          >
                            <div className="option-card-top">
                              <span className="option-card-title">{a.label}</span>
                              {isSelected && <span className="card-check"><CheckIcon size={12} /></span>}
                            </div>
                            <span className="option-card-desc">{a.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Question C: Honorific & Formality Register */}
                  <div className="question-block">
                    <div className="question-label-row">
                      <span className="question-number">3</span>
                      <div>
                        <label className="question-title">Honorific &amp; Formality Register</label>
                        <p className="question-desc">
                          Controls Indian pronouns (आप vs तुम vs तू / तुम्ही vs तू) and polite verb conjugation
                        </p>
                      </div>
                    </div>
                    <div className="options-card-grid three-col">
                      {FORMALITY_LEVELS.map((f) => {
                        const isSelected = formality === f.id;
                        return (
                          <button
                            key={f.id}
                            type="button"
                            className={`option-card ${isSelected ? 'selected' : ''}`}
                            onClick={() => setFormality(f.id)}
                            disabled={isLoading}
                          >
                            <div className="option-card-top">
                              <span className="option-card-title">{f.label}</span>
                              {isSelected && <span className="card-check"><CheckIcon size={12} /></span>}
                            </div>
                            <span className="option-card-desc">{f.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Question D: Vocabulary & Loanword Style */}
                  <div className="question-block">
                    <div className="question-label-row">
                      <span className="question-number">4</span>
                      <div>
                        <label className="question-title">Vocabulary &amp; Loanword Preference</label>
                        <p className="question-desc">How should technical and modern terms be handled in Devanagari?</p>
                      </div>
                    </div>
                    <div className="options-card-grid three-col">
                      {VOCABULARY_STYLES.map((v) => {
                        const isSelected = vocabularyStyle === v.id;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            className={`option-card ${isSelected ? 'selected' : ''}`}
                            onClick={() => setVocabularyStyle(v.id)}
                            disabled={isLoading}
                          >
                            <div className="option-card-top">
                              <span className="option-card-title">{v.label}</span>
                              {isSelected && <span className="card-check"><CheckIcon size={12} /></span>}
                            </div>
                            <span className="option-card-desc">{v.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Question E: Tone & Voice */}
                  <div className="question-block">
                    <div className="question-label-row">
                      <span className="question-number">5</span>
                      <div>
                        <label className="question-title">Tone &amp; Emotional Expression</label>
                        <p className="question-desc">Emotional resonance and attitude of the voice</p>
                      </div>
                    </div>
                    <div className="tone-options-row">
                      <div className="tone-chips-wrap">
                        {TONE_PRESETS.map((t) => {
                          const isSelected = tonePreset === t.value;
                          return (
                            <button
                              key={t.label}
                              type="button"
                              className={`tone-pill ${isSelected ? 'selected' : ''}`}
                              onClick={() => setTonePreset(t.value)}
                              disabled={isLoading}
                            >
                              {t.label}
                            </button>
                          );
                        })}
                      </div>

                      {isCustomTone && (
                        <div className="custom-tone-field">
                          <input
                            id="custom-tone"
                            type="text"
                            className="form-input"
                            value={customTone}
                            onChange={(e) => setCustomTone(e.target.value)}
                            placeholder="Describe custom tone (e.g. playful, reassuring and maternal, witty)"
                            maxLength={100}
                            disabled={isLoading}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Question F: Brand Directives / Special Instructions (Expandable) */}
                  <div className="question-block expandable">
                    <button
                      type="button"
                      className="accordion-toggle-btn"
                      onClick={() => setShowDirectives(!showDirectives)}
                    >
                      <span className="toggle-left">
                        <span className="question-number optional">✦</span>
                        <span className="toggle-label">Special Directives &amp; Brand Terminology (Optional)</span>
                      </span>
                      {showDirectives ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
                    </button>

                    {showDirectives && (
                      <div className="accordion-content">
                        <p className="question-desc" style={{ marginBottom: '8px' }}>
                          Add specific terms to preserve, avoid, or highlight (e.g. &ldquo;Keep product name 'DhanPay' untranslated; ensure OTP warning is emphasized&rdquo;).
                        </p>
                        <textarea
                          className="form-textarea directives-input"
                          value={additionalInstructions}
                          onChange={(e) => setAdditionalInstructions(e.target.value)}
                          placeholder="e.g. Do not translate 'Kavach Shield'. Use a welcoming Mumbai Marathi dialect nuance."
                          rows={2}
                          maxLength={500}
                          disabled={isLoading}
                        />
                      </div>
                    )}
                  </div>

                </div>
              </div>

              {/* ── 4. Submit Button ── */}
              <button
                id="localize-btn"
                type="submit"
                className="btn btn-primary btn-full submit-localize-btn"
                disabled={isLoading || !sourceText.trim() || charCount > MAX_LEN}
                aria-busy={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    Localizing with Cultural Persona…
                  </>
                ) : (
                  <>
                    <SendIcon size={18} />
                    <span>Localize into {targetLocale === 'hi-IN' ? 'Hindi (हिन्दी)' : 'Marathi (मराठी)'}</span>
                  </>
                )}
              </button>

            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
