import { Link } from 'react-router-dom';
import { FreshnessBadge, StackChips } from './Freshness';
import UserLink from './UserLink';
import { formatDate, postPath } from '../utils/format';

const PostCard = ({ post, showAuthor = true }) => (
  <article className="card post-card">
    <div className="spread">
      <FreshnessBadge status={post.freshness?.status} score={post.freshness?.score} />
      <span className="faint">
        rev {post.revision} · {formatDate(post.createdAt)}
      </span>
    </div>
    <h2>
      <Link to={postPath(post)}>{post.title}</Link>
    </h2>
    {post.excerpt && <p>{post.excerpt}</p>}
    <div className="spread">
      <StackChips stack={post.stack} packages={post.freshness?.packages} />
      {showAuthor && (
        <span className="faint">
          by <UserLink user={post.author} />
        </span>
      )}
    </div>
  </article>
);

export default PostCard;
