import { useState } from 'react';
import api, { errorMessage } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import Modal from '../ui/Modal';
import { PRIORITIES, STATUSES, toDateInputValue } from '../../utils/constants';
import './TaskModal.css';

/**
 * `isAdmin` gates the fields the server will actually honour. The previous
 * version let members type a new title and description, then silently discarded
 * them while reporting "Task updated!" — the server now rejects those fields
 * outright, and the inputs are disabled here to match.
 */
export default function TaskModal({ project, task, onClose, onSave, isAdmin }) {
  const { addToast } = useToast();
  const [form, setForm] = useState(() => ({
    title:       task?.title || '',
    description: task?.description || '',
    status:      task?.status || 'todo',
    priority:    task?.priority || 'medium',
    assignee:    task?.assignee?._id || '',
    dueDate:     toDateInputValue(task?.dueDate),
    tags:        task?.tags?.join(', ') || '',
  }));
  const [saving, setSaving] = useState(false);

  const editing = Boolean(task);
  // Admins own every field; members only control status and assignee.
  const locked = editing && !isAdmin;

/**
 * Members may only change status and assignee; the server rejects admin-only
 * fields outright, so don't send them.
 */
const buildPayload = () => {
  const payload = { status: form.status, assignee: form.assignee || null, project: project._id };

  if (!locked) {
    payload.title = form.title;
    payload.description = form.description;
    payload.priority = form.priority;
    payload.dueDate = form.dueDate || null;
    payload.tags = form.tags
      ? form.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 10)
      : [];
  }

  return payload;
};

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = buildPayload();

      if (editing) {
        await api.put(`/tasks/${task._id}`, payload);
      } else {
        await api.post('/tasks', payload);
      }

      onSave();
      addToast(editing ? 'Task updated' : 'Task created', 'success');
    } catch (err) {
      addToast(errorMessage(err, 'Failed to save task'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={editing ? 'Edit Task' : 'New Task'} onClose={saving ? () => {} : onClose}>
      <form onSubmit={handleSubmit} className="task-modal-form">
        <div className="form-group">
          <label className="form-label" htmlFor="task-title">Title *</label>
          <input
            id="task-title"
            className="input-field"
            placeholder="Task title"
            value={form.title}
            maxLength={200}
            disabled={locked}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            required
          />
          {locked && <span className="form-hint">Only project admins can edit this field.</span>}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="task-desc">Description</label>
          <textarea
            id="task-desc"
            className="input-field"
            rows={3}
            maxLength={1000}
            style={{ resize: 'vertical' }}
            placeholder="Describe this task…"
            value={form.description}
            disabled={locked}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          />
          {locked && <span className="form-hint">Only project admins can edit this field.</span>}
        </div>

        <div className="task-modal-grid2">
          <div className="form-group">
            <label className="form-label" htmlFor="task-status">Status</label>
            <select
              id="task-status"
              className="input-field"
              value={form.status}
              onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="task-priority">Priority</label>
            <select
              id="task-priority"
              className="input-field"
              value={form.priority}
              disabled={locked}
              onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
            >
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div className="task-modal-grid2">
          <div className="form-group">
            <label className="form-label" htmlFor="task-assignee">Assignee</label>
            <select
              id="task-assignee"
              className="input-field"
              value={form.assignee}
              onChange={(e) => setForm((prev) => ({ ...prev, assignee: e.target.value }))}
            >
              <option value="">Unassigned</option>
              {(project.members || [])
                .filter((m) => m.user)
                .map((m) => (
                  <option key={m.user._id} value={m.user._id}>{m.user.name}</option>
                ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="task-due">Due Date</label>
            <input
              id="task-due"
              className="input-field"
              type="date"
              value={form.dueDate}
              disabled={locked}
              onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
            />
          </div>
        </div>

        {isAdmin && (
          <div className="form-group">
            <label className="form-label" htmlFor="task-tags">Tags (comma-separated, max 10)</label>
            <input
              id="task-tags"
              className="input-field"
              placeholder="bug, feature, urgent"
              value={form.tags}
              onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
            />
          </div>
        )}

        <div className="task-modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : editing ? 'Update Task' : 'Create Task'}
          </button>
        </div>
      </form>
    </Modal>
  );
}