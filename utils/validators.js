// Validation utilities
const validators = {
  // Email validation
  isValidEmail: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  // Password validation (minimum 8 chars, at least 1 uppercase, 1 lowercase, 1 number)
  isStrongPassword: (password) => {
    const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return strongRegex.test(password);
  },

  // Phone validation
  isValidPhone: (phone) => {
    const phoneRegex = /^(\+\d{1,3}[- ]?)?\d{10}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  },

  // Date validation
  isValidDate: (date) => {
    return !isNaN(Date.parse(date));
  },

  // Positive number validation
  isPositiveNumber: (num) => {
    return Number.isFinite(num) && num > 0;
  },

  // Pagination parameters
  isValidPagination: (limit, offset) => {
    return Number.isInteger(limit) && limit > 0 && limit <= 100 &&
           Number.isInteger(offset) && offset >= 0;
  },

  // URL validation
  isValidUrl: (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
};

module.exports = validators;
