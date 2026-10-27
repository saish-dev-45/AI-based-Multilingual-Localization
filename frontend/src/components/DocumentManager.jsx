import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteDocument, listDocuments, uploadDocuments } from '../api/localize';
import { BookIcon, CloseIcon, FileIcon, UploadIcon } from './Icons';

const ACCEPT = '.txt,.md,.docx,.pdf';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentManager({ disabled }) {
  const [docs, setDocs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState(null); // { type, text }
  const inputRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      setDocs(await listDocuments());
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await uploadDocuments(files);
      const parts = [`Indexed ${res.uploaded.length} document${res.uploaded.length === 1 ? '' : 's'}.`];
      if (res.failed.length) {
        parts.push(res.failed.map((f) => `${f.name}: ${f.error}`).join('; '));
      }
      setMessage({ type: res.failed.length ? 'error' : 'success', text: parts.join(' ') });
      await refresh();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleDelete(name) {
    setBusy(true);
    setMessage(null);
    try {
      await deleteDocument(name);
      await refresh();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  const locked = busy || disabled;

  return (
    <section aria-label="Knowledge documents">
      <div className="card">
        <div className="card-header">
          <div className="card-icon accent" aria-hidden="true"><BookIcon /></div>
          <div>
            <div className="card-title">Knowledge Documents</div>
            <div className="card-subtitle">
              Upload glossaries, brand guidelines or style guides (TXT, MD, DOCX, PDF)
            </div>
          </div>
        </div>
        <div className="card-body">
          <div
            id="dropzone"
            className={`dropzone ${dragging ? 'dragging' : ''} ${locked ? 'locked' : ''}`}
            onClick={() => !locked && inputRef.current?.click()}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !locked) {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (!locked) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!locked) handleFiles(e.dataTransfer.files);
            }}
            role="button"
            tabIndex={0}
            aria-label="Upload documents"
          >
            <input
              ref={inputRef}
              id="document-input"
              type="file"
              accept={ACCEPT}
              multiple
              hidden
              onChange={(e) => handleFiles(e.target.files)}
            />
            {busy ? (
              <>
                <span className="spinner dark" aria-hidden="true" />
                <div className="dropzone-title">Processing…</div>
              </>
            ) : (
              <>
                <div className="dropzone-icon" aria-hidden="true"><UploadIcon size={28} /></div>
                <div className="dropzone-title">Drop files here or click to browse</div>
                <div className="dropzone-hint">Max 10 MB per file</div>
              </>
            )}
          </div>

          {message && (
            <div className={`status-banner ${message.type}`} role="status" style={{ marginTop: 'var(--space-4)' }}>
              <span>{message.text}</span>
            </div>
          )}

          <div className="doc-list">
            {docs.length === 0 ? (
              <div className="doc-empty">No documents indexed yet.</div>
            ) : (
              docs.map((d) => (
                <div key={d.name} className="doc-item">
                  <span className="doc-icon" aria-hidden="true"><FileIcon size={20} /></span>
                  <div className="doc-info">
                    <div className="doc-name">{d.name}</div>
                    <div className="meta-tags">
                      <span className="meta-tag">{d.category}</span>
                      <span className="meta-tag">{d.target_locale}</span>
                      <span className="meta-tag">{d.chunks} chunks</span>
                      {d.size > 0 && <span className="meta-tag">{formatSize(d.size)}</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="doc-delete"
                    onClick={() => handleDelete(d.name)}
                    disabled={locked}
                    aria-label={`Delete ${d.name}`}
                    title="Delete"
                  >
                    <CloseIcon size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
