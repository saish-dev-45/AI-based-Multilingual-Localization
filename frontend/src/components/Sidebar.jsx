import { BoltIcon, BookIcon, LayersIcon, MicIcon, VolumeIcon } from './Icons';

const MODES = [
  {
    id: 'simple',
    icon: <BoltIcon size={20} />,
    title: 'Simple Translation',
    desc: 'Translate and localize text instantly, no documents needed.',
  },
  {
    id: 'rag',
    icon: <BookIcon size={20} />,
    title: 'RAG Localization',
    desc: 'Upload glossaries and guidelines to ground the localization.',
  },
  {
    id: 'image',
    icon: <LayersIcon size={20} />,
    title: 'Image Localization',
    desc: 'Translate detected text and return a localized image.',
  },
  {
    id: 'tts',
    icon: <VolumeIcon size={20} />,
    title: 'Text-to-Speech',
    desc: 'Synthesize natural voice audio tailored to context and tone.',
  },
  {
    id: 'stt',
    icon: <MicIcon size={20} />,
    title: 'Speech-to-Text',
    desc: 'Transcribe live voice recordings or audio files with Whisper.',
  },
];

export default function Sidebar({ mode, onChange, disabled }) {
  return (
    <aside className="sidebar" aria-label="Workspace mode">
      <div className="sidebar-label">Mode</div>
      <nav className="sidebar-nav">
        {MODES.map((m) => (
          <button
            key={m.id}
            id={`mode-${m.id}`}
            type="button"
            className={`sidebar-item ${mode === m.id ? 'active' : ''}`}
            aria-current={mode === m.id ? 'page' : undefined}
            onClick={() => onChange(m.id)}
            disabled={disabled}
          >
            <span className="sidebar-item-icon" aria-hidden="true">{m.icon}</span>
            <span className="sidebar-item-text">
              <span className="sidebar-item-title">{m.title}</span>
              <span className="sidebar-item-desc">{m.desc}</span>
            </span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
