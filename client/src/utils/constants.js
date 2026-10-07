/** Board columns, ordered and carrying the display label + accent colour. */
const STATUS_COLUMNS = [
  { key: 'todo',        label: 'To Do',       color: 'var(--text3)'  },
  { key: 'in-progress', label: 'In Progress', color: 'var(--blue)'   },
  { key: 'review',      label: 'Review',      color: 'var(--yellow)' },
  { key: 'done',        label: 'Done',        color: 'var(--green)'  },
];

// Plain key list, for <select> options and filter rows.
const STATUSES = STATUS_COLUMNS.map((s) => s.key);

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const PROJECT_COLORS = ['#7e72f2', '#34d3a0', '#f0c050', '#f06080', '#60b8f0', '#f09050', '#a855f7', '#ec4899'];

const SEVERITY_COLORS = {
  mild: 'var(--yellow)',
  moderate: 'var(--orange)',
  severe: 'var(--red)',
};

const toDateInputValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  // Local calendar date, not UTC, otherwise the input shifts by a day.
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const isOverdue = (task) =>
  Boolean(task.dueDate) && new Date(task.dueDate) < new Date() && task.status !== 'done';

const initialsOf = (name = '', max = 2) =>
  name.trim().split(/\s+/).filter(Boolean).map((n) => n[0]).join('').toUpperCase().slice(0, max);

const formatDueDate = (value) =>
  new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export {
  STATUS_COLUMNS,
  STATUSES,
  PRIORITIES,
  PROJECT_COLORS,
  SEVERITY_COLORS,
  toDateInputValue,
  isOverdue,
  initialsOf,
  formatDueDate,
};