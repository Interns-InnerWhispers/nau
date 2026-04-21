// Database utilities
const pool = require('./database');

// Generic query helper
async function executeQuery(sql, params = []) {
  let conn;
  try {
    conn = await pool.getConnection();
    const [results] = await conn.execute(sql, params);
    return results;
  } catch (error) {
    throw error;
  } finally {
    if (conn) conn.release();
  }
}

// Get paginated results
async function getPaginatedResults(query, countQuery, params, limit, offset) {
  try {
    const [count] = await executeQuery(countQuery, params);
    const [results] = await pool.query(
      `${query} LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    
    return {
      results,
      total: count[0].total,
      page: Math.floor(offset / limit) + 1,
      limit
    };
  } catch (error) {
    throw error;
  }
}

module.exports = {
  executeQuery,
  getPaginatedResults
};
