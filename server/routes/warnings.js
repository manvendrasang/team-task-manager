const express = require('express');
const { body } = require('express-validator');

const Project = require('../models/Project');
const Warning = require('../models/Warning');

const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { protect } = require('../middleware/auth');
const { getMemberRole } = require('../utils/helpers');
const { idParam } = require('../validators/common');

const router = express.Router();

// @route   GET /api/warnings
// @desc    Every warning issued to the caller, newest first
// @access  Private
router.get(
  '/',
  protect,
  asyncHandler(async (req, res) => {
    const filter = { issuedTo: req.user._id };
    if (req.query.resolved === 'true') filter.resolved = true;
    else if (req.query.resolved === 'false') filter.resolved = false;

    const warnings = await Warning.find(filter)
      .populate('issuedBy', 'name email')
      .populate('task', 'title status dueDate')
      .populate('project', 'name color')
      .sort({ resolved: 1, createdAt: -1 })
      .lean();

    // Whether the caller still admins the project decides if they can keep
    // managing these warnings.
    const projectIds = [...new Set(warnings.map((w) => w.project?._id).filter(Boolean))];
    const projects = projectIds.length
      ? await Project.find({ _id: { $in: projectIds } }).select('members').lean()
      : [];
    const isAdminOf = new Map(
      projects.map((p) => [p._id.toString(), getMemberRole(p, req.user._id) === 'admin'])
    );

    res.json(
      warnings.map((w) => ({
        ...w,
        canManage: isAdminOf.get(w.project?._id?.toString()) || false,
      }))
    );
  })
);

// @route   PATCH /api/warnings/:id/resolve
// @desc    Recipient closes out a warning; a project admin can also do it
// @access  Private
router.patch(
  '/:id/resolve',
  protect,
  [
    idParam('id', 'warning id'),
    body('resolved').isBoolean().withMessage('resolved must be true or false').toBoolean(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const warning = await Warning.findById(req.params.id);
    if (!warning) throw ApiError.notFound('Warning not found');

    const isRecipient = warning.issuedTo.toString() === req.user._id.toString();
    if (!isRecipient) {
      const project = await Project.findById(warning.project);
      if (getMemberRole(project, req.user._id) !== 'admin') {
        throw ApiError.forbidden('Not authorized to update this warning');
      }
    }

    warning.resolved = req.body.resolved;
    await warning.save();

    await Promise.all([
      warning.populate('issuedBy', 'name email'),
      warning.populate('task', 'title status dueDate'),
      warning.populate('project', 'name color'),
    ]);

    const { __v, ...rest } = warning.toObject();
    res.json(rest);
  })
);

module.exports = router;