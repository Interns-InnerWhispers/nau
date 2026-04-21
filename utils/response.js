// Response formatting utilities

// Success response
const successResponse = (res, data, message = 'Success', statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    code: statusCode,
    message,
    data
  });
};

// Error response
const errorResponse = (res, error, statusCode = 400, code = 'ERROR') => {
  res.status(statusCode).json({
    success: false,
    code,
    message: error.message || error || 'An error occurred',
    statusCode
  });
};

// Paginated response
const paginatedResponse = (res, items, total, page, limit, message = 'Success') => {
  res.json({
    success: true,
    message,
    data: {
      items,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    }
  });
};

// Data formatters
const formatters = {
  // Format database date to ISO string
  formatDate: (date) => {
    return new Date(date).toISOString();
  },

  // Format currency
  formatCurrency: (amount, currency = 'USD') => {
    return `${currency} ${parseFloat(amount).toFixed(2)}`;
  },

  // Format percentage
  formatPercentage: (value) => {
    return `${(parseFloat(value) * 100).toFixed(2)}%`;
  },

  // Format user data (remove sensitive fields)
  formatUser: (user) => {
    const { password_hash, ...rest } = user;
    return rest;
  },

  // Format activity response
  formatActivity: (activity) => {
    return {
      ...activity,
      created_at: new Date(activity.created_at).toISOString(),
      updated_at: new Date(activity.updated_at).toISOString()
    };
  }
};

module.exports = {
  successResponse,
  errorResponse,
  paginatedResponse,
  formatters
};
