import { format, isAfter } from 'date-fns';
import './TaskCard.css';

const PRIORITY_COLORS = { low:'var(--text3)', medium:'var(--blue)', high:'var(--yellow)', urgent:'var(--red)' };
const STATUS_OPTIONS  = ['todo','in-progress','review','done'];

export default function TaskCard({ task, onEdit, onDelete, onStatusChange, onExpedite, isAdmin }) {
  const isOverdue  = task.dueDate && isAfter(new Date(), new Date(task.dueDate)) && task.status !== 'done';
  const isExpedited = task.expedited;

  return (
    <div className="task-card">
      <div className="task-card-stripe" style={{ background: PRIORITY_COLORS[task.priority] }} />
      <div className="task-card-body">
        <div className="task-card-title-row">
          <span className="task-card-title">{task.title}</span>
          <div className="task-card-actions">
            <button className="task-action-btn" onClick={onEdit} title="Edit">✏</button>
            {isAdmin && (
              <>
                <button className="task-action-btn" onClick={onExpedite}
                  title={isExpedited ? 'Remove expedite' : 'Expedite task'}
                  style={{ color: isExpedited ? 'var(--red)' : 'var(--text3)' }}>🚀</button>
                <button className="task-action-btn task-action-delete" onClick={onDelete} title="Delete">✕</button>
              </>
            )}
          </div>
        </div>

        {isExpedited && (
          <div className="task-expedite-row">
            <span className="expedite-badge">🚀 EXPEDITED</span>
          </div>
        )}

        {task.description && <p className="task-card-desc">{task.description}</p>}

        <div className="task-card-meta">
          {task.assignee ? (
            <div className="task-assignee">
              <div className="task-assignee-av">{task.assignee.name?.[0]?.toUpperCase()}</div>
              <span className="task-assignee-name">{task.assignee.name.split(' ')[0]}</span>
            </div>
          ) : <span />}
          {task.dueDate && (
            <span className="task-due" style={{ color: isOverdue ? 'var(--red)' : 'var(--text3)' }}>
              {isOverdue ? '⚠ ' : '📅 '}{format(new Date(task.dueDate), 'MMM d')}
            </span>
          )}
        </div>

        <div className="task-card-footer">
          <span className={`badge badge-${task.priority}`}>{task.priority}</span>
          <select className="task-status-select" value={task.status}
            onChange={e => onStatusChange(task._id, e.target.value)}
            onClick={e => e.stopPropagation()}>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}
