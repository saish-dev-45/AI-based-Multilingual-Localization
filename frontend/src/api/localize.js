/**
 * API client for the Multilingual Localization backend.
 * Base URL defaults to http://localhost:8000 (override with VITE_API_URL env var).
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * GET /health
 * Throws if the response is not ok.
 */
export async function checkHealth() {
  const res = await fetch(`${BASE_URL}/health`);
  if (!res.ok) throw new Error('API unhealthy');
  return res.json();
}

/**
 * POST /localize
 * @param {{
 *   source_text: string,
 *   target_language: string,
 *   tone?: string,
 *   target_locale?: string,
 *   use_rag?: boolean,
 *   domain?: string,
 *   target_audience?: string,
 *   formality?: string,
 *   vocabulary_style?: string,
 *   additional_instructions?: string
 * }} payload
 * @returns {Promise<LocalizationResponse>}
 */
export async function localize(payload) {
  const res = await fetch(`${BASE_URL}/localize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  // Try to parse body regardless of status so we can surface backend errors.
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Server returned ${res.status} with non-JSON body.`);
  }

  if (!res.ok) {
    // FastAPI validation errors come in detail.msg or detail itself.
    const detail = data?.detail;
    if (typeof detail === 'string') throw new Error(detail);
    if (detail?.message) throw new Error(detail.message);
    if (Array.isArray(detail)) {
      throw new Error(detail.map((e) => e.msg).join('; '));
    }
    throw new Error(`Request failed with status ${res.status}`);
  }

  return data;
}

/**
 * POST /localize/suggest-context
 * Analyzes the source text and target language to recommend domain, audience, formality, vocabulary style, and tone.
 * @param {string} source_text
 * @param {string} target_language
 * @returns {Promise<{
 *   domain: string,
 *   target_audience: string,
 *   formality: string,
 *   vocabulary_style: string,
 *   tone: string,
 *   rationale: string
 * }>}
 */
export async function suggestLocalizationContext(source_text, target_language = 'Hindi') {
  const res = await fetch(`${BASE_URL}/localize/suggest-context`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_text, target_language }),
  });
  return parseResponse(res);
}

async function parseResponse(res) {
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Server returned ${res.status} with non-JSON body.`);
  }
  if (!res.ok) {
    const detail = data?.detail;
    if (typeof detail === 'string') throw new Error(detail);
    if (detail?.message) throw new Error(detail.message);
    if (Array.isArray(detail)) throw new Error(detail.map((e) => e.msg).join('; '));
    throw new Error(`Request failed with status ${res.status}`);
  }
  return data;
}

/** GET /documents */
export async function listDocuments() {
  const data = await parseResponse(await fetch(`${BASE_URL}/documents`));
  return data.documents;
}

/** POST /documents (multipart) */
export async function uploadDocuments(files) {
  const form = new FormData();
  files.forEach((f) => form.append('files', f));
  return parseResponse(await fetch(`${BASE_URL}/documents`, { method: 'POST', body: form }));
}

/** POST /documents/extract (multipart) - read a file to localize, without indexing. */
export async function extractDocumentText(file) {
  const form = new FormData();
  form.append('file', file);
  return parseResponse(await fetch(`${BASE_URL}/documents/extract`, { method: 'POST', body: form }));
}

/** DELETE /documents/{name} */
export async function deleteDocument(name) {
  return parseResponse(
    await fetch(`${BASE_URL}/documents/${encodeURIComponent(name)}`, { method: 'DELETE' })
  );
}

/** POST /images/localize (multipart) - returns the localized image blob. */
export async function localizeImage(file, targetLanguage = 'Hindi', tone = 'natural') {
  const form = new FormData();
  form.append('file', file);
  form.append('target_language', targetLanguage);
  form.append('tone', tone);

  const res = await fetch(`${BASE_URL}/images/localize`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const data = await res.json();
      if (typeof data?.detail === 'string') message = data.detail;
      else if (data?.detail?.message) message = data.detail.message;
    } catch {
      // Keep the status-based message if the error body is not JSON.
    }
    throw new Error(message);
  }

  return res.json();
}


/**
 * POST /tts/generate
 * Generates speech for text and returns an audio Blob (WAV format).
 * @param {string} text
 * @param {string} language
 * @param {string} speaker
 * @returns {Promise<Blob>}
 */
export async function generateSpeech(text, language = 'Hindi', speaker = 'shubh') {
  const res = await fetch(`${BASE_URL}/tts/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language, speaker }),
  });

  if (!res.ok) {
    let message = `Speech generation failed with status ${res.status}`;
    try {
      const data = await res.json();
      if (typeof data?.detail === 'string') message = data.detail;
    } catch {
      // Keep default message
    }
    throw new Error(message);
  }

  const audioBlob = await res.blob();
  return audioBlob;
}

/**
 * POST /tts/context-speech
 * Generates an answer or adapted script based on context, purpose, and tone, then synthesizes voice.
 * @param {{
 *   query: string,
 *   context_purpose?: string,
 *   tone?: string,
 *   target_language?: string,
 *   speaker?: string,
 *   mode?: string
 * }} payload
 * @returns {Promise<{
 *   query: string,
 *   context_purpose: string,
 *   tone: string,
 *   target_language: string,
 *   speaker: string,
 *   mode: string,
 *   generated_text: string,
 *   audio_base64: string
 * }>}
 */
export async function generateContextualSpeech(payload) {
  const res = await fetch(`${BASE_URL}/tts/context-speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let message = `Contextual speech generation failed with status ${res.status}`;
    try {
      const data = await res.json();
      if (typeof data?.detail === 'string') message = data.detail;
      else if (data?.detail?.message) message = data.detail.message;
    } catch {
      // Keep default message
    }
    throw new Error(message);
  }

  return res.json();
}

/**
 * POST /stt/transcribe
 * Transcribes audio recording/file to text using Groq Whisper, with auto-detected language and optional target language translation.
 * @param {Blob|File} audioBlob
 * @param {string} [language]
 * @param {string} [targetLanguage]
 * @param {string} [tone]
 * @returns {Promise<{
 *   text: string,
 *   detected_language: string,
 *   target_language?: string,
 *   localized_text?: string,
 *   duration?: number,
 *   filename?: string
 * }>}
 */
export async function transcribeAudio(audioBlob, language, targetLanguage, tone) {
  const form = new FormData();
  let filename = 'recording.wav';

  if (audioBlob instanceof File && audioBlob.name) {
    filename = audioBlob.name;
  } else if (audioBlob.type) {
    const type = audioBlob.type.toLowerCase();
    if (type.includes('wav')) filename = 'recording.wav';
    else if (type.includes('mp4') || type.includes('m4a')) filename = 'recording.m4a';
    else if (type.includes('ogg')) filename = 'recording.ogg';
    else if (type.includes('mpeg') || type.includes('mp3')) filename = 'recording.mp3';
    else if (type.includes('webm')) filename = 'recording.webm';
    else if (type.includes('flac')) filename = 'recording.flac';
  }

  form.append('file', audioBlob, filename);
  if (language) form.append('language', language);
  if (targetLanguage) form.append('target_language', targetLanguage);
  if (tone) form.append('tone', tone);

  const res = await fetch(`${BASE_URL}/stt/transcribe`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    let message = `Speech transcription failed with status ${res.status}`;
    try {
      const data = await res.json();
      if (typeof data?.detail === 'string') message = data.detail;
      else if (data?.detail?.message) message = data.detail.message;
    } catch {
      // Keep default message
    }
    throw new Error(message);
  }

  const data = await res.json();
  return data;
}

