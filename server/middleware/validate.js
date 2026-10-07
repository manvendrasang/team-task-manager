const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

/** Terminates the chain and forwards express-validator failures as 400s. */
const validate = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const errors = result.array({ onlyFirstError: true });
  return next(
    ApiError.badRequest(errors[0].msg, { errors: result.array() })
  );
};

module.exports = validate;