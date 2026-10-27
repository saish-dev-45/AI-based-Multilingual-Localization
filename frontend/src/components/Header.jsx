import { useHealthCheck } from '../hooks/useHealthCheck';
import { GlobeIcon } from './Icons';

const LABELS = {
  healthy: 'API Online',
  unhealthy: 'API Offline',
  checking: 'Checking…',
};

export default function Header() {
  const status = useHealthCheck();

  return (
    <header className="header">
      <div className="header-inner">
        <div className="logo">
          <div className="logo-icon" aria-hidden="true"><GlobeIcon size={20} /></div>
          <span className="logo-text">Multilingual Localization</span>
        </div>

        <div
          className={`health-badge ${status}`}
          role="status"
          aria-live="polite"
          aria-label={`API status: ${LABELS[status]}`}
          id="api-health-badge"
        >
          <span className="health-dot" aria-hidden="true" />
          {LABELS[status]}
        </div>
      </div>
    </header>
  );
}
