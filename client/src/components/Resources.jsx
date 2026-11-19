import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import UserLink from './UserLink';
import { Empty } from './Status';
import { timeAgo } from '../utils/format';

const KINDS = [
  ['tutorial', 'Tutorial'],
  ['official-docs', 'Official docs'],
  ['video', 'Video'],
  ['course', 'Course'],
  ['article', 'Article'],
];
const KIND_LABEL = Object.fromEntries(KINDS);

const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

// What the automatic version check found, in plain words.
export const VersionBadge = ({ version, packageName }) => {
  if (!version || version.status === 'unknown') {
    return (
      <span className="badge s-untracked" title="The page doesn't say which version it targets">
        Version not stated
      </span>
    );
  }
  if (version.status === 'current') {
    return (
      <span className="badge s-fresh" title={`Written for ${packageName} ${version.mentionedMajor}`}>
        Current (v{version.mentionedMajor})
      </span>
    );
  }
  return (
    <span className="badge s-stale" title={`Latest is ${packageName} ${version.latestMajor}`}>
      Written for v{version.mentionedMajor} · latest v{version.latestMajor}
    </span>
  );
};

const ReportButton = ({ resource }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (!user) return null;
  if (message) return <span className="faint">{message}</span>;
  if (!open) {
    return (
      <button className="btn btn-sm btn-ghost" onClick={() => setOpen(true)}>
        Report a problem
      </button>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.post(`/resources/${resource._id}/report`, { reason });
      setMessage(res.data.message);
    } catch (err) {
      setError(errorMessage(err, 'Could not send report'));
    }
  };

  return (
    <form className="report-form" onSubmit={submit}>
      <input
        className="input"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="What's wrong? e.g. the code no longer works in v19"
        minLength={10}
        maxLength={280}
        required
        aria-label="What's wrong with this resource"
      />
      <button className="btn btn-sm" type="submit">
        Send
      </button>
      <button className="btn btn-sm btn-ghost" type="button" onClick={() => setOpen(false)}>
        Cancel
      </button>
      {error && <span className="field-error">{error}</span>}
    </form>
  );
};

const SuggestForm = ({ topic, onSubmitted }) => {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('tutorial');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setSubmitting(true);
    try {
      const res = await api.post(`/topics/${topic.slug}/resources`, { url, title, kind, description });
      setResult(res.data);
      setUrl('');
      setTitle('');
      setDescription('');
      onSubmitted();
    } catch (err) {
      setError(errorMessage(err, 'Could not submit'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="card suggest-form" onSubmit={submit}>
      <h3>Suggest a resource</h3>
      <p className="faint">
        Share a tutorial, video or doc that teaches {topic.name} well. We open the page to check it's reachable, about{' '}
        {topic.name}, and which version it's written for. Then a reviewer checks it's accurate before it's published.
      </p>
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      {result && (
        <div className="alert alert-ok" role="status">
          {result.message}
        </div>
      )}
      <div className="suggest-grid">
        <label className="field">
          <span>Link</span>
          <input
            className="input"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            required
          />
        </label>
        <label className="field">
          <span>Type</span>
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
            {KINDS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span>Title</span>
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          minLength={5}
          maxLength={160}
          required
        />
      </label>
      <label className="field">
        <span>Why it's useful (optional)</span>
        <input
          className="input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={280}
          placeholder="e.g. Best explanation of Server Components I've found"
        />
      </label>
      <div>
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Checking the page…' : 'Submit for review'}
        </button>
      </div>
    </form>
  );
};

const STATUS_TEXT = { pending: 'Waiting for review', rejected: 'Not accepted' };

const Resources = ({ topic, onChange }) => {
  const { user } = useAuth();
  const packageName = topic.primaryName;

  return (
    <section className="topic-section" id="resources">
      <h2 className="section-title">Community resources</h2>
      {topic.resources.length === 0 ? (
        <Empty>No community resources yet. Be the first to suggest one.</Empty>
      ) : (
        <div className="resource-list">
          {topic.resources.map((r) => (
            <article key={r._id} className="card resource-card">
              <div className="spread">
                <span className="row">
                  <span className="chip">{KIND_LABEL[r.kind] ?? r.kind}</span>
                  <VersionBadge version={r.checks?.version} packageName={packageName} />
                </span>
                <span className="faint mono">{hostOf(r.url)}</span>
              </div>
              <h3>
                <a href={r.url} target="_blank" rel="noopener noreferrer nofollow ugc">
                  {r.title} ↗
                </a>
              </h3>
              {r.description && <p>{r.description}</p>}
              <div className="spread">
                <span className="faint">
                  Suggested by <UserLink user={r.submittedBy} />
                  {r.reviewedBy && r.reviewedBy._id !== r.submittedBy?._id && (
                    <>
                      {' '}
                      · reviewed by <UserLink user={r.reviewedBy} />
                    </>
                  )}
                  {r.reviewedAt && ` ${timeAgo(r.reviewedAt)}`}
                </span>
                <ReportButton resource={r} />
              </div>
            </article>
          ))}
        </div>
      )}

      {topic.myResources?.length > 0 && (
        <div className="my-resources">
          <h3>Your suggestions</h3>
          {topic.myResources.map((r) => (
            <div key={r._id} className="row my-resource">
              <span className={`badge ${r.status === 'rejected' ? 's-stale' : 's-aging'}`}>
                {STATUS_TEXT[r.status]}
              </span>
              <a href={r.url} target="_blank" rel="noopener noreferrer nofollow ugc">
                {r.title}
              </a>
              {r.reviewNote && <span className="faint">: {r.reviewNote}</span>}
            </div>
          ))}
        </div>
      )}

      {user ? (
        <SuggestForm topic={topic} onSubmitted={onChange} />
      ) : (
        <p className="faint suggest-login">
          <Link to="/login">Log in</Link> or <Link to="/register">create an account</Link> to suggest a resource.
        </p>
      )}
    </section>
  );
};

export default Resources;
