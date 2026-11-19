import { Link } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { Loading, ErrorBox, Empty } from '../components/Status';
import { compactNumber, timeAgo } from '../utils/format';

const Topics = () => {
  const { user } = useAuth();
  const { data: topics, loading, error } = useFetch('/topics');

  return (
    <>
      <header className="hero">
        <div className="spread">
          <h1>Learn what's current</h1>
          {user?.role === 'admin' && (
            <Link to="/learn/new" className="btn btn-primary">
              + New topic
            </Link>
          )}
        </div>
        <p>
          Every topic shows the latest version, how widely it's used, the alternatives worth knowing and tutorials
          checked against what's current today. Data comes live from npm.
        </p>
      </header>

      {loading && !topics && <Loading />}
      {error && <ErrorBox>{error}</ErrorBox>}
      {topics &&
        (topics.length === 0 ? (
          <Empty>No topics yet.</Empty>
        ) : (
          <div className="topic-grid">
            {topics.map((t) => (
              <Link key={t._id} to={`/learn/${t.slug}`} className="card topic-card">
                <div className="spread">
                  <h2>{t.name}</h2>
                  {t.primary?.found && <span className="chip mono">v{t.primary.version}</span>}
                </div>
                {t.summary && <p>{t.summary}</p>}
                {t.primary?.deprecated && <span className="badge s-stale">Deprecated</span>}
                <div className="topic-meta faint">
                  {t.primary?.weeklyDownloads != null && (
                    <span>{compactNumber(t.primary.weeklyDownloads)} downloads/week</span>
                  )}
                  {t.primary?.publishedAt && <span>released {timeAgo(t.primary.publishedAt)}</span>}
                  {t.alternativeCount > 0 && <span>{t.alternativeCount} alternatives</span>}
                </div>
              </Link>
            ))}
          </div>
        ))}
    </>
  );
};

export default Topics;
