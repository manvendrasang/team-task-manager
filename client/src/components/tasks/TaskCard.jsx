import { PRIORITY_COLORS } from './taskCardConfig';
import { STATUSES, isOverdue, formatDueDate } from '../../utils/constants';

export default function TaskCard({
  task, onEdit, onDelete, onStatusChange, onExpedite, isAdmin, canEdit = true,
}) {
  const overdue = isOverdue(task);

  return (
    <article className="task-card">
      <div className="task-card-stripe" style={{ background: PRIORITY_COLORS[task.priority] }} />
      <div className="task-card-body">
        <div className="task-card-title-row">
          <h4 className="task-card-title">{task.title}</h4>
          <div className="task-card-actions">
            {canEdit && (
              <button className="task-action-btn" onClick={onEdit} title="Edit task" aria-label="Edit task">✏</button>
            )}
            {isAdmin && (
              <>
                <button
                  className="task-action-btn"
                  onClick={onExpedite}
                  title={task.expedited ? 'Remove expedite' : 'Expedite task'}
                  aria-label={task.expedited ? 'Remove expedite' : 'Expedite task'}
                  style={{ color: task.expedited ? 'var(--red)' : 'var(--text3)' }}
                >
                  🚀
                </button>
                <button
                  className="task-action-btn task-action-delete"
                  onClick={onDelete}
                  title="Delete task"
                  aria-label="Delete task"
                >
                  ✕
                </button>
              </>
            )}
          </div>
        </div>

        {task.expedited && (
          <div className="task-expedite-row">
            <span className="expedite-badge">🚀 EXPEDITED</span>
          </div>
        )}

        {task.description && <p className="task-card-desc">{task.description}</p>}

        <div className="task-card-meta">
          {task.assignee ? (
            <div className="task-assignee">
              <div className="task-assignee-av">
                {task.assignee.name?.[0]?.toUpperCase()}
              </div>
              <span className="task-assignee-name">{task.assignee.name.split(' ')[0]}</span>
            </div>
          ) : <span />}
          {task.dueDate && (
            <span className="task-due" style={{ color: overdue ? 'var(--red)' : 'var(--text3)' }}>
              {overdue ? '⚠ ' : '📅 '}{formatDueDate(task.dueDate)}
            </span>
          )}
        </div>

        <div className="task-card-footer">
          <span className={`badge badge-${task.priority}`}>{task.priority}</span>
          <select
            className="task-status-select"
            value={task.status}
            onChange={(e) => onStatusChange(task._id, e.target.value)}
            aria-label={`Status for ${task.title}`}
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
    </article>
  );
}