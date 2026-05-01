const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Task = require('../models/Task');
const Project = require('../models/Project');
const { protect } = require('../middleware/auth');

const getMemberRole = (project, userId) => {
  const member = project.members.find((m) => {
    const memberId = m.user?._id ? m.user._id.toString() : m.user.toString();
    return memberId === userId.toString();
  });
  return member ? member.role : null;
};

// @route   GET /api/tasks
// @desc    Get tasks (filter by project, assignee, status, priority)
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { project, assignee, status, priority, overdue } = req.query;
    const filter = {};

    if (project) {
      const proj = await Project.findById(project);
      if (!proj || !getMemberRole(proj, req.user._id))
        return res.status(403).json({ message: 'Access denied' });
      filter.project = project;
    } else {
      // Only tasks from projects user belongs to
      const userProjects = await Project.find({ 'members.user': req.user._id }).select('_id');
      filter.project = { $in: userProjects.map((p) => p._id) };
    }

    if (assignee) filter.assignee = assignee;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (overdue === 'true') {
      filter.dueDate = { $lt: new Date() };
      filter.status = { $ne: 'done' };
    }

    const tasks = await Task.find(filter)
      .populate('assignee', 'name email')
      .populate('createdBy', 'name email')
      .populate('project', 'name color')
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   POST /api/tasks
// @desc    Create a task
// @access  Private (project members)
router.post(
  '/',
  protect,
  [body('title').trim().notEmpty().withMessage('Title is required'),
   body('project').notEmpty().withMessage('Project is required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    try {
      const project = await Project.findById(req.body.project);
      if (!project) return res.status(404).json({ message: 'Project not found' });

      const role = getMemberRole(project, req.user._id);
      if (!role) return res.status(403).json({ message: 'Access denied' });

      const { title, description, status, priority, assignee, dueDate, tags } = req.body;
      const task = await Task.create({
        title,
        description,
        status,
        priority,
        assignee: assignee || null,
        dueDate,
        tags,
        project: project._id,
        createdBy: req.user._id,
      });

      await task.populate('assignee', 'name email');
      await task.populate('createdBy', 'name email');
      await task.populate('project', 'name color');
      res.status(201).json(task);
    } catch (err) {
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  }
);

// @route   GET /api/tasks/:id
// @desc    Get single task
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignee', 'name email')
      .populate('createdBy', 'name email')
      .populate('project', 'name color members');

    if (!task) return res.status(404).json({ message: 'Task not found' });

    const role = getMemberRole(task.project, req.user._id);
    if (!role) return res.status(403).json({ message: 'Access denied' });

    res.json(task);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   PUT /api/tasks/:id
// @desc    Update task
// @access  Private (project members; admins can do anything, members can update status/assignee)
router.put('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).populate('project');
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const role = getMemberRole(task.project, req.user._id);
    if (!role) return res.status(403).json({ message: 'Access denied' });

    const { title, description, status, priority, assignee, dueDate, tags } = req.body;

    if (role === 'admin') {
      if (title) task.title = title;
      if (description !== undefined) task.description = description;
      if (priority) task.priority = priority;
      if (dueDate !== undefined) task.dueDate = dueDate;
      if (tags) task.tags = tags;
    }
    // Both admin and member can update status and assignee
    if (status) task.status = status;
    if (assignee !== undefined) task.assignee = assignee || null;

    await task.save();
    await task.populate('assignee', 'name email');
    await task.populate('createdBy', 'name email');
    await task.populate('project', 'name color');
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   DELETE /api/tasks/:id
// @desc    Delete task (admin or creator)
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).populate('project');
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const role = getMemberRole(task.project, req.user._id);
    if (!role) return res.status(403).json({ message: 'Access denied' });

    const isCreator = task.createdBy.toString() === req.user._id.toString();
    if (role !== 'admin' && !isCreator)
      return res.status(403).json({ message: 'Not authorized to delete this task' });

    await task.deleteOne();
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;