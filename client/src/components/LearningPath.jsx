import { useEffect, useState } from 'react';
import api, { errorMessage } from '../api/axios';
import { useFetch } from '../hooks/useFetch';
import UserLink from './UserLink';
import { Empty } from './Status';
import { formatDate, timeAgo } from '../utils/format';

const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

const hours = (h) => (h == null ? null : h < 1 ? `${Math.round(h * 60)} min` : `${h % 1 ? h.toFixed(1) : h} h`);

// The ordered steps. Used for the public path and for previewing drafts.
export const PathSteps = ({ path, showVerification = false }) => (
  <ol className="path-steps">
    {path.steps.map((s, i) => (
      <li key={i} className="card path-step">
        <div className="spread">
          <h3>
            <span className="step-num">{i + 1}</span> {s.title}
          </h3>
          {hours(s.estimatedHours) && <span className="faint">≈ {hours(s.estimatedHours)}</span>}
        </div>
        <p className="step-goal">{s.goal}</p>
        {s.explanation && <p>{s.explanation}</p>}
        {s.versionNote && (
          <p className="version-note">
            <b>What changed recently:</b> {s.versionNote}
          </p>
        )}
        <div className="topic-meta faint">
          {s.prerequisites?.length > 0 && <span>Builds on step {s.prerequisites.join(', ')}</span>}
          {s.sources.length > 0 && (
            <span className="step-sources">
              Official docs:{' '}
              {s.sources.map((src, j) => (
                <span key={j}>
                  {j > 0 && ' · '}
                  <a href={src.url} target="_blank" rel="noreferrer">
                    {src.title || hostOf(src.url)}
                  </a>
                  {showVerification && (
                    <span className={src.verified ? 'verified' : 'unverified'}>
                      {src.verified ? ' ✓ verified' : ' ⚠ unverified'}
                    </span>
                  )}
                </span>
              ))}
            </span>
          )}
        </div>
      </li>
    ))}
  </ol>
);

// Public section on the topic page.
export const LearningPathSection = ({ topic }) => {
  const path = topic.path;
  return (
    <section className="topic-section" id="learning-path">
      <h2 className="section-title">Learning path</h2>
      {!path ? (
        <Empty>A step-by-step path for {topic.name}, built from the official docs, is coming soon.</Empty>
      ) : (
        <>
          {path.outdated && (
            <div className="alert alert-warn" style={{ marginBottom: 14 }}>
              This path was written for {topic.primaryName} {path.basedOnVersion}. Version {path.currentVersion} is out
              now, so some steps may have changed. An updated path is on its way.
            </div>
          )}
          <p className="path-intro">{path.intro}</p>
          {path.assumedKnowledge?.length > 0 && (
            <p className="faint">Before you start: {path.assumedKnowledge.join(', ')}.</p>
          )}
          <PathSteps path={path} />
          <p className="faint path-credit">
            Drafted with AI from the official {topic.name} docs for version {path.basedOnVersion}, then checked and
            published by <UserLink user={path.reviewedBy} /> {path.reviewedAt && `on ${formatDate(path.reviewedAt)}`}.
            Every linked source was opened during research.
          </p>
        </>
      )}
    </section>
  );
};

const STATUS_BADGE = {
  generating: 's-aging',
  draft: 's-aging',
  published: 's-fresh',
  failed: 's-stale',
  rejected: 's-stale',
  archived: 's-untracked',
};

const Usage = ({ g }) =>
  g ? (
    <span className="faint">
      {g.servedBy || g.model} · effort {g.effort} · {Math.round((g.inputTokens + g.outputTokens) / 1000)}k tokens ·{' '}
      {g.webSearches} searches · {g.webFetches} pages read · {Math.round(g.durationMs / 1000)}s
    </span>
  ) : null;

// Admin panel: generate drafts, review warnings, publish or reject.
export const PathAdmin = ({ topic, onPublished }) => {
  const [refresh, setRefresh] = useState(0);
  const { data, error: loadError } = useFetch(`/topics/${topic.slug}/paths`, refresh);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(null);

  const paths = data?.paths ?? [];
  const generating = paths.some((p) => p.status === 'generating');

  // Poll while a draft is being written.
  useEffect(() => {
    if (!generating) return undefined;
    const t = setInterval(() => setRefresh((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, [generating]);

  const generate = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post(`/topics/${topic.slug}/paths`);
      setRefresh((n) => n + 1);
    } catch (err) {
      setError(errorMessage(err, 'Could not start generation'));
    } finally {
      setBusy(false);
    }
  };

  const review = async (id, action) => {
    setError('');
    try {
      await api.post(`/paths/${id}/${action}`, { reviewNote: note });
      setNote('');
      setRefresh((n) => n + 1);
      if (action === 'publish') onPublished();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <section className="card path-admin" aria-label="Learning path admin">
      <div className="spread">
        <h3>Learning path · admin</h3>
        <button
          className="btn btn-sm btn-primary"
          onClick={generate}
          disabled={busy || generating || data?.aiEnabled === false}
        >
          {generating ? 'Drafting… (1-3 min)' : topic.path ? 'Draft an updated path' : 'Draft a path with AI'}
        </button>
      </div>
      {data?.aiEnabled === false && (
        <p className="faint">AI is not configured on this server (no ANTHROPIC_API_KEY).</p>
      )}
      {(error || loadError) && <div className="alert alert-error">{error || loadError}</div>}
      {paths.length === 0 && <p className="faint">No drafts yet.</p>}

      {paths.map((p) => (
        <div key={p._id} className="path-version">
          <div className="spread">
            <span className="row">
              <span className={`badge ${STATUS_BADGE[p.status]}`}>{p.status}</span>
              <span>
                {p.basedOnVersion ? `for v${p.basedOnVersion}` : ''} · {timeAgo(p.createdAt)}
                {p.requestedBy && (
                  <>
                    {' '}
                    by <UserLink user={p.requestedBy} />
                  </>
                )}
              </span>
            </span>
            {p.steps?.length > 0 && (
              <button className="btn btn-sm btn-ghost" onClick={() => setOpen(open === p._id ? null : p._id)}>
                {open === p._id ? 'Hide' : `Preview ${p.steps.length} steps`}
              </button>
            )}
          </div>
          {p.error && <p className="field-error">{p.error}</p>}
          <Usage g={p.generation} />

          {p.status === 'draft' && (
            <>
              {p.warnings?.length > 0 ? (
                <div className="alert alert-warn">
                  <b>Check these before publishing:</b>
                  <ul>
                    {p.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="faint">✓ Every step cites an official page Claude actually opened.</p>
              )}
              <p className="faint">
                Read each step against its sources. Unverified links are hidden from learners automatically.
              </p>
              <div className="row review-actions">
                <input
                  className="input"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                  placeholder="Review note (optional)"
                  aria-label="Review note"
                />
                <button className="btn btn-sm btn-primary" onClick={() => review(p._id, 'publish')}>
                  Publish
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => review(p._id, 'reject')}>
                  Reject
                </button>
              </div>
            </>
          )}
          {open === p._id && (
            <div className="path-preview">
              <p className="path-intro">{p.intro}</p>
              <PathSteps path={p} showVerification />
            </div>
          )}
        </div>
      ))}
    </section>
  );
};
