const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    status: {
      type: String,
      enum: ['todo', 'in-progress', 'review', 'done'],
      default: 'todo',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    dueDate: { type: Date },
    tags: {
      type: [{ type: String, trim: true, maxlength: 30 }],
      default: [],
    },
    expedited: { type: Boolean, default: false },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

// Kanban boards group by status within a project; overdue filters scan dueDate.
TaskSchema.index({ project: 1, status: 1, createdAt: -1 });
TaskSchema.index({ dueDate: 1 });

// Keep completedAt in step with status on every save.
TaskSchema.pre('save', function syncCompletedAt(next) {
  if (this.isModified('status')) {
    if (this.status === 'done') {
      this.completedAt = this.completedAt || new Date();
    } else {
      this.completedAt = undefined;
    }
  }
  next();
});

module.exports = mongoose.model('Task', TaskSchema);