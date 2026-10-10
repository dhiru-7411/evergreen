import { Link } from 'react-router-dom';

const NotFound = () => (
  <div className="empty">
    <h1>Page not found</h1>
    <p>
      This page doesn't exist, or it was removed. <Link to="/">Back to all posts</Link>
    </p>
  </div>
);

export default NotFound;
