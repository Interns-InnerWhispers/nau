// Multi-Tenancy Middleware - Ensure college_id is extracted from token
const multitenancy = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Extract college_id from JWT token
  req.collegeId = req.user.college_id;

  // Ensure college_id is available for all queries
  if (!req.collegeId) {
    return res.status(401).json({
      success: false,
      message: 'College ID not found in token'
    });
  }

  next();
};

// Validation middleware to check college access
const validateCollegeAccess = (req, res, next) => {
  const requestedCollegeId = req.body?.college_id || req.query?.college_id || req.params?.college_id;
  
  // If a specific college_id is being requested, verify user has access
  if (requestedCollegeId && parseInt(requestedCollegeId) !== parseInt(req.collegeId)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: you cannot access another college data'
    });
  }

  next();
};

module.exports = {
  multitenancy,
  validateCollegeAccess
};
