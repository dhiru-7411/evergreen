import { useParams, useSearchParams } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { usePageMeta } from '../hooks/usePageMeta';
import PostCard from '../components/PostCard';
import { Loading, ErrorBox, Empty } from '../components/Status';
import { formatDate, plural } from '../utils/format';

const scoreStatus = (score) => (score == null ? 'untracked' : score >= 80 ? 'fresh' : score >= 50 ? 'aging' : 'stale');

const Profile = () => {
  const { username } = useParams();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);

  const { data: profile, loading, error } = useFetch(`/users/${encodeURIComponent(username)}`);
  usePageMeta(`@${username}`);
  const authorId = profile?.user.id;
  const { data: posts } = useFetch(
    authorId ? `/posts?${new URLSearchParams({ author: authorId, page, limit: 10 })}` : null,
  );

  if (loading && !profile) return <Loading />;
  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!profile) return null;

  const { user, averageScore, fixes } = profile;
  const status = scoreStatus(averageScore);

  return (
    <>
      <header className="hero profile-hero">
        <h1>@{user.username}</h1>
        <p className="faint">Joined {formatDate(user.joinedAt)}</p>
      </header>

      <section className="profile-stats" aria-label="Profile summary">
        <div className="card stat">
          <div className="stat-number">{profile.posts.total}</div>
          <div className="faint">{profile.posts.total === 1 ? 'post' : 'posts'}</div>
        </div>
        <div className="card stat">
          <div className="stat-number" style={{ color: `var(--${status})` }}>
            {averageScore ?? '-'}
          </div>
          <div className="faint">average freshness</div>
        </div>
        <div className="card stat">
          <div className="stat-number">{fixes.merged}</div>
          <div className="faint">
            {fixes.merged === 1 ? 'fix' : 'fixes'} merged into others' posts
            {fixes.open > 0 && ` · ${fixes.open} open`}
          </div>
        </div>
      </section>

      <h2 className="section-title">Posts</h2>
      {!posts && <Loading label="Loading posts…" />}
      {posts &&
        (posts.items.length === 0 ? (
          <Empty>@{user.username} hasn't published anything yet.</Empty>
        ) : (
          <div className="post-list">
            {posts.items.map((post) => (
              <PostCard key={post._id} post={post} showAuthor={false} />
            ))}
          </div>
        ))}

      {posts && posts.totalPages > 1 && (
        <nav className="pagination" aria-label="Pagination">
          <button className="btn btn-sm" disabled={page <= 1} onClick={() => setParams({ page: page - 1 })}>
            ← Newer
          </button>
          <span className="faint">
            Page {page} of {posts.totalPages} · {plural(posts.total, 'post')}
          </span>
          <button
            className="btn btn-sm"
            disabled={page >= posts.totalPages}
            onClick={() => setParams({ page: page + 1 })}
          >
            Older →
          </button>
        </nav>
      )}
    </>
  );
};

export default Profile;
