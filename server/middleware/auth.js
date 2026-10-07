const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const requireJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw ApiError.internal('JWT_SECRET is not set on the server');
  }
};

const generateToken = (id) => {
  requireJwtSecret();
  return jwt.sign({ id: id.toString() }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Not authorized, no token');
  }

  const token = header.slice(7).trim();

  let decoded;
  try {
    requireJwtSecret();
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError'
        ? 'Session expired, please sign in again'
        : 'Not authorized, token failed';
    throw ApiError.unauthorized(message);
  }

  const user = await User.findById(decoded.id).select('-password');
  if (!user) throw ApiError.unauthorized('User no longer exists');

  req.user = user;
  next();
});

module.exports = { protect, generateToken };