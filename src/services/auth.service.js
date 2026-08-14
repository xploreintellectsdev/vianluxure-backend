const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { pool } = require('../config/db');
const emailService = require('./email.service');
const JWT_EXPIRES_IN = '1d';

const signToken = (user) =>
  jwt.sign({ user_id: user.user_id, name: user.name, email: user.email, mobile: user.mobile }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

/**
 * Normalizes email address and merges any duplicate accounts sharing the same email
 */
const findAndMergeUserByEmail = async (rawEmail) => {
  if (!rawEmail) return null;
  const email = rawEmail.toLowerCase().trim();
  const [rows] = await pool.query(`SELECT * FROM users WHERE LOWER(TRIM(email)) = ? ORDER BY user_id ASC`, [email]);
  
  if (!rows || rows.length === 0) return null;
  if (rows.length === 1) return rows[0];

  // If duplicate accounts exist (e.g., one from email/password and one from Google OAuth), merge them into the primary account
  const primary = rows[0];
  for (let i = 1; i < rows.length; i++) {
    const dup = rows[i];
    
    // Merge best attributes into primary
    const mergedGoogleId = primary.google_id || dup.google_id || null;
    const mergedProfilePic = primary.profile_pic || dup.profile_pic || null;
    const mergedMobile = primary.mobile || dup.mobile || null;
    const mergedName = primary.name || dup.name || "Customer";
    
    // Preserve strong password if primary has a random dummy hash or empty password
    let mergedPassword = primary.password;
    if ((!mergedPassword || mergedPassword.length < 20) && dup.password) {
      mergedPassword = dup.password;
    }

    await pool.query(
      `UPDATE users SET name = ?, google_id = ?, profile_pic = ?, mobile = ?, password = ?, is_guest = 0 WHERE user_id = ?`,
      [mergedName, mergedGoogleId, mergedProfilePic, mergedMobile, mergedPassword, primary.user_id]
    );

    // Update in-memory primary object
    primary.name = mergedName;
    primary.google_id = mergedGoogleId;
    primary.profile_pic = mergedProfilePic;
    primary.mobile = mergedMobile;
    primary.password = mergedPassword;
    primary.is_guest = 0;

    // Migrate user records from duplicate account to primary account
    const tablesToMigrate = [
      'orders',
      'user_addresses',
      'user_login_history',
      'wallet_transactions'
    ];
    for (const table of tablesToMigrate) {
      try {
        await pool.query(`UPDATE ${table} SET user_id = ? WHERE user_id = ?`, [primary.user_id, dup.user_id]);
      } catch (e) {
        // Ignore if table/column does not exist
      }
    }

    // Safely combine wallet balance to prevent unique constraint conflicts on user_id
    try {
      const [primaryWallet] = await pool.query(`SELECT wallet_id, balance FROM wallets WHERE user_id = ?`, [primary.user_id]);
      const [dupWallet] = await pool.query(`SELECT wallet_id, balance FROM wallets WHERE user_id = ?`, [dup.user_id]);
      if (dupWallet.length > 0) {
        if (primaryWallet.length > 0) {
          const newBal = parseFloat(primaryWallet[0].balance || 0) + parseFloat(dupWallet[0].balance || 0);
          await pool.query(`UPDATE wallets SET balance = ? WHERE wallet_id = ?`, [newBal, primaryWallet[0].wallet_id]);
          await pool.query(`DELETE FROM wallets WHERE wallet_id = ?`, [dupWallet[0].wallet_id]);
        } else {
          await pool.query(`UPDATE wallets SET user_id = ? WHERE wallet_id = ?`, [primary.user_id, dupWallet[0].wallet_id]);
        }
      }
    } catch (e) {
      // Ignore wallet merge errors
    }

    // Remove the duplicate user row after merging all assets
    await pool.query(`DELETE FROM users WHERE user_id = ?`, [dup.user_id]);
    console.log(`✅ [AUTH SERVICE] Successfully merged duplicate account (ID: ${dup.user_id}) into primary account (ID: ${primary.user_id})`);
  }
  return primary;
};

const sendRegisterOtp = async ({ name, email: rawEmail, mobile }) => {
  if (!rawEmail) {
    const err = new Error("Email is required for verification.");
    err.statusCode = 400;
    throw err;
  }
  const email = rawEmail.toLowerCase().trim();
  const existingEmailUser = await findAndMergeUserByEmail(email);
  if (existingEmailUser && !existingEmailUser.is_guest && !existingEmailUser.google_id) {
    const err = new Error("An account with this email already exists. Please login directly using your password.");
    err.statusCode = 409;
    throw err;
  }
  if (mobile) {
    const [existingMobile] = await pool.query('SELECT user_id, is_guest FROM users WHERE mobile = ? AND mobile IS NOT NULL AND mobile != ""', [mobile]);
    if (existingMobile.length > 0 && !existingMobile[0].is_guest) {
      if (!existingEmailUser || existingEmailUser.user_id !== existingMobile[0].user_id) {
        const err = new Error("An account with this mobile number already exists.");
        err.statusCode = 409;
        throw err;
      }
    }
  }

  // Generate a secure 6-digit verification code
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Clean old OTPs for this email and save new OTP
  await pool.query('DELETE FROM email_otps WHERE LOWER(email) = ?', [email]);
  await pool.query(
    'INSERT INTO email_otps (email, otp, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))',
    [email, otp]
  );

  await emailService.sendVerificationOtpEmail({ name, email, otp });
  return { success: true, message: "Verification code sent to your email address." };
};

const register = async ({ name, email: rawEmail, mobile, password, otp }) => {
  const email = rawEmail ? rawEmail.toLowerCase().trim() : null;
  if (!otp) {
    const err = new Error("Email verification code (OTP) is required.");
    err.statusCode = 400;
    throw err;
  }

  // Verify OTP
  const [otpRows] = await pool.query('SELECT * FROM email_otps WHERE LOWER(email) = ? AND otp = ? AND expires_at >= NOW()', [email, otp.trim()]);
  if (!otpRows || otpRows.length === 0) {
    const err = new Error("Invalid or expired verification code. Please check the digits or request a new code.");
    err.statusCode = 400;
    throw err;
  }
  
  // Clean consumed OTP
  await pool.query('DELETE FROM email_otps WHERE LOWER(email) = ?', [email]);

  const existingEmailUser = await findAndMergeUserByEmail(email);
  const [existingMobile] = await pool.query('SELECT user_id, is_guest FROM users WHERE mobile = ? AND mobile IS NOT NULL AND mobile != ""', [mobile]);

  if (existingMobile.length > 0 && !existingMobile[0].is_guest) {
    if (!existingEmailUser || existingEmailUser.user_id !== existingMobile[0].user_id) {
      const err = new Error("An account with this mobile number already exists.");
      err.statusCode = 409;
      throw err;
    }
  }

  let userId;
  const hashedPassword = await bcrypt.hash(password, 10);

  // If user previously signed in via Google OAuth or is a guest, merge password and mobile into their account
  if (existingEmailUser && (existingEmailUser.is_guest || existingEmailUser.google_id)) {
    userId = existingEmailUser.user_id;
    await pool.query(
      'UPDATE users SET name = ?, email = ?, mobile = COALESCE(?, mobile), password = ?, is_guest = 0 WHERE user_id = ?',
      [name, email, mobile || null, hashedPassword, userId]
    );
  } else if (existingEmailUser && !existingEmailUser.is_guest) {
    const err = new Error("An account with this email already exists. Please login using your password or Google OAuth.");
    err.statusCode = 409;
    throw err;
  } else if (existingMobile.length > 0 && existingMobile[0].is_guest) {
    userId = existingMobile[0].user_id;
    await pool.query(
      'UPDATE users SET name = ?, email = ?, password = ?, is_guest = 0 WHERE user_id = ?',
      [name, email, hashedPassword, userId]
    );
  } else {
    const [result] = await pool.query(
      `INSERT INTO users (name, email, mobile, password, is_guest) VALUES (?, ?, ?, ?, 0)`,
      [name, email, mobile || null, hashedPassword]
    );
    userId = result.insertId;
  }

  const user = { user_id: userId, name, email, mobile };
  return { user, token: signToken(user) };
};

const login = async ({ email: rawEmail, password }) => {
  const email = rawEmail ? rawEmail.toLowerCase().trim() : null;
  const dbUser = await findAndMergeUserByEmail(email);

  // Same message for "no such user" and "wrong password" on purpose — don't reveal which part was wrong.
  if (!dbUser) {
    const err = new Error("Invalid email or password.");
    err.statusCode = 401;
    throw err;
  }

  if (!dbUser.is_active) {
    const err = new Error("This account has been deactivated.");
    err.statusCode = 403;
    throw err;
  }

  if (!dbUser.password) {
    const err = new Error("This account uses Google OAuth. Please login with Google or reset your password.");
    err.statusCode = 401;
    throw err;
  }

  const passwordMatches = await bcrypt.compare(password, dbUser.password);
  if (!passwordMatches) {
    const err = new Error("Invalid email or password.");
    err.statusCode = 401;
    throw err;
  }

  await pool.query(`UPDATE users SET last_login = NOW() WHERE user_id = ?`, [dbUser.user_id]);

  const user = { user_id: dbUser.user_id, name: dbUser.name, email: dbUser.email, mobile: dbUser.mobile, profile_pic: dbUser.profile_pic };
  return { user, token: signToken(user) };
};

const googleLogin = async ({ token, access_token }) => {
  const authToken = token || access_token;
  if (!authToken) {
    const err = new Error("Google token is required.");
    err.statusCode = 400;
    throw err;
  }

  let googleData = null;

  // Try verifying as an OAuth access token via Google UserInfo API
  try {
    const res = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${authToken}` },
      timeout: 5000,
    });
    googleData = res.data;
  } catch (e1) {
    // If access token fails, try verifying as an OpenID id_token via tokeninfo
    try {
      const res2 = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${authToken}`, {
        timeout: 5000,
      });
      googleData = res2.data;
    } catch (e2) {
      const err = new Error("Invalid Google authentication token.");
      err.statusCode = 401;
      throw err;
    }
  }

  if (!googleData || !googleData.email) {
    const err = new Error("Could not retrieve email from Google profile.");
    err.statusCode = 401;
    throw err;
  }

  const email = googleData.email.toLowerCase().trim();
  const name = googleData.name || `${googleData.given_name || ""} ${googleData.family_name || ""}`.trim() || email.split("@")[0];
  const picture = googleData.picture || null;
  const googleId = googleData.sub || null;

  let dbUser = await findAndMergeUserByEmail(email);

  if (dbUser) {
    if (!dbUser.is_active) {
      const err = new Error("This account has been deactivated.");
      err.statusCode = 403;
      throw err;
    }
    // Automatically MERGE google_id into existing account (such as one created via email & password)
    await pool.query(
      "UPDATE users SET name = COALESCE(name, ?), last_login = NOW(), google_id = ?, profile_pic = COALESCE(profile_pic, ?), is_guest = 0 WHERE user_id = ?",
      [name, googleId, picture, dbUser.user_id]
    );
    dbUser.google_id = googleId;
    dbUser.profile_pic = dbUser.profile_pic || picture;
    dbUser.name = dbUser.name || name;
    dbUser.is_guest = 0;
  } else {
    // Create new user via Google OAuth
    const dummyPassword = await bcrypt.hash(Math.random().toString(36) + Math.random().toString(36), 10);
    const [result] = await pool.query(
      `INSERT INTO users (name, email, mobile, password, profile_pic, google_id, is_guest) VALUES (?, ?, NULL, ?, ?, ?, 0)`,
      [name, email, dummyPassword, picture, googleId]
    );
    dbUser = {
      user_id: result.insertId,
      name,
      email,
      mobile: null,
      profile_pic: picture,
      is_guest: 0,
    };
  }

  const user = {
    user_id: dbUser.user_id,
    name: dbUser.name,
    email: dbUser.email,
    mobile: dbUser.mobile,
    profile_pic: dbUser.profile_pic,
  };
  return { user, token: signToken(user) };
};

module.exports = { register, login, googleLogin, sendRegisterOtp };