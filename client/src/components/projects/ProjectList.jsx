import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import Modal from '../ui/Modal';
import { PROJECT_COLORS, isOverdue, formatDueDate } from '../../utils/constants';
import './ProjectList.css';

const EMPTY_FORM = { name: '', description: '', color: PROJECT_COLORS[0], dueDate: '' };

export default function ProjectList() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const { addToast } = useToast();
  const { user } = useAuth();

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/projects');
      setProjects(data);
    } catch (err) {
      addToast(errorMessage(err, 'Failed to load projects'), 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const openCreateModal = () => { setForm(EMPTY_FORM); setShowModal(true); };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/projects', { ...form, dueDate: form.dueDate || null });
      setShowModal(false);
      addToast('Project created', 'success');
      fetchProjects();
    } catch (err) {
      addToast(errorMessage(err, 'Failed to create project'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const isOwner = (p) => String(p.owner?._id ?? p.owner) === String(user?._id);

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
    <div className="project-list-page fade-in">
      <div className="project-list-header">
        <div>
          <h1 className="project-list-title">Projects</h1>
          <p className="project-list-count">
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreateModal}>+ New Project</button>
      </div>

      {projects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🗂️</div>
          <h3>No projects yet</h3>
          <p>Create your first project to get started</p>
          <button className="btn btn-primary" onClick={openCreateModal}>Create Project</button>
        </div>
      ) : (
        <div className="project-grid">
          {projects.map((p, i) => (
            <Link key={p._id} to={`/projects/${p._id}`} className="project-card">
              <div className="project-card-bar" style={{ background: p.color || PROJECT_COLORS[i % PROJECT_COLORS.length] }} />
              <div className="project-card-body">
                <div className="project-card-header">
                  <h3 className="project-card-title">{p.name}</h3>
                  <span className={`badge badge-${p.status}`}>{p.status}</span>
                </div>
                {p.description && <p className="project-card-desc">{p.description}</p>}
                {p.dueDate && (
                  <p className={`project-card-due${isOverdue({ dueDate: p.dueDate, status: p.status }) ? ' overdue' : ''}`}>
                    📅 Due {formatDueDate(p.dueDate)}
                  </p>
                )}
                <div className="project-card-footer">
                  <div className="project-members">
                    {p.members.slice(0, 4).map((m, idx) => (
                      <div
                        key={m.user?._id || idx}
                        className="member-avatar"
                        style={{ background: PROJECT_COLORS[idx % PROJECT_COLORS.length], zIndex: 10 - idx }}
                        title={m.user?.name}
                      >
                        {m.user?.name?.[0]?.toUpperCase() || '?'}
                      </div>
                    ))}
                    {p.members.length > 4 && (
                      <div className="member-avatar-more">+{p.members.length - 4}</div>
                    )}
                  </div>
                  <span className="project-owner-badge">
                    {isOwner(p) ? '👑 Owner' : '👤 Member'}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title="New Project" onClose={saving ? () => {} : () => setShowModal(false)} maxWidth={460}>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="new-proj-name">Project Name *</label>
              <input
                id="new-proj-name"
                className="input-field"
                placeholder="My awesome project"
                value={form.name}
                maxLength={100}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="new-proj-desc">Description</label>
              <textarea
                id="new-proj-desc"
                className="input-field"
                rows={3}
                maxLength={500}
                placeholder="What's this project about?"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                style={{ resize: 'vertical' }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Color</label>
              <div className="color-picker">
                {PROJECT_COLORS.map((c) => (
                  <button
                    type="button"
                    key={c}
                    className="color-swatch"
                    onClick={() => setForm((prev) => ({ ...prev, color: c }))}
                    aria-label={`Use colour ${c}`}
                    aria-pressed={form.color === c}
                    style={{
                      background: c,
                      border: form.color === c ? '2px solid var(--text)' : '2px solid transparent',
                      transform: form.color === c ? 'scale(1.15)' : 'scale(1)',
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="new-proj-due">Due Date</label>
              <input
                id="new-proj-due"
                className="input-field"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}