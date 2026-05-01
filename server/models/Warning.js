const mongoose = require('mongoose');

const WarningSchema = new mongoose.Schema(
  {
    project:   { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    task:      { type: mongoose.Schema.Types.ObjectId, ref: 'Task',    required: true },
    issuedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
    issuedTo:  { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
    message:   { type: String, required: true, maxlength: 500 },
    severity:  { type: String, enum: ['mild', 'moderate', 'severe'], default: 'mild' },
    resolved:  { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Warning', WarningSchema);