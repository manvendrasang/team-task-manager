const express = require('express');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');

const bcrypt = require('bcryptjs');

const User = require('../models/User');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { protect, generateToken } = require('../middleware/auth');

// A real bcrypt hash of a value nobody can guess. Comparing against it when no
// user matched keeps "unknown email" and "wrong password" equally expensive,
// so response timing can't be used to enumerate accounts.
const DUMMY_HASH = bcrypt.hashSync('taskflow-timing-equaliser', 12);

const router = express.Router();

// Credential endpoints get a much tighter budget than the global limiter.
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many attempts, please try again in a few minutes' },
});

const publicUser = (user, token) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  token,
});

// @route   POST /api/auth/register
router.post(
  '/register',
  credentialLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required')
      .isLength({ max: 50 }).withMessage('Name cannot exceed 50 characters'),
    body('email').trim().isEmail().withMessage('Valid email is required')
      .normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .isStrongPassword({ minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 0 })
      .withMessage('Password needs an uppercase letter, a lowercase letter and a number'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;

    if (!process.env.JWT_SECRET) {
      throw ApiError.internal('JWT_SECRET is not set on the server');
    }

    const existing = await User.findOne({ email });
    if (existing) throw ApiError.conflict('Email already in use');

    const user = await User.create({ name, email, password });
    res.status(201).json(publicUser(user, generateToken(user._id)));
  })
);

// @route   POST /api/auth/login
router.post(
  '/login',
  credentialLimiter,
  [
    body('email').trim().isEmail().withMessage('Valid email is required')
      .normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    const passwordMatches = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);

    if (!user || !passwordMatches) throw ApiError.unauthorized('Invalid email or password');

    res.json(publicUser(user, generateToken(user._id)));
  })
);

// @route   GET /api/auth/me
router.get('/me', protect, (req, res) => {
  res.json({
    _id: req.user._id,
    name: req.user.name,
    email: req.user.email,
  });
});

module.exports = router;