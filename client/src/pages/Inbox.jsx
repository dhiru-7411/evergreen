import { Link, useSearchParams } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { Loading, ErrorBox, Empty } from '../components/Status';
import { timeAgo } from '../utils/format';

const TABS = {
  review: { label: 'Needs your review', path: '/fixes/inbox' },
  mine: { label: 'Your proposals', path: '/fixes/mine' },
};

const Inbox = () => {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'mine' ? 'mine' : 'review';
  const { data, loading, error } = useFetch(TABS[tab].path);

  return (
    <div className="narrow" style={{ margin: '0 auto' }}>
      <h1>Fixes</h1>
      <p className="muted">Reader-proposed changes work like pull requests: review the diff, then merge or close.</p>

      <div className="tabs" role="tablist">
        {Object.entries(TABS).map(([key, t]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={`tab ${tab === key ? 'active' : ''}`}
            onClick={() => setParams(key === 'mine' ? { tab: 'mine' } : {})}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}
      {loading && <Loading />}
      {!loading &&
        data &&
        (data.length === 0 ? (
          <Empty>
            {tab === 'review'
              ? 'Nothing to review. Readers will send fixes here when your posts drift.'
              : "You haven't proposed any fixes yet. Find a stale post and help keep it current."}
          </Empty>
        ) : (
          <ul className="timeline">
            {data.map((fix) => (
              <li key={fix._id}>
                <Link className="timeline-item" to={`/fixes/${fix._id}`}>
                  <span className={`badge s-${fix.status}`}>{fix.status}</span>
                  <span>
                    <b style={{ fontWeight: 500 }}>{fix.note}</b>
                    <br />
                    <span className="faint">
                      on “{fix.post?.title ?? 'deleted post'}”
                      {fix.proposer && ` · @${fix.proposer.username}`} · {timeAgo(fix.createdAt)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
};

export default Inbox;
