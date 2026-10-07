const { body, param } = require('express-validator');

const { assertObjectId } = require('../utils/helpers');

/**
 * Date fields arrive from `<input type="date">` as `''` when the user clears
 * them, which is not a valid ISO string. Treat blank/null/undefined as "no
 * date" and normalise it to null so Mongoose stores an unset date.
 */
const optionalDate = (field) =>
  body(field)
    .optional()
    .custom((value) => {
      if (value === undefined || value === null || value === '') return true;
      if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
        throw new Error(`Invalid ${field}`);
      }
      return true;
    })
    .customSanitizer((value) =>
      value === undefined || value === null || value === '' ? null : value
    );

/** Optional hex colour; blank input falls back to the schema default. */
const optionalHexColor = (field = 'color') =>
  body(field)
    .optional()
    .custom((value) => {
      if (value === undefined || value === null || value === '') return true;
      if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) {
        throw new Error('Color must be a hex value like #7e72f2');
      }
      return true;
    })
    .customSanitizer((value) => (value === undefined || value === '' ? undefined : value));

/** Rejects malformed ids as 400s before they reach a Mongoose cast. */
const idParam = (field, label) =>
  param(field).custom((value) => {
    assertObjectId(value, label || `${field} id`);
    return true;
  });

/** Same as `idParam` but for a body field (assignee, issuedTo, ...). */
const idBody = (field, label) =>
  body(field).custom((value) => {
    assertObjectId(value, label || field);
    return true;
  });

module.exports = { optionalDate, optionalHexColor, idParam, idBody };