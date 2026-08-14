const { pool } = require('../config/db');

const getAllAddresses = async (userId) => {
    const query = `
        SELECT * FROM user_addresses
        WHERE user_id = ?
        ORDER BY is_default DESC, address_order ASC
    `;
    const [rows] = await pool.query(query, [userId]);
    return rows;
};

const getNextAddressOrder = async (conn, userId) => {
    const [rows] = await conn.query(
        `SELECT COALESCE(MAX(address_order), 0) + 1 AS nextOrder FROM user_addresses WHERE user_id = ?`,
        [userId]
    );
    return rows[0].nextOrder;
};

const createAddress = async (userId, data) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        if (data.isDefault) {
            await conn.query(
                `UPDATE user_addresses SET is_default = FALSE WHERE user_id = ?`,
                [userId]
            );
        }

        const addressOrder = await getNextAddressOrder(conn, userId);

        const query = `
            INSERT INTO user_addresses (
                user_id, address_order, full_name, mobile, alternate_mobile,
                house_building, street_locality, landmark,
                city, state, country, postal_code,
                address_type, is_default
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const [result] = await conn.query(query, [
            userId,
            addressOrder,
            data.fullName,
            data.mobile,
            data.alternateMobile || null,
            data.house,
            data.street,
            data.landmark || null,
            data.city,
            data.state,
            data.country || 'India',
            data.postalCode,
            data.addressType || 'Home',
            !!data.isDefault,
        ]);

        await conn.commit();
        return result.insertId;
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

const updateAddress = async (userId, addressId, data) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        if (data.isDefault) {
            await conn.query(
                `UPDATE user_addresses SET is_default = FALSE WHERE user_id = ?`,
                [userId]
            );
        }

        const query = `
            UPDATE user_addresses SET
                full_name = ?, mobile = ?, alternate_mobile = ?,
                house_building = ?, street_locality = ?, landmark = ?,
                city = ?, state = ?, country = ?, postal_code = ?,
                address_type = ?, is_default = ?
            WHERE address_id = ? AND user_id = ?
        `;

        const [result] = await conn.query(query, [
            data.fullName,
            data.mobile,
            data.alternateMobile || null,
            data.house,
            data.street,
            data.landmark || null,
            data.city,
            data.state,
            data.country || 'India',
            data.postalCode,
            data.addressType || 'Home',
            !!data.isDefault,
            addressId,
            userId
        ]);

        await conn.commit();
        return result.affectedRows;
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

const deleteAddress = async (userId, id) => {
    const query = `DELETE FROM user_addresses WHERE address_id = ? AND user_id = ?`;
    const [result] = await pool.query(query, [id, userId]);
    return result.affectedRows;
};

module.exports = { getAllAddresses, createAddress, updateAddress, deleteAddress };