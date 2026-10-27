import { useState } from 'react';
import { XCircleIcon } from './components/Icons';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import DocumentManager from './components/DocumentManager';
import LocalizationForm from './components/LocalizationForm';
import ResultsPanel from './components/ResultsPanel';
import ImageLocalization from './components/ImageLocalization';
import TextToSpeechStudio from './components/TextToSpeechStudio';
import SpeechToTextStudio from './components/SpeechToTextStudio';
import { localize } from './api/localize';

const HERO = {
  simple: {
    badge: 'Simple translation',
    subtitle: 'Translate, localize, validate and quality-review your text in one step.',
  },
  rag: {
    badge: 'RAG-grounded localization',
    subtitle:
      'Upload your glossaries and brand guidelines, then localize text that follows your terminology.',
  },
  image: {
    badge: 'Image OCR & localization',
    subtitle: 'Extract text from an image, localize it, and download the updated image.',
  },
  tts: {
    badge: 'Text-to-Speech & Voice Studio',
    subtitle:
      'Answer questions and synthesize natural voices tailored to domain context, tone, and speaker preferences.',
  },
  stt: {
    badge: 'Speech-to-Text & Voice Transcription',
    subtitle:
      'Transcribe live microphone speech or audio files into accurate text powered by Whisper.',
  },
};


export default function App() {
  const [mode, setMode] = useState('simple');
  const [result, setResult] = useState(null);
  const [initialSourceText, setInitialSourceText] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  function handleModeChange(next) {
    if (next === mode) return;
    setMode(next);
    setResult(null);
    setError('');
  }

  async function handleSubmit(payload) {
    setIsLoading(true);
    setError('');
    setResult(null);
    try {
      setResult(await localize({ ...payload, use_rag: mode === 'rag' }));
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="app-layout">
      <Header />
      <div className="body-layout">
        <Sidebar mode={mode} onChange={handleModeChange} disabled={isLoading} />
        <main className="main-content">
          <div className="hero">
            <div className="hero-badge">{HERO[mode].badge}</div>
            <h1 className="hero-title">
              Localize English into <span className="gradient-text">Hindi &amp; Marathi</span>
            </h1>
            <p className="hero-subtitle">{HERO[mode].subtitle}</p>
          </div>

          <div className="workspace">
            {mode === 'tts' ? (
              <TextToSpeechStudio />
            ) : mode === 'stt' ? (
              <SpeechToTextStudio
                onSendToTranslate={(text) => {
                  setInitialSourceText(text);
                  setMode('simple');
                  setResult(null);
                }}
              />
            ) : mode === 'image' ? (
              <ImageLocalization />
            ) : (
              <>
                {mode === 'rag' && <DocumentManager disabled={isLoading} />}

                <LocalizationForm
                  onSubmit={handleSubmit}
                  isLoading={isLoading}
                  allowFile={mode === 'rag'}
                  initialText={initialSourceText}
                />

                {error && (
                  <div className="status-banner error" role="alert">
                    <span className="status-icon" aria-hidden="true"><XCircleIcon size={20} /></span>
                    <span>{error}</span>
                  </div>
                )}

                {result && <ResultsPanel result={result} showKnowledge={mode === 'rag'} />}
              </>
            )}
          </div>
        </main>
      </div>
      <footer className="footer">Powered by NLLB-200 and Gemini</footer>
    </div>
  );
}
