import { useState } from 'react';
import Markdown from './Markdown';

const StackEditor = ({ value, onChange }) => {
  const update = (idx, key, v) => onChange(value.map((item, i) => (i === idx ? { ...item, [key]: v } : item)));
  const remove = (idx) => onChange(value.filter((_, i) => i !== idx));

  return (
    <div className="stack-editor">
      {value.map((item, idx) => (
        <div className="stack-row" key={idx}>
          <input
            className="input mono"
            placeholder="package (e.g. react)"
            aria-label="Package name"
            value={item.name}
            onChange={(e) => update(idx, 'name', e.target.value)}
          />
          <input
            className="input mono"
            placeholder="18.2"
            aria-label="Version"
            value={item.version}
            onChange={(e) => update(idx, 'version', e.target.value)}
          />
          <button type="button" className="btn btn-ghost" onClick={() => remove(idx)} aria-label="Remove package">
            ✕
          </button>
        </div>
      ))}
      <div>
        <button type="button" className="btn btn-sm" onClick={() => onChange([...value, { name: '', version: '' }])}>
          + Add package
        </button>
      </div>
    </div>
  );
};

/**
 * Shared editor for creating, editing and proposing fixes to a post.
 * `noteLabel` turns on the change-note field (edits and fixes need one).
 */
const PostForm = ({ initial, submitLabel, noteLabel, notePlaceholder, onSubmit, error, children }) => {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [stack, setStack] = useState(
    initial?.stack?.length ? initial.stack.map(({ name, version }) => ({ name, version })) : []
  );
  const [note, setNote] = useState('');
  const [tab, setTab] = useState('write');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        title,
        content,
        stack: stack.filter((s) => s.name.trim() || s.version.trim()),
        ...(noteLabel && { note }),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="editor" onSubmit={handleSubmit}>
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      {children}

      <label className="field">
        <span>Title</span>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} />
      </label>

      <div className="field">
        <span>Stack</span>
        <span className="hint">
          The npm packages and versions this post was written against. Evergreen watches them and flags the post when
          they move on.
        </span>
        <StackEditor value={stack} onChange={setStack} />
      </div>

      <div className="field">
        <div className="tabs" role="tablist" style={{ marginBottom: 0 }}>
          {['write', 'preview'].map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={`tab ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'write' ? 'Write' : 'Preview'}
            </button>
          ))}
        </div>
        {tab === 'write' ? (
          <textarea
            className="textarea"
            aria-label="Content (Markdown)"
            placeholder="Write in Markdown. Fenced code blocks get syntax highlighting."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
          />
        ) : (
          <div className="preview">{content.trim() ? <Markdown>{content}</Markdown> : <p className="faint">Nothing to preview yet.</p>}</div>
        )}
      </div>

      {noteLabel && (
        <label className="field">
          <span>{noteLabel}</span>
          <input
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={notePlaceholder}
            required
            minLength={3}
            maxLength={280}
          />
        </label>
      )}

      <div>
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
};

export default PostForm;
