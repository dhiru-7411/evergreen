import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errorMessage } from '../api/axios';
import { useFetch } from '../hooks/useFetch';
import { SnapshotDiff } from '../components/DiffView';
import { Loading, ErrorBox } from '../components/Status';
import { formatDate, timeAgo } from '../utils/format';
import UserLink from '../components/UserLink';

const FixReview = () => {
  const { fixId } = useParams();
  const navigate = useNavigate();
  const { data: fix, loading, error, reload } = useFetch(`/fixes/${fixId}`);
  const [reviewNote, setReviewNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  if (loading && !fix) return <Loading />;
  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!fix) return null;

  const act = async (action, body) => {
    setBusy(true);
    setActionError('');
    try {
      await api.post(`/fixes/${fixId}/${action}`, { ...body, ...(reviewNote.trim() && { reviewNote }) });
      if (action === 'merge') navigate(`/posts/${fix.post._id}`);
      else reload();
    } catch (err) {
      setActionError(errorMessage(err));
      reload();
    } finally {
      setBusy(false);
    }
  };

  const proposed = { title: fix.title, content: fix.content, stack: fix.stack };

  return (
    <>
      <p className="faint">
        <Link to={`/posts/${fix.post._id}`}>← {fix.post.title}</Link>
      </p>

      <div className="row" style={{ marginBottom: 8 }}>
        <span className={`badge s-${fix.status}`}>{fix.status}</span>
        <span className="faint">
          proposed by <UserLink user={fix.proposer} /> {timeAgo(fix.createdAt)} · based on revision {fix.baseRevision}
        </span>
      </div>
      <h1 style={{ fontSize: '1.8rem' }}>{fix.note}</h1>

      {fix.status !== 'open' && (
        <p className="muted">
          {fix.status === 'merged'
            ? `Merged as revision ${fix.mergedRevision} on ${formatDate(fix.reviewedAt)}.`
            : `Closed on ${formatDate(fix.reviewedAt)}.`}
          {fix.reviewNote && <> Author's note: “{fix.reviewNote}”</>}
        </p>
      )}

      {fix.outdated && (
        <div className="alert alert-warn" style={{ margin: '16px 0' }}>
          The post has been revised since this fix was proposed (now at revision {fix.post.revision}). The diff below is
          against revision {fix.baseRevision}; merging anyway replaces the current version with this proposal.
        </div>
      )}

      {actionError && (
        <div style={{ margin: '16px 0' }}>
          <ErrorBox>{actionError}</ErrorBox>
        </div>
      )}

      {fix.canReview && (
        <section className="card" style={{ padding: 18, margin: '20px 0' }} aria-label="Review">
          <label className="field">
            <span>Note to @{fix.proposer?.username} (optional)</span>
            <input
              className="input"
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              maxLength={280}
              placeholder="Thanks! Or: why you're not merging this"
            />
          </label>
          <div className="row" style={{ marginTop: 12 }}>
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={() => act('merge', { force: Boolean(fix.outdated) })}
            >
              {fix.outdated ? 'Merge anyway' : `Merge as revision ${fix.post.revision + 1}`}
            </button>
            <button className="btn btn-danger" disabled={busy} onClick={() => act('reject')}>
              Close without merging
            </button>
          </div>
        </section>
      )}

      <h2 style={{ fontSize: '1.2rem', marginTop: 28 }}>Proposed changes</h2>
      {fix.base ? (
        <SnapshotDiff from={fix.base} to={proposed} />
      ) : (
        <ErrorBox>The base revision for this fix is missing.</ErrorBox>
      )}
    </>
  );
};

export default FixReview;
