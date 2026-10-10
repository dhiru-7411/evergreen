import { STATUS_LABEL, timeAgo, plural } from '../utils/format';

export const FreshnessBadge = ({ status = 'untracked', score }) => (
  <span className={`badge s-${status}`} title={score != null ? `Freshness score ${score}/100` : undefined}>
    {STATUS_LABEL[status]}
  </span>
);

// Package chips coloured by how far behind each one is.
export const StackChips = ({ stack = [], packages = [] }) => {
  if (stack.length === 0) return null;
  const report = Object.fromEntries(packages.map((p) => [p.name, p]));
  return (
    <div className="chips">
      {stack.map(({ name, version }) => {
        const p = report[name];
        const drifted = p && p.status !== 'fresh' && p.status !== 'unknown';
        return (
          <span
            key={name}
            className={`chip ${drifted ? `s-${p.status}` : ''}`}
            title={p?.latest ? `Latest: ${p.latest}` : undefined}
          >
            <b>{name}</b>@{version}
            {drifted && <span aria-label={`latest ${p.latest}`}>→ {p.latest}</span>}
          </span>
        );
      })}
    </div>
  );
};

const HEADLINES = {
  fresh: 'Up to date',
  aging: 'Getting older',
  stale: 'Probably out of date',
  untracked: 'Freshness not tracked',
};

function summary({ status, packages }) {
  const behind = packages.filter((p) => p.status === 'aging' || p.status === 'stale');
  if (status === 'untracked') {
    return packages.length
      ? "We couldn't find these packages on npm, so freshness can't be scored."
      : "This post doesn't declare the packages it depends on, so there's nothing to check.";
  }
  if (behind.length === 0) {
    return status === 'fresh'
      ? `All ${plural(packages.length, 'package')} this post depends on are on their latest major version.`
      : 'Every package is current, but the content itself has not been revised in a long time.';
  }
  const list = behind.map((p) => `${p.name} ${p.declared} → ${p.latest}`).join(', ');
  return status === 'stale'
    ? `Code in this post may not work as written. Breaking releases since it was written: ${list}.`
    : `Newer major versions are out (${list}). Most of this should still apply, but check the release notes.`;
}

export const FreshnessReport = ({ freshness, onRecheck, rechecking, children }) => {
  const { status = 'untracked', score, checkedAt, packages = [] } = freshness || {};
  return (
    <section className={`card report s-${status}`} aria-label="Freshness report">
      <div className="spread">
        <div className="row">
          <FreshnessBadge status={status} score={score} />
          <h3>{HEADLINES[status]}</h3>
          {score != null && <span className="faint">score {score}/100</span>}
        </div>
        {onRecheck && (
          <button className="btn btn-sm btn-ghost" onClick={onRecheck} disabled={rechecking}>
            {rechecking ? 'Checking npm…' : 'Recheck now'}
          </button>
        )}
      </div>
      <p style={{ marginTop: 8 }}>{summary({ status, packages })}</p>

      {packages.length > 0 && (
        <table className="pkg-table">
          <thead>
            <tr>
              <th>Package</th>
              <th>Written for</th>
              <th>Latest</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {packages.map((p) => (
              <tr key={p.name}>
                <td className="mono">{p.name}</td>
                <td className="mono">{p.declared}</td>
                <td className="mono">{p.latest ?? '-'}</td>
                <td>
                  <span className={`badge s-${p.status}`}>
                    {p.behind > 0 ? `${p.behind} behind` : STATUS_LABEL[p.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="spread" style={{ marginTop: 12 }}>
        <span className="faint">{checkedAt ? `Checked against npm ${timeAgo(checkedAt)}` : 'Not checked yet'}</span>
        {children}
      </div>
    </section>
  );
};
