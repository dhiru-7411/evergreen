import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api/axios';
import { useFetch } from '../hooks/useFetch';
import { usePageMeta } from '../hooks/usePageMeta';
import { useAuth } from '../context/AuthContext';
import UserLink from '../components/UserLink';
import { Loading, ErrorBox, Empty } from '../components/Status';
import { timeAgo } from '../utils/format';

const TABS = [
  ['', 'Open'],
  ['done', 'Added'],
  ['declined', 'Declined'],
];
const STATUS = {
  open: ['s-untracked', 'Open'],
  planned: ['s-aging', 'Planned'],
  done: ['s-fresh', 'Added'],
  declined: ['s-stale', 'Declined'],
};

const RequestForm = ({ categories, onCreated }) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [packageName, setPackageName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post('/topic-requests', { name, category, packageName, description });
      setName('');
      setPackageName('');
      setDescription('');
      onCreated();
    } catch (err) {
      setError({ message: errorMessage(err, 'Could not send request'), details: err.response?.data?.details });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card suggest-form" onSubmit={submit}>
      <h3>Request a topic</h3>
      <p className="faint">
        Evergreen covers the core skills for building software. Ask for a library, framework or tool in one of these
        areas, and upvote other requests you'd like to see.
      </p>
      {error && (
        <div className="alert alert-error" role="alert">
          {error.message}
          {error.details?.topic && (
            <>
              {' '}
              <Link to={`/learn/${error.details.topic.slug}`}>Go to {error.details.topic.name} →</Link>
            </>
          )}
        </div>
      )}
      <div className="suggest-grid">
        <label className="field">
          <span>Topic</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Vue, Docker, Prisma"
            minLength={2}
            maxLength={60}
            required
          />
        </label>
        <label className="field">
          <span>Area</span>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)} required>
            <option value="" disabled>
              Choose…
            </option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span>npm package (optional)</span>
        <input
          className="input mono"
          value={packageName}
          onChange={(e) => setPackageName(e.target.value)}
          placeholder="e.g. vue"
        />
        <span className="hint">If you know it, it helps us track the right versions.</span>
      </label>
      <label className="field">
        <span>Why do you want it? (optional)</span>
        <input
          className="input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          placeholder="e.g. Most tutorials I find are for Vue 2"
        />
      </label>
      <div>
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Sending…' : 'Request topic'}
        </button>
      </div>
    </form>
  );
};

const AdminControls = ({ request, onChange }) => {
  const [note, setNote] = useState(request.adminNote);
  const [error, setError] = useState('');

  const set = async (status) => {
    setError('');
    try {
      await api.patch(`/topic-requests/${request._id}`, { status, adminNote: note });
      onChange();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="row review-actions">
      <input
        className="input"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={280}
        placeholder="Note shown to everyone (optional)"
        aria-label="Admin note"
      />
      {request.status !== 'planned' && (
        <button className="btn btn-sm" onClick={() => set('planned')}>
          Mark planned
        </button>
      )}
      {request.status !== 'declined' && (
        <button className="btn btn-sm btn-danger" onClick={() => set('declined')}>
          Decline
        </button>
      )}
      {request.status !== 'open' && (
        <button className="btn btn-sm btn-ghost" onClick={() => set('open')}>
          Reopen
        </button>
      )}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
};

const RequestCard = ({ request, user, onChange }) => {
  const [state, setState] = useState({ voteCount: request.voteCount, voted: request.voted });
  const [error, setError] = useState('');
  const canVote = ['open', 'planned'].includes(request.status);
  const [badge, label] = STATUS[request.status];

  const vote = async () => {
    setError('');
    try {
      const res = await api.post(`/topic-requests/${request._id}/vote`);
      setState(res.data);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <article className="card request-card">
      <button
        className={`vote ${state.voted ? 'voted' : ''}`}
        onClick={vote}
        disabled={!user || !canVote}
        aria-pressed={state.voted}
        title={user ? (state.voted ? 'Remove your vote' : 'Upvote') : 'Log in to vote'}
      >
        <span aria-hidden="true">▲</span>
        <b>{state.voteCount}</b>
      </button>
      <div className="request-body">
        <div className="row">
          <h3>{request.name}</h3>
          <span className={`badge ${badge}`}>{label}</span>
          {request.packageName && <span className="chip mono">{request.packageName}</span>}
        </div>
        {request.description && <p>{request.description}</p>}
        {request.adminNote && (
          <p className="admin-note">
            <b>Editor:</b> {request.adminNote}
          </p>
        )}
        {request.topic && (
          <p>
            <Link to={`/learn/${request.topic.slug}`}>See the {request.topic.name} topic →</Link>
          </p>
        )}
        <span className="faint">
          Requested by <UserLink user={request.requestedBy} /> {timeAgo(request.createdAt)}
        </span>
        {error && <span className="field-error">{error}</span>}
        {user?.role === 'admin' && request.status !== 'done' && <AdminControls request={request} onChange={onChange} />}
      </div>
    </article>
  );
};

const TopicRequests = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState('');
  const { data: categories } = useFetch('/topics/categories');
  usePageMeta('Requested topics', 'Vote for what Evergreen should cover next.');
  const { data, loading, error, reload } = useFetch(`/topic-requests${tab ? `?status=${tab}` : ''}`, user?.id);
  const areaName = Object.fromEntries((categories ?? []).map((c) => [c.id, c.name]));

  return (
    <>
      <p className="faint">
        <Link to="/learn">← All topics</Link>
      </p>
      <header className="hero topic-hero">
        <h1>Requested topics</h1>
        <p>What should Evergreen cover next? The most-wanted topics get researched first.</p>
      </header>

      <div className="tabs" role="tablist">
        {TABS.map(([value, text]) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            className={`tab ${tab === value ? 'active' : ''}`}
            onClick={() => setTab(value)}
          >
            {text}
          </button>
        ))}
      </div>

      {loading && !data && <Loading />}
      {error && <ErrorBox>{error}</ErrorBox>}
      {data &&
        (data.length === 0 ? (
          <Empty>{tab ? 'Nothing here yet.' : 'No open requests. Be the first to ask for a topic.'}</Empty>
        ) : (
          <div className="request-list">
            {data.map((r) => (
              <div key={r._id}>
                <span className="faint request-area">{areaName[r.category]}</span>
                <RequestCard request={r} user={user} onChange={reload} />
              </div>
            ))}
          </div>
        ))}

      <section className="topic-section" style={{ marginTop: 28 }}>
        {user ? (
          <RequestForm categories={categories} onCreated={() => (tab ? setTab('') : reload())} />
        ) : (
          <p className="faint">
            <Link to="/login">Log in</Link> or <Link to="/register">create an account</Link> to request topics and vote.
          </p>
        )}
      </section>
    </>
  );
};

export default TopicRequests;
