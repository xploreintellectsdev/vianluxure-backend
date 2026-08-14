const { pool } = require('../config/db');
const catchAsync = require('../utils/catchAsync');
const { successRes } = require('../utils/response');

function formatRelativeTime(dateInput) {
    if (!dateInput) return "Recently";
    const date = new Date(dateInput);
    if (isNaN(date)) return "Recently";

    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return "Just now";
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes} min${diffInMinutes > 1 ? 's' : ''} ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hr${diffInHours > 1 ? 's' : ''} ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const getDashboardStats = catchAsync(async (req, res) => {
    let totalProducts = 0;
    let totalCategories = 0;
    let totalWalletAmount = 0;
    let totalRevenue = 0;
    let productTypes = 0;
    let topPicks = 0;
    let exclusiveProducts = 0;
    let totalUsers = 0;

    // 1. Total Products (Fabrics + RTW)
    try {
        const [fabrics] = await pool.query(`SELECT COUNT(*) as count FROM fabric_master WHERE deleted_at IS NULL`);
        const [rtw] = await pool.query(`SELECT COUNT(*) as count FROM ready_to_wear_master WHERE deleted_at IS NULL`);
        totalProducts = (fabrics[0]?.count || 0) + (rtw[0]?.count || 0);
    } catch (e) { console.error("Error querying products count:", e.message); }

    // 2. Total Categories
    try {
        const [cats] = await pool.query(`SELECT COUNT(*) as count FROM fabric_categories WHERE deleted_at IS NULL`);
        totalCategories = cats[0]?.count || 0;
    } catch (e) { console.error("Error querying categories count:", e.message); }

    // 3. Product Types
    try {
        const [pts] = await pool.query(`SELECT COUNT(*) as count FROM product_types WHERE deleted_at IS NULL`);
        productTypes = pts[0]?.count || 0;
    } catch (e) { console.error("Error querying product types count:", e.message); }

    // 4. Top Picks (Styles count in DB)
    try {
        const [styles] = await pool.query(`SELECT COUNT(*) as count FROM styles WHERE deleted_at IS NULL`);
        topPicks = styles[0]?.count || 0;
    } catch (e) { console.error("Error querying top picks count:", e.message); }

    // 5. Exclusive Products (Bespoke custom options count in DB)
    try {
        const [custom] = await pool.query(`SELECT COUNT(*) as count FROM custom_options WHERE deleted_at IS NULL`);
        exclusiveProducts = custom[0]?.count || 0;
        if (exclusiveProducts === 0) {
            const [rtwExclusive] = await pool.query(`SELECT COUNT(*) as count FROM ready_to_wear_master WHERE deleted_at IS NULL`);
            exclusiveProducts = rtwExclusive[0]?.count || 0;
        }
    } catch (e) { console.error("Error querying exclusive products count:", e.message); }

    // 6. Total Users
    try {
        const [usr] = await pool.query(`SELECT COUNT(*) as count FROM users`);
        totalUsers = usr[0]?.count || 0;
    } catch (e) { console.error("Error querying total users count:", e.message); }

    // 7. Total Wallet Amount
    try {
        const [wallets] = await pool.query(`SELECT SUM(balance) as total FROM wallets`);
        totalWalletAmount = parseFloat(wallets[0]?.total || 0);
    } catch (e) { console.error("Error querying wallet sum:", e.message); }

    // 8. Total Revenue
    try {
        const [ordersRev] = await pool.query(`SELECT SUM(grand_total) as total FROM orders WHERE order_status != 'Cancelled'`);
        totalRevenue = parseFloat(ordersRev[0]?.total || 0);
    } catch (e) { console.error("Error querying total revenue:", e.message); }

    // ── RECENT ACTIVITIES STRATEGY FROM LIVE DATABASE ──
    const activityFeed = [];

    // Recent categories added/modified
    try {
        const [cats] = await pool.query(`SELECT fc_name as name, created_at FROM fabric_categories WHERE deleted_at IS NULL ORDER BY fc_id DESC LIMIT 5`);
        cats.forEach(c => {
            activityFeed.push({
                id: `cat-${c.name}-${c.created_at}`,
                text: `Enabled category '${c.name}'`,
                by: "Admin",
                time: formatRelativeTime(c.created_at),
                timestamp: new Date(c.created_at || 0).getTime()
            });
        });
    } catch (e) { /* ignore */ }

    // Recent fabrics added/modified
    try {
        const [fabs] = await pool.query(`SELECT fab_name as name, created_at FROM fabric_master WHERE deleted_at IS NULL ORDER BY fab_id DESC LIMIT 5`);
        fabs.forEach(f => {
            activityFeed.push({
                id: `fab-${f.name}-${f.created_at}`,
                text: `Enabled product '${f.name}'`,
                by: "Admin",
                time: formatRelativeTime(f.created_at),
                timestamp: new Date(f.created_at || 0).getTime()
            });
        });
    } catch (e) { /* ignore */ }

    // Recent RTW added/modified
    try {
        const [rtws] = await pool.query(`SELECT rtw_name as name, created_at FROM ready_to_wear_master WHERE deleted_at IS NULL ORDER BY rtw_id DESC LIMIT 5`);
        rtws.forEach(r => {
            activityFeed.push({
                id: `rtw-${r.name}-${r.created_at}`,
                text: `Enabled product '${r.name}'`,
                by: "Admin",
                time: formatRelativeTime(r.created_at),
                timestamp: new Date(r.created_at || 0).getTime()
            });
        });
    } catch (e) { /* ignore */ }

    // Recent orders
    try {
        const [ords] = await pool.query(`SELECT order_number, order_status, created_at FROM orders ORDER BY order_id DESC LIMIT 5`);
        ords.forEach(o => {
            activityFeed.push({
                id: `ord-${o.order_number}-${o.created_at}`,
                text: `Order #${o.order_number} (${o.order_status})`,
                by: "Customer",
                time: formatRelativeTime(o.created_at),
                timestamp: new Date(o.created_at || 0).getTime()
            });
        });
    } catch (e) { /* ignore */ }

    // Sort all genuine DB activities chronologically (newest first)
    activityFeed.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const activities = activityFeed.slice(0, 15);

    // ── USER LOGIN HISTORY FROM LIVE DATABASE ──
    let loginHistory = [];
    try {
        const [logins] = await pool.query(`SELECT id, name, email, ip_address as ip, status, login_time FROM user_login_history ORDER BY login_time DESC LIMIT 15`);
        if (logins && logins.length > 0) {
            loginHistory = logins.map(l => {
                const dt = l.login_time ? new Date(l.login_time) : new Date();
                return {
                    id: l.id,
                    name: l.name || l.email || 'User',
                    time: isNaN(dt) ? 'N/A' : dt.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'medium' }),
                    ip: l.ip || '::1',
                    status: l.status || 'SUCCESS'
                };
            });
        }
    } catch (e) { /* ignore */ }

    // If user_login_history table has no login logs yet, query existing registered user accounts directly from the DB!
    if (loginHistory.length === 0) {
        try {
            const [users] = await pool.query(`SELECT user_id, name, email, created_at FROM users ORDER BY user_id DESC LIMIT 15`);
            loginHistory = users.map(u => {
                const dt = u.created_at ? new Date(u.created_at) : new Date();
                return {
                    id: u.user_id,
                    name: u.name || u.email || 'Registered User',
                    time: isNaN(dt) ? 'N/A' : dt.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'medium' }),
                    ip: '::1',
                    status: 'SUCCESS'
                };
            });
        } catch (e) { /* ignore */ }
    }

    return successRes(res, "Dashboard stats fetched from database successfully", {
        stats: {
            totalProducts,
            totalCategories,
            totalWalletAmount,
            totalRevenue,
            productTypes,
            topPicks,
            exclusiveProducts,
            totalUsers
        },
        activities,
        loginHistory
    });
});

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const adminLogin = catchAsync(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const [rows] = await pool.query("SELECT * FROM admins WHERE email = ?", [email]);
    const admin = rows[0];
    if (!admin) {
        return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch && password !== admin.password) {
        return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const token = jwt.sign(
        { admin_id: admin.admin_id, name: admin.name, email: admin.email, role: admin.role || "Admin" },
        process.env.JWT_SECRET || "vianluxure-secret-key",
        { expiresIn: "1d" }
    );

    return successRes(res, "Admin logged in successfully", {
        token,
        admin: { admin_id: admin.admin_id, name: admin.name, email: admin.email, role: admin.role || "Admin" }
    });
});

const listAdmins = catchAsync(async (req, res) => {
    const [rows] = await pool.query("SELECT admin_id, name, email, role, password, plain_password, created_at FROM admins ORDER BY admin_id ASC");
    return successRes(res, "Admins fetched successfully", rows);
});

const createAdmin = catchAsync(async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: "Name, email, and password are required" });
    }

    const [existing] = await pool.query("SELECT admin_id FROM admins WHERE email = ?", [email]);
    if (existing && existing.length > 0) {
        return res.status(409).json({ success: false, message: "An administrator with this email already exists" });
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
        "INSERT INTO admins (name, email, password, plain_password, role) VALUES (?, ?, ?, ?, 'Admin')",
        [name, email, hash, password]
    );

    return successRes(res, "Administrator created successfully", {
        admin_id: result.insertId,
        name,
        email,
        role: "Admin"
    }, null, 201);
});

const deleteAdmin = catchAsync(async (req, res) => {
    const { id } = req.params;
    if (parseInt(id) === 1) {
        return res.status(403).json({ success: false, message: "Cannot delete the primary Superadmin account" });
    }
    await pool.query("DELETE FROM admins WHERE admin_id = ?", [id]);
    return successRes(res, "Administrator deleted successfully");
});

const sendSuperAdminOtp = catchAsync(async (req, res) => {
    const personalEmail = (process.env.SUPERADMIN_PERSONAL_EMAIL || 'admin@vlglobal.com').trim().toLowerCase();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    await pool.query('DELETE FROM email_otps WHERE LOWER(email) = ?', [personalEmail]);
    await pool.query(
        'INSERT INTO email_otps (email, otp, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))',
        [personalEmail, otp]
    );

    const emailService = require('../services/email.service');
    await emailService.sendVerificationOtpEmail({
        name: "Super Admin",
        email: personalEmail,
        otp
    });

    const [local, domain] = personalEmail.split('@');
    const masked = local.length > 2 ? `${local[0]}***${local[local.length - 1]}@${domain}` : `***@${domain}`;
    return successRes(res, `Verification code sent to Super Admin's personal email (${masked})`, { maskedEmail: masked });
});

const changeAdminPassword = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { newPassword, otp } = req.body;

    if (!newPassword || newPassword.length < 4) {
        return res.status(400).json({ success: false, message: "Password must be at least 4 characters long" });
    }

    const [adminRows] = await pool.query("SELECT admin_id, role, email FROM admins WHERE admin_id = ?", [id]);
    if (!adminRows || adminRows.length === 0) {
        return res.status(404).json({ success: false, message: "Administrator account not found" });
    }
    
    const targetAdmin = adminRows[0];
    const isSuper = parseInt(targetAdmin.admin_id) === 1 || (targetAdmin.role || "").toLowerCase().includes("super");

    if (isSuper) {
        if (!otp || !otp.trim()) {
            return res.status(400).json({ success: false, message: "OTP verification code from Super Admin personal email is required to change Super Admin password" });
        }
        const personalEmail = (process.env.SUPERADMIN_PERSONAL_EMAIL || 'admin@vlglobal.com').trim().toLowerCase();
        const [otpRows] = await pool.query(
            'SELECT * FROM email_otps WHERE LOWER(email) = ? AND otp = ? AND expires_at >= NOW()',
            [personalEmail, otp.trim()]
        );
        if (!otpRows || otpRows.length === 0) {
            return res.status(400).json({ success: false, message: "Invalid or expired OTP code. Please verify the 6-digit code sent to your personal email." });
        }
        // Remove verified OTP
        await pool.query('DELETE FROM email_otps WHERE LOWER(email) = ?', [personalEmail]);
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE admins SET password = ?, plain_password = ? WHERE admin_id = ?", [hash, newPassword, id]);
    return successRes(res, "Password changed successfully!");
});

const updateAdmin = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { name, email, password, otp } = req.body;

    if (!name || !email) {
        return res.status(400).json({ success: false, message: "Name and email are required" });
    }

    const [existing] = await pool.query("SELECT admin_id FROM admins WHERE email = ? AND admin_id != ?", [email, id]);
    if (existing && existing.length > 0) {
        return res.status(409).json({ success: false, message: "An administrator with this email already exists" });
    }

    const [currentRows] = await pool.query("SELECT * FROM admins WHERE admin_id = ?", [id]);
    if (!currentRows || currentRows.length === 0) {
        return res.status(404).json({ success: false, message: "Administrator account not found" });
    }
    const targetAdmin = currentRows[0];
    const isSuper = parseInt(targetAdmin.admin_id) === 1 || (targetAdmin.role || "").toLowerCase().includes("super");
    const isPassChanged = password && password !== targetAdmin.plain_password && password !== targetAdmin.password;
    const isEmailChanged = email.trim().toLowerCase() !== (targetAdmin.email || "").trim().toLowerCase();

    if (isSuper && (isPassChanged || isEmailChanged)) {
        if (!otp || !otp.trim()) {
            return res.status(400).json({ success: false, message: "OTP verification code from Super Admin personal email is required to change Super Admin email or password" });
        }
        const personalEmail = (process.env.SUPERADMIN_PERSONAL_EMAIL || 'admin@vlglobal.com').trim().toLowerCase();
        const [otpRows] = await pool.query(
            'SELECT * FROM email_otps WHERE LOWER(email) = ? AND otp = ? AND expires_at >= NOW()',
            [personalEmail, otp.trim()]
        );
        if (!otpRows || otpRows.length === 0) {
            return res.status(400).json({ success: false, message: "Invalid or expired OTP code. Please verify the 6-digit code sent to your personal email." });
        }
        await pool.query('DELETE FROM email_otps WHERE LOWER(email) = ?', [personalEmail]);
    }

    if (isPassChanged) {
        const hash = await bcrypt.hash(password, 10);
        await pool.query("UPDATE admins SET name = ?, email = ?, password = ?, plain_password = ? WHERE admin_id = ?", [name, email, hash, password, id]);
    } else {
        await pool.query("UPDATE admins SET name = ?, email = ? WHERE admin_id = ?", [name, email, id]);
    }

    return successRes(res, "Administrator account updated successfully", { admin_id: parseInt(id), name, email });
});

const getAllUsers = catchAsync(async (req, res) => {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (Math.max(1, Number(page)) - 1) * Number(limit);
    const searchTerm = `%${search}%`;

    const countQuery = `
        SELECT COUNT(*) as total 
        FROM users 
        WHERE name LIKE ? OR email LIKE ? OR mobile LIKE ?
    `;
    const [countRows] = await pool.query(countQuery, [searchTerm, searchTerm, searchTerm]);
    const total = countRows[0]?.total || 0;

    const query = `
        SELECT u.user_id, u.name, u.email, u.mobile, u.created_at, u.last_login,
               COUNT(o.order_id) as total_orders,
               COALESCE(SUM(o.grand_total), 0) as total_spent
        FROM users u
        LEFT JOIN orders o ON o.user_id = u.user_id
        WHERE u.name LIKE ? OR u.email LIKE ? OR u.mobile LIKE ?
        GROUP BY u.user_id
        ORDER BY u.created_at DESC
        LIMIT ? OFFSET ?
    `;
    const [rows] = await pool.query(query, [searchTerm, searchTerm, searchTerm, Number(limit), offset]);

    return successRes(res, "Users fetched successfully", rows, { total });
});

const getUserDetails = catchAsync(async (req, res) => {
    const userId = req.params.id;

    const [userRows] = await pool.query(`
        SELECT user_id, name, email, mobile, created_at, last_login, is_active, profile_pic 
        FROM users WHERE user_id = ?
    `, [userId]);

    if (!userRows.length) {
        return res.status(404).json({ success: false, message: "User not found" });
    }
    
    const user = userRows[0];

    // Fetch Wallet Balance
    const [walletRows] = await pool.query(`
        SELECT balance FROM wallets WHERE user_id = ?
    `, [userId]);
    const walletBalance = walletRows.length ? walletRows[0].balance : 0;

    // Fetch Orders
    const [orders] = await pool.query(`
        SELECT order_id, order_number, grand_total, order_status, created_at
        FROM orders WHERE user_id = ? ORDER BY created_at DESC
    `, [userId]);

    // Fetch Addresses
    const [addresses] = await pool.query(`
        SELECT * FROM user_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC
    `, [userId]);

    // Fetch Login History
    const [loginHistory] = await pool.query(`
        SELECT * FROM user_login_history WHERE user_id = ? ORDER BY login_time DESC LIMIT 20
    `, [userId]);

    // Calculate total spent
    const totalSpent = orders.reduce((acc, curr) => acc + Number(curr.grand_total || 0), 0);

    return successRes(res, "User details fetched successfully", {
        user: { ...user, total_orders: orders.length, total_spent: totalSpent, wallet_balance: walletBalance },
        orders,
        addresses,
        loginHistory
    });
});

module.exports = {
    getDashboardStats,
    adminLogin,
    listAdmins,
    createAdmin,
    deleteAdmin,
    updateAdmin,
    sendSuperAdminOtp,
    changeAdminPassword,
    getAllUsers,
    getUserDetails
};
