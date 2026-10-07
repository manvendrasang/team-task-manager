const express = require('express');
const { body } = require('express-validator');

const User = require('../models/User');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { protect } = require('../middleware/auth');
const { normalizeEmail } = require('../utils/helpers');

const router = express.Router();

const publicFields = { _id: 1, name: 1, email: 1 };

// @route   PUT /api/users/profile
// @desc    Update the caller's display name
// @access  Private
router.put(
  '/profile',
  protect,
  [
    body('name').trim().notEmpty().withMessage('Name is required')
      .isLength({ max: 50 }).withMessage('Name cannot exceed 50 characters'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    // `runValidators` so the schema's maxlength is actually enforced here.
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name: req.body.name },
      { new: true, runValidators: true, projection: publicFields }
    );
    if (!user) throw ApiError.notFound('User not found');

    res.json(user);
  })
);

// @route   GET /api/users/search?email=...
// @desc    Look up an exact email so an admin can confirm who they're adding
// @access  Private
router.get(
  '/search',
  protect,
  asyncHandler(async (req, res) => {
    const { email } = req.query;
    if (!email || typeof email !== 'string') {
      throw ApiError.badRequest('Email query required');
    }

    const user = await User.findOne({ email: normalizeEmail(email) }, publicFields).lean();
    // Same response for "no such user" whether or not the address is registered,
    // and no other account data is ever exposed.
    if (!user) throw ApiError.notFound('No user found with that email');

    res.json(user);
  })
);

module.exports = router;