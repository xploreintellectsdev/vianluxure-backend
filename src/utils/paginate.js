const { pool } = require('../config/db');


const paginate = async (
    baseQuery, 
    queryParams = [], 
    page = 1, 
    limit = 10, 
    sortColumn = 'id', 
    sortOrder = 'DESC'
) => {
    // Sanitize column name to prevent SQL Injection (allows only alphanumeric and underscores)
    const cleanSortColumn = sortColumn.replace(/[^a-zA-Z0-9_]/g, '');
    
    // Strictly enforce ASC or DESC
    const cleanSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Get total records count
    const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery}) as temp_table`;
    const [countResult] = await pool.query(countQuery, queryParams);
    const total = countResult[0].total;

    const offset = (page - 1) * limit;

    // Dynamically append ORDER BY, LIMIT, and OFFSET
    const dataQuery = `${baseQuery} ORDER BY ${cleanSortColumn} ${cleanSortOrder} LIMIT ? OFFSET ?`;
    
    const finalParams = [...queryParams, Number(limit), Number(offset)];
    
    const [data] = await pool.query(dataQuery, finalParams);

    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return {
        data,
        meta: {
            total,
            page: Number(page),
            limit: Number(limit),
            totalPages,
            hasNextPage,
            hasPrevPage,
            sortBy: cleanSortColumn,
            sortOrder: cleanSortOrder
        }
    };
};

module.exports = paginate;