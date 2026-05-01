import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import './ProjectList.css';

const COLORS = ['#7e72f2','#34d3a0','#f0c050','#f06080','#60b8f0','#f09050','#a855f7','#ec4899'];

export default function ProjectList() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name:'', description:'', color: COLORS[0], dueDate:'' });
  const [saving, setSaving] = useState(false);
  const { addToast } = useToast();
  const { user } = useAuth();

  const fetchProjects = () => {
    setLoading(true);
    api.get('/projects')
      .then(res => setProjects(res.data))
      .catch(err => addToast(err.response?.data?.message || 'Failed to load projects', 'error'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { fetchProjects(); }, []); // eslint-disable-line

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post('/projects', form);
      setProjects([data, ...projects]);
      setShowModal(false);
      setForm({ name:'', description:'', color: COLORS[0], dueDate:'' });
      addToast('Project created!', 'success');
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to create project', 'error');
    } finally { setSaving(false); }
  };

  const isOwner = p => p.owner?._id === user._id;

  if (loading) return (
    <div className="loading-screen">
      <div style={{ display:'flex', gap:8 }}>
        <div className="loading-dot"/><div className="loading-dot"/><div className="loading-dot"/>
      </div>
    </div>
  );

  return (
    <div className="project-list-page fade-in">
      <div className="project-list-header">
        <div>
          <h1 className="project-list-title">Projects</h1>
          <p className="project-list-count">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Project</button>
      </div>

      {projects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🗂️</div>
          <h3>No projects yet</h3>
          <p>Create your first project to get started</p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>Create Project</button>
        </div>
      ) : (
        <div className="project-grid">
          {projects.map((p, i) => (
            <Link key={p._id} to={`/projects/${p._id}`} className="project-card">
              <div className="project-card-bar" style={{ background: p.color || COLORS[i % COLORS.length] }} />
              <div className="project-card-body">
                <div className="project-card-header">
                  <h3 className="project-card-title">{p.name}</h3>
                  <span className={`badge badge-${p.status}`}>{p.status}</span>
                </div>
                {p.description && <p className="project-card-desc">{p.description}</p>}
                <div className="project-card-footer">
                  <div className="project-members">
                    {p.members.slice(0, 4).map((m, idx) => (
                      <div key={m.user?._id || idx} className="member-avatar"
                        style={{ background: COLORS[idx % COLORS.length], zIndex: 10 - idx }}>
                        {m.user?.name?.[0]?.toUpperCase()}
                      </div>
                    ))}
                    {p.members.length > 4 && (
                      <div className="member-avatar-more">+{p.members.length - 4}</div>
                    )}
                  </div>
                  <span className="project-owner-badge">{isOwner(p) ? '👑 Owner' : '👤 Member'}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">New Project</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate} style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div className="form-group">
                <label className="form-label">Project Name *</label>
                <input className="input-field" placeholder="My awesome project"
                  value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="input-field" rows={3} placeholder="What's this project about?"
                  value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                  style={{ resize:'vertical' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Color</label>
                <div className="color-picker">
                  {COLORS.map(c => (
                    <div key={c} className="color-swatch" onClick={() => setForm({...form, color:c})}
                      style={{
                        background: c,
                        border: form.color === c ? '2px solid var(--text)' : '2px solid transparent',
                        transform: form.color === c ? 'scale(1.2)' : 'scale(1)',
                      }} />
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input className="input-field" type="date" value={form.dueDate}
                  onChange={e => setForm({...form, dueDate: e.target.value})} />
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
