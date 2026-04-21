// Input Validation Middleware
const validateInput = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        errors: details
      });
    }

    req.body = value;
    next();
  };
};

// Pagination validation
const validatePagination = (req, res, next) => {
  let { limit, offset, page } = req.query;

  limit = Math.min(parseInt(limit) || 10, 100);
  offset = parseInt(offset) || 0;
  page = parseInt(page) || 1;

  // Ensure offset and page are consistent
  if (page && !offset) {
    offset = (page - 1) * limit;
  }

  req.pagination = { limit, offset, page };
  next();
};

// Query parameter sanitization
const sanitizeQuery = (req, res, next) => {
  if (req.query.search) {
    // Remove potential SQL injection patterns
    req.query.search = req.query.search
      .replace(/[;'"\\]/g, '')
      .substring(0, 100);
  }

  next();
};

module.exports = {
  validateInput,
  validatePagination,
  sanitizeQuery
};
