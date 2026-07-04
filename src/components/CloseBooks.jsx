import { useState } from 'react';
import { useClosedPeriods } from '../hooks/useClosedPeriods';
import { currentMonthKey, monthRangeKeys, shiftMonthKey } from '../lib/trendsEngine';

function formatMonth(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export default function CloseBooks() {
  const { closedPeriods, loading, isMonthClosed, closePeriod, reopenPeriod } = useClosedPeriods();
  const [error, setError] = useState('');
  const [busyMonth, setBusyMonth] = useState(null);

  const thisMonth = currentMonthKey();
  // Show the last 12 months, most recent first, up through the month before this one --
  // that's the natural close-out window (you close last month once it's fully entered).
  const months = monthRangeKeys(shiftMonthKey(thisMonth, -12), shiftMonthKey(thisMonth, -1)).reverse();

  const handleClose = async (monthKey) => {
    if (
      !window.confirm(
        `Close ${formatMonth(monthKey)}? Transactions dated in this month can't be edited, deleted, or added to until you reopen it.`
      )
    ) {
      return;
    }
    setError('');
    setBusyMonth(monthKey);
    try {
      await closePeriod(monthKey);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyMonth(null);
    }
  };

  const handleReopen = async (monthKey) => {
    if (!window.confirm(`Reopen ${formatMonth(monthKey)} for editing?`)) return;
    setError('');
    setBusyMonth(monthKey);
    try {
      await reopenPeriod(monthKey);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyMonth(null);
    }
  };

  return (
    <div className="card">
      <h3>Month-End Close</h3>
      <p className="tooltip-hint">
        Closing a month locks its transactions from edits, deletes, and new entries -- use it once a month's books
        are finalized. It's a soft lock: reopen any month at any time to make a correction, then close it again.
      </p>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p>Loading…</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {months.map((monthKey) => {
              const closed = isMonthClosed(monthKey);
              const closedRecord = closedPeriods.find((p) => p.period_month.slice(0, 7) === monthKey);
              return (
                <tr key={monthKey}>
                  <td>{formatMonth(monthKey)}</td>
                  <td>
                    {closed ? (
                      <span title={closedRecord ? `Closed ${new Date(closedRecord.closed_at).toLocaleDateString()}` : ''}>
                        🔒 Closed
                      </span>
                    ) : (
                      'Open'
                    )}
                  </td>
                  <td>
                    {closed ? (
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => handleReopen(monthKey)}
                        disabled={busyMonth === monthKey}
                      >
                        {busyMonth === monthKey ? 'Reopening…' : 'Reopen'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => handleClose(monthKey)}
                        disabled={busyMonth === monthKey}
                      >
                        {busyMonth === monthKey ? 'Closing…' : 'Close month'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
