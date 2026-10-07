import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { STATUSES, PRIORITIES, isOverdue, formatDueDate } from '../../utils/constants';
import './MyTasks.css';

const STATUS_FILTERS = ['all', ...STATUSES];
const PRIORITY_FILTERS = ['all', ...PRIORITIES];

const statusColor = (s) =>
  ({ todo: 'var(--text3)', 'in-progress': 'var(--blue)', review: 'var(--yellow)', done: 'var(--green)' }[s]
    || 'var(--text3)');

export default function MyTasks() {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [showOverdue, setShowOverdue] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/tasks?assignee=${user._id}`);
      setTasks(data);
    } catch (err) {
      addToast(errorMessage(err, 'Failed to load tasks'), 'error');
    } finally {
      setLoading(false);
    }
  }, [user?._id, addToast]);

  useEffect(() => {
    if (user?._id) load();
  }, [user?._id, load]);

  const handleStatusChange = async (taskId, newStatus) => {
    const previous = tasks;
    // Optimistic: the select would otherwise snap back on a slow network.
    setTasks((prev) => prev.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t)));
    try {
      const { data } = await api.put(`/tasks/${taskId}`, { status: newStatus });
      setTasks((prev) => prev.map((t) => (t._id === taskId ? data : t)));
      addToast('Status updated', 'success');
    } catch (err) {
      setTasks(previous);
      addToast(errorMessage(err, 'Failed to update status'), 'error');
    }
  };

  const overdueCnt = tasks.filter(isOverdue).length;

  const filtered = tasks.filter((t) => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    if (showOverdue && !isOverdue(t)) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="loading-screen">
        <div style={{ display: 'flex', gap: 8 }} role="status" aria-label="Loading">
          <div className="loading-dot" /><div className="loading-dot" /><div className="loading-dot" />
        </div>
      </div>
    );
  }

  return (
    <div className="my-tasks-page fade-in">
      <div className="my-tasks-header">
        <div>
          <h1 className="my-tasks-title">My Tasks</h1>
          <p className="my-tasks-count">
            {filtered.length} task{filtered.length !== 1 ? 's' : ''}
            {filtered.length !== tasks.length && ` of ${tasks.length}`}
          </p>
        </div>
        {overdueCnt > 0 && (
          <button
            onClick={() => setShowOverdue((v) => !v)}
            className={`btn btn-sm ${showOverdue ? 'btn-danger' : 'btn-ghost'}`}
            aria-pressed={showOverdue}
          >
            ⚠ {overdueCnt} Overdue
          </button>
        )}
      </div>

      <div className="filter-bar">
        <div className="filter-group" role="group" aria-label="Filter by status">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`filter-btn${filterStatus === s ? ' active' : ''}`}
              aria-pressed={filterStatus === s}
            >
              {s === 'all' ? 'All Status' : s}
            </button>
          ))}
        </div>
        <div className="filter-group" role="group" aria-label="Filter by priority">
          {PRIORITY_FILTERS.map((p) => (
            <button
              key={p}
              onClick={() => setFilterPriority(p)}
              className={`filter-btn${filterPriority === p ? ' active' : ''}`}
              aria-pressed={filterPriority === p}
            >
              {p === 'all' ? 'All Priority' : p}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">✅</div>
          <h3>No tasks found</h3>
          <p>Adjust your filters or ask a project admin to assign you tasks</p>
        </div>
      ) : (
        <div className="tasks-list">
          {filtered.map((task) => {
            const overdue = isOverdue(task);
            return (
              <div key={task._id} className={`task-list-row${overdue ? ' overdue' : ''}`}>
                <div className="task-list-dot" style={{ background: statusColor(task.status) }} />
                <div className="task-list-body">
                  <div className="task-list-title">
                    {task.expedited && <span title="Expedited">🚀 </span>}
                    {task.title}
                  </div>
                  {task.description && <p className="task-list-desc">{task.description}</p>}
                  <div className="task-list-tags">
                    {task.project && (
                      <Link to={`/projects/${task.project._id}`} className="task-tag task-tag-project">
                        ◈ {task.project.name}
                      </Link>
                    )}
                    {task.tags?.map((tag) => (
                      <span key={tag} className="task-tag">{tag}</span>
                    ))}
                  </div>
                </div>
                <div className="task-list-right">
                  <span className={`badge badge-${task.priority}`}>{task.priority}</span>
                  {task.dueDate && (
                    <span className="task-list-due" style={{ color: overdue ? 'var(--red)' : 'var(--text3)' }}>
                      {overdue ? '⚠ ' : ''}{formatDueDate(task.dueDate)}
                    </span>
                  )}
                  <select
                    className="task-list-select"
                    value={task.status}
                    onChange={(e) => handleStatusChange(task._id, e.target.value)}
                    aria-label={`Status for ${task.title}`}
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}