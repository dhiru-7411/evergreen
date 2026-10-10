import { Link, useSearchParams } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { FreshnessBadge, StackChips } from '../components/Freshness';
import { Loading, ErrorBox, Empty } from '../components/Status';
import { formatDate, plural } from '../utils/format';

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
            (s) => stats[s] > 0 && <span key={s} style={{ flex: stats[s], background: COLORS[s] }} />
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

const PostCard = ({ post }) => (
  <article className="card post-card">
    <div className="spread">
      <FreshnessBadge status={post.freshness?.status} score={post.freshness?.score} />
      <span className="faint">
        rev {post.revision} · {formatDate(post.createdAt)}
      </span>
    </div>
    <h2>
      <Link to={`/posts/${post._id}`}>{post.title}</Link>
    </h2>
    {post.excerpt && <p>{post.excerpt}</p>}
    <div className="spread">
      <StackChips stack={post.stack} packages={post.freshness?.packages} />
      <span className="faint">by @{post.author?.username ?? 'deleted'}</span>
    </div>
  </article>
);

const Home = () => {
  const [params, setParams] = useSearchParams();
  const status = FILTERS.includes(params.get('status')) ? params.get('status') : 'all';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const query = new URLSearchParams({ page, limit: 10, ...(status !== 'all' && { status }) });
  const { data, loading, error } = useFetch(`/posts?${query}`);
  const { data: stats } = useFetch('/posts/stats');

  const go = (next) => setParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v && v !== 'all' && v !== 1)));

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

      <div className="tabs" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={status === f}
            className={`tab ${status === f ? 'active' : ''}`}
            onClick={() => go({ status: f })}
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
            {status === 'all' ? (
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
          <button className="btn btn-sm" disabled={page <= 1} onClick={() => go({ status, page: page - 1 })}>
            ← Newer
          </button>
          <span className="faint">
            Page {page} of {data.totalPages}
          </span>
          <button
            className="btn btn-sm"
            disabled={page >= data.totalPages}
            onClick={() => go({ status, page: page + 1 })}
          >
            Older →
          </button>
        </nav>
      )}
    </>
  );
};

export default Home;
