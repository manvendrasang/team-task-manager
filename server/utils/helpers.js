const mongoose = require('mongoose');
const ApiError = require('./ApiError');

/** Mongoose only validates id *shapes*; this keeps the cast error out of routes. */
const isValidObjectId = (id) =>
  typeof id === 'string' && mongoose.Types.ObjectId.isValid(id) && /^[0-9a-fA-F]{24}$/.test(id);

const assertObjectId = (id, label = 'id') => {
  if (!isValidObjectId(id)) {
    throw ApiError.badRequest(`Invalid ${label}`);
  }
  return id;
};

/**
 * Mongoose's `lowercase: true` only runs on save, never on query filters.
 * Every lookup therefore has to normalise explicitly or registered users with
 * mixed-case emails become unreachable.
 */
const normalizeEmail = (email) =>
  typeof email === 'string' ? email.trim().toLowerCase() : email;

/**
 * Works whether `members.user` is a raw ObjectId or a populated document.
 * Returns the member's role, or null when the user is not a member.
 */
const getMemberRole = (project, userId) => {
  if (!project || !Array.isArray(project.members)) return null;
  const target = userId.toString();
  const member = project.members.find((m) => {
    const ref = m.user;
    const memberId = (ref && ref._id ? ref._id : ref)?.toString();
    return memberId === target;
  });
  return member ? member.role : null;
};

/** Throws 403 unless the requester is a project admin. */
const assertProjectAdmin = (project, userId, message) => {
  if (getMemberRole(project, userId) !== 'admin') {
    throw ApiError.forbidden(message || 'Only project admins can do that');
  }
};

/** Throws 403 unless the requester is a project member (any role). */
const assertProjectMember = (project, userId, message) => {
  if (!getMemberRole(project, userId)) {
    throw ApiError.forbidden(message || 'Access denied');
  }
};

module.exports = {
  assertObjectId,
  normalizeEmail,
  getMemberRole,
  assertProjectAdmin,
  assertProjectMember,
};