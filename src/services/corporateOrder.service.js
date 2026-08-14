const { pool } = require('../config/db');

const createCorporateOrder = async (name, companyName, email, phone, message, agreeContact) => {
  const [result] = await pool.query(
    `INSERT INTO corporate_order_master 
      (name, company_name, email, phone, message, agree_contact, status) 
     VALUES (?, ?, ?, ?, ?, ?, 'Pending')`,
    [name, companyName, email, phone, message || '', agreeContact ? 1 : 0]
  );
  return result.insertId;
};

const getAllCorporateOrders = async (search = '', page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  let countSql = `SELECT COUNT(*) as total FROM corporate_order_master`;
  let querySql = `SELECT * FROM corporate_order_master`;
  const params = [];

  if (search) {
    const whereClause = ` WHERE name LIKE ? OR company_name LIKE ? OR email LIKE ? OR phone LIKE ?`;
    countSql += whereClause;
    querySql += whereClause;
    const sParam = `%${search}%`;
    params.push(sParam, sParam, sParam, sParam);
  }

  querySql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  
  const [countRes] = await pool.query(countSql, params);
  const total = countRes[0]?.total || 0;

  const [rows] = await pool.query(querySql, [...params, Number(limit), Number(offset)]);

  return {
    data: rows,
    meta: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit) || 1
    }
  };
};

const updateOrderStatus = async (id, status) => {
  const [result] = await pool.query(
    `UPDATE corporate_order_master SET status = ? WHERE id = ?`,
    [status, id]
  );
  return result.affectedRows > 0;
};

const deleteOrder = async (id) => {
  const [result] = await pool.query(`DELETE FROM corporate_order_master WHERE id = ?`, [id]);
  return result.affectedRows > 0;
};

module.exports = {
  createCorporateOrder,
  getAllCorporateOrders,
  updateOrderStatus,
  deleteOrder
};
