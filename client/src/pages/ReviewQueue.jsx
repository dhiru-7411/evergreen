import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api/axios';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import UserLink from '../components/UserLink';
import { VersionBadge } from '../components/Resources';
import { Loading, ErrorBox, Empty } from '../components/Status';
import { timeAgo } from '../utils/format';

const Checks = ({ checks }) => (
  <ul className="check-list">
    <li className={checks?.reachable ? 'ok' : 'bad'}>
      {checks?.reachable ? 'Page opens' : 'Page did not open'}
      {checks?.httpStatus ? ` (HTTP ${checks.httpStatus})` : ''}
    </li>
    <li className={checks?.relevant ? 'ok' : 'bad'}>
      {checks?.relevant ? 'About this topic' : 'May not be about this topic'}: mentions{' '}
      {checks?.matchedTerms?.length ? checks.matchedTerms.join(', ') : 'nothing'} ({checks?.mentions ?? 0}×)
    </li>
    {checks?.pageTitle && <li>Page title: “{checks.pageTitle}”</li>}
  </ul>
);

const ReviewItem = ({ resource, reported, onDone }) => {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const act = async (action) => {
    setBusy(true);
    setError('');
    try {
      await api.post(`/resources/${resource._id}/${action}`, { reviewNote: note });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <article className="card review-item">
      <div className="spread">
        <span className="row">
          <Link to={`/learn/${resource.topic?.slug}`}>{resource.topic?.name}</Link>
          <VersionBadge version={resource.checks?.version} packageName={resource.topic?.name} />
        </span>
        <span className="faint">
          by <UserLink user={resource.submittedBy} /> {timeAgo(resource.createdAt)}
        </span>
      </div>
      <h3>
        <a href={resource.url} target="_blank" rel="noopener noreferrer nofollow">
          {resource.title} ↗
        </a>
      </h3>
      <p className="faint mono break">{resource.url}</p>
      {resource.description && <p>{resource.description}</p>}
      <Checks checks={resource.checks} />

      {reported && (
        <div className="alert alert-warn">
          <b>Reported by readers:</b>
          <ul>
            {resource.reports.map((r, i) => (
              <li key={i}>
                <UserLink user={r.user} />: {r.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="faint">
        Open the page and check that it's accurate and teaches the current version correctly before approving.
      </p>
      {error && <ErrorBox>{error}</ErrorBox>}
      <div className="row review-actions">
        <input
          className="input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={280}
          placeholder="Note to the submitter (shown if rejected)"
          aria-label="Review note"
        />
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => act('approve')}>
          {reported ? 'Keep (reports checked)' : 'Approve'}
        </button>
        <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => act('reject')}>
          {reported ? 'Remove' : 'Reject'}
        </button>
      </div>
    </article>
  );
};

const ReviewQueue = () => {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(user?.role === 'admin' ? '/resources/review' : null);

  if (user?.role !== 'admin') return <ErrorBox>Only admins can review resources.</ErrorBox>;
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!data) return null;

  return (
    <>
      <p className="faint">
        <Link to="/learn">← All topics</Link>
      </p>
      <h1>Review queue</h1>

      <h2 className="section-title">Reported by readers ({data.reported.length})</h2>
      {data.reported.length === 0 ? (
        <Empty>No reports.</Empty>
      ) : (
        <div className="post-list">
          {data.reported.map((r) => (
            <ReviewItem key={r._id} resource={r} reported onDone={reload} />
          ))}
        </div>
      )}

      <h2 className="section-title" style={{ marginTop: 32 }}>
        Waiting for review ({data.pending.length})
      </h2>
      {data.pending.length === 0 ? (
        <Empty>Nothing to review.</Empty>
      ) : (
        <div className="post-list">
          {data.pending.map((r) => (
            <ReviewItem key={r._id} resource={r} onDone={reload} />
          ))}
        </div>
      )}
    </>
  );
};

export default ReviewQueue;
