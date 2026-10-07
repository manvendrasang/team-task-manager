const express = require('express');
const { body } = require('express-validator');

const Task    = require('../models/Task');
const Project = require('../models/Project');
const Warning = require('../models/Warning');

const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { protect } = require('../middleware/auth');
const { assertObjectId, getMemberRole } = require('../utils/helpers');
const { optionalDate, idParam, idBody } = require('../validators/common');

const router = express.Router();

const STATUSES = ['todo', 'in-progress', 'review', 'done'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

/**
 * Loads a task with just enough of its project to authorise the caller.
 * Scoping the populate keeps the whole project document (and its member list)
 * out of the response.
 */
const loadTaskForProject = async (taskId, user) => {
  assertObjectId(taskId, 'task id');
  const task = await Task.findById(taskId).populate('project', 'name color members');
  if (!task || !task.project) throw ApiError.notFound('Task not found');

  const role = getMemberRole(task.project, user._id);
  if (!role) throw ApiError.forbidden('Access denied');

  return { task, role };
};

const presentTask = async (task) => {
  await Promise.all([
    task.populate('assignee', 'name email'),
    task.populate('createdBy', 'name email'),
    task.populate('project', 'name color'),
  ]);
  const { __v, ...rest } = task.toObject();
  return rest;
};

/** Assignees must be members of the owning project. */
const resolveAssignee = async (assignee, project) => {
  if (assignee === undefined) return undefined;
  if (assignee === null || assignee === '') return null;
  assertObjectId(assignee, 'assignee');
  if (!project.members.some((m) => m.user.toString() === assignee)) {
    throw ApiError.badRequest('Assignee must be a member of this project');
  }
  return assignee;
};

// @route   GET /api/tasks
// @desc    Tasks visible to the caller, optionally filtered
// @access  Private
router.get(
  '/',
  protect,
  asyncHandler(async (req, res) => {
    const { project, assignee, status, priority, overdue } = req.query;
    const filter = {};

    if (project) {
      assertObjectId(project, 'project id');
      const proj = await Project.findById(project);
      if (!proj) throw ApiError.notFound('Project not found');
      if (!getMemberRole(proj, req.user._id)) throw ApiError.forbidden('Access denied');
      filter.project = project;
    } else {
      // Without an explicit project, scope to the caller's own projects.
      const userProjects = await Project.find({ 'members.user': req.user._id })
        .select('_id')
        .lean();
      filter.project = { $in: userProjects.map((p) => p._id) };
    }

    if (assignee) {
      assertObjectId(assignee, 'assignee');
      filter.assignee = assignee;
    }

    if (overdue === 'true') {
      // Applied before `status` so an explicit status filter still wins.
      filter.dueDate = { $lt: new Date() };
      filter.status = { $ne: 'done' };
    } else if (status) {
      if (!STATUSES.includes(status)) throw ApiError.badRequest('Invalid status filter');
      filter.status = status;
    }

    if (priority) {
      if (!PRIORITIES.includes(priority)) throw ApiError.badRequest('Invalid priority filter');
      filter.priority = priority;
    }

    const tasks = await Task.find(filter)
      .populate('assignee', 'name email')
      .populate('createdBy', 'name email')
      .populate('project', 'name color')
      .sort({ createdAt: -1 })
      .lean();

    res.json(tasks);
  })
);

// @route   POST /api/tasks
// @desc    Create a task
// @access  Private (project members)
router.post(
  '/',
  protect,
  [
    body('title').trim().notEmpty().withMessage('Title is required')
      .isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters'),
    idBody('project', 'project'),
    body('description').optional({ values: 'null' }).trim()
      .isLength({ max: 1000 }).withMessage('Description cannot exceed 1000 characters'),
    body('status').optional().isIn(STATUSES).withMessage('Invalid status'),
    body('priority').optional().isIn(PRIORITIES).withMessage('Invalid priority'),
    body('assignee').optional({ values: 'null' }).custom((v) => {
      if (v === '' ) return true;
      assertObjectId(v, 'assignee');
      return true;
    }),
    optionalDate('dueDate'),
    body('tags').optional({ values: 'null' }).isArray({ max: 10 })
      .withMessage('Tags must be an array of at most 10 strings'),
    body('tags.*').optional().isString().isLength({ max: 30 })
      .withMessage('Each tag must be 30 characters or fewer'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    assertObjectId(req.body.project, 'project');
    const project = await Project.findById(req.body.project);
    if (!project) throw ApiError.notFound('Project not found');

    const role = getMemberRole(project, req.user._id);
    if (!role) throw ApiError.forbidden('Access denied');

    const { title, description, status, priority, dueDate, tags } = req.body;
    const assignee = await resolveAssignee(req.body.assignee, project);

    const task = await Task.create({
      title,
      description,
      status,
      priority,
      assignee: assignee ?? null,
      dueDate,
      tags,
      project: project._id,
      createdBy: req.user._id,
    });

    res.status(201).json(await presentTask(task));
  })
);

// @route   GET /api/tasks/:id
// @access  Private (project members)
router.get(
  '/:id',
  protect,
  [idParam('id', 'task id')],
  validate,
  asyncHandler(async (req, res) => {
    const { task } = await loadTaskForProject(req.params.id, req.user);
    // presentTask populates assignee/createdBy/project so this endpoint returns
    // the same shape as POST and PUT, instead of raw ObjectId strings.
    res.json(await presentTask(task));
  })
);

// @route   PUT /api/tasks/:id
// @desc    Admins edit everything; members may only move status / assignee
// @access  Private (project members)
router.put(
  '/:id',
  protect,
  [
    idParam('id', 'task id'),
    body('title').optional().trim().notEmpty().withMessage('Title is required')
      .isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters'),
    body('description').optional({ values: 'null' }).trim()
      .isLength({ max: 1000 }).withMessage('Description cannot exceed 1000 characters'),
    body('status').optional().isIn(STATUSES).withMessage('Invalid status'),
    body('priority').optional().isIn(PRIORITIES).withMessage('Invalid priority'),
    body('assignee').optional({ values: 'null' }).custom((v) => {
      if (v === '') return true;
      assertObjectId(v, 'assignee');
      return true;
    }),
    optionalDate('dueDate'),
    body('tags').optional({ values: 'null' }).isArray({ max: 10 })
      .withMessage('Tags must be an array of at most 10 strings'),
    body('tags.*').optional().isString().isLength({ max: 30 })
      .withMessage('Each tag must be 30 characters or fewer'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { task, role } = await loadTaskForProject(req.params.id, req.user);
    const { title, description, status, priority, dueDate, tags } = req.body;

    // Reject admin-only edits from plain members instead of silently dropping
    // them: a 200 that quietly discards the change reads as success to the
    // caller, which is how a member could lose work believing it saved.
    if (role !== 'admin') {
      const attempted = [
        ['title', title],
        ['description', description],
        ['priority', priority],
        ['dueDate', dueDate],
        ['tags', tags],
      ].filter(([, v]) => v !== undefined).map(([f]) => f);

      if (attempted.length > 0) {
        throw ApiError.forbidden(
          `Only project admins can change: ${attempted.join(', ')}`
        );
      }
    } else {
      if (title !== undefined) task.title = title;
      if (description !== undefined) task.description = description;
      if (priority !== undefined) task.priority = priority;
      if (dueDate !== undefined) task.dueDate = dueDate;
      if (tags !== undefined) task.tags = tags;
    }

    // Admins and plain members alike may move a task or change who owns it.
    if (status !== undefined) task.status = status;
    const assignee = await resolveAssignee(req.body.assignee, task.project);
    if (assignee !== undefined) task.assignee = assignee;

    await task.save();
    res.json(await presentTask(task));
  })
);

// @route   DELETE /api/tasks/:id
// @access  Private (project admins or the task creator)
router.delete(
  '/:id',
  protect,
  [idParam('id', 'task id')],
  validate,
  asyncHandler(async (req, res) => {
    const { task, role } = await loadTaskForProject(req.params.id, req.user);

    const isCreator = task.createdBy.toString() === req.user._id.toString();
    if (role !== 'admin' && !isCreator) {
      throw ApiError.forbidden('Not authorized to delete this task');
    }

    // Warnings reference their task, so they have to go with it.
    await Warning.deleteMany({ task: task._id });
    await task.deleteOne();

    res.json({ message: 'Task deleted' });
  })
);

module.exports = router;