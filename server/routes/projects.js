const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Project = require('../models/Project');
const Task    = require('../models/Task');
const Warning = require('../models/Warning');
const User    = require('../models/User');
const { protect } = require('../middleware/auth');

const getMemberRole = (project, userId) => {
  const member = project.members.find((m) => {
    const memberId = m.user?._id ? m.user._id.toString() : m.user.toString();
    return memberId === userId.toString();
  });
  return member ? member.role : null;
};

router.get('/', protect, async (req, res) => {
  try {
    const projects = await Project.find({ 'members.user': req.user._id })
      .populate('owner', 'name email')
      .populate('members.user', 'name email')
      .sort({ createdAt: -1 });
    res.json(projects);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
});

router.post('/', protect,
  [body('name').trim().notEmpty().withMessage('Project name is required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const { name, description, color, dueDate } = req.body;
      const project = await Project.create({ name, description, color, dueDate, owner: req.user._id, members: [{ user: req.user._id, role: 'admin' }] });
      await project.populate('owner', 'name email');
      await project.populate('members.user', 'name email');
      res.status(201).json(project);
    } catch (err) { console.error('Create project error:', err); res.status(500).json({ message: 'Server error', error: err.message }); }
  }
);

router.get('/:id', protect, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('owner', 'name email')
      .populate('members.user', 'name email');
    if (!project) return res.status(404).json({ message: 'Project not found' });
    const role = getMemberRole(project, req.user._id);
    if (!role) return res.status(403).json({ message: 'Access denied' });
    res.json({ ...project.toObject(), userRole: role });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    const role = getMemberRole(project, req.user._id);
    if (role !== 'admin') return res.status(403).json({ message: 'Only admins can update project' });
    const { name, description, color, status, dueDate } = req.body;
    if (name) project.name = name;
    if (description !== undefined) project.description = description;
    if (color) project.color = color;
    if (status) project.status = status;
    if (dueDate !== undefined) project.dueDate = dueDate;
    await project.save();
    await project.populate('owner', 'name email');
    await project.populate('members.user', 'name email');
    res.json(project);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
});

router.post('/:id/members', protect, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    const role = getMemberRole(project, req.user._id);
    if (role !== 'admin') return res.status(403).json({ message: 'Only admins can add members' });
    const { email, memberRole = 'member' } = req.body;
    const userToAdd = await User.findOne({ email });
    if (!userToAdd) return res.status(404).json({ message: 'User not found' });
    const alreadyMember = project.members.some(m => (m.user?._id || m.user).toString() === userToAdd._id.toString());
    if (alreadyMember) return res.status(400).json({ message: 'User is already a member' });
    project.members.push({ user: userToAdd._id, role: memberRole });
    await project.save();
    await project.populate('members.user', 'name email');
    res.json(project);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
});

router.delete('/:id/members/:userId', protect, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    const role = getMemberRole(project, req.user._id);
    if (role !== 'admin') return res.status(403).json({ message: 'Only admins can remove members' });
    if (req.params.userId === project.owner.toString()) return res.status(400).json({ message: 'Cannot remove project owner' });
    project.members = project.members.filter(m => (m.user?._id || m.user).toString() !== req.params.userId);
    await project.save();
    await project.populate('members.user', 'name email');
    res.json(project);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    if (project.owner.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Only the owner can delete the project' });
    await Task.deleteMany({ project: project._id });
    await Warning.deleteMany({ project: project._id });
    await project.deleteOne();
    res.json({ message: 'Project deleted successfully' });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
});

router.get('/:id/stats', protect, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    const role = getMemberRole(project, req.user._id);
    if (!role) return res.status(403).json({ message: 'Access denied' });
    const tasks = await Task.find({ project: req.params.id });
    res.json({
      total: tasks.length,
      todo: tasks.filter(t => t.status === 'todo').length,
      inProgress: tasks.filter(t => t.status === 'in-progress').length,
      review: tasks.filter(t => t.status === 'review').length,
      done: tasks.filter(t => t.status === 'done').length,
      overdue: tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done').length,
      expedited: tasks.filter(t => t.expedited).length,
    });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
});

// EXPEDITE
router.put('/:id/tasks/:taskId/expedite', protect, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    const role = getMemberRole(project, req.user._id);
    if (role !== 'admin') return res.status(403).json({ message: 'Admins only' });
    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    task.expedited = !task.expedited;
    if (task.expedited) task.priority = 'urgent';
    await task.save();
    await task.populate('assignee', 'name email');
    await task.populate('createdBy', 'name email');
    await task.populate('project', 'name color');
    res.json(task);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
});

// WARNINGS
router.get('/:id/warnings', protect, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    const role = getMemberRole(project, req.user._id);
    if (!role) return res.status(403).json({ message: 'Access denied' });
    const warnings = await Warning.find({ project: req.params.id })
      .populate('issuedBy', 'name email')
      .populate('issuedTo', 'name email')
      .populate('task', 'title status dueDate')
      .sort({ createdAt: -1 });
    res.json(warnings);
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
});

router.post('/:id/warnings', protect,
  [
    body('issuedTo').notEmpty().withMessage('Recipient required'),
    body('task').notEmpty().withMessage('Task reference required'),
    body('message').trim().notEmpty().withMessage('Message required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const project = await Project.findById(req.params.id);
      if (!project) return res.status(404).json({ message: 'Project not found' });
      const role = getMemberRole(project, req.user._id);
      if (role !== 'admin') return res.status(403).json({ message: 'Only admins can issue warnings' });
      const { issuedTo, task, message, severity } = req.body;
      const warning = await Warning.create({ project: req.params.id, task, issuedBy: req.user._id, issuedTo, message, severity: severity || 'mild' });
      await warning.populate('issuedBy', 'name email');
      await warning.populate('issuedTo', 'name email');
      await warning.populate('task', 'title status dueDate');
      res.status(201).json(warning);
    } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
  }
);

router.delete('/:id/warnings/:warnId', protect, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    const role = getMemberRole(project, req.user._id);
    if (role !== 'admin') return res.status(403).json({ message: 'Admins only' });
    await Warning.findByIdAndDelete(req.params.warnId);
    res.json({ message: 'Warning removed' });
  } catch (err) { res.status(500).json({ message: 'Server error', error: err.message }); }
});

module.exports = router;