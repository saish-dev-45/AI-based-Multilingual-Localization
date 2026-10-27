import { useEffect, useRef, useState } from 'react';
import { CheckIcon, MicIcon, SquareIcon } from './Icons';
import { transcribeAudio } from '../api/localize';
import { WavAudioRecorder } from '../utils/audioRecorder';

/**
 * VoiceInputButton: Records audio from microphone and transcribes it into text using Groq Whisper.
 *
 * @param {{
 *   onTranscribed: (text: string) => void,
 *   disabled?: boolean,
 *   language?: string,
 *   compact?: boolean,
 * }} props
 */
export default function VoiceInputButton({
  onTranscribed,
  disabled = false,
  language = 'en',
  compact = false,
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [hasSuccess, setHasSuccess] = useState(false);

  const wavRecorderRef = useRef(null);
  const timerRef = useRef(null);

  // Clean up timer and media tracks on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (wavRecorderRef.current) {
        wavRecorderRef.current.cancel();
      }
    };
  }, []);

  function formatTime(secs) {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins}:${remaining < 10 ? '0' : ''}${remaining}`;
  }

  async function startRecording() {
    setStatusMessage('');
    setHasSuccess(false);

    try {
      const recorder = new WavAudioRecorder();
      await recorder.start();
      wavRecorderRef.current = recorder;

      setIsRecording(true);
      setRecordSeconds(0);

      // Start duration timer
      timerRef.current = setInterval(() => {
        setRecordSeconds((prev) => {
          if (prev >= 60) {
            // Auto stop after 60 seconds
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setStatusMessage('Microphone access denied. Please allow microphone permissions in your browser.');
      } else {
        setStatusMessage(err.message || 'Could not access microphone.');
      }
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
          setStatusMessage('No audio captured. Please speak clearly into your microphone.');
          return;
        }

        setIsTranscribing(true);
        setStatusMessage('');
        try {
          const res = await transcribeAudio(blob, language);
          const transcribedText = typeof res === 'string' ? res : (res?.text || '');
          if (transcribedText && transcribedText.trim()) {
            onTranscribed(transcribedText.trim());
            setHasSuccess(true);
            setTimeout(() => setHasSuccess(false), 2500);
          } else {
            setStatusMessage('No clear speech detected. Please try again.');
          }
        } catch (err) {
          setStatusMessage(err.message || 'Speech transcription failed.');
        } finally {
          setIsTranscribing(false);
        }
      } catch (err) {
        setStatusMessage(err.message || 'Recording failed.');
        setIsTranscribing(false);
      }
    }
  }

  function handleToggle() {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  return (
    <div className={`voice-input-container ${compact ? 'compact' : ''}`}>
      <button
        type="button"
        id="voice-input-btn"
        className={`voice-btn ${isRecording ? 'recording' : ''} ${isTranscribing ? 'transcribing' : ''} ${hasSuccess ? 'success' : ''}`}
        onClick={handleToggle}
        disabled={disabled || isTranscribing}
        title={isRecording ? 'Click to stop recording' : 'Click to speak using your microphone'}
        aria-label={isRecording ? 'Stop voice recording' : 'Start voice recording'}
      >
        {isTranscribing ? (
          <>
            <span className="spinner dark" aria-hidden="true" />
            <span className="voice-btn-label">Transcribing…</span>
          </>
        ) : isRecording ? (
          <>
            <span className="recording-dot" aria-hidden="true" />
            <span className="voice-btn-label">Stop ({formatTime(recordSeconds)})</span>
            <SquareIcon size={12} />
          </>
        ) : hasSuccess ? (
          <>
            <CheckIcon size={14} />
            <span className="voice-btn-label">Transcribed!</span>
          </>
        ) : (
          <>
            <MicIcon size={15} />
            <span className="voice-btn-label">{compact ? 'Speak' : 'Voice Input'}</span>
          </>
        )}
      </button>

      {statusMessage && (
        <span className="voice-status-msg" role="status">
          {statusMessage}
        </span>
      )}
    </div>
  );
}
