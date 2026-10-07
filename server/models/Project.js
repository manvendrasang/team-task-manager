const mongoose = require('mongoose');

const MemberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ProjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      maxlength: [100, 'Project name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    color: {
      type: String,
      default: '#7e72f2',
      match: [/^#[0-9a-fA-F]{6}$/, 'Color must be a hex value like #7e72f2'],
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'archived'],
      default: 'active',
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    members: {
      type: [MemberSchema],
      // Every list endpoint filters on membership, so this drives the index below.
      validate: [(v) => v.length > 0, 'A project needs at least one member'],
    },
    dueDate: { type: Date },
  },
  { timestamps: true }
);

// Backs `Project.find({ 'members.user': userId })` on every list request.
ProjectSchema.index({ 'members.user': 1, createdAt: -1 });

// Ensure owner is always in members as admin (only on new documents)
ProjectSchema.pre('save', function ensureOwnerMember(next) {
  if (!this.isNew) return next();
  const ownerId = this.owner?.toString();
  const ownerInMembers = this.members.some((m) => m.user.toString() === ownerId);
  if (!ownerInMembers) {
    this.members.push({ user: this.owner, role: 'admin' });
  }
  next();
});

module.exports = mongoose.model('Project', ProjectSchema);