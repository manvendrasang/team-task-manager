import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { PROJECT_COLORS, isOverdue } from '../../utils/constants';
import './Dashboard.css';

const getGreeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
};

const statusColor = (s) =>
  ({ todo: 'var(--text3)', 'in-progress': 'var(--blue)', review: 'var(--yellow)', done: 'var(--green)' }[s]
    || 'var(--text3)');

export default function Dashboard() {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    // Warnings are a nice-to-have here; don't let them block the dashboard.
    const [projectsRes, tasksRes, warningsRes] = await Promise.allSettled([
      api.get('/projects'),
      api.get('/tasks'),
      api.get('/warnings'),
    ]);

    if (projectsRes.status === 'rejected') {
      addToast(errorMessage(projectsRes.reason, 'Failed to load projects'), 'error');
    } else {
      setProjects(projectsRes.value.data);
    }

    if (tasksRes.status === 'rejected') {
      addToast(errorMessage(tasksRes.reason, 'Failed to load tasks'), 'error');
    } else {
      setTasks(tasksRes.value.data);
    }

    if (warningsRes.status === 'fulfilled') setWarnings(warningsRes.value.data);
    setLoading(false);
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div style={{ display: 'flex', gap: 8 }} role="status" aria-label="Loading">
          <div className="loading-dot" /><div className="loading-dot" /><div className="loading-dot" />
        </div>
      </div>
    );
  }

  const overdue = tasks.filter(isOverdue);
  const inProgress = tasks.filter((t) => t.status === 'in-progress');
  const done = tasks.filter((t) => t.status === 'done');
  const openWarnings = warnings.filter((w) => !w.resolved);

  const stats = [
    { label: 'Active Projects',   value: projects.filter((p) => p.status === 'active').length, color: 'var(--accent)', icon: '◈', to: '/projects' },
    { label: 'Tasks In Progress', value: inProgress.length, color: 'var(--blue)',   icon: '◎', to: '/my-tasks' },
    { label: 'Completed Tasks',   value: done.length,       color: 'var(--green)',  icon: '✓', to: '/my-tasks' },
    { label: 'Overdue',           value: overdue.length,    color: 'var(--red)',    icon: '⚠', to: '/my-tasks' },
  ];

  const firstName = (user?.name || '').trim().split(/\s+/)[0] || 'there';

  return (
    <div className="dashboard-page fade-in">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-greeting">Good {getGreeting()}, {firstName} 👋</h1>
          <p className="dashboard-subtext">Here's what's happening with your projects.</p>
        </div>
        <Link to="/projects" className="btn btn-primary">+ New Project</Link>
      </div>

      <div className="stats-grid">
        {stats.map((s) => (
          <Link key={s.label} to={s.to} className="card stat-card">
            <div className="stat-icon" style={{ background: `${s.color}20`, color: s.color }} aria-hidden="true">{s.icon}</div>
            <div>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </Link>
        ))}
      </div>

      {openWarnings.length > 0 && (
        <Link to="/warnings" className="card dashboard-alert">
          <span className="dashboard-alert-icon" aria-hidden="true">⚠️</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="dashboard-alert-title">
              You have {openWarnings.length} unresolved warning{openWarnings.length !== 1 ? 's' : ''}
            </div>
            <div className="dashboard-alert-text">
              Most recent: “{openWarnings[0].message}” — issued by {openWarnings[0].issuedBy?.name || 'an admin'}
            </div>
          </div>
          <span className="dashboard-alert-cta">Review →</span>
        </Link>
      )}

      <div className="dashboard-grid2">
        <div className="card">
          <div className="section-header">
            <h3 className="section-title">Recent Tasks</h3>
            <Link to="/my-tasks" className="section-link">View all →</Link>
          </div>
          {tasks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <h3>No tasks yet</h3>
            </div>
          ) : (
            <div className="task-list">
              {tasks.slice(0, 5).map((task) => (
                <div key={task._id} className="task-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    <div className="task-dot" style={{ background: statusColor(task.status) }} />
                    <div style={{ minWidth: 0 }}>
                      <div className="task-title-sm">
                        {task.expedited && <span title="Expedited">🚀 </span>}
                        {task.title}
                      </div>
                      <div className="task-meta-sm">{task.project?.name}</div>
                    </div>
                  </div>
                  <span className={`badge badge-${task.status}`}>{task.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-header">
            <h3 className="section-title">Projects</h3>
            <Link to="/projects" className="section-link">View all →</Link>
          </div>
          {projects.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🗂️</div>
              <h3>No projects yet</h3>
            </div>
          ) : (
            <div className="project-list-sm">
              {projects.slice(0, 5).map((p, i) => (
                <Link key={p._id} to={`/projects/${p._id}`} className="project-row-sm">
                  <div className="project-dot-sm" style={{ background: p.color || PROJECT_COLORS[i % PROJECT_COLORS.length] }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="project-name-sm">{p.name}</div>
                    <div className="project-meta-sm">
                      {p.members.length} member{p.members.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <span className={`badge badge-${p.status}`}>{p.status}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}