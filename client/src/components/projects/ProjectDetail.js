import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import api from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import TaskCard from '../tasks/TaskCard';
import TaskModal from '../tasks/TaskModal';
import './ProjectDetail.css';

const STATUSES = [
  { key:'todo',        label:'To Do',       color:'var(--text3)'  },
  { key:'in-progress', label:'In Progress',  color:'var(--blue)'   },
  { key:'review',      label:'Review',       color:'var(--yellow)' },
  { key:'done',        label:'Done',         color:'var(--green)'  },
];

const SEVERITY_COLORS = { mild:'var(--yellow)', moderate:'var(--orange)', severe:'var(--red)' };
const TABS = ['board','members','warnings'];

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [project,     setProject]     = useState(null);
  const [tasks,       setTasks]       = useState([]);
  const [stats,       setStats]       = useState(null);
  const [warnings,    setWarnings]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState('board');
  const [showTaskModal,   setShowTaskModal]   = useState(false);
  const [editingTask,     setEditingTask]     = useState(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showWarnModal,   setShowWarnModal]   = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole,  setMemberRole]  = useState('member');
  const [addingMember, setAddingMember] = useState(false);
  const [warnForm, setWarnForm] = useState({ issuedTo:'', task:'', message:'', severity:'mild' });
  const [sendingWarn, setSendingWarn] = useState(false);

  const fetchData = async () => {
    try {
      const projRes = await api.get(`/projects/${id}`);
      setProject(projRes.data);
    } catch {
      addToast('Project not found or access denied', 'error');
      navigate('/projects');
      setLoading(false);
      return;
    }
    setLoading(false);
    try { const r = await api.get(`/tasks?project=${id}`);       setTasks(r.data);    } catch {}
    try { const r = await api.get(`/projects/${id}/stats`);      setStats(r.data);    } catch {}
    try { const r = await api.get(`/projects/${id}/warnings`);   setWarnings(r.data); } catch {}
  };

  useEffect(() => { fetchData(); }, [id]); // eslint-disable-line

  const isAdmin = project?.userRole === 'admin';

  const handleTaskSave = (task, isNew) => {
    if (isNew) setTasks(prev => [task, ...prev]);
    else setTasks(prev => prev.map(t => t._id === task._id ? task : t));
    setShowTaskModal(false);
    setEditingTask(null);
    fetchData();
  };

  const handleTaskDelete = async (taskId) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      setTasks(prev => prev.filter(t => t._id !== taskId));
      addToast('Task deleted', 'success');
      fetchData();
    } catch { addToast('Failed to delete task', 'error'); }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const { data } = await api.put(`/tasks/${taskId}`, { status: newStatus });
      setTasks(prev => prev.map(t => t._id === taskId ? data : t));
      fetchData();
    } catch { addToast('Failed to update task', 'error'); }
  };

  const handleExpedite = async (taskId) => {
    try {
      const { data } = await api.put(`/projects/${id}/tasks/${taskId}/expedite`);
      setTasks(prev => prev.map(t => t._id === taskId ? data : t));
      addToast(data.expedited ? '🚀 Task expedited!' : 'Expedite removed', data.expedited ? 'info' : 'success');
      fetchData();
    } catch { addToast('Failed to expedite task', 'error'); }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    setAddingMember(true);
    try {
      const { data } = await api.post(`/projects/${id}/members`, { email: memberEmail, memberRole });
      setProject(data);
      setShowMemberModal(false);
      setMemberEmail('');
      addToast('Member added!', 'success');
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to add member', 'error');
    } finally { setAddingMember(false); }
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm('Remove this member?')) return;
    try {
      const { data } = await api.delete(`/projects/${id}/members/${userId}`);
      setProject(data);
      addToast('Member removed', 'success');
    } catch (err) { addToast(err.response?.data?.message || 'Failed', 'error'); }
  };

  const handleDeleteProject = async () => {
    if (!window.confirm('Delete this project and all its tasks? This cannot be undone.')) return;
    try {
      await api.delete(`/projects/${id}`);
      addToast('Project deleted', 'success');
      navigate('/projects');
    } catch (err) { addToast(err.response?.data?.message || 'Failed to delete', 'error'); }
  };

  const handleIssueWarning = async (e) => {
    e.preventDefault();
    setSendingWarn(true);
    try {
      const { data } = await api.post(`/projects/${id}/warnings`, warnForm);
      setWarnings(prev => [data, ...prev]);
      setShowWarnModal(false);
      setWarnForm({ issuedTo:'', task:'', message:'', severity:'mild' });
      addToast('⚠ Warning issued', 'warn');
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to issue warning', 'error');
    } finally { setSendingWarn(false); }
  };

  const handleDeleteWarning = async (warnId) => {
    try {
      await api.delete(`/projects/${id}/warnings/${warnId}`);
      setWarnings(prev => prev.filter(w => w._id !== warnId));
      addToast('Warning removed', 'success');
    } catch { addToast('Failed to remove warning', 'error'); }
  };

  if (loading) return (
    <div className="loading-screen">
      <div style={{ display:'flex', gap:8 }}>
        <div className="loading-dot"/><div className="loading-dot"/><div className="loading-dot"/>
      </div>
    </div>
  );

  const tasksByStatus = STATUSES.reduce((acc, s) => {
    acc[s.key] = tasks.filter(t => t.status === s.key);
    return acc;
  }, {});

  // Non-admin members for warning target (exclude self)
  const warnableMembers = project?.members?.filter(m => {
    const uid = m.user?._id || m.user;
    return uid !== project.owner?._id;
  }) || [];

  // Overdue tasks for warning reference
  const overdueTasks = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done');

  return (
    <div className="project-detail-page fade-in">
      {/* Header */}
      <div className="project-detail-header">
        <div className="project-detail-left">
          <div className="project-color-dot" style={{ background: project.color }} />
          <div>
            <h1 className="project-detail-title">{project.name}</h1>
            {project.description && <p className="project-detail-desc">{project.description}</p>}
          </div>
        </div>
        <div className="project-detail-actions">
          {isAdmin && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowMemberModal(true)}>+ Member</button>
              <button className="btn btn-warn btn-sm" onClick={() => { setActiveTab('warnings'); setShowWarnModal(true); }}>⚠ Warn</button>
              <button className="btn btn-danger btn-sm" onClick={handleDeleteProject}>Delete</button>
            </>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => { setEditingTask(null); setShowTaskModal(true); }}>+ Task</button>
        </div>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="stats-bar">
          {[
            { label:'Total',      val:stats.total,      color:'var(--text2)'  },
            { label:'To Do',      val:stats.todo,       color:'var(--text3)'  },
            { label:'In Progress',val:stats.inProgress, color:'var(--blue)'   },
            { label:'Review',     val:stats.review,     color:'var(--yellow)' },
            { label:'Done',       val:stats.done,       color:'var(--green)'  },
            { label:'Overdue',    val:stats.overdue,    color:'var(--red)'    },
            { label:'Expedited',  val:stats.expedited,  color:'var(--red)'    },
          ].map(s => (
            <div key={s.label} className="stats-bar-item">
              <span className="stats-bar-val" style={{ color:s.color }}>{s.val}</span>
              <span className="stats-bar-label">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="detail-tabs">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`detail-tab${activeTab === tab ? ' active' : ''}`}>
            {tab === 'warnings' ? `⚠ Warnings (${warnings.length})` : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* BOARD TAB */}
      {activeTab === 'board' && (
        <div className="kanban-board">
          {STATUSES.map(s => (
            <div key={s.key} className="kanban-col">
              <div className="kanban-col-header">
                <div className="kanban-col-label">
                  <div className="kanban-col-dot" style={{ background: s.color }} />
                  <span className="kanban-col-title">{s.label}</span>
                </div>
                <span className="kanban-col-count">{tasksByStatus[s.key].length}</span>
              </div>
              <div className="kanban-col-body">
                {tasksByStatus[s.key].length === 0
                  ? <div className="kanban-empty">No tasks</div>
                  : tasksByStatus[s.key].map(task => (
                    <TaskCard key={task._id} task={task}
                      isAdmin={isAdmin}
                      onEdit={() => { setEditingTask(task); setShowTaskModal(true); }}
                      onDelete={() => handleTaskDelete(task._id)}
                      onStatusChange={handleStatusChange}
                      onExpedite={() => handleExpedite(task._id)}
                    />
                  ))
                }
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MEMBERS TAB */}
      {activeTab === 'members' && (
        <div className="members-list">
          {project.members.map(m => (
            <div key={m.user?._id} className="member-row">
              <div className="member-row-avatar">{m.user?.name?.[0]?.toUpperCase()}</div>
              <div style={{ flex:1 }}>
                <div className="member-row-name">{m.user?.name}</div>
                <div className="member-row-email">{m.user?.email}</div>
              </div>
              <span className="member-row-role" style={{ color: m.role==='admin' ? 'var(--accent)' : 'var(--text2)' }}>
                {m.role === 'admin' ? '👑 admin' : '👤 member'}
              </span>
              {isAdmin && m.user?._id !== project.owner?._id && (
                <button className="btn btn-danger btn-sm" onClick={() => handleRemoveMember(m.user._id)}>Remove</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* WARNINGS TAB */}
      {activeTab === 'warnings' && (
        <div className="warnings-panel">
          {isAdmin && (
            <button className="btn btn-warn btn-sm" style={{ marginBottom:16 }}
              onClick={() => setShowWarnModal(true)}>
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
            warnings.map(w => (
              <div key={w._id} className="warning-item"
                style={{ borderColor: `${SEVERITY_COLORS[w.severity]}40` }}>
                <div className="warning-icon">⚠️</div>
                <div className="warning-body">
                  <div className="warning-to" style={{ color: SEVERITY_COLORS[w.severity] }}>
                    Warning to {w.issuedTo?.name} — <span style={{ textTransform:'capitalize' }}>{w.severity}</span>
                  </div>
                  {w.task && <div className="warning-task">Re: "{w.task.title}"</div>}
                  <div className="warning-msg">{w.message}</div>
                  <div className="warning-date">
                    Issued by {w.issuedBy?.name} · {format(new Date(w.createdAt), 'MMM d, yyyy')}
                  </div>
                </div>
                {isAdmin && (
                  <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteWarning(w._id)}
                    style={{ flexShrink:0 }}>✕</button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* TASK MODAL */}
      {showTaskModal && (
        <TaskModal project={project} task={editingTask} isAdmin={isAdmin}
          onClose={() => { setShowTaskModal(false); setEditingTask(null); }}
          onSave={handleTaskSave} />
      )}

      {/* ADD MEMBER MODAL */}
      {showMemberModal && (
        <div className="modal-overlay" onClick={() => setShowMemberModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Member</h2>
              <button className="modal-close" onClick={() => setShowMemberModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddMember} style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div className="form-group">
                <label className="form-label">User Email *</label>
                <input className="input-field" type="email" placeholder="teammate@example.com"
                  value={memberEmail} onChange={e => setMemberEmail(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="input-field" value={memberRole} onChange={e => setMemberRole(e.target.value)}>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowMemberModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={addingMember}>
                  {addingMember ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ISSUE WARNING MODAL */}
      {showWarnModal && (
        <div className="modal-overlay" onClick={() => setShowWarnModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">⚠ Issue Warning</h2>
              <button className="modal-close" onClick={() => setShowWarnModal(false)}>✕</button>
            </div>
            <form onSubmit={handleIssueWarning} style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div className="form-group">
                <label className="form-label">Member *</label>
                <select className="input-field" value={warnForm.issuedTo}
                  onChange={e => setWarnForm({...warnForm, issuedTo: e.target.value})} required>
                  <option value="">Select member...</option>
                  {project.members.map(m => (
                    <option key={m.user?._id} value={m.user?._id}>{m.user?.name} ({m.user?.email})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Related Task *</label>
                <select className="input-field" value={warnForm.task}
                  onChange={e => setWarnForm({...warnForm, task: e.target.value})} required>
                  <option value="">Select task...</option>
                  {tasks.map(t => (
                    <option key={t._id} value={t._id}>
                      {t.title}{t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done' ? ' ⚠ overdue' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Severity</label>
                <select className="input-field" value={warnForm.severity}
                  onChange={e => setWarnForm({...warnForm, severity: e.target.value})}>
                  <option value="mild">Mild — friendly reminder</option>
                  <option value="moderate">Moderate — formal notice</option>
                  <option value="severe">Severe — urgent escalation</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Message *</label>
                <textarea className="input-field" rows={4} style={{ resize:'vertical' }}
                  placeholder="Explain why this warning is being issued and what action is expected..."
                  value={warnForm.message}
                  onChange={e => setWarnForm({...warnForm, message: e.target.value})} required />
              </div>
              {overdueTasks.length > 0 && (
                <div style={{ padding:'10px 14px', background:'var(--red-bg)', borderRadius:8, fontSize:13, color:'var(--red)', border:'1px solid rgba(240,96,128,0.2)' }}>
                  ⚠ {overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''} in this project
                </div>
              )}
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowWarnModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-warn" disabled={sendingWarn}>
                  {sendingWarn ? 'Issuing...' : '⚠ Issue Warning'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
