import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { errorMessage } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import TaskCard from '../tasks/TaskCard';
import TaskModal from '../tasks/TaskModal';
import Modal from '../ui/Modal';
import {
  STATUS_COLUMNS, PROJECT_COLORS, SEVERITY_COLORS,
  toDateInputValue, isOverdue, formatDueDate,
} from '../../utils/constants';
import './ProjectDetail.css';

const TABS = ['board', 'members', 'warnings'];
const TAB_LABELS = { board: 'Board', members: 'Members', warnings: 'Warnings' };

const EMPTY_PROJECT_FORM = { name: '', description: '', color: PROJECT_COLORS[0], status: 'active', dueDate: '' };

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { user } = useAuth();

  const [project, setProject]     = useState(null);
  const [tasks, setTasks]       = useState([]);
  const [stats, setStats]       = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState('board');

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask]     = useState(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showWarnModal, setShowWarnModal]     = useState(false);
  const [showEditModal, setShowEditModal]     = useState(false);

  const [memberEmail, setMemberEmail] = useState('');
  const [memberLookup, setMemberLookup] = useState(null);
  const [memberRole, setMemberRole] = useState('member');
  const [addingMember, setAddingMember] = useState(false);

  const [warnForm, setWarnForm] = useState({ issuedTo: '', task: '', message: '', severity: 'mild' });
  const [sendingWarn, setSendingWarn] = useState(false);

  const [projectForm, setProjectForm] = useState(EMPTY_PROJECT_FORM);
  const [savingProject, setSavingProject] = useState(false);

  const [busyWarningId, setBusyWarningId] = useState(null);

  const isAdmin = project?.userRole === 'admin';

  /**
   * Loads the project and its dependent lists in parallel. Every mutation calls
   * this again, so the admin's own role always comes from the server rather
   * than from a stale local guess.
   */
  const fetchData = useCallback(async () => {
    let projectData;
    try {
      ({ data: projectData } = await api.get(`/projects/${id}`));
      setProject(projectData);
      setLoading(false);
    } catch (err) {
      addToast(errorMessage(err, 'Project not found or access denied'), 'error');
      navigate('/projects', { replace: true });
      return;
    }

    // Dependent lists are non-critical: a failure shouldn't blank the page.
    const [tasksRes, statsRes, warningsRes] = await Promise.allSettled([
      api.get(`/tasks?project=${id}`),
      api.get(`/projects/${id}/stats`),
      api.get(`/projects/${id}/warnings`),
    ]);

    if (tasksRes.status === 'fulfilled') setTasks(tasksRes.value.data);
    if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
    if (warningsRes.status === 'fulfilled') setWarnings(warningsRes.value.data);
  }, [id, addToast, navigate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ---- tasks ----

  const handleTaskSave = () => {
    setShowTaskModal(false);
    setEditingTask(null);
    fetchData();
  };

  const handleTaskDelete = async (taskId) => {
    if (!window.confirm('Delete this task? Any warnings about it are removed too.')) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      setTasks((prev) => prev.filter((t) => t._id !== taskId));
      addToast('Task deleted', 'success');
      fetchData();
    } catch (err) {
      addToast(errorMessage(err, 'Failed to delete task'), 'error');
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const { data } = await api.put(`/tasks/${taskId}`, { status: newStatus });
      setTasks((prev) => prev.map((t) => (t._id === taskId ? data : t)));
      fetchData();
    } catch (err) {
      addToast(errorMessage(err, 'Failed to update task'), 'error');
      fetchData();
    }
  };

  const handleExpedite = async (taskId) => {
    try {
      const { data } = await api.put(`/projects/${id}/tasks/${taskId}/expedite`);
      addToast(
        data.expedited ? '🚀 Task expedited' : 'Expedite removed',
        data.expedited ? 'info' : 'success'
      );
      fetchData();
    } catch (err) {
      addToast(errorMessage(err, 'Failed to expedite task'), 'error');
    }
  };

  // ---- members ----

  const openMemberModal = () => {
    setMemberEmail('');
    setMemberLookup(null);
    setMemberRole('member');
    setShowMemberModal(true);
  };

  // Confirms the address belongs to a real account before submitting, and shows
  // the matching name so the admin doesn't add the wrong person.
  const lookupMember = async () => {
    setMemberLookup({ state: 'loading' });
    try {
      const { data } = await api.get(`/users/search?email=${encodeURIComponent(memberEmail.trim())}`);
      setMemberLookup({ state: 'found', user: data });
    } catch {
      setMemberLookup({ state: 'missing' });
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    setAddingMember(true);
    try {
      await api.post(`/projects/${id}/members`, { email: memberEmail.trim(), memberRole });
      setShowMemberModal(false);
      addToast('Member added', 'success');
      fetchData(); // refetch so userRole/owner stay server-authoritative
    } catch (err) {
      addToast(errorMessage(err, 'Failed to add member'), 'error');
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm('Remove this member? Their tasks will become unassigned.')) return;
    try {
      await api.delete(`/projects/${id}/members/${userId}`);
      addToast('Member removed', 'success');
      fetchData();
    } catch (err) {
      addToast(errorMessage(err, 'Failed to remove member'), 'error');
    }
  };

  // ---- project editing ----

  const openEditModal = () => {
    setProjectForm({
      name: project.name || '',
      description: project.description || '',
      color: project.color || PROJECT_COLORS[0],
      status: project.status || 'active',
      dueDate: toDateInputValue(project.dueDate),
    });
    setShowEditModal(true);
  };

  const handleSaveProject = async (e) => {
    e.preventDefault();
    setSavingProject(true);
    try {
      await api.put(`/projects/${id}`, {
        ...projectForm,
        dueDate: projectForm.dueDate || null,
      });
      setShowEditModal(false);
      addToast('Project updated', 'success');
      fetchData();
    } catch (err) {
      addToast(errorMessage(err, 'Failed to update project'), 'error');
    } finally {
      setSavingProject(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!window.confirm('Delete this project and all its tasks? This cannot be undone.')) return;
    try {
      await api.delete(`/projects/${id}`);
      addToast('Project deleted', 'success');
      navigate('/projects', { replace: true });
    } catch (err) {
      addToast(errorMessage(err, 'Failed to delete project'), 'error');
    }
  };

  // ---- warnings ----

  const handleIssueWarning = async (e) => {
    e.preventDefault();
    setSendingWarn(true);
    try {
      const { data } = await api.post(`/projects/${id}/warnings`, warnForm);
      setWarnings((prev) => [data, ...prev]);
      setShowWarnModal(false);
      setWarnForm({ issuedTo: '', task: '', message: '', severity: 'mild' });
      addToast('⚠ Warning issued', 'warn');
    } catch (err) {
      addToast(errorMessage(err, 'Failed to issue warning'), 'error');
    } finally {
      setSendingWarn(false);
    }
  };

  const handleToggleResolved = async (warnId, resolved) => {
    setBusyWarningId(warnId);
    try {
      const { data } = await api.patch(`/projects/${id}/warnings/${warnId}`, { resolved });
      setWarnings((prev) => prev.map((w) => (w._id === warnId ? data : w)));
    } catch (err) {
      addToast(errorMessage(err, 'Failed to update warning'), 'error');
    } finally {
      setBusyWarningId(null);
    }
  };

  const handleDeleteWarning = async (warnId) => {
    if (!window.confirm('Delete this warning permanently?')) return;
    try {
      await api.delete(`/projects/${id}/warnings/${warnId}`);
      setWarnings((prev) => prev.filter((w) => w._id !== warnId));
      addToast('Warning removed', 'success');
    } catch (err) {
      addToast(errorMessage(err, 'Failed to remove warning'), 'error');
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div style={{ display: 'flex', gap: 8 }} role="status" aria-label="Loading">
          <div className="loading-dot" /><div className="loading-dot" /><div className="loading-dot" />
        </div>
      </div>
    );
  }
  if (!project) return null;

  const tasksByStatus = STATUS_COLUMNS.reduce((acc, s) => {
    acc[s.key] = tasks.filter((t) => t.status === s.key);
    return acc;
  }, {});

  const overdueTasks = tasks.filter(isOverdue);
  const unresolvedWarnings = warnings.filter((w) => !w.resolved).length;
  const ownerId = String(project.owner?._id ?? project.owner);
  // The server rejects self-warnings, so don't offer the current user as a target.
  const warnableMembers = project.members.filter(
    (m) => m.user?._id && String(m.user._id) !== String(user?._id)
  );

  return (
    <div className="project-detail-page fade-in">
      <div className="project-detail-header">
        <div className="project-detail-left">
          <div className="project-color-dot" style={{ background: project.color }} />
          <div>
            <div className="project-detail-title-row">
              <h1 className="project-detail-title">{project.name}</h1>
              <span className={`badge badge-${project.status}`}>{project.status}</span>
            </div>
            {project.description && <p className="project-detail-desc">{project.description}</p>}
            {project.dueDate && (
              <p className={`project-detail-due${isOverdue({ dueDate: project.dueDate, status: project.status }) ? ' overdue' : ''}`}>
                📅 Due {formatDueDate(project.dueDate)}
              </p>
            )}
          </div>
        </div>
        <div className="project-detail-actions">
          {isAdmin && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={openEditModal}>Edit</button>
              <button className="btn btn-ghost btn-sm" onClick={openMemberModal}>+ Member</button>
              <button
                className="btn btn-warn btn-sm"
                onClick={() => { setActiveTab('warnings'); setShowWarnModal(true); }}
                disabled={project.members.length < 2 || tasks.length === 0}
                title={project.members.length < 2 ? 'Add another member first' : tasks.length === 0 ? 'Create a task first' : undefined}
              >
                ⚠ Warn
              </button>
              <button className="btn btn-danger btn-sm" onClick={handleDeleteProject}>Delete</button>
            </>
          )}
          <button
            className="btn btn-primary btn-sm"
            onClick={() => { setEditingTask(null); setShowTaskModal(true); }}
          >
            + Task
          </button>
        </div>
      </div>

      {stats && (
        <div className="stats-bar">
          {[
            { label: 'Total',       val: stats.total,       color: 'var(--text2)'  },
            { label: 'To Do',       val: stats.todo,        color: 'var(--text3)'  },
            { label: 'In Progress', val: stats.inProgress, color: 'var(--blue)'   },
            { label: 'Review',      val: stats.review,     color: 'var(--yellow)' },
            { label: 'Done',        val: stats.done,       color: 'var(--green)'  },
            { label: 'Overdue',     val: stats.overdue,    color: 'var(--red)'    },
            { label: 'Expedited',   val: stats.expedited,  color: 'var(--red)'    },
          ].map((s) => (
            <div key={s.label} className="stats-bar-item">
              <span className="stats-bar-val" style={{ color: s.color }}>{s.val}</span>
              <span className="stats-bar-label">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="detail-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`detail-tab${activeTab === tab ? ' active' : ''}`}
          >
            {tab === 'warnings' ? `⚠ Warnings (${warnings.length})` : TAB_LABELS[tab]}
            {tab === 'warnings' && unresolvedWarnings > 0 && (
              <span className="tab-badge">{unresolvedWarnings}</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'board' && (
        <div className="kanban-board">
          {STATUS_COLUMNS.map((s) => (
            <div key={s.key} className="kanban-col">
              <div className="kanban-col-header">
                <div className="kanban-col-label">
                  <div className="kanban-col-dot" style={{ background: s.color }} />
                  <span className="kanban-col-title">{s.label}</span>
                </div>
                <span className="kanban-col-count">{tasksByStatus[s.key].length}</span>
              </div>
              <div className="kanban-col-body">
                {tasksByStatus[s.key].length === 0 ? (
                  <div className="kanban-empty">No tasks</div>
                ) : (
                  tasksByStatus[s.key].map((task) => (
                    <TaskCard
                      key={task._id}
                      task={task}
                      isAdmin={isAdmin}
                      canEdit={isAdmin || task.createdBy?._id === project.owner?._id}
                      onEdit={() => { setEditingTask(task); setShowTaskModal(true); }}
                      onDelete={() => handleTaskDelete(task._id)}
                      onStatusChange={handleStatusChange}
                      onExpedite={() => handleExpedite(task._id)}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'members' && (
        <div className="members-list">
          {project.members.map((m) => {
            const isOwnerRow = m.user?._id?.toString() === ownerId;
            return (
              <div key={m.user?._id || m._id} className="member-row">
                <div className="member-row-avatar">{(m.user?.name || '?')[0]?.toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="member-row-name">
                    {m.user?.name || 'Deleted user'}
                    {isOwnerRow && <span className="member-owner-tag">owner</span>}
                  </div>
                  <div className="member-row-email">{m.user?.email}</div>
                </div>
                <span className="member-row-role" style={{ color: m.role === 'admin' ? 'var(--accent)' : 'var(--text2)' }}>
                  {m.role === 'admin' ? '👑 admin' : '👤 member'}
                </span>
                {isAdmin && !isOwnerRow && (
                  <button className="btn btn-danger btn-sm" onClick={() => handleRemoveMember(m.user._id)}>
                    Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'warnings' && (
        <div className="warnings-panel">
          {isAdmin && project.members.length > 1 && tasks.length > 0 && (
            <button className="btn btn-warn btn-sm" style={{ marginBottom: 16 }} onClick={() => setShowWarnModal(true)}>
              ⚠ Issue New Warning
            </button>
          )}
          {warnings.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">✅</div>
              <h3>No warnings issued</h3>
              <p>All members are on track!</p>
            </div>
          ) : (
            warnings.map((w) => (
              <div
                key={w._id}
                className={`warning-item${w.resolved ? ' resolved' : ''}`}
                style={{ borderColor: `${SEVERITY_COLORS[w.severity]}40` }}
              >
                <div className="warning-icon" aria-hidden="true">{w.resolved ? '✓' : '⚠️'}</div>
                <div className="warning-body">
                  <div className="warning-to" style={{ color: SEVERITY_COLORS[w.severity] }}>
                    Warning to {w.issuedTo?.name || 'Unknown member'} —{' '}
                    <span style={{ textTransform: 'capitalize' }}>{w.severity}</span>
                    {w.resolved && <span className="warning-resolved-tag"> · resolved</span>}
                  </div>
                  {w.task && <div className="warning-task">Re: “{w.task.title}”</div>}
                  <div className="warning-msg">{w.message}</div>
                  <div className="warning-date">
                    Issued by {w.issuedBy?.name || 'Unknown'} ·{' '}
                    {new Date(w.createdAt).toLocaleDateString(undefined, {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </div>
                </div>
                {isAdmin && (
                  <div className="warning-actions">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleToggleResolved(w._id, !w.resolved)}
                      disabled={busyWarningId === w._id}
                    >
                      {w.resolved ? 'Reopen' : 'Resolve'}
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDeleteWarning(w._id)}
                      aria-label="Delete warning"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {showTaskModal && (
        <TaskModal
          project={project}
          task={editingTask}
          isAdmin={isAdmin}
          onClose={() => { setShowTaskModal(false); setEditingTask(null); }}
          onSave={handleTaskSave}
        />
      )}

      {showMemberModal && (
        <Modal title="Add Member" onClose={() => setShowMemberModal(false)} maxWidth={440}>
          <form onSubmit={handleAddMember} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="member-email">User Email *</label>
              <div className="inline-field">
                <input
                  id="member-email"
                  className="input-field"
                  type="email"
                  placeholder="teammate@example.com"
                  value={memberEmail}
                  onChange={(e) => { setMemberEmail(e.target.value); setMemberLookup(null); }}
                  required
                />
                <button type="button" className="btn btn-ghost btn-sm" onClick={lookupMember} disabled={!memberEmail.trim()}>
                  Check
                </button>
              </div>
              {memberLookup?.state === 'loading' && <span className="form-hint">Looking up…</span>}
              {memberLookup?.state === 'missing' && (
                <span className="form-hint error">No account with that email.</span>
              )}
              {memberLookup?.state === 'found' && (
                <span className="form-hint success">
                  Found: {memberLookup.user.name} ({memberLookup.user.email})
                </span>
              )}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="member-role">Role</label>
              <select
                id="member-role"
                className="input-field"
                value={memberRole}
                onChange={(e) => setMemberRole(e.target.value)}
              >
                <option value="member">Member — can move tasks</option>
                <option value="admin">Admin — full control</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowMemberModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={addingMember}>
                {addingMember ? 'Adding...' : 'Add Member'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showEditModal && (
        <Modal title="Edit Project" onClose={() => setShowEditModal(false)}>
          <form onSubmit={handleSaveProject} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="proj-name">Project Name *</label>
              <input
                id="proj-name"
                className="input-field"
                value={projectForm.name}
                maxLength={100}
                onChange={(e) => setProjectForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="proj-desc">Description</label>
              <textarea
                id="proj-desc"
                className="input-field"
                rows={3}
                maxLength={500}
                value={projectForm.description}
                onChange={(e) => setProjectForm((prev) => ({ ...prev, description: e.target.value }))}
                style={{ resize: 'vertical' }}
              />
            </div>
            <div className="form-grid2">
              <div className="form-group">
                <label className="form-label" htmlFor="proj-status">Status</label>
                <select
                  id="proj-status"
                  className="input-field"
                  value={projectForm.status}
                  onChange={(e) => setProjectForm((prev) => ({ ...prev, status: e.target.value }))}
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="proj-due">Due Date</label>
                <input
                  id="proj-due"
                  className="input-field"
                  type="date"
                  value={projectForm.dueDate}
                  onChange={(e) => setProjectForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Color</label>
              <div className="color-picker">
                {PROJECT_COLORS.map((c) => (
                  <button
                    type="button"
                    key={c}
                    className="color-swatch"
                    onClick={() => setProjectForm((prev) => ({ ...prev, color: c }))}
                    aria-label={`Use colour ${c}`}
                    aria-pressed={projectForm.color === c}
                    style={{
                      background: c,
                      border: projectForm.color === c ? '2px solid var(--text)' : '2px solid transparent',
                      transform: projectForm.color === c ? 'scale(1.15)' : 'scale(1)',
                    }}
                  />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={savingProject}>
                {savingProject ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showWarnModal && (
        <Modal title="⚠ Issue Warning" onClose={() => setShowWarnModal(false)}>
          <form onSubmit={handleIssueWarning} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="warn-to">Member *</label>
              <select
                id="warn-to"
                className="input-field"
                value={warnForm.issuedTo}
                onChange={(e) => setWarnForm((prev) => ({ ...prev, issuedTo: e.target.value }))}
                required
              >
                <option value="">Select member…</option>
                {warnableMembers.map((m) => (
                  <option key={m.user?._id} value={m.user?._id}>{m.user?.name} ({m.user?.email})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="warn-task">Related Task *</label>
              <select
                id="warn-task"
                className="input-field"
                value={warnForm.task}
                onChange={(e) => setWarnForm((prev) => ({ ...prev, task: e.target.value }))}
                required
              >
                <option value="">Select task…</option>
                {tasks.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.title}{isOverdue(t) ? ' ⚠ overdue' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="warn-severity">Severity</label>
              <select
                id="warn-severity"
                className="input-field"
                value={warnForm.severity}
                onChange={(e) => setWarnForm((prev) => ({ ...prev, severity: e.target.value }))}
              >
                <option value="mild">Mild — friendly reminder</option>
                <option value="moderate">Moderate — formal notice</option>
                <option value="severe">Severe — urgent escalation</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="warn-msg">Message *</label>
              <textarea
                id="warn-msg"
                className="input-field"
                rows={4}
                maxLength={500}
                style={{ resize: 'vertical' }}
                placeholder="Explain why this warning is being issued and what action is expected…"
                value={warnForm.message}
                onChange={(e) => setWarnForm((prev) => ({ ...prev, message: e.target.value }))}
                required
              />
            </div>
            {overdueTasks.length > 0 && (
              <div className="inline-warning">
                ⚠ {overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''} in this project
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowWarnModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-warn" disabled={sendingWarn}>
                {sendingWarn ? 'Issuing...' : '⚠ Issue Warning'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}