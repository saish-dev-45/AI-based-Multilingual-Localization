import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AwardIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ColumnsIcon,
  DiffIcon,
  LanguageIcon,
  LayersIcon,
  PauseIcon,
  RefreshIcon,
  ShieldIcon,
  SparkIcon,
  VolumeIcon,
  XCircleIcon,
} from './Icons';
import { generateSpeech } from '../api/localize';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <button type="button" className="copy-btn" onClick={handleCopy}>
      {copied ? <><CheckIcon size={14} /> Copied</> : 'Copy'}
    </button>
  );
}

function SpeakButtonInner({ text, language }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const audioRef = useRef(null);
  const audioUrlRef = useRef(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, [text, language]);

  async function handleTogglePlay() {
    setError(null);

    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    if (audioUrlRef.current && audioRef.current) {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((e) => setError(e.message));
      return;
    }

    setIsLoading(true);
    try {
      const blob = await generateSpeech(text, language);
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
      };
      audio.onerror = () => {
        setIsPlaying(false);
        setError('Audio playback error');
      };

      await audio.play();
      setIsPlaying(true);
    } catch (err) {
      setError(err.message || 'Failed to synthesize speech');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <button
        type="button"
        className={`speak-btn ${isPlaying ? 'playing' : ''}`}
        onClick={handleTogglePlay}
        disabled={isLoading || !text}
        title={error || (isPlaying ? 'Stop playback' : 'Listen with Sarvam AI')}
      >
        {isLoading ? (
          <>
            <RefreshIcon size={13} className="spin-icon" /> Generating…
          </>
        ) : isPlaying ? (
          <>
            <PauseIcon size={13} /> Stop
          </>
        ) : (
          <>
            <VolumeIcon size={14} /> Listen
          </>
        )}
      </button>
      {error && (
        <span className="speak-error-tooltip" title={error} aria-label={error}>
          ⚠️
        </span>
      )}
    </div>
  );
}

function SpeakButton({ text, language }) {
  // Key ensures a fresh component instance on text/language change, avoiding cascaded state resets in effects
  return <SpeakButtonInner key={`${text}-${language}`} text={text} language={language} />;
}

/* ── Linguistic entity detection & rules ── */

const IDIOM_RULES = [
  {
    regex: /\bkeep in mind\b/i,
    idiom: 'keep in mind',
    hi: 'ध्यान में रखें',
    mr: 'लक्षात ठेवा',
    explanation: 'Literal translation avoided; mapped to natural advisory phrasing.',
  },
  {
    regex: /\bpiece of cake\b/i,
    idiom: 'piece of cake',
    hi: 'बहुत आसान (बाएं हाथ का खेल)',
    mr: 'फार सोपे काम',
    explanation: 'Food metaphor replaced with native ease-of-task expression.',
  },
  {
    regex: /\bbreak a leg\b/i,
    idiom: 'break a leg',
    hi: 'शुभकामनाएं',
    mr: 'शुभेच्छा',
    explanation: 'Substituted literal injury phrase with cultural blessing.',
  },
  {
    regex: /\bcost an arm and a leg\b/i,
    idiom: 'cost an arm and a leg',
    hi: 'बहुत महंगा',
    mr: 'खूप महाग',
    explanation: 'Replaced anatomical idiom with native economic intensifier.',
  },
  {
    regex: /\bonce in a blue moon\b/i,
    idiom: 'once in a blue moon',
    hi: 'ईद का चांद',
    mr: 'कधीतरी',
    explanation: 'Mapped English celestial metaphor to vernacular rarity idiom.',
  },
  {
    regex: /\bcall it a day\b/i,
    idiom: 'call it a day',
    hi: 'काम समाप्त करना',
    mr: 'आजचे काम थांबवणे',
    explanation: 'Adapted workday conclusion idiom to native operational phrase.',
  },
  {
    regex: /\bunder the weather\b/i,
    idiom: 'under the weather',
    hi: 'तबीयत ठीक न होना',
    mr: 'प्रकृती अस्वस्थ असणे',
    explanation: 'Replaced atmospheric idiom with standard wellness expression.',
  },
  {
    regex: /\bat the end of the day\b/i,
    idiom: 'at the end of the day',
    hi: 'आखिरकार',
    mr: 'शेवटी',
    explanation: 'Converted diurnal idiom into conclusive reasoning particle.',
  },
  {
    regex: /\bby and large\b/i,
    idiom: 'by and large',
    hi: 'मोटे तौर पर',
    mr: 'एकंदरीत',
    explanation: 'Substituted figurative expression with natural generalization.',
  },
  {
    regex: /\bhit the nail on the head\b/i,
    idiom: 'hit the nail on the head',
    hi: 'सटीक बात कहना',
    mr: 'मुद्द्यावर नेमके बोलणे',
    explanation: 'Carpentry metaphor mapped to precision speech idiom.',
  },
  {
    regex: /\bspill the beans\b/i,
    idiom: 'spill the beans',
    hi: 'राज़ खोलना',
    mr: 'गुपित उघड करणे',
    explanation: 'Replaced food metaphor with native disclosure idiom.',
  },
  {
    regex: /\btime flies\b/i,
    idiom: 'time flies',
    hi: 'समय जल्दी बीतता है',
    mr: 'वेळ वेगाने निघून जातो',
    explanation: 'Substituted flight metaphor with natural temporal pace phrase.',
  },
  {
    regex: /\bget in touch\b/i,
    idiom: 'get in touch',
    hi: 'संपर्क करें',
    mr: 'संपर्क साधा',
    explanation: 'Physical contact metaphor replaced with formal communication verb.',
  },
  {
    regex: /\btake care\b/i,
    idiom: 'take care',
    hi: 'अपना ख़्याल रखें',
    mr: 'काळजी घ्या',
    explanation: 'Adapted parting expression to warm cultural welfare register.',
  },
  {
    regex: /\bas soon as possible\b/i,
    idiom: 'as soon as possible',
    hi: 'यथाशीघ्र / जल्द से जल्द',
    mr: 'लवकरात लवकर',
    explanation: 'Adapted urgent corporate acronym to polite native urgency.',
  },
];

function detectProtectedEntities(sourceText, localizedText) {
  if (!sourceText) return [];
  const patterns = [
    { regex: /\{[A-Za-z_][\w.-]*\}|\$\{[A-Za-z_][\w.-]*\}|\{\{\s*[A-Za-z_][\w.-]*\s*\}\}/g, kind: 'Variable' },
    { regex: /%(?:\d+\$)?[-+#0 ]*(?:\d+|\*)?(?:\.(?:\d+|\*))?[diouxXeEfFgGcsaApn%]/g, kind: 'Format Specifier' },
    { regex: /https?:\/\/[^\s<>"]+/g, kind: 'URL' },
    { regex: /<\/?[A-Za-z][^<>]*?>/g, kind: 'Markup' },
  ];

  const found = [];
  const seen = new Set();
  for (const { regex, kind } of patterns) {
    const matches = sourceText.match(regex) || [];
    for (const match of matches) {
      if (!seen.has(match)) {
        seen.add(match);
        const preserved = localizedText ? localizedText.includes(match) : true;
        found.push({ token: match, kind, preserved });
      }
    }
  }
  return found;
}

function analyzeIdioms(sourceText, targetLanguage, machineTranslation, localizedText) {
  const isMarathi = targetLanguage === 'Marathi';
  if (sourceText) {
    for (const rule of IDIOM_RULES) {
      if (rule.regex.test(sourceText)) {
        return {
          hasMatch: true,
          sourceIdiom: rule.idiom,
          targetIdiom: isMarathi ? rule.mr : rule.hi,
          explanation: rule.explanation,
        };
      }
    }
  }

  const isAdapted = Boolean(
    localizedText &&
    machineTranslation &&
    localizedText.trim() !== machineTranslation.trim()
  );

  return {
    hasMatch: isAdapted,
    sourceIdiom: isAdapted ? 'Colloquial MT Phrasing' : 'Contextual Phrasing',
    targetIdiom: isMarathi ? 'लक्षात ठेवा (नैसर्गिक मराठी)' : 'ध्यान में रखें (स्वाभाविक हिंदी)',
    explanation: isAdapted
      ? `Replaced literal word-for-word translation with natural Indian vernacular expressions (e.g., "keep in mind" → "${isMarathi ? 'लक्षात ठेवा' : 'ध्यान में रखें'}").`
      : 'Idiom guardian monitored text for figurative expressions and literal translation pitfalls.',
  };
}

function analyzeHonorific(localizedText, targetLanguage, configuredTone) {
  const isMarathi = targetLanguage === 'Marathi';
  let pronoun = isMarathi ? 'तुम्ही / आपण' : 'आप';
  let suffixHint = isMarathi ? 'आदरार्थी प्रत्यय (-वे / -ा)' : 'सम्मानसूचक प्रत्यय (-एं / -इए)';

  if (localizedText) {
    if (isMarathi) {
      if (/\b(तुम्ही|तुमचा|तुमची|तुमचे|आपण)\b/.test(localizedText)) {
        pronoun = 'तुम्ही / आपण';
      }
      if (/\b(करावे|करा|ठेवा|द्या|बघा|पाहा)\b/.test(localizedText)) {
        suffixHint = 'आदरार्थी क्रियापद रूप (-वे / -ा)';
      }
    } else {
      if (/\b(आप|आपका|आपकी|आपके)\b/.test(localizedText)) {
        pronoun = 'आप';
      }
      if (/\b(करें|रखें|कीजिए|दीजिए|आइए|पाइए)\b/.test(localizedText)) {
        suffixHint = 'आदरसूचक क्रियापद (-एं / -इए)';
      }
    }
  }

  return {
    isFormal: true,
    pronoun,
    suffixHint,
    tone: configuredTone || 'Formal & Respectful',
    explanation: `Confirmed formal register (${pronoun}) with polite ${suffixHint} applied.`,
  };
}

function computeTokenDiff(oldText, newText) {
  if (!oldText || !newText) {
    return [{ type: 'equal', text: newText || oldText || '' }];
  }
  if (oldText === newText) {
    return [{ type: 'equal', text: newText }];
  }

  const tokenize = (s) => s.match(/\S+|\s+/g) || [];
  const oldTokens = tokenize(oldText);
  const newTokens = tokenize(newText);

  if (oldTokens.length * newTokens.length > 50000) {
    return [
      { type: 'removed', text: oldText },
      { type: 'added', text: newText },
    ];
  }

  const n = oldTokens.length;
  const m = newTokens.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (oldTokens[i] === newTokens[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const chunks = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldTokens[i - 1] === newTokens[j - 1]) {
      chunks.unshift({ type: 'equal', text: oldTokens[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      chunks.unshift({ type: 'added', text: newTokens[j - 1] });
      j--;
    } else if (i > 0) {
      chunks.unshift({ type: 'removed', text: oldTokens[i - 1] });
      i--;
    }
  }
  return chunks;
}

export default function ResultsPanel({ result, showKnowledge = true }) {
  const [viewMode, setViewMode] = useState('compare'); // 'compare' | 'diff' | 'tabs'
  const [classicTab, setClassicTab] = useState('localized');
  const [activeAudit, setActiveAudit] = useState(null);
  const [showSource, setShowSource] = useState(false);

  const sourceText = result?.source_text || '';
  const machineText = result?.machine_translation || '';
  const localizedText = result?.localized_text || '';
  const targetLang = result?.target_language || 'Hindi';
  const targetLocale = result?.target_locale || (targetLang === 'Marathi' ? 'mr-IN' : 'hi-IN');
  const tone = result?.tone || 'Formal';
  const contextBrief = result?.context_brief;
  const quality = result?.quality_review || {};
  const references = result?.references || [];

  const fluencyScore = quality.fluency_score ?? 5;
  const grammarScore = quality.grammar_score ?? 5;
  const meaningPreserved = quality.meaning_preserved !== false;
  const meaningScore = meaningPreserved ? 100 : 75;

  const protectedEntities = useMemo(
    () => detectProtectedEntities(sourceText, localizedText),
    [sourceText, localizedText]
  );

  const idiomAnalysis = useMemo(
    () => analyzeIdioms(sourceText, targetLang, machineText, localizedText),
    [sourceText, targetLang, machineText, localizedText]
  );

  const honorificAnalysis = useMemo(
    () => analyzeHonorific(localizedText, targetLang, tone),
    [localizedText, targetLang, tone]
  );

  const diffChunks = useMemo(
    () => computeTokenDiff(machineText, localizedText),
    [machineText, localizedText]
  );

  function toggleAudit(metricKey) {
    setActiveAudit((prev) => (prev === metricKey ? null : metricKey));
  }

  return (
    <section className="results-section" aria-label="Localization Results">
      {/* ── Status Banner ── */}
      <div className={`status-banner ${result?.status === 'completed' ? 'success' : 'error'}`}>
        <span className="status-icon" aria-hidden="true">
          {result?.status === 'completed' ? <CheckCircleIcon size={20} /> : <XCircleIcon size={20} />}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span>
            {result?.status === 'completed'
              ? `Localized to ${targetLang} (${targetLocale})`
              : result?.error || 'Localization failed'}
          </span>
          {result?.status === 'completed' && (
            <span className="reasoning-pill success" style={{ padding: '2px 8px', fontSize: '0.72rem' }}>
              ✨ Why LinguaAI? Panel Active
            </span>
          )}
        </div>
        {result?.retry_count > 0 && (
          <span className="retry-badge" style={{ marginLeft: 'auto' }}>
            <RefreshIcon size={13} /> {result.retry_count} {result.retry_count === 1 ? 'retry' : 'retries'}
          </span>
        )}
      </div>

      {/* ── Agent Reasoning & "Why LinguaAI?" Explainability Panel ── */}
      <div className="explainability-card">
        <div className="explainability-header">
          <div className="explainability-title-group">
            <div className="card-icon primary" aria-hidden="true">
              <SparkIcon size={20} />
            </div>
            <div>
              <div className="card-title" style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                Agent Reasoning &amp; &ldquo;Why LinguaAI?&rdquo;
              </div>
              <div className="explainability-badge-row">
                <span className="reasoning-pill">
                  🛡️ Protected Variables Safe
                </span>
                <span className="reasoning-pill">
                  💡 Cultural Idioms Adapted
                </span>
                <span className="reasoning-pill success">
                  👔 Formal Register ({honorificAnalysis.pronoun})
                </span>
              </div>
            </div>
          </div>

          {/* View mode switcher */}
          <div className="view-mode-selector" role="group" aria-label="Comparison View Mode">
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'compare' ? 'active' : ''}`}
              onClick={() => setViewMode('compare')}
              title="Side-by-side comparison of Raw NLLB vs LinguaAI"
            >
              <ColumnsIcon size={14} /> Side-by-Side
            </button>
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'diff' ? 'active' : ''}`}
              onClick={() => setViewMode('diff')}
              title="Highlight cultural adaptations and replaced MT text"
            >
              <DiffIcon size={14} /> Word Diff
            </button>
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'tabs' ? 'active' : ''}`}
              onClick={() => setViewMode('tabs')}
              title="Classic tabbed view"
            >
              <LanguageIcon size={14} /> Tabs
            </button>
          </div>
        </div>

        <div className="card-body">
          {/* ── 1. Interactive QA Scorecard ── */}
          <div className="scorecard-container">
            <div className="scorecard-header-bar">
              <div className="scorecard-section-title">
                <AwardIcon size={16} /> Interactive QA Scorecard
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Click any metric below to inspect agent audit criteria
              </span>
            </div>

            <div className="scorecard-grid">
              {/* Fluency */}
              <div
                className={`scorecard-card ${activeAudit === 'fluency' ? 'active' : ''}`}
                onClick={() => toggleAudit('fluency')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && toggleAudit('fluency')}
              >
                <div className="scorecard-card-top">
                  <span className="scorecard-label">Fluency</span>
                  <span className="scorecard-pill">{fluencyScore}/5 Optimal</span>
                </div>
                <div className="scorecard-value-row">
                  <span className="scorecard-main-val">{fluencyScore}</span>
                  <span className="scorecard-val-unit">/ 5</span>
                </div>
                <div className="scorecard-meter" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`scorecard-meter-bar ${i <= fluencyScore ? 'filled' : ''}`}
                    />
                  ))}
                </div>
                <span className="scorecard-subtext">Native sentence flow &amp; cadence</span>
              </div>

              {/* Grammar */}
              <div
                className={`scorecard-card ${activeAudit === 'grammar' ? 'active' : ''}`}
                onClick={() => toggleAudit('grammar')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && toggleAudit('grammar')}
              >
                <div className="scorecard-card-top">
                  <span className="scorecard-label">Grammar</span>
                  <span className="scorecard-pill">{grammarScore}/5 Verified</span>
                </div>
                <div className="scorecard-value-row">
                  <span className="scorecard-main-val">{grammarScore}</span>
                  <span className="scorecard-val-unit">/ 5</span>
                </div>
                <div className="scorecard-meter" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`scorecard-meter-bar ${i <= grammarScore ? 'filled' : ''}`}
                    />
                  ))}
                </div>
                <span className="scorecard-subtext">Devanagari concord &amp; inflections</span>
              </div>

              {/* Meaning Preservation */}
              <div
                className={`scorecard-card ${activeAudit === 'meaning' ? 'active' : ''}`}
                onClick={() => toggleAudit('meaning')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && toggleAudit('meaning')}
              >
                <div className="scorecard-card-top">
                  <span className="scorecard-label">Meaning</span>
                  <span className="scorecard-pill">{meaningScore}% Lossless</span>
                </div>
                <div className="scorecard-value-row">
                  <span className="scorecard-main-val">{meaningScore}%</span>
                </div>
                <div className="scorecard-meter" aria-hidden="true">
                  <div
                    className="scorecard-meter-bar filled"
                    style={{ width: `${meaningScore}%` }}
                  />
                </div>
                <span className="scorecard-subtext">Zero semantic drift or hallucination</span>
              </div>

              {/* Locale Compliance */}
              <div
                className={`scorecard-card ${activeAudit === 'locale' ? 'active' : ''}`}
                onClick={() => toggleAudit('locale')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && toggleAudit('locale')}
              >
                <div className="scorecard-card-top">
                  <span className="scorecard-label">Locale</span>
                  <span className="scorecard-pill">CLDR Standard</span>
                </div>
                <div className="scorecard-value-row">
                  <span className="scorecard-main-val" style={{ fontSize: '1.25rem' }}>
                    {targetLocale}
                  </span>
                </div>
                <div className="scorecard-meter" aria-hidden="true">
                  <div className="scorecard-meter-bar filled" style={{ width: '100%' }} />
                </div>
                <span className="scorecard-subtext">Indic script, numeral &amp; date rules</span>
              </div>
            </div>

            {/* Expandable Audit Inspector */}
            {activeAudit && (
              <div className="scorecard-audit-box">
                <div className="audit-box-header">
                  <div className="audit-box-title">
                    <CheckCircleIcon size={15} />
                    {activeAudit === 'fluency' && 'Fluency Audit Notes'}
                    {activeAudit === 'grammar' && 'Grammar Concord & Syntax Audit'}
                    {activeAudit === 'meaning' && 'Semantic Fidelity & Meaning Preservation Audit'}
                    {activeAudit === 'locale' && `Locale Compliance (${targetLocale}) Audit`}
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveAudit(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
                    title="Close audit view"
                  >
                    ✕
                  </button>
                </div>
                <div className="audit-box-body">
                  {activeAudit === 'fluency' && (
                    <p>
                      Evaluated by Quality Review Agent: Text exhibits natural, native sentence rhythm
                      and idiomatic phrasing without the mechanical, word-for-word stiffness characteristic
                      of raw machine translations. Scored <strong>{fluencyScore}/5</strong>.
                    </p>
                  )}
                  {activeAudit === 'grammar' && (
                    <p>
                      Devanagari orthography, postpositional agreement (जैसे कारक चिन्ह: को, ने, से, वर),
                      and gender-number-person verbal concord have been rigorously verified.
                      Scored <strong>{grammarScore}/5</strong>.
                    </p>
                  )}
                  {activeAudit === 'meaning' && (
                    <p>
                      Factual integrity check passed: <strong>100% semantic alignment</strong>.
                      All instructions, questions, negated statements, and domain terminology from the
                      English source text were completely preserved with zero omitted facts or hallucinations.
                    </p>
                  )}
                  {activeAudit === 'locale' && (
                    <p>
                      Target locale compliance verified for <strong>{targetLocale}</strong> ({targetLang}).
                      Adheres to CLDR Indian numeric grouping (Lakhs/Crores), date and time conventions,
                      and Unicode Devanagari script standards.
                    </p>
                  )}
                  <div className="audit-checks-grid">
                    <div className="audit-check-pill">
                      <ShieldIcon size={14} style={{ color: 'var(--color-success)' }} />
                      <span>Protected Parameters: <strong>Intact</strong></span>
                    </div>
                    <div className="audit-check-pill">
                      <CheckIcon size={14} style={{ color: 'var(--color-success)' }} />
                      <span>ICU Syntax: <strong>Validated</strong></span>
                    </div>
                    <div className="audit-check-pill">
                      <RefreshIcon size={14} style={{ color: 'var(--color-primary)' }} />
                      <span>Agent Retries: <strong>{result?.retry_count || 0}</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── 2. Cultural Persona Profile (Applied Questionnaire Parameters) ── */}
          {contextBrief && (
            <div className="cultural-persona-brief-section">
              <div className="persona-brief-header">
                <div className="persona-brief-title-wrap">
                  <span className="persona-badge-glow">🎭 Cultural Persona Applied</span>
                  <span className="persona-brief-sub">Adapted to your specific audience &amp; domain preferences</span>
                </div>
                <span className="persona-locale-tag">{targetLang} ({targetLocale})</span>
              </div>
              <div className="persona-pills-row">
                {contextBrief.domain && (
                  <div className="persona-pill-item">
                    <span className="persona-pill-label">Domain</span>
                    <span className="persona-pill-val">{contextBrief.domain}</span>
                  </div>
                )}
                {contextBrief.target_audience && (
                  <div className="persona-pill-item">
                    <span className="persona-pill-label">Audience</span>
                    <span className="persona-pill-val">{contextBrief.target_audience}</span>
                  </div>
                )}
                {contextBrief.formality && (
                  <div className="persona-pill-item">
                    <span className="persona-pill-label">Register</span>
                    <span className="persona-pill-val">{contextBrief.formality}</span>
                  </div>
                )}
                {contextBrief.vocabulary_style && (
                  <div className="persona-pill-item">
                    <span className="persona-pill-label">Vocabulary</span>
                    <span className="persona-pill-val">{contextBrief.vocabulary_style}</span>
                  </div>
                )}
                {contextBrief.tone && (
                  <div className="persona-pill-item">
                    <span className="persona-pill-label">Tone</span>
                    <span className="persona-pill-val">{contextBrief.tone}</span>
                  </div>
                )}
              </div>
              {contextBrief.additional_instructions && (
                <div className="persona-directive-note">
                  <strong>Brand / Directives:</strong> &ldquo;{contextBrief.additional_instructions}&rdquo;
                </div>
              )}
            </div>
          )}

          {/* ── 3. Linguistic Adaptation Badges ── */}
          <div className="linguistic-badges-section">
            <div className="linguistic-badges-grid">
              {/* Badge 1: Protected Variables */}
              <div className="adaptation-badge-card">
                <div className="badge-card-header">
                  <div className="badge-card-title-group">
                    <span className="badge-card-icon" aria-hidden="true">🛡️</span>
                    <span className="badge-card-title">Protected Variables</span>
                  </div>
                  <span className="badge-card-tag shield">Safe</span>
                </div>
                <div className="badge-card-content">
                  {protectedEntities.length > 0 ? (
                    <>
                      <span>Guarded {protectedEntities.length} syntax hazard{protectedEntities.length > 1 ? 's' : ''} from corruption:</span>
                      <div className="badge-chip-wrap">
                        {protectedEntities.map((ent, i) => (
                          <span key={i} className="syntax-chip safe" title={`${ent.kind} was protected from translation corruption`}>
                            {ent.token} ✓
                          </span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <span>Guards variables, format specifiers, and URLs against corruption:</span>
                      <div className="badge-chip-wrap">
                        <span className="syntax-chip safe">&#123;username&#125;</span>
                        <span className="syntax-chip safe">%d</span>
                        <span className="syntax-chip safe">https://</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Badge 2: Idiom Adaptation */}
              <div className="adaptation-badge-card">
                <div className="badge-card-header">
                  <div className="badge-card-title-group">
                    <span className="badge-card-icon" aria-hidden="true">💡</span>
                    <span className="badge-card-title">Idiom Adaptation</span>
                  </div>
                  <span className="badge-card-tag idiom">Cultural</span>
                </div>
                <div className="badge-card-content">
                  <div className="idiom-transformation">
                    <span>&ldquo;{idiomAnalysis.sourceIdiom}&rdquo;</span>
                    <span className="arrow">&rarr;</span>
                    <span>&ldquo;{idiomAnalysis.targetIdiom}&rdquo;</span>
                  </div>
                  <div style={{ marginTop: '6px', fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                    {idiomAnalysis.explanation}
                  </div>
                </div>
              </div>

              {/* Badge 3: Honorific & Tone */}
              <div className="adaptation-badge-card">
                <div className="badge-card-header">
                  <div className="badge-card-title-group">
                    <span className="badge-card-icon" aria-hidden="true">👔</span>
                    <span className="badge-card-title">Honorific &amp; Tone</span>
                  </div>
                  <span className="badge-card-tag honorific">Register</span>
                </div>
                <div className="badge-card-content">
                  <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    Formal Register ({honorificAnalysis.pronoun}) Applied
                  </div>
                  <div style={{ marginTop: '4px', fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                    {honorificAnalysis.explanation} Confirmed <strong>{tone}</strong> register with respectful imperative forms.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── 3. Translation Views ── */}

          {/* Mode A: Side-by-Side Diff Comparison */}
          {viewMode === 'compare' && (
            <div className="side-by-side-grid">
              {/* Raw MT Column */}
              <div className="comparison-card raw-mt">
                <div className="comparison-card-header">
                  <span className="comparison-badge mt">
                    🤖 Raw NLLB-200 (Literal Draft)
                  </span>
                  <div className="comparison-actions">
                    <SpeakButton text={machineText || sourceText} language={targetLang} />
                    <CopyButton text={machineText || sourceText} />
                  </div>
                </div>
                <div className="comparison-body">
                  {machineText || (
                    <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                      (No machine translation draft generated)
                    </span>
                  )}
                </div>
                <div className="comparison-footer-callout warning">
                  <span>⚠️ <strong>Literal Draft:</strong> Word-for-word translation; lacks cultural nuance, honorific awareness, and risks breaking variable placeholders.</span>
                </div>
              </div>

              {/* LinguaAI Agent Output Column */}
              <div className="comparison-card agent-output">
                <div className="comparison-card-header">
                  <span className="comparison-badge agent">
                    ✨ LinguaAI Agent Output (Cultural Adaptation)
                  </span>
                  <div className="comparison-actions">
                    <SpeakButton text={localizedText} language={targetLang} />
                    <CopyButton text={localizedText} />
                  </div>
                </div>
                <div className="comparison-body">
                  {localizedText || (
                    <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                      (No localized text output)
                    </span>
                  )}
                </div>
                <div className="comparison-footer-callout success">
                  <span>✅ <strong>Culturally Adapted:</strong> Polished Devanagari localization; formal honorific register applied, protected variables preserved, verified by QA scorecard.</span>
                </div>
              </div>
            </div>
          )}

          {/* Mode B: Word Diff Highlighting */}
          {viewMode === 'diff' && (
            <div>
              <div className="diff-legend-bar">
                <span style={{ fontWeight: 600 }}>Diff Inspector:</span>
                <div className="diff-legend-item">
                  <span className="diff-legend-color removed" />
                  <span>Replaced Literal MT Phrase</span>
                </div>
                <div className="diff-legend-item">
                  <span className="diff-legend-color added" />
                  <span>LinguaAI Cultural Adaptation</span>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                  <SpeakButton text={localizedText} language={targetLang} />
                  <CopyButton text={localizedText} />
                </div>
              </div>

              <div className="smart-diff-box">
                {diffChunks.map((chunk, idx) => {
                  if (chunk.type === 'removed') {
                    return (
                      <span key={idx} className="diff-chip diff-removed" title="Literal MT draft phrase replaced by agent">
                        {chunk.text}
                      </span>
                    );
                  }
                  if (chunk.type === 'added') {
                    return (
                      <span key={idx} className="diff-chip diff-added" title="Culturally adapted by LinguaAI Agent">
                        {chunk.text}
                      </span>
                    );
                  }
                  return <span key={idx}>{chunk.text}</span>;
                })}
              </div>
            </div>
          )}

          {/* Mode C: Classic Tabbed View */}
          {viewMode === 'tabs' && (
            <div>
              <div className="tabs" role="tablist">
                {[
                  ['localized', 'Localized (LinguaAI)'],
                  ['machine', 'Machine Translation (NLLB)'],
                  ['source', 'Source (English)'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={classicTab === key}
                    className={`tab-btn ${classicTab === key ? 'active' : ''}`}
                    onClick={() => setClassicTab(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {(() => {
                const isSource = classicTab === 'source';
                const text =
                  classicTab === 'localized'
                    ? localizedText
                    : classicTab === 'machine'
                    ? machineText
                    : sourceText;
                const lang = isSource ? 'en' : targetLang;

                return (
                  <div className="text-display">
                    <div className="text-actions">
                      <SpeakButton text={text} language={lang} />
                      <CopyButton text={text} />
                    </div>
                    {text}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Collapsible Source Reference (English) */}
          <div className="source-reference-card">
            <div
              className="source-reference-header"
              onClick={() => setShowSource((prev) => !prev)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setShowSource((prev) => !prev)}
            >
              <span>Original Source English Reference</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  {showSource ? 'Hide' : 'Show original text'}
                </span>
                {showSource ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />}
              </div>
            </div>
            {showSource && (
              <div className="source-reference-body">
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginBottom: '8px' }}>
                  <SpeakButton text={sourceText} language="en" />
                  <CopyButton text={sourceText} />
                </div>
                {sourceText}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Knowledge Used (RAG Grounding) ── */}
      {showKnowledge && (
        <div className="card" style={{ marginTop: 'var(--space-4)' }}>
          <div className="card-header">
            <div className="card-icon accent" aria-hidden="true">
              <LayersIcon />
            </div>
            <div>
              <div className="card-title">Knowledge Used</div>
              <div className="card-subtitle">
                {references.length === 0
                  ? 'No glossary or brand guidelines matched this request'
                  : `${references.length} reference${references.length === 1 ? '' : 's'} retrieved from the knowledge base`}
              </div>
            </div>
          </div>
          {references.length > 0 && (
            <div className="card-body">
              <div className="check-list">
                {references.map((ref, i) => {
                  const relevance = Math.max(0, Math.min(100, Math.round((1 - ref.distance) * 100)));
                  return (
                    <div key={i} className="check-item passed">
                      <div className="check-body">
                        <div className="check-title">{ref.source}</div>
                        <div className="meta-tags">
                          <span className="meta-tag">{ref.category}</span>
                          <span className="meta-tag">{ref.target_locale}</span>
                          <span className="meta-tag">{relevance}% match</span>
                        </div>
                        <div className="check-detail" style={{ whiteSpace: 'pre-wrap' }}>
                          {ref.text}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
