/* Lightweight inline SVG icon set (stroke icons, inherit currentColor). */

const base = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
};

function make(children) {
  return function Icon({ size, ...props }) {
    const dims = size ? { width: size, height: size } : {};
    return (
      <svg {...base} {...dims} {...props}>
        {children}
      </svg>
    );
  };
}

export const GlobeIcon = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z" />
  </>
);

export const BoltIcon = make(<path d="M13 2L4 14h7l-1 8l9-12h-7l1-8z" />);

export const BookIcon = make(
  <>
    <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z" />
    <path d="M19 19v2H6a2 2 0 0 1-2-2" />
  </>
);

export const EditIcon = make(
  <>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1l1-4L16.5 3.5z" />
  </>
);

export const ShieldIcon = make(
  <>
    <path d="M12 3l8 3v6c0 5-3.5 8-8 9c-4.5-1-8-4-8-9V6l8-3z" />
    <path d="M9 12l2 2l4-4" />
  </>
);

export const LanguageIcon = make(
  <>
    <path d="M4 5h9" />
    <path d="M8.5 3v2" />
    <path d="M6 5c.5 3 3 6 6 7" />
    <path d="M12 5c-.5 3-3 6-6.5 8" />
    <path d="M13 20l4-9l4 9" />
    <path d="M14.5 17h5" />
  </>
);

export const UploadIcon = make(
  <>
    <path d="M12 16V4" />
    <path d="M7 9l5-5l5 5" />
    <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
  </>
);

export const FileIcon = make(
  <>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" />
    <path d="M14 3v5h5" />
  </>
);

export const CheckIcon = make(<path d="M5 12.5l4.5 4.5L19 7.5" />);

export const CheckCircleIcon = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.5l3 3l5-6" />
  </>
);

export const XCircleIcon = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M9 9l6 6M15 9l-6 6" />
  </>
);

export const CloseIcon = make(<path d="M6 6l12 12M18 6L6 18" />);

export const RefreshIcon = make(
  <>
    <path d="M20 11a8 8 0 0 0-14.5-4M4 4v4h4" />
    <path d="M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4" />
  </>
);

export const SparkIcon = make(
  <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
);

export const SendIcon = make(
  <>
    <path d="M21 3L10 14" />
    <path d="M21 3l-7 18l-4-7l-7-4l18-7z" />
  </>
);

export const LayersIcon = make(
  <>
    <path d="M12 3l9 5l-9 5l-9-5l9-5z" />
    <path d="M3 13l9 5l9-5" />
  </>
);

export const VolumeIcon = make(
  <>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </>
);

export const PlayIcon = make(
  <polygon points="5 3 19 12 5 21 5 3" />
);

export const PauseIcon = make(
  <>
    <rect x="6" y="4" width="4" height="16" />
    <rect x="14" y="4" width="4" height="16" />
  </>
);

export const DownloadIcon = make(
  <>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </>
);

export const MicIcon = make(
  <>
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </>
);

export const SquareIcon = make(
  <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />
);

export const ColumnsIcon = make(
  <>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <line x1="12" y1="4" x2="12" y2="20" />
  </>
);

export const DiffIcon = make(
  <>
    <circle cx="6" cy="6" r="3" />
    <circle cx="18" cy="18" r="3" />
    <path d="M6 9v12" />
    <path d="M18 9a9 9 0 0 0-9 9" />
  </>
);

export const LightbulbIcon = make(
  <>
    <path d="M9 18h6" />
    <path d="M10 22h4" />
    <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
  </>
);

export const AwardIcon = make(
  <>
    <circle cx="12" cy="8" r="6" />
    <path d="M15.48 13.92L18 22l-6-3.5L6 22l2.52-8.08" />
  </>
);

export const ChevronDownIcon = make(<path d="M6 9l6 6l6-6" />);

export const ChevronUpIcon = make(<path d="M18 15l-6-6l-6 6" />);





