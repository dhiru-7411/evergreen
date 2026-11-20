import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errorMessage } from '../api/axios';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import PostCard from '../components/PostCard';
import Resources from '../components/Resources';
import { LearningPathSection, PathAdmin } from '../components/LearningPath';
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

// Numbered citation linking to the Sources list at the bottom of the page.
// A plain function (not a component) so it can close over this page's numbering.
const makeCite = (sources) => {
  const number = Object.fromEntries(sources.map((s, i) => [s.id, i + 1]));
  return (ids) => {
    const nums = ids.map((id) => number[id]).filter(Boolean);
    if (nums.length === 0) return null;
    return (
      <sup className="cite">
        {nums.map((n) => (
          <a key={n} href={`#source-${n}`} aria-label={`Source ${n}`}>
            [{n}]
          </a>
        ))}
      </sup>
    );
  };
};

const TopicDetail = () => {
  const { slug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: topic, loading, error, reload } = useFetch(`/topics/${encodeURIComponent(slug)}`, user?.id);
  const [deleteError, setDeleteError] = useState('');

  if (loading && !topic) return <Loading />;
  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!topic) return null;

  const { primary, primaryName, sources } = topic;
  const extraPackages = topic.packages.slice(1);
  const cite = makeCite(sources);
  const npm = (name) => `npm:${name}`;
  const depsDev = (name) => `depsdev:${name}`;

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
        {topic.category && <> · {topic.category.name}</>}
      </p>
      <header className="hero topic-hero">
        <h1>{topic.name}</h1>
        {topic.summary && (
          <p>
            {topic.summary}
            {topic.summarySource === 'editor' ? (
              <span className="faint summary-source"> (editor's summary)</span>
            ) : (
              cite([npm(primaryName)])
            )}
          </p>
        )}
      </header>

      {primary?.deprecated && (
        <div className="alert alert-error" role="alert" style={{ marginBottom: 20 }}>
          <b>{primaryName} is deprecated.</b> {primary.deprecated}
          {cite([npm(primaryName)])}
        </div>
      )}

      {primary?.advisoryCount > 0 && (
        <div className="alert alert-warn" style={{ marginBottom: 20 }}>
          {primaryName}@{primary.version} has {primary.advisoryCount} known security{' '}
          {primary.advisoryCount === 1 ? 'advisory' : 'advisories'}. Check the details before using it.
          {cite([depsDev(primaryName)])}
        </div>
      )}

      {primary?.found ? (
        <section className="profile-stats" aria-label="At a glance">
          <div className="card stat">
            <div className="stat-number mono-num">{primary.version}</div>
            <div className="faint">
              latest <span className="mono">{primaryName}</span>
              {cite([npm(primaryName)])}
            </div>
          </div>
          <div className="card stat">
            <div className="stat-number">{primary.publishedAt ? timeAgo(primary.publishedAt) : '-'}</div>
            <div className="faint">
              {primary.publishedAt ? `released ${formatDate(primary.publishedAt)}` : 'release date unknown'}
              {cite([depsDev(primaryName)])}
            </div>
          </div>
          <div className="card stat">
            <div className="stat-number">{compactNumber(primary.weeklyDownloads)}</div>
            <div className="faint">
              downloads last week
              {cite([npm(primaryName)])}
            </div>
          </div>
          <div className="card stat">
            <div className="stat-number">{primary.license || '-'}</div>
            <div className="faint">
              license
              {cite([npm(primaryName)])} · <PackageLinks pkg={primary} />
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
                  <td className="mono">
                    {p.version ?? '-'}
                    {cite([npm(p.name)])}
                  </td>
                  <td>
                    {p.publishedAt ? timeAgo(p.publishedAt) : '-'}
                    {cite([depsDev(p.name)])}
                  </td>
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
                {alt.note && (
                  <p>
                    {alt.note} <span className="faint summary-source">(editor's note)</span>
                  </p>
                )}
                {alt.found && (
                  <div className="topic-meta faint">
                    <span>
                      {compactNumber(alt.weeklyDownloads)}/week
                      {share(alt.weeklyDownloads, primary?.weeklyDownloads) &&
                        ` (${share(alt.weeklyDownloads, primary.weeklyDownloads)} of ${primaryName})`}
                      {cite([npm(alt.name)])}
                    </span>
                    {alt.publishedAt && (
                      <span>
                        released {timeAgo(alt.publishedAt)}
                        {cite([depsDev(alt.name)])}
                      </span>
                    )}
                    <PackageLinks pkg={alt} />
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <LearningPathSection topic={topic} />
      {user?.role === 'admin' && <PathAdmin topic={topic} onPublished={reload} />}

      <Resources topic={topic} onChange={reload} />

      <section className="topic-section">
        <h2 className="section-title">Tutorials on Evergreen</h2>
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

      <section className="topic-section sources" id="sources" aria-label="Sources">
        <h2 className="section-title">Sources</h2>
        <p className="faint">
          Versions, dates, downloads and advisories are fetched automatically from these sources
          {topic.checkedAt && `, last checked ${timeAgo(topic.checkedAt)}`}. Notes marked "editor's" are written by
          Evergreen editors; community resources show who suggested and reviewed them.
        </p>
        <ol>
          {sources.map((s, i) => (
            <li key={s.id} id={`source-${i + 1}`}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.label}
              </a>
              <span className="faint"> · {s.provides}</span>
            </li>
          ))}
        </ol>
      </section>

      {user?.role === 'admin' && (
        <footer className="spread topic-footer faint">
          <Link to="/learn/review">Review queue</Link>
          <span className="row">
            {deleteError && <span className="alert alert-error">{deleteError}</span>}
            <button className="btn btn-sm btn-danger" onClick={handleDelete}>
              Delete topic
            </button>
          </span>
        </footer>
      )}
    </>
  );
};

export default TopicDetail;
