const express = require('express');
const { body } = require('express-validator');

const Project = require('../models/Project');
const Task    = require('../models/Task');
const Warning = require('../models/Warning');
const User    = require('../models/User');

const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { protect } = require('../middleware/auth');
const {
  assertObjectId,
  normalizeEmail,
  assertProjectAdmin,
  assertProjectMember,
} = require('../utils/helpers');
const { optionalDate, optionalHexColor, idParam, idBody } = require('../validators/common');

const router = express.Router();

const PROJECT_STATUSES = ['active', 'completed', 'archived'];
const SEVERITIES = ['mild', 'moderate', 'severe'];

/** Loads a project by `:id`, or throws a clean 400/404 instead of a CastError. */
const loadProject = async (id) => {
  assertObjectId(id, 'project id');
  const project = await Project.findById(id);
  if (!project) throw ApiError.notFound('Project not found');
  return project;
};

/**
 * Populates refs, drops dangling members whose user was deleted, and always
 * includes `userRole` so the client never has to refetch after a mutation.
 */
const presentProject = async (project, viewerId) => {
  await Promise.all([
    project.populate('owner', 'name email'),
    project.populate('members.user', 'name email'),
  ]);

  const members = project.members.filter((m) => m.user);
  project.members = members;

  const viewer = members.find((m) => m.user._id.equals(viewerId));
  const { __v, ...rest } = project.toObject();

  return { ...rest, members, userRole: viewer ? viewer.role : null };
};

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

// @route   GET /api/projects
// @desc    Every project the caller belongs to
// @access  Private
router.get(
  '/',
  protect,
  asyncHandler(async (req, res) => {
    const projects = await Project.find({ 'members.user': req.user._id })
      .populate('owner', 'name email')
      .populate('members.user', 'name email')
      .sort({ createdAt: -1 })
      .lean();
    res.json(projects);
  })
);

// @route   POST /api/projects
// @desc    Create a project; the caller becomes owner + admin
// @access  Private
router.post(
  '/',
  protect,
  [
    body('name').trim().notEmpty().withMessage('Project name is required')
      .isLength({ max: 100 }).withMessage('Project name cannot exceed 100 characters'),
    body('description').optional({ values: 'null' }).trim()
      .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
    optionalHexColor('color'),
    body('status').optional().isIn(PROJECT_STATUSES).withMessage('Invalid project status'),
    optionalDate('dueDate'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { name, description, color, status, dueDate } = req.body;
    const project = await Project.create({
      name,
      description,
      color,
      status,
      dueDate,
      owner: req.user._id,
      members: [{ user: req.user._id, role: 'admin' }],
    });
    res.status(201).json(await presentProject(project, req.user._id));
  })
);

// @route   GET /api/projects/:id
// @access  Private (project members)
router.get(
  '/:id',
  protect,
  [idParam('id', 'project id')],
  validate,
  asyncHandler(async (req, res) => {
    const project = await loadProject(req.params.id);
    assertProjectMember(project, req.user._id);
    res.json(await presentProject(project, req.user._id));
  })
);

// @route   PUT /api/projects/:id
// @access  Private (project admins)
router.put(
  '/:id',
  protect,
  [
    idParam('id', 'project id'),
    body('name').optional().trim().notEmpty().withMessage('Project name is required')
      .isLength({ max: 100 }).withMessage('Project name cannot exceed 100 characters'),
    body('description').optional({ values: 'null' }).trim()
      .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
    optionalHexColor('color'),
    body('status').optional().isIn(PROJECT_STATUSES).withMessage('Invalid project status'),
    optionalDate('dueDate'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const project = await loadProject(req.params.id);
    assertProjectAdmin(project, req.user._id, 'Only admins can update project');

    const { name, description, color, status, dueDate } = req.body;
    if (name !== undefined) project.name = name;
    if (description !== undefined) project.description = description;
    if (color) project.color = color;
    if (status !== undefined) project.status = status;
    if (dueDate !== undefined) project.dueDate = dueDate; // null clears it

    await project.save();
    res.json(await presentProject(project, req.user._id));
  })
);

// @route   DELETE /api/projects/:id
// @access  Private (owner only)
router.delete(
  '/:id',
  protect,
  [idParam('id', 'project id')],
  validate,
  asyncHandler(async (req, res) => {
    const project = await loadProject(req.params.id);

    if (!project.owner.equals(req.user._id)) {
      throw ApiError.forbidden('Only the owner can delete the project');
    }

    // Drop dependents too, so no warning can outlive its task or project.
    const { deletedCount: deletedTasks } = await Task.deleteMany({ project: project._id });
    await Warning.deleteMany({ project: project._id });
    await project.deleteOne();

    res.json({ message: 'Project deleted successfully', deletedTasks });
  })
);

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

// @route   POST /api/projects/:id/members
// @access  Private (project admins)
router.post(
  '/:id/members',
  protect,
  [
    idParam('id', 'project id'),
    body('email').trim().isEmail().withMessage('Valid email is required')
      .customSanitizer(normalizeEmail),
    body('memberRole').optional().isIn(['admin', 'member']).withMessage('Invalid role'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const project = await loadProject(req.params.id);
    assertProjectAdmin(project, req.user._id, 'Only admins can add members');

    const userToAdd = await User.findOne({ email: normalizeEmail(req.body.email) });
    if (!userToAdd) throw ApiError.notFound('No user found with that email');

    if (project.members.some((m) => m.user.equals(userToAdd._id))) {
      throw ApiError.conflict('User is already a member');
    }

    project.members.push({ user: userToAdd._id, role: req.body.memberRole || 'member' });
    await project.save();

    res.status(201).json(await presentProject(project, req.user._id));
  })
);

// @route   DELETE /api/projects/:id/members/:userId
// @access  Private (project admins)
router.delete(
  '/:id/members/:userId',
  protect,
  [idParam('id', 'project id'), idParam('userId', 'user id')],
  validate,
  asyncHandler(async (req, res) => {
    const project = await loadProject(req.params.id);
    assertProjectAdmin(project, req.user._id, 'Only admins can remove members');

    if (project.owner.equals(req.params.userId)) {
      throw ApiError.badRequest('Cannot remove the project owner');
    }

    if (!project.members.some((m) => m.user.equals(req.params.userId))) {
      throw ApiError.notFound('That user is not a member of this project');
    }

    project.members = project.members.filter((m) => !m.user.equals(req.params.userId));
    await project.save();

    // Don't leave tasks assigned to someone who can no longer see the project.
    await Task.updateMany(
      { project: project._id, assignee: req.params.userId },
      { $set: { assignee: null } }
    );

    res.json(await presentProject(project, req.user._id));
  })
);

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

// @route   GET /api/projects/:id/stats
// @access  Private (project members)
router.get(
  '/:id/stats',
  protect,
  [idParam('id', 'project id')],
  validate,
  asyncHandler(async (req, res) => {
    const project = await loadProject(req.params.id);
    assertProjectMember(project, req.user._id);

    // Counted by the database instead of loading every task into memory.
    const [grouped, overdue, expedited] = await Promise.all([
      Task.aggregate([
        { $match: { project: project._id } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Task.countDocuments({ project: project._id, status: { $ne: 'done' }, dueDate: { $lt: new Date() } }),
      Task.countDocuments({ project: project._id, expedited: true }),
    ]);

    const byStatus = grouped.reduce((acc, g) => ({ ...acc, [g._id]: g.count }), {});

    res.json({
      total: grouped.reduce((sum, g) => sum + g.count, 0),
      todo: byStatus.todo || 0,
      inProgress: byStatus['in-progress'] || 0,
      review: byStatus.review || 0,
      done: byStatus.done || 0,
      overdue,
      expedited,
    });
  })
);

// ---------------------------------------------------------------------------
// Expedite
// ---------------------------------------------------------------------------

// @route   PUT /api/projects/:id/tasks/:taskId/expedite
// @desc    Toggle the expedite flag; restores the priority when toggled off
// @access  Private (project admins)
router.put(
  '/:id/tasks/:taskId/expedite',
  protect,
  [idParam('id', 'project id'), idParam('taskId', 'task id')],
  validate,
  asyncHandler(async (req, res) => {
    const project = await loadProject(req.params.id);
    assertProjectAdmin(project, req.user._id, 'Only admins can expedite tasks');

    // Scoping the lookup by project stops one project's admin from touching
    // another project's task.
    const task = await Task.findOne({ _id: req.params.taskId, project: project._id });
    if (!task) throw ApiError.notFound('Task not found in this project');

    const previousPriority = task.priority;
    task.expedited = !task.expedited;
    task.priority = task.expedited
      ? 'urgent'
      : (previousPriority === 'urgent' ? 'medium' : previousPriority);

    await task.save();

    await Promise.all([
      task.populate('assignee', 'name email'),
      task.populate('createdBy', 'name email'),
      task.populate('project', 'name color'),
    ]);

    res.json(task);
  })
);

// ---------------------------------------------------------------------------
// Warnings
// ---------------------------------------------------------------------------

// @route   GET /api/projects/:id/warnings
// @access  Private (project members)
router.get(
  '/:id/warnings',
  protect,
  [idParam('id', 'project id')],
  validate,
  asyncHandler(async (req, res) => {
    const project = await loadProject(req.params.id);
    assertProjectMember(project, req.user._id);

    const warnings = await Warning.find({ project: project._id })
      .populate('issuedBy', 'name email')
      .populate('issuedTo', 'name email')
      .populate('task', 'title status dueDate')
      .sort({ createdAt: -1 })
      .lean();

    res.json(warnings);
  })
);

// @route   POST /api/projects/:id/warnings
// @access  Private (project admins)
router.post(
  '/:id/warnings',
  protect,
  [
    idParam('id', 'project id'),
    idBody('issuedTo', 'issuedTo'),
    idBody('task', 'task'),
    body('message').trim().notEmpty().withMessage('Message is required')
      .isLength({ max: 500 }).withMessage('Message cannot exceed 500 characters'),
    body('severity').optional().isIn(SEVERITIES).withMessage('Invalid severity'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const project = await loadProject(req.params.id);
    assertProjectAdmin(project, req.user._id, 'Only admins can issue warnings');

    const { issuedTo, task: taskId, message, severity } = req.body;

    const recipient = project.members.find((m) => m.user.toString() === issuedTo);
    if (!recipient) throw ApiError.badRequest('Warnings can only be issued to a project member');
    if (recipient.user.toString() === req.user._id.toString()) {
      throw ApiError.badRequest('You cannot issue a warning to yourself');
    }

    // The task must belong to *this* project, not just exist somewhere.
    const task = await Task.findOne({ _id: taskId, project: project._id }).select('_id');
    if (!task) throw ApiError.badRequest('That task does not belong to this project');

    const warning = await Warning.create({
      project: project._id,
      task: task._id,
      issuedBy: req.user._id,
      issuedTo,
      message,
      severity: severity || 'mild',
    });

    await Promise.all([
      warning.populate('issuedBy', 'name email'),
      warning.populate('issuedTo', 'name email'),
      warning.populate('task', 'title status dueDate'),
    ]);

    res.status(201).json(warning);
  })
);

// @route   PATCH /api/projects/:id/warnings/:warnId
// @desc    Mark a warning resolved / unresolved
// @access  Private (project admins)
router.patch(
  '/:id/warnings/:warnId',
  protect,
  [
    idParam('id', 'project id'),
    idParam('warnId', 'warning id'),
    body('resolved').isBoolean().withMessage('resolved must be true or false').toBoolean(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const project = await loadProject(req.params.id);
    assertProjectAdmin(project, req.user._id, 'Only admins can update warnings');

    const warning = await Warning.findOne({ _id: req.params.warnId, project: project._id });
    if (!warning) throw ApiError.notFound('Warning not found in this project');

    warning.resolved = req.body.resolved;
    await warning.save();

    await Promise.all([
      warning.populate('issuedBy', 'name email'),
      warning.populate('issuedTo', 'name email'),
      warning.populate('task', 'title status dueDate'),
    ]);

    res.json(warning);
  })
);

// @route   DELETE /api/projects/:id/warnings/:warnId
// @access  Private (project admins)
router.delete(
  '/:id/warnings/:warnId',
  protect,
  [idParam('id', 'project id'), idParam('warnId', 'warning id')],
  validate,
  asyncHandler(async (req, res) => {
    const project = await loadProject(req.params.id);
    assertProjectAdmin(project, req.user._id, 'Only admins can remove warnings');

    // Scoping by project stops one project's admin deleting another's warnings.
    const deleted = await Warning.findOneAndDelete({
      _id: req.params.warnId,
      project: project._id,
    });
    if (!deleted) throw ApiError.notFound('Warning not found in this project');

    res.json({ message: 'Warning removed' });
  })
);

module.exports = router;