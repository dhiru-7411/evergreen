import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { SnapshotDiff } from '../components/DiffView';
import Markdown from '../components/Markdown';
import { Loading, ErrorBox } from '../components/Status';
import { formatDate, timeAgo } from '../utils/format';
import UserLink from '../components/UserLink';

const RevisionDiff = ({ postId, number }) => {
  const { data: current, error } = useFetch(`/posts/${postId}/revisions/${number}`);
  const { data: previous } = useFetch(number > 1 ? `/posts/${postId}/revisions/${number - 1}` : null);

  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!current || (number > 1 && !previous)) return <Loading />;

  return (
    <div className="stack-gap">
      <div>
        <h2 style={{ fontSize: '1.3rem', marginBottom: 4 }}>
          Revision {current.number}: {current.note}
        </h2>
        <p className="faint" style={{ margin: 0 }}>
          <UserLink user={current.editor} /> · {formatDate(current.createdAt)}
          {current.fixRequest && (
            <>
              {' · '}
              <Link to={`/fixes/${current.fixRequest}`}>merged from a reader fix</Link>
            </>
          )}
        </p>
      </div>
      {previous ? (
        <SnapshotDiff from={previous} to={current} />
      ) : (
        <div className="card" style={{ padding: '4px 22px' }}>
          <Markdown>{current.content}</Markdown>
        </div>
      )}
    </div>
  );
};

const History = () => {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const { data: post } = useFetch(`/posts/${id}`);
  const { data: revisions, loading, error } = useFetch(`/posts/${id}/revisions`);

  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (loading || !revisions) return <Loading />;

  const selected = Number(params.get('rev')) || revisions[0]?.number;

  return (
    <>
      <p className="faint">
        <Link to={`/posts/${id}`}>← {post?.title ?? 'Back to post'}</Link>
      </p>
      <h1>History</h1>
      <p className="muted">Every change to this post is kept. Pick a revision to see what changed.</p>

      <div className="layout-2" style={{ marginTop: 24 }}>
        <ol className="timeline" aria-label="Revisions">
          {revisions.map((rev) => (
            <li key={rev._id}>
              <button
                className={`timeline-item ${rev.number === selected ? 'selected' : ''}`}
                onClick={() => setParams({ rev: rev.number })}
                aria-current={rev.number === selected}
              >
                <span className="rev-num">r{rev.number}</span>
                <span>
                  <b style={{ fontWeight: 500 }}>{rev.note}</b>
                  <br />
                  <span className="faint">
                    {rev.editor?.username ? `@${rev.editor.username}` : '@deleted'} · {timeAgo(rev.createdAt)}
                    {rev.fixRequest && ' · reader fix'}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
        <div>{selected && <RevisionDiff key={selected} postId={id} number={selected} />}</div>
      </div>
    </>
  );
};

export default History;
