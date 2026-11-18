import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import PostCard from '../components/PostCard';
import { Loading, ErrorBox, Empty } from '../components/Status';
import { plural } from '../utils/format';

const FILTERS = ['all', 'fresh', 'aging', 'stale', 'untracked'];
const COLORS = { fresh: 'var(--fresh)', aging: 'var(--aging)', stale: 'var(--stale)', untracked: 'var(--untracked)' };

const Health = ({ stats }) => {
  const tracked = stats.fresh + stats.aging + stats.stale;
  const pct = tracked ? Math.round((stats.fresh / tracked) * 100) : null;
  return (
    <section className="card health" aria-label="Blog freshness">
      <div>
        <div className="health-number">{pct == null ? '-' : `${pct}%`}</div>
        <div className="faint">of tracked posts are current</div>
      </div>
      <div>
        <div className="health-bar" role="img" aria-label="Posts by freshness">
          {['fresh', 'aging', 'stale', 'untracked'].map(
            (s) => stats[s] > 0 && <span key={s} style={{ flex: stats[s], background: COLORS[s] }} />,
          )}
        </div>
        <div className="legend">
          {['fresh', 'aging', 'stale', 'untracked'].map((s) => (
            <span key={s}>
              <i style={{ background: COLORS[s] }} />
              {stats[s]} {s}
            </span>
          ))}
          <span>
            · {plural(stats.mergedFixes, 'reader fix')} merged, {stats.openFixes} open
          </span>
        </div>
      </div>
    </section>
  );
};

const Home = () => {
  const [params, setParams] = useSearchParams();
  const status = FILTERS.includes(params.get('status')) ? params.get('status') : 'all';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const q = params.get('q') ?? '';
  const [text, setText] = useState(q);
  const [syncedQ, setSyncedQ] = useState(q);
  if (q !== syncedQ) {
    // The URL changed underneath us (back button, logo link): follow it.
    setSyncedQ(q);
    setText(q);
  }
  const timer = useRef();

  const query = new URLSearchParams({ page, limit: 10, ...(status !== 'all' && { status }), ...(q && { q }) });
  const { data, loading, error } = useFetch(`/posts?${query}`);
  const { data: stats } = useFetch('/posts/stats');

  const go = (next) =>
    setParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v && v !== 'all' && v !== 1)));

  // Typing updates the box immediately and the URL (and so the query) once it settles.
  const onSearch = (e) => {
    const value = e.target.value;
    setText(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setSyncedQ(value.trim());
      go({ status, q: value.trim() });
    }, 300);
  };

  return (
    <>
      <header className="hero">
        <h1>Tutorials that tell you when they're out of date.</h1>
        <p>
          Every post declares the packages it was written for. Evergreen checks them against npm and flags posts as they
          drift. Spot something outdated? Propose a fix and get credited when it's merged.
        </p>
      </header>

      {stats && <Health stats={stats} />}

      <form className="search" role="search" onSubmit={(e) => e.preventDefault()}>
        <input
          className="input"
          type="search"
          placeholder="Search posts or packages, e.g. react"
          aria-label="Search posts"
          value={text}
          onChange={onSearch}
        />
      </form>

      <div className="tabs" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={status === f}
            className={`tab ${status === f ? 'active' : ''}`}
            onClick={() => go({ status: f, q })}
          >
            {f[0].toUpperCase() + f.slice(1)}
            {stats && <span className="faint">{f === 'all' ? stats.total : stats[f]}</span>}
          </button>
        ))}
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}
      {loading && !data && <Loading label="Loading posts…" />}
      {data &&
        (data.items.length === 0 ? (
          <Empty>
            {q ? (
              `No posts match “${q}”.`
            ) : status === 'all' ? (
              <>
                No posts yet. <Link to="/create">Write the first one.</Link>
              </>
            ) : (
              `No ${status} posts right now.`
            )}
          </Empty>
        ) : (
          <div className="post-list" style={{ opacity: loading ? 0.6 : 1 }}>
            {data.items.map((post) => (
              <PostCard key={post._id} post={post} />
            ))}
          </div>
        ))}

      {data && data.totalPages > 1 && (
        <nav className="pagination" aria-label="Pagination">
          <button className="btn btn-sm" disabled={page <= 1} onClick={() => go({ status, q, page: page - 1 })}>
            ← Newer
          </button>
          <span className="faint">
            Page {page} of {data.totalPages}
          </span>
          <button
            className="btn btn-sm"
            disabled={page >= data.totalPages}
            onClick={() => go({ status, q, page: page + 1 })}
          >
            Older →
          </button>
        </nav>
      )}
    </>
  );
};

export default Home;
