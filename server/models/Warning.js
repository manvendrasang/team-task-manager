const mongoose = require('mongoose');

const WarningSchema = new mongoose.Schema(
  {
    project:   { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    task:      { type: mongoose.Schema.Types.ObjectId, ref: 'Task',    required: true },
    issuedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
    issuedTo:  { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true, index: true },
    message:   { type: String, required: true, trim: true, maxlength: 500 },
    severity:  { type: String, enum: ['mild', 'moderate', 'severe'], default: 'mild' },
    resolved:  { type: Boolean, default: false },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

// "Warnings issued to me" — the recipient inbox view.
WarningSchema.index({ issuedTo: 1, resolved: 1, createdAt: -1 });

WarningSchema.pre('save', function syncResolvedAt(next) {
  if (this.isModified('resolved')) {
    this.resolvedAt = this.resolved ? new Date() : undefined;
  }
  next();
});

module.exports = mongoose.model('Warning', WarningSchema);