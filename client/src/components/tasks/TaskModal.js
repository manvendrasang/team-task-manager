import { useState } from 'react';
import api from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import './TaskModal.css';

const STATUSES   = ['todo','in-progress','review','done'];
const PRIORITIES = ['low','medium','high','urgent'];

export default function TaskModal({ project, task, onClose, onSave, isAdmin }) {
  const { addToast } = useToast();
  const [form, setForm] = useState({
    title:       task?.title       || '',
    description: task?.description || '',
    status:      task?.status      || 'todo',
    priority:    task?.priority    || 'medium',
    assignee:    task?.assignee?._id || '',
    dueDate:     task?.dueDate ? task.dueDate.split('T')[0] : '',
    tags:        task?.tags?.join(', ') || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        assignee: form.assignee || null,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        project: project._id,
      };
      const res = task
        ? await api.put(`/tasks/${task._id}`, payload)
        : await api.post('/tasks', payload);
      onSave(res.data, !task);
      addToast(task ? 'Task updated!' : 'Task created!', 'success');
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to save task', 'error');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{task ? 'Edit Task' : 'New Task'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="task-modal-form">
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input className="input-field" placeholder="Task title" value={form.title}
              onChange={e => setForm({...form, title: e.target.value})} required />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="input-field" rows={3} style={{ resize:'vertical' }}
              placeholder="Describe this task..."
              value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
          </div>
          <div className="task-modal-grid2">
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="input-field" value={form.status}
                onChange={e => setForm({...form, status: e.target.value})}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select className="input-field" value={form.priority}
                onChange={e => setForm({...form, priority: e.target.value})}
                disabled={!isAdmin && !!task}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="task-modal-grid2">
            <div className="form-group">
              <label className="form-label">Assignee</label>
              <select className="input-field" value={form.assignee}
                onChange={e => setForm({...form, assignee: e.target.value})}>
                <option value="">Unassigned</option>
                {project.members.map(m => (
                  <option key={m.user?._id} value={m.user?._id}>{m.user?.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Due Date</label>
              <input className="input-field" type="date" value={form.dueDate}
                onChange={e => setForm({...form, dueDate: e.target.value})}
                disabled={!isAdmin && !!task} />
            </div>
          </div>
          {isAdmin && (
            <div className="form-group">
              <label className="form-label">Tags (comma-separated)</label>
              <input className="input-field" placeholder="bug, feature, urgent"
                value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} />
            </div>
          )}
          <div className="task-modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : task ? 'Update Task' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
