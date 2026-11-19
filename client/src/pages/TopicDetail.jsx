import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errorMessage } from '../api/axios';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import PostCard from '../components/PostCard';
import { Loading, ErrorBox, Empty } from '../components/Status';
import { compactNumber, formatDate, timeAgo } from '../utils/format';

const PackageLinks = ({ pkg }) => (
  <span className="pkg-links">
    {pkg.homepage && (
      <a href={pkg.homepage} target="_blank" rel="noreferrer">
        Docs
      </a>
    )}
    {pkg.repository && (
      <a href={pkg.repository} target="_blank" rel="noreferrer">
        Source
      </a>
    )}
    {pkg.npmUrl && (
      <a href={pkg.npmUrl} target="_blank" rel="noreferrer">
        npm
      </a>
    )}
  </span>
);

// "12% of react's downloads": a quick sense of how mainstream each option is.
const share = (downloads, base) => {
  if (downloads == null || !base) return null;
  const pct = (downloads / base) * 100;
  return pct >= 100 ? `${(downloads / base).toFixed(1)}×` : `${pct < 1 ? pct.toFixed(1) : Math.round(pct)}%`;
};

const TopicDetail = () => {
  const { slug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: topic, loading, error } = useFetch(`/topics/${encodeURIComponent(slug)}`);
  const [deleteError, setDeleteError] = useState('');

  if (loading && !topic) return <Loading />;
  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!topic) return null;

  const { primary, primaryName } = topic;
  const extraPackages = topic.packages.slice(1);

  const handleDelete = async () => {
    setDeleteError('');
    try {
      await api.delete(`/topics/${topic.slug}`);
      navigate('/learn');
    } catch (err) {
      setDeleteError(errorMessage(err, 'Could not delete topic'));
    }
  };

  return (
    <>
      <p className="faint">
        <Link to="/learn">← All topics</Link>
      </p>
      <header className="hero topic-hero">
        <h1>{topic.name}</h1>
        {topic.summary && <p>{topic.summary}</p>}
      </header>

      {primary?.deprecated && (
        <div className="alert alert-error" role="alert" style={{ marginBottom: 20 }}>
          <b>{primaryName} is deprecated.</b> {primary.deprecated}
        </div>
      )}

      {primary?.advisoryCount > 0 && (
        <div className="alert alert-warn" style={{ marginBottom: 20 }}>
          {primaryName}@{primary.version} has {primary.advisoryCount} known security{' '}
          {primary.advisoryCount === 1 ? 'advisory' : 'advisories'}. Check the{' '}
          <a
            href={`https://deps.dev/npm/${encodeURIComponent(primaryName)}/${primary.version}`}
            target="_blank"
            rel="noreferrer"
          >
            details
          </a>{' '}
          before using it.
        </div>
      )}

      {primary?.found ? (
        <section className="profile-stats" aria-label="At a glance">
          <div className="card stat">
            <div className="stat-number mono-num">{primary.version}</div>
            <div className="faint">
              latest <span className="mono">{primaryName}</span>
            </div>
          </div>
          <div className="card stat">
            <div className="stat-number">{primary.publishedAt ? timeAgo(primary.publishedAt) : '-'}</div>
            <div className="faint">
              {primary.publishedAt ? `released ${formatDate(primary.publishedAt)}` : 'release date unknown'}
            </div>
          </div>
          <div className="card stat">
            <div className="stat-number">{compactNumber(primary.weeklyDownloads)}</div>
            <div className="faint">downloads last week</div>
          </div>
          <div className="card stat">
            <div className="stat-number">{primary.license || '-'}</div>
            <div className="faint">
              license · <PackageLinks pkg={primary} />
            </div>
          </div>
        </section>
      ) : (
        <div className="alert alert-warn" style={{ marginBottom: 24 }}>
          Couldn't load live data for <span className="mono">{primaryName}</span> from npm. Try again later.
        </div>
      )}

      {extraPackages.length > 0 && (
        <section className="card topic-section">
          <h2 className="section-title">Related packages</h2>
          <table className="pkg-table">
            <thead>
              <tr>
                <th>Package</th>
                <th>Latest</th>
                <th>Released</th>
                <th>Weekly downloads</th>
              </tr>
            </thead>
            <tbody>
              {extraPackages.map((p) => (
                <tr key={p.name}>
                  <td className="mono">{p.name}</td>
                  <td className="mono">{p.version ?? '-'}</td>
                  <td>{p.publishedAt ? timeAgo(p.publishedAt) : '-'}</td>
                  <td>{compactNumber(p.weeklyDownloads)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="topic-section">
        <h2 className="section-title">Alternatives</h2>
        {topic.alternatives.length === 0 ? (
          <Empty>No alternatives listed yet.</Empty>
        ) : (
          <div className="alt-list">
            {topic.alternatives.map((alt) => (
              <article key={alt.name} className="card alt-card">
                <div className="spread">
                  <h3 className="mono">{alt.name}</h3>
                  <span className="row">
                    {alt.deprecated && <span className="badge s-stale">Deprecated</span>}
                    {alt.advisoryCount > 0 && (
                      <span className="badge s-aging" title="Known security advisories for this version">
                        {alt.advisoryCount} {alt.advisoryCount === 1 ? 'advisory' : 'advisories'}
                      </span>
                    )}
                    {alt.found ? (
                      <span className="chip mono">v{alt.version}</span>
                    ) : (
                      <span className="faint">not found on npm</span>
                    )}
                  </span>
                </div>
                {alt.note && <p>{alt.note}</p>}
                {alt.found && (
                  <div className="topic-meta faint">
                    <span>
                      {compactNumber(alt.weeklyDownloads)}/week
                      {share(alt.weeklyDownloads, primary?.weeklyDownloads) &&
                        ` (${share(alt.weeklyDownloads, primary.weeklyDownloads)} of ${primaryName})`}
                    </span>
                    {alt.publishedAt && <span>released {timeAgo(alt.publishedAt)}</span>}
                    <PackageLinks pkg={alt} />
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="topic-section">
        <h2 className="section-title">Learning path</h2>
        <Empty>A step-by-step path for {topic.name}, built from the official docs, is coming soon.</Empty>
      </section>

      <section className="topic-section">
        <h2 className="section-title">Tutorials</h2>
        {topic.posts.length === 0 ? (
          <Empty>No tutorials on Evergreen use {topic.packages.join(', ')} yet.</Empty>
        ) : (
          <div className="post-list">
            {topic.posts.map((post) => (
              <PostCard key={post._id} post={post} />
            ))}
          </div>
        )}
      </section>

      <footer className="spread topic-footer faint">
        <span>{topic.checkedAt ? `Live data from npm, checked ${timeAgo(topic.checkedAt)}` : 'Not checked yet'}</span>
        {user?.role === 'admin' && (
          <span className="row">
            {deleteError && <span className="alert alert-error">{deleteError}</span>}
            <button className="btn btn-sm btn-danger" onClick={handleDelete}>
              Delete topic
            </button>
          </span>
        )}
      </footer>
    </>
  );
};

export default TopicDetail;
