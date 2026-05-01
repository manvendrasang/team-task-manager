import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { isAfter } from 'date-fns';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import './Dashboard.css';

const getGreeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
};
const statusColor = s => ({ todo:'var(--text3)', 'in-progress':'var(--blue)', review:'var(--yellow)', done:'var(--green)' }[s] || 'var(--text3)');

const COLORS = ['#7e72f2','#34d3a0','#f0c050','#f06080','#60b8f0','#f09050','#a855f7','#ec4899'];

export default function Dashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks]       = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([api.get('/projects'), api.get('/tasks')])
      .then(([p, t]) => { setProjects(p.data); setTasks(t.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="loading-screen">
      <div style={{ display:'flex', gap:8 }}>
        <div className="loading-dot"/><div className="loading-dot"/><div className="loading-dot"/>
      </div>
    </div>
  );

  const overdue    = tasks.filter(t => t.dueDate && isAfter(new Date(), new Date(t.dueDate)) && t.status !== 'done');
  const inProgress = tasks.filter(t => t.status === 'in-progress');
  const done       = tasks.filter(t => t.status === 'done');

  const stats = [
    { label:'Active Projects',    value: projects.filter(p=>p.status==='active').length, color:'var(--accent)', icon:'◈' },
    { label:'Tasks In Progress',  value: inProgress.length, color:'var(--blue)',   icon:'◎' },
    { label:'Completed Tasks',    value: done.length,       color:'var(--green)',  icon:'✓' },
    { label:'Overdue',            value: overdue.length,    color:'var(--red)',    icon:'⚠' },
  ];

  return (
    <div className="dashboard-page fade-in">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-greeting">Good {getGreeting()}, {user.name.split(' ')[0]} 👋</h1>
          <p className="dashboard-subtext">Here's what's happening with your projects.</p>
        </div>
        <Link to="/projects" className="btn btn-primary">+ New Project</Link>
      </div>

      <div className="stats-grid">
        {stats.map(s => (
          <div key={s.label} className="card stat-card">
            <div className="stat-icon" style={{ background:`${s.color}20`, color:s.color }}>{s.icon}</div>
            <div>
              <div className="stat-value" style={{ color:s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-grid2">
        <div className="card">
          <div className="section-header">
            <h3 className="section-title">Recent Tasks</h3>
            <Link to="/my-tasks" className="section-link">View all →</Link>
          </div>
          {tasks.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon">📋</div><h3>No tasks yet</h3></div>
          ) : (
            <div className="task-list">
              {tasks.slice(0, 5).map(task => (
                <div key={task._id} className="task-row">
                  <div style={{ display:'flex', alignItems:'center', gap:10, flex:1, minWidth:0 }}>
                    <div className="task-dot" style={{ background: statusColor(task.status) }} />
                    <div style={{ minWidth:0 }}>
                      <div className="task-title-sm">{task.title}</div>
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
            <div className="empty-state"><div className="empty-state-icon">🗂️</div><h3>No projects yet</h3></div>
          ) : (
            <div className="project-list-sm">
              {projects.slice(0, 5).map((p, i) => (
                <Link key={p._id} to={`/projects/${p._id}`} className="project-row-sm">
                  <div className="project-dot-sm" style={{ background: p.color || COLORS[i % COLORS.length] }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div className="project-name-sm">{p.name}</div>
                    <div className="project-meta-sm">{p.members.length} member{p.members.length !== 1 ? 's' : ''}</div>
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
