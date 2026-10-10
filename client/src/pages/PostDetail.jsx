import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import api, { errorMessage } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import { FreshnessReport, StackChips } from '../components/Freshness';
import Markdown from '../components/Markdown';
import { Loading, ErrorBox } from '../components/Status';
import { formatDate, timeAgo, plural } from '../utils/format';

const PostDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: post, loading, error, reload } = useFetch(`/posts/${id}`);
  const [actionError, setActionError] = useState('');
  const [rechecking, setRechecking] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm('Delete this post and its whole revision history?')) return;
    try {
      await api.delete(`/posts/${id}`);
      navigate('/');
    } catch (err) {
      setActionError(errorMessage(err, 'Failed to delete post'));
    }
  };

  const handleRecheck = async () => {
    setRechecking(true);
    setActionError('');
    try {
      await api.post(`/posts/${id}/freshness`);
      reload();
    } catch (err) {
      setActionError(errorMessage(err, 'Recheck failed'));
    } finally {
      setRechecking(false);
    }
  };

  if (loading && !post) return <Loading />;
  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!post) return null;

  const isOwner = user && post.author?._id === user.id;
  const revised = post.revision > 1;

  return (
    <article className="narrow" style={{ margin: '0 auto' }}>
      <header className="article-header">
        <StackChips stack={post.stack} packages={post.freshness?.packages} />
        <h1>{post.title}</h1>
        <p className="byline">
          By <b>@{post.author?.username ?? 'deleted'}</b> · {formatDate(post.createdAt)}
          {revised && (
            <>
              {' · '}
              <Link to={`/posts/${id}/history`}>
                revision {post.revision}, updated {timeAgo(post.lastRevisedAt)}
              </Link>
            </>
          )}
          {post.contributors?.length > 0 && (
            <> · with fixes from {post.contributors.map((c) => `@${c.username}`).join(', ')}</>
          )}
        </p>
      </header>

      <FreshnessReport freshness={post.freshness} onRecheck={user ? handleRecheck : undefined} rechecking={rechecking}>
        {!isOwner && post.freshness?.status !== 'fresh' && (
          <Link className="btn btn-sm btn-primary" to={`/posts/${id}/suggest`}>
            Suggest a fix
          </Link>
        )}
        {isOwner && post.freshness?.status !== 'fresh' && post.freshness?.status !== 'untracked' && (
          <Link className="btn btn-sm btn-primary" to={`/posts/${id}/edit`}>
            Update this post
          </Link>
        )}
      </FreshnessReport>

      {actionError && (
        <div style={{ marginTop: 16 }}>
          <ErrorBox>{actionError}</ErrorBox>
        </div>
      )}

      <div style={{ marginTop: 28 }}>
        <Markdown>{post.content}</Markdown>
      </div>

      <div className="actions">
        <Link className="btn" to={`/posts/${id}/history`}>
          History ({plural(post.revision, 'revision')})
        </Link>
        {isOwner ? (
          <>
            <Link className="btn" to={`/posts/${id}/edit`}>
              Edit
            </Link>
            {post.openFixCount > 0 && (
              <Link className="btn" to="/inbox">
                Review {plural(post.openFixCount, 'open fix')}
              </Link>
            )}
            <button className="btn btn-danger" onClick={handleDelete}>
              Delete
            </button>
          </>
        ) : (
          <Link className="btn" to={`/posts/${id}/suggest`}>
            Suggest a fix
          </Link>
        )}
      </div>
    </article>
  );
};

export default PostDetail;
