import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format, isAfter } from 'date-fns';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import './MyTasks.css';

const STATUSES   = ['all','todo','in-progress','review','done'];
const PRIORITIES = ['all','low','medium','high','urgent'];
const STATUS_COLORS = { todo:'var(--text3)', 'in-progress':'var(--blue)', review:'var(--yellow)', done:'var(--green)' };

export default function MyTasks() {
  const { user }    = useAuth();
  const { addToast } = useToast();
  const [tasks,          setTasks]          = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [filterStatus,   setFilterStatus]   = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [showOverdue,    setShowOverdue]     = useState(false);

  useEffect(() => {
    api.get(`/tasks?assignee=${user._id}`)
      .then(res => setTasks(res.data))
      .catch(() => addToast('Failed to load tasks', 'error'))
      .finally(() => setLoading(false));
  }, [user._id]); // eslint-disable-line

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const { data } = await api.put(`/tasks/${taskId}`, { status: newStatus });
      setTasks(prev => prev.map(t => t._id === taskId ? data : t));
      addToast('Status updated', 'success');
    } catch { addToast('Failed to update', 'error'); }
  };

  const overdueCnt = tasks.filter(t => t.dueDate && isAfter(new Date(), new Date(t.dueDate)) && t.status !== 'done').length;

  const filtered = tasks.filter(t => {
    if (filterStatus   !== 'all' && t.status   !== filterStatus)   return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    if (showOverdue && !(t.dueDate && isAfter(new Date(), new Date(t.dueDate)) && t.status !== 'done')) return false;
    return true;
  });

  if (loading) return (
    <div className="loading-screen">
      <div style={{ display:'flex', gap:8 }}>
        <div className="loading-dot"/><div className="loading-dot"/><div className="loading-dot"/>
      </div>
    </div>
  );

  return (
    <div className="my-tasks-page fade-in">
      <div className="my-tasks-header">
        <div>
          <h1 className="my-tasks-title">My Tasks</h1>
          <p style={{ color:'var(--text2)', fontSize:14 }}>{filtered.length} task{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        {overdueCnt > 0 && (
          <button onClick={() => setShowOverdue(!showOverdue)}
            className={`btn btn-sm ${showOverdue ? 'btn-danger' : 'btn-ghost'}`}>
            ⚠ {overdueCnt} Overdue
          </button>
        )}
      </div>

      <div className="filter-bar">
        <div className="filter-group">
          {STATUSES.map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`filter-btn${filterStatus === s ? ' active' : ''}`}>
              {s === 'all' ? 'All Status' : s}
            </button>
          ))}
        </div>
        <div className="filter-group">
          {PRIORITIES.map(p => (
            <button key={p} onClick={() => setFilterPriority(p)}
              className={`filter-btn${filterPriority === p ? ' active' : ''}`}>
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
          {filtered.map(task => {
            const isOverdue = task.dueDate && isAfter(new Date(), new Date(task.dueDate)) && task.status !== 'done';
            return (
              <div key={task._id} className={`task-list-row${isOverdue ? ' overdue' : ''}`}>
                <div className="task-list-dot" style={{ background: STATUS_COLORS[task.status] }} />
                <div className="task-list-body">
                  <div className="task-list-title">
                    {task.expedited && <span style={{ marginRight:6, fontSize:12 }}>🚀</span>}
                    {task.title}
                  </div>
                  {task.description && <p className="task-list-desc">{task.description}</p>}
                  <div className="task-list-tags">
                    {task.project && (
                      <Link to={`/projects/${task.project._id}`} className="task-tag task-tag-project">
                        ◈ {task.project.name}
                      </Link>
                    )}
                    {task.tags?.map(tag => <span key={tag} className="task-tag">{tag}</span>)}
                  </div>
                </div>
                <div className="task-list-right">
                  <span className={`badge badge-${task.priority}`}>{task.priority}</span>
                  {task.dueDate && (
                    <span className="task-list-due" style={{ color: isOverdue ? 'var(--red)' : 'var(--text3)' }}>
                      {isOverdue ? '⚠ ' : ''}{format(new Date(task.dueDate), 'MMM d')}
                    </span>
                  )}
                  <select className="task-list-select" value={task.status}
                    onChange={e => handleStatusChange(task._id, e.target.value)}>
                    {['todo','in-progress','review','done'].map(s => <option key={s} value={s}>{s}</option>)}
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
