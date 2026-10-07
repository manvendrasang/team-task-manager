import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { SEVERITY_COLORS, formatDueDate } from '../../utils/constants';
import './MyWarnings.css';

const FILTERS = [
  { key: 'open',    label: 'Open',    query: 'false' },
  { key: 'all',     label: 'All',     query: undefined },
  { key: 'resolved',label: 'Resolved',query: 'true'  },
];

export default function MyWarnings() {
  const { addToast } = useToast();
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const active = FILTERS.find((f) => f.key === filter);
      const { data } = await api.get('/warnings' + (active.query ? `?resolved=${active.query}` : ''));
      setWarnings(data);
    } catch (err) {
      addToast(errorMessage(err, 'Failed to load warnings'), 'error');
    } finally {
      setLoading(false);
    }
  }, [filter, addToast]);

  useEffect(() => { load(); }, [load]);

  const toggleResolved = async (warning) => {
    setBusyId(warning._id);
    try {
      const { data } = await api.patch(`/warnings/${warning._id}/resolve`, {
        resolved: !warning.resolved,
      });
      setWarnings((prev) => prev.map((w) => (w._id === warning._id ? { ...w, ...data } : w)));
      addToast(data.resolved ? 'Warning marked resolved' : 'Warning reopened', 'success');
      if (filter === 'open' || filter === 'resolved') load();
    } catch (err) {
      addToast(errorMessage(err, 'Failed to update warning'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const openCount = warnings.filter((w) => !w.resolved).length;

  return (
    <div className="my-warnings-page fade-in">
      <div className="my-warnings-header">
        <div>
          <h1 className="my-warnings-title">Warnings</h1>
          <p className="my-warnings-count">
            {loading ? 'Loading...' : `${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`}
            {!loading && openCount > 0 && filter === 'all' && ` · ${openCount} unresolved`}
          </p>
        </div>
        <div className="filter-group">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`filter-btn${filter === f.key ? ' active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading-block"><div className="spinner" /></div>
      ) : warnings.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">✅</div>
          <h3>{filter === 'open' ? 'No open warnings' : 'No warnings'}</h3>
          <p>Keep it up — nothing to act on here.</p>
        </div>
      ) : (
        <div className="warning-list">
          {warnings.map((w) => (
            <article
              key={w._id}
              className={`warning-card${w.resolved ? ' resolved' : ''}`}
              style={{ borderColor: `${SEVERITY_COLORS[w.severity]}40` }}
            >
              <div className="warning-card-top">
                <div className="warning-card-title">
                  {w.project && (
                    <Link to={`/projects/${w.project._id}`} className="warning-project">
                      ◈ {w.project.name}
                    </Link>
                  )}
                  <span className="badge" style={{
                    background: 'transparent',
                    border: `1px solid ${SEVERITY_COLORS[w.severity]}66`,
                    color: SEVERITY_COLORS[w.severity],
                  }}>
                    {w.severity}
                  </span>
                  {w.resolved && <span className="badge badge-done">resolved</span>}
                </div>
                {w.task && (
                  <Link to={`/projects/${w.project?._id}`} className="warning-task">
                    Re: “{w.task.title}”
                    {w.task.dueDate && (
                      <span className="warning-task-due"> · due {formatDueDate(w.task.dueDate)}</span>
                    )}
                  </Link>
                )}
              </div>

              <p className="warning-message">{w.message}</p>

              <div className="warning-card-footer">
                <span className="warning-from">
                  Issued by {w.issuedBy?.name || 'Unknown'} ·{' '}
                  {new Date(w.createdAt).toLocaleDateString(undefined, {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </span>
                <button
                  className={`btn btn-sm ${w.resolved ? 'btn-ghost' : 'btn-primary'}`}
                  onClick={() => toggleResolved(w)}
                  disabled={busyId === w._id}
                >
                  {busyId === w._id ? 'Saving...' : w.resolved ? 'Reopen' : 'Mark resolved'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}