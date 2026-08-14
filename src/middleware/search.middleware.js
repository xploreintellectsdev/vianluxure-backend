const mysql = require('mysql2');

const dynamicSearch = (searchColumns) => {
    return (req, res, next) => {
        const searchTerm = req.query.search;
        
        // Search term illana, next() call panni vitruvum
        if (!searchTerm) {
            req.searchCondition = "";
            return next();
        }

        // Hack aagama irukka input-a escape panrom
        const safeSearchTerm = mysql.escape(`%${searchTerm}%`);
        
        // Loop panni dynamic OR conditions create panrom
        const conditions = searchColumns.map(col => `${col} LIKE ${safeSearchTerm}`);
        
        // Output: "AND (pt_name LIKE '%shirt%' OR pt_slug LIKE '%shirt%')"
        req.searchCondition = ` AND (${conditions.join(' OR ')})`;
        
        next();
    };
};

module.exports = dynamicSearch;