import { useEffect, useRef, useState } from 'react';
import { localizeImage, generateSpeech } from '../api/localize';
import {
  CheckIcon,
  DownloadIcon,
  PauseIcon,
  VolumeIcon,
} from './Icons';

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <button type="button" className="copy-btn" onClick={handleCopy} title="Copy to clipboard">
      {copied ? <><CheckIcon size={14} /> Copied</> : 'Copy'}
    </button>
  );
}

function AudioButton({ text, language }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  async function handleTogglePlay() {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }
    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
      return;
    }
    if (!text) return;
    setIsLoading(true);
    try {
      const blob = await generateSpeech(text, language);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => setIsPlaying(false);
      audioRef.current = audio;
      await audio.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button
      type="button"
      className="copy-btn"
      onClick={handleTogglePlay}
      disabled={isLoading || !text}
      title="Listen to spoken audio"
    >
      {isLoading ? (
        'Loading…'
      ) : isPlaying ? (
        <><PauseIcon size={14} /> Pause</>
      ) : (
        <><VolumeIcon size={14} /> Listen</>
      )}
    </button>
  );
}

export default function ImageLocalization() {
  const [file, setFile] = useState(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [result, setResult] = useState(null);
  const [targetLanguage, setTargetLanguage] = useState('Hindi');
  const [tone, setTone] = useState('natural');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  }, [sourceUrl]);

  function chooseFile(nextFile) {
    setError('');
    setResult(null);
    if (!nextFile) {
      setFile(null);
      setSourceUrl('');
      return;
    }
    if (!ACCEPTED_TYPES.has(nextFile.type)) {
      setFile(null);
      setSourceUrl('');
      setError('Choose a PNG, JPG, JPEG, or WEBP image.');
      return;
    }
    if (nextFile.size > MAX_BYTES) {
      setFile(null);
      setSourceUrl('');
      setError('Image exceeds the 10 MB limit.');
      return;
    }
    setFile(nextFile);
    setSourceUrl(URL.createObjectURL(nextFile));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!file) return;
    setIsLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await localizeImage(file, targetLanguage, tone);
      setResult(res);
    } catch (err) {
      setError(err.message || 'Image localization failed.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="card" aria-label="Image localization">
      <div className="card-header">
        <div className="card-icon primary" aria-hidden="true">▧</div>
        <div>
          <div className="card-title">Localize an Image with OCR</div>
          <div className="card-subtitle">
            Extract text from an image, culturally localize it, and render it back with matching colors.
          </div>
        </div>
      </div>

      <form className="card-body" onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="image-file">Choose Image</label>
            <input
              id="image-file"
              className="form-input"
              type="file"
              accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
              onChange={(event) => chooseFile(event.target.files?.[0])}
              disabled={isLoading}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="image-language">Target language</label>
              <select
                id="image-language"
                className="form-select"
                value={targetLanguage}
                onChange={(event) => setTargetLanguage(event.target.value)}
                disabled={isLoading}
              >
                <option value="Hindi">Hindi (हिन्दी)</option>
                <option value="Marathi">Marathi (मराठी)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="image-tone">Tone</label>
              <select
                id="image-tone"
                className="form-select"
                value={tone}
                onChange={(event) => setTone(event.target.value)}
                disabled={isLoading}
              >
                <option value="natural">Natural</option>
                <option value="friendly and professional">Friendly &amp; professional</option>
                <option value="formal">Formal</option>
                <option value="casual">Casual</option>
              </select>
            </div>
          </div>

          {error && <div className="status-banner error" role="alert">{error}</div>}

          <button className="btn btn-primary btn-full" type="submit" disabled={!file || isLoading}>
            {isLoading ? (
              <>
                <span className="spinner" aria-hidden="true" />
                <span>Detecting text, inpainting, and localizing…</span>
              </>
            ) : (
              'Localize Image & Extract Text'
            )}
          </button>

          {/* Detailed OCR & Localized Text Output */}
          {result && (
            <div className="ocr-results-wrapper">
              <div className="ocr-text-grid">
                {/* Extracted Text */}
                <div className="ocr-text-card">
                  <div className="ocr-card-header">
                    <div className="ocr-card-label">
                      <span className="badge-pill source">Extracted Text (OCR)</span>
                      <span className="ocr-count">
                        {result.regions?.length || 0} regions detected
                      </span>
                    </div>
                    <CopyButton text={result.extracted_text} />
                  </div>
                  <div className="ocr-text-content source-content">
                    {result.extracted_text ? (
                      result.extracted_text.split('\n').map((line, idx) => (
                        <p key={idx}>{line}</p>
                      ))
                    ) : (
                      <span className="text-muted">No text detected.</span>
                    )}
                  </div>
                </div>

                {/* Localized Text */}
                <div className="ocr-text-card">
                  <div className="ocr-card-header">
                    <div className="ocr-card-label">
                      <span className="badge-pill localized">Localized ({targetLanguage})</span>
                    </div>
                    <div className="ocr-actions">
                      <AudioButton text={result.localized_text} language={targetLanguage} />
                      <CopyButton text={result.localized_text} />
                    </div>
                  </div>
                  <div className="ocr-text-content localized-content">
                    {result.localized_text ? (
                      result.localized_text.split('\n').map((line, idx) => (
                        <p key={idx}>{line}</p>
                      ))
                    ) : (
                      <span className="text-muted">No localized text generated.</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Detected Regions Breakdown */}
              {result.regions && result.regions.length > 0 && (
                <div className="ocr-regions-section">
                  <div className="ocr-regions-title">
                    Detected Text Regions &amp; Translations
                  </div>
                  <div className="ocr-regions-list">
                    {result.regions.map((reg, idx) => (
                      <div key={idx} className="ocr-region-item">
                        <span className="region-index">#{idx + 1}</span>
                        <div className="region-texts">
                          <span className="region-src">{reg.source_text}</span>
                          <span className="region-arrow">→</span>
                          <span className="region-dst">{reg.localized_text}</span>
                        </div>
                        {reg.confidence && (
                          <span className="region-confidence">
                            {Math.round(reg.confidence * 100)}% confidence
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Visual Images Comparison Grid */}
              <div className="ocr-images-grid">
                <div className="ocr-image-box">
                  <span className="form-label">Original Image</span>
                  {sourceUrl && (
                    <img
                      className="image-localization-preview"
                      src={sourceUrl}
                      alt="Original uploaded graphic"
                    />
                  )}
                </div>

                <div className="ocr-image-box">
                  <span className="form-label">Localized Image ({targetLanguage})</span>
                  {result.image_url && (
                    <>
                      <img
                        className="image-localization-preview"
                        src={result.image_url}
                        alt={`Localized graphic in ${targetLanguage}`}
                      />
                      <a
                        className="btn btn-secondary btn-full"
                        href={result.image_url}
                        download="localized-image.png"
                      >
                        <DownloadIcon size={16} /> Download Localized Image
                      </a>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Initial preview before processing */}
          {!result && sourceUrl && (
            <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
              <span className="form-label">Selected Image Preview</span>
              <img
                className="image-localization-preview"
                src={sourceUrl}
                alt="Uploaded source image preview"
              />
            </div>
          )}
        </div>
      </form>
    </section>
  );
}
