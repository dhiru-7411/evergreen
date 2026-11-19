import { Link } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { Loading, ErrorBox, Empty } from '../components/Status';
import { compactNumber, timeAgo } from '../utils/format';

const TopicCard = ({ topic: t }) => (
  <Link to={`/learn/${t.slug}`} className="card topic-card">
    <div className="spread">
      <h3>{t.name}</h3>
      {t.primary?.found && <span className="chip mono">v{t.primary.version}</span>}
    </div>
    {t.summary && <p>{t.summary}</p>}
    {t.primary?.deprecated && <span className="badge s-stale">Deprecated</span>}
    <div className="topic-meta faint">
      {t.primary?.weeklyDownloads != null && <span>{compactNumber(t.primary.weeklyDownloads)} downloads/week</span>}
      {t.primary?.publishedAt && <span>released {timeAgo(t.primary.publishedAt)}</span>}
      {t.alternativeCount > 0 && <span>{t.alternativeCount} alternatives</span>}
    </div>
  </Link>
);

const Topics = () => {
  const { user } = useAuth();
  const { data: topics, loading, error } = useFetch('/topics');
  const { data: categories } = useFetch('/topics/categories');

  return (
    <>
      <header className="hero">
        <div className="spread">
          <h1>Learn what's current</h1>
          {user?.role === 'admin' && (
            <span className="row">
              <Link to="/learn/review" className="btn">
                Review queue
              </Link>
              <Link to="/learn/new" className="btn btn-primary">
                + New topic
              </Link>
            </span>
          )}
        </div>
        <p>
          The core skills for building software, kept current. Every topic shows the latest version, how widely it's
          used, the alternatives worth knowing and resources checked against what's current today, with every fact
          linked to its source.
        </p>
      </header>

      {loading && !topics && <Loading />}
      {error && <ErrorBox>{error}</ErrorBox>}
      {topics && topics.length === 0 && <Empty>No topics yet.</Empty>}
      {topics &&
        categories &&
        categories.map((cat) => {
          const inCat = topics.filter((t) => t.category === cat.id);
          if (inCat.length === 0) return null;
          return (
            <section key={cat.id} className="topic-section">
              <h2 className="section-title">
                {cat.name} <span className="faint category-blurb">{cat.blurb}</span>
              </h2>
              <div className="topic-grid">
                {inCat.map((t) => (
                  <TopicCard key={t._id} topic={t} />
                ))}
              </div>
            </section>
          );
        })}
    </>
  );
};

export default Topics;
