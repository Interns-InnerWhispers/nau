// Request Logging Middleware
const logging = (req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;

  res.send = function(data) {
    const duration = Date.now() - startTime;
    const logEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.user_id || 'anonymous',
      collegeId: req.user?.college_id || null
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      const status = res.statusCode >= 400 ? '❌' : '✓';
      console.log(`${status} [${logEntry.method}] ${logEntry.url} - ${logEntry.statusCode} (${logEntry.duration})`);
    }

    // Log errors
    if (res.statusCode >= 400) {
      console.error('REQUEST ERROR:', logEntry);
    }

    res.send = originalSend;
    return res.send(data);
  };

  next();
};

module.exports = logging;
