import { useMemo } from 'react';
import { diffLines } from 'diff';

const CONTEXT = 3;

// Splits jsdiff output into one entry per line, then folds long unchanged runs
// down to a few lines of context, like a GitHub diff.
function buildRows(oldText, newText) {
  const lines = [];
  for (const part of diffLines(oldText ?? '', newText ?? '')) {
    const kind = part.added ? 'add' : part.removed ? 'del' : 'same';
    const values = part.value.replace(/\n$/, '').split('\n');
    for (const value of values) lines.push({ kind, value });
  }

  const rows = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].kind !== 'same') {
      rows.push(lines[i++]);
      continue;
    }
    let j = i;
    while (j < lines.length && lines[j].kind === 'same') j++;
    const run = lines.slice(i, j);
    const keepHead = i === 0 ? 0 : CONTEXT;
    const keepTail = j === lines.length ? 0 : CONTEXT;
    if (run.length > keepHead + keepTail + 1) {
      rows.push(...run.slice(0, keepHead));
      rows.push({ kind: 'fold', value: `${run.length - keepHead - keepTail} unchanged lines` });
      rows.push(...run.slice(run.length - keepTail));
    } else {
      rows.push(...run);
    }
    i = j;
  }
  return rows;
}

const SIGN = { add: '+', del: '−', same: ' ' };

export const DiffView = ({ oldText, newText, label }) => {
  const rows = useMemo(() => buildRows(oldText, newText), [oldText, newText]);
  const added = rows.filter((r) => r.kind === 'add').length;
  const removed = rows.filter((r) => r.kind === 'del').length;

  return (
    <div className="diff">
      <div className="diff-head spread">
        <span>{label}</span>
        <span className="diff-summary">
          {added === 0 && removed === 0 ? (
            'No changes'
          ) : (
            <>
              <span className="plus">+{added}</span> <span className="minus">−{removed}</span>
            </>
          )}
        </span>
      </div>
      {(added > 0 || removed > 0) && (
        <div className="diff-body">
          {rows.map((row, idx) =>
            row.kind === 'fold' ? (
              <div key={idx} className="diff-fold">
                ⋯ {row.value}
              </div>
            ) : (
              <div key={idx} className={`diff-line ${row.kind}`} data-sign={SIGN[row.kind]}>
                <span>{row.value || ' '}</span>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};

const stackText = (stack = []) => stack.map((s) => `${s.name}@${s.version}`).join('\n');

// Full comparison of two post snapshots: title, stack and body.
export const SnapshotDiff = ({ from, to }) => (
  <div className="stack-gap">
    {from.title !== to.title && <DiffView label="Title" oldText={from.title} newText={to.title} />}
    {stackText(from.stack) !== stackText(to.stack) && (
      <DiffView label="Stack" oldText={stackText(from.stack)} newText={stackText(to.stack)} />
    )}
    <DiffView label="Content" oldText={from.content} newText={to.content} />
  </div>
);
