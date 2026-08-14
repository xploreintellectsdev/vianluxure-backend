const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || "localhost",
  port:     parseInt(process.env.DB_PORT || "3306"),
  user:     process.env.DB_USER     || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME     || "vianluxure",
  waitForConnections: true,
  connectionLimit:    10,   
  queueLimit:         0,    
  
  dateStrings: true, 
});

/**
 * Verify DB connectivity on startup.
 */
const testConnection = async () => {
  try {
    const conn = await pool.getConnection();
    console.log("✅ MySQL connected successfully");
    try {
      await conn.query("ALTER TABLE orders ADD COLUMN refund_method VARCHAR(50) DEFAULT NULL");
    } catch (e) {
      // Ignore if column already exists
    }
    try {
      await conn.query("ALTER TABLE users ADD COLUMN google_id VARCHAR(255) DEFAULT NULL");
      await conn.query("ALTER TABLE users MODIFY COLUMN password VARCHAR(255) NULL");
      await conn.query("ALTER TABLE users MODIFY COLUMN mobile VARCHAR(20) NULL");
    } catch (e) {
      // Ignore if columns/table already altered
    }
    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS user_login_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        name VARCHAR(150) NOT NULL,
        email VARCHAR(150) NULL,
        ip_address VARCHAR(50) DEFAULT '::1',
        status VARCHAR(50) DEFAULT 'SUCCESS',
        login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
    } catch (e) {
      // Ignore table creation error
    }
    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS email_otps (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(150) NOT NULL,
        otp VARCHAR(20) NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
    } catch (e) {
      // Ignore table creation error
    }
    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS admins (
        admin_id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        plain_password VARCHAR(255) DEFAULT NULL,
        role VARCHAR(50) DEFAULT 'Admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
      try {
        await conn.query("ALTER TABLE admins ADD COLUMN plain_password VARCHAR(255) DEFAULT NULL AFTER password");
      } catch (e) { /* ignore if column already exists */ }
      const bcrypt = require("bcryptjs");
      const [admRows] = await conn.query("SELECT COUNT(*) as cnt FROM admins");
      if (admRows[0].cnt === 0) {
        const hash = await bcrypt.hash("Xplore@123", 10);
        await conn.query(
          "INSERT INTO admins (name, email, password, plain_password, role) VALUES (?, ?, ?, ?, ?)",
          ["Super Admin", "admin@vlglobal.com", hash, "Xplore@123", "Superadmin"]
        );
        console.log("👑 Seeded default superadmin -> email: admin@vlglobal.com, pass: Xplore@123");
      } else {
        // Ensure primary admin role remains Superadmin without resetting custom email or password
        await conn.query("UPDATE admins SET role = 'Superadmin' WHERE admin_id = 1");
        // Migrate legacy default domain only if still untouched
        await conn.query("UPDATE admins SET email = 'admin@vlglobal.com' WHERE email = 'admin@vianluxure.com'");
      }
    } catch (e) {
      console.error("Admins table check/seeding error:", e.message);
    }
    try {
      await conn.query("ALTER TABLE fabric_master ADD COLUMN fab_gst DECIMAL(5,2) NOT NULL DEFAULT '0.00'");
    } catch (e) { /* ignore if column already exists */ }
    try {
      await conn.query("ALTER TABLE fabric_master ADD COLUMN fab_stitching_charges DECIMAL(10,2) NOT NULL DEFAULT '0.00'");
    } catch (e) { /* ignore if column already exists */ }
    try {
      await conn.query("ALTER TABLE fabric_master MODIFY COLUMN fab_stitching_charges DECIMAL(10,2) NOT NULL DEFAULT '0.00'");
    } catch (e) { /* ignore if already modified */ }
    try {
      await conn.query("ALTER TABLE order_items MODIFY COLUMN monogram_text VARCHAR(1000) NULL DEFAULT NULL");
    } catch (e) { /* ignore if column doesn't exist or already modified */ }
    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS blogs (
        blog_id INT AUTO_INCREMENT PRIMARY KEY,
        order_no INT DEFAULT 0,
        published_date DATE NULL,
        blog_title VARCHAR(255) NOT NULL,
        blog_image VARCHAR(500) NOT NULL,
        short_description TEXT NULL,
        blog_content LONGTEXT NULL,
        is_active TINYINT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL
      )`);
      await conn.query("ALTER TABLE blogs ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL");
    } catch (e) { /* ignore if column already exists */ }
    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS events (
        event_id INT AUTO_INCREMENT PRIMARY KEY,
        order_no INT DEFAULT 0,
        event_date DATE NULL,
        event_title VARCHAR(255) NOT NULL,
        media_type VARCHAR(50) DEFAULT 'Image',
        event_media VARCHAR(500) NOT NULL,
        short_description TEXT NULL,
        is_active TINYINT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL
      )`);
      await conn.query("ALTER TABLE events ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL");
    } catch (e) { /* ignore if column already exists */ }
    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS home_hero_slides (
        slide_id INT AUTO_INCREMENT PRIMARY KEY,
        order_no INT DEFAULT 0,
        title VARCHAR(255) NOT NULL,
        description TEXT NULL,
        image VARCHAR(500) NOT NULL,
        button_text VARCHAR(100) NULL,
        button_link VARCHAR(255) NULL,
        is_active TINYINT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL
      )`);
    } catch (e) { /* ignore */ }
    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS home_marquee_items (
        item_id INT AUTO_INCREMENT PRIMARY KEY,
        order_no INT DEFAULT 0,
        item_text VARCHAR(255) NOT NULL,
        is_active TINYINT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL
      )`);
    } catch (e) { /* ignore */ }
    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS home_story_sections (
        section_id INT AUTO_INCREMENT PRIMARY KEY,
        section_key VARCHAR(100) NOT NULL UNIQUE,
        order_no INT DEFAULT 0,
        eyebrow_label VARCHAR(150) NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NULL,
        is_active TINYINT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL
      )`);
    } catch (e) { /* ignore */ }

    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS about_page_sections (
        section_id INT AUTO_INCREMENT PRIMARY KEY,
        section_key VARCHAR(100) NOT NULL UNIQUE,
        section_type VARCHAR(30) NOT NULL,
        order_no INT DEFAULT 0,
        eyebrow_label VARCHAR(150) NULL,
        title VARCHAR(255) NULL,
        description TEXT NULL,
        image VARCHAR(500) NULL,
        button_text VARCHAR(100) NULL,
        button_link VARCHAR(255) NULL,
        is_active TINYINT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL
      )`);
    } catch (e) { /* ignore */ }

    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS about_section_items (
        item_id INT AUTO_INCREMENT PRIMARY KEY,
        section_id INT NOT NULL,
        order_no INT DEFAULT 0,
        item_title VARCHAR(255) NULL,
        item_text TEXT NULL,
        item_image VARCHAR(500) NULL,
        is_active TINYINT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        FOREIGN KEY (section_id) REFERENCES about_page_sections(section_id) ON DELETE CASCADE
      )`);
    } catch (e) { /* ignore */ }

    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS home_story_cards (
        card_id INT AUTO_INCREMENT PRIMARY KEY,
        section_id INT NOT NULL,
        order_no INT DEFAULT 0,
        image VARCHAR(500) NOT NULL,
        caption VARCHAR(255) NULL,
        card_title VARCHAR(255) NOT NULL,
        card_description TEXT NULL,
        is_active TINYINT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        FOREIGN KEY (section_id) REFERENCES home_story_sections(section_id) ON DELETE CASCADE
      )`);
    } catch (e) { /* ignore */ }

    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS home_banners (
        banner_id INT AUTO_INCREMENT PRIMARY KEY,
        banner_key VARCHAR(100) NOT NULL UNIQUE,
        order_no INT DEFAULT 0,
        layout_type VARCHAR(30) DEFAULT 'overlay',
        eyebrow_label VARCHAR(150) NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NULL,
        button_text VARCHAR(100) NULL,
        button_link VARCHAR(255) NULL,
        image VARCHAR(500) NOT NULL,
        is_active TINYINT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL
      )`);
      
      await conn.query(`CREATE TABLE IF NOT EXISTS home_banner_stats (
        stat_id INT AUTO_INCREMENT PRIMARY KEY,
        banner_id INT NOT NULL,
        order_no INT DEFAULT 0,
        stat_value VARCHAR(50) NOT NULL,
        stat_label VARCHAR(150) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (banner_id) REFERENCES home_banners(banner_id) ON DELETE CASCADE
      )`);
    } catch (e) { /* ignore */ }
    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS stock_master (
        stock_id INT AUTO_INCREMENT PRIMARY KEY,
        pro_id INT NOT NULL,
        product_type VARCHAR(50) NOT NULL DEFAULT 'fabric',
        quantity DECIMAL(10, 2) NOT NULL DEFAULT '0.00',
        unit VARCHAR(20) NOT NULL DEFAULT 'meters',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_product (pro_id, product_type)
      )`);
    } catch (e) { /* ignore if table already exists */ }
    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS shipment_details (
        shipment_id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL UNIQUE,
        carrier VARCHAR(50) DEFAULT 'DELHIVERY',
        awb_number VARCHAR(100) NULL,
        shipment_status VARCHAR(100) NULL,
        tracking_url VARCHAR(500) NULL,
        shiprocket_order_id VARCHAR(100) NULL,
        shiprocket_shipment_id VARCHAR(100) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`);
      await conn.query("ALTER TABLE shipment_details ADD COLUMN carrier VARCHAR(50) DEFAULT 'DELHIVERY'");
    } catch (e) { /* ignore */ }
    try {
      await conn.query("ALTER TABLE shipment_details ADD COLUMN shiprocket_order_id VARCHAR(100) NULL");
    } catch (e) { /* ignore */ }
    try {
      await conn.query("ALTER TABLE shipment_details ADD COLUMN shiprocket_shipment_id VARCHAR(100) NULL");
    } catch (e) { /* ignore */ }
    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS corporate_order_master (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        company_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        message TEXT,
        agree_contact BOOLEAN DEFAULT TRUE,
        status VARCHAR(50) DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`);
    } catch (e) { /* ignore */ }
    try {
      await conn.query("ALTER TABLE orders ADD COLUMN customer_email VARCHAR(255) NULL");
    } catch (e) { /* ignore */ }
    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS monogram_placements (
        placement_id INT AUTO_INCREMENT PRIMARY KEY,
        placement_name VARCHAR(255) NOT NULL,
        placement_image VARCHAR(500),
        extra_price DECIMAL(10, 2) DEFAULT 0.00,
        is_active BOOLEAN DEFAULT true,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
      await conn.query(`CREATE TABLE IF NOT EXISTS monogram_colors (
        color_id INT AUTO_INCREMENT PRIMARY KEY,
        color_name VARCHAR(255) NOT NULL,
        color_image VARCHAR(500),
        is_active BOOLEAN DEFAULT true,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
      await conn.query(`CREATE TABLE IF NOT EXISTS monogram_fonts (
        font_id INT AUTO_INCREMENT PRIMARY KEY,
        font_name VARCHAR(255) NOT NULL,
        font_preview_image VARCHAR(500),
        is_active BOOLEAN DEFAULT true,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
    } catch (e) { console.error("Monogram Table creation error:", e.message); }

    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS site_menu_items (
        menu_id INT AUTO_INCREMENT PRIMARY KEY,
        location VARCHAR(20) NOT NULL,
        group_name VARCHAR(100) NULL,
        label VARCHAR(150) NOT NULL,
        link VARCHAR(255) NULL,
        item_type VARCHAR(20) DEFAULT 'link',
        icon VARCHAR(100) NULL,
        order_no INT DEFAULT 0,
        is_active TINYINT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL
      )`);
    } catch (e) { console.error("site_menu_items creation error:", e.message); }

    try {
      
      // Pre-seed known homepage sections
      const seeds = [
        ['hero', 'Homepage Hero', 10],
        ['product-sell', 'Top Product Features', 20],
        ['new-arrival', 'New Arrivals', 30],
        ['story-cotton', 'Story: Cotton', 40],
        ['fabric-shop', 'Banner: Fabric Shop', 50],
        ['reviews', 'Customer Reviews', 60],
        ['ready-to-wear', 'Banner: Ready to Wear', 70],
        ['best-sellers', 'Best Sellers', 80],
        ['story-2', 'Story: Second Section', 90],
        ['made-to-wear', 'Banner: Made to Wear', 100],
        ['story-linen', 'Story: Linen', 110],
        ['bespoke-cta', 'Banner: Bespoke CTA', 120]
      ];

      for (const [sKey, sLabel, sOrder] of seeds) {
        await conn.query(`INSERT IGNORE INTO site_section_visibility (section_key, section_label, order_no) VALUES (?, ?, ?)`, [sKey, sLabel, sOrder]);
      }
    } catch (e) { console.error("site_section_visibility creation error:", e.message); }

    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS contact_hero (
        hero_id INT AUTO_INCREMENT PRIMARY KEY,
        eyebrow_label VARCHAR(150) NULL,
        title VARCHAR(255) NULL,
        description TEXT NULL,
        image VARCHAR(500) NULL,
        is_active TINYINT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL
      )`);
      
      try {
        await conn.query(`ALTER TABLE contact_hero ADD COLUMN form_title VARCHAR(255) NULL AFTER eyebrow_label`);
      } catch (e) {
        // Ignore duplicate column error
        if (e.code !== 'ER_DUP_FIELDNAME') {
          console.error("contact_hero alter error:", e.message);
        }
      }
    } catch (e) { console.error("contact_hero creation error:", e.message); }

    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS contact_info_items (
        item_id INT AUTO_INCREMENT PRIMARY KEY,
        item_type VARCHAR(20) NOT NULL DEFAULT 'card',
        icon_key VARCHAR(50) NULL,
        label VARCHAR(150) NULL,
        value TEXT NULL,
        link_url VARCHAR(500) NULL,
        order_no INT DEFAULT 0,
        is_active TINYINT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL
      )`);
    } catch (e) { console.error("contact_info_items creation error:", e.message); }

    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS contact_submissions (
        submission_id INT AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        whatsapp_number VARCHAR(30) NULL,
        email VARCHAR(255) NULL,
        message TEXT NULL,
        is_read TINYINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL
      )`);
    } catch (e) { console.error("contact_submissions creation error:", e.message); }

    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS page_info_sections (
        section_id INT AUTO_INCREMENT PRIMARY KEY,
        page_key VARCHAR(50) NOT NULL,
        section_type VARCHAR(20) NOT NULL,
        subtitle VARCHAR(150) NULL,
        title VARCHAR(255) NULL,
        description TEXT NULL,
        image VARCHAR(500) NULL,
        is_active TINYINT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        UNIQUE KEY uniq_page_section (page_key, section_type)
      )`);
    } catch (e) { console.error("page_info_sections creation error:", e.message); }

    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS page_info_items (
        item_id INT AUTO_INCREMENT PRIMARY KEY,
        section_id INT NOT NULL,
        order_no INT DEFAULT 0,
        icon_key VARCHAR(50) NULL,
        item_title VARCHAR(255) NOT NULL,
        item_description TEXT NULL,
        is_active TINYINT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        FOREIGN KEY (section_id) REFERENCES page_info_sections(section_id) ON DELETE CASCADE
      )`);
    } catch (e) { console.error("page_info_items creation error:", e.message); }

    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS page_faq_sections (
        faq_section_id INT AUTO_INCREMENT PRIMARY KEY,
        page_key VARCHAR(50) NOT NULL UNIQUE,
        subtitle VARCHAR(150) NULL DEFAULT 'Frequently Asked Questions',
        title VARCHAR(255) NULL,
        footer_text VARCHAR(255) NULL,
        is_active TINYINT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL
      )`);
    } catch (e) { console.error("page_faq_sections creation error:", e.message); }

    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS page_faqs (
        faq_id INT AUTO_INCREMENT PRIMARY KEY,
        faq_section_id INT NOT NULL,
        order_no INT DEFAULT 0,
        question VARCHAR(500) NOT NULL,
        answer TEXT NULL,
        is_active TINYINT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        FOREIGN KEY (faq_section_id) REFERENCES page_faq_sections(faq_section_id) ON DELETE CASCADE
      )`);
    } catch (e) { console.error("page_faqs creation error:", e.message); }

    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS customer_story_sections (
        story_section_id INT AUTO_INCREMENT PRIMARY KEY,
        page_key VARCHAR(50) NOT NULL UNIQUE,
        title VARCHAR(255) DEFAULT 'Customer Stories',
        image VARCHAR(500) NULL,
        is_active TINYINT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL
      )`);
    } catch (e) { console.error("customer_story_sections creation error:", e.message); }

    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS customer_stories (
        story_id INT AUTO_INCREMENT PRIMARY KEY,
        story_section_id INT NOT NULL,
        order_no INT DEFAULT 0,
        customer_name VARCHAR(150),
        story_date DATE NULL,
        rating TINYINT DEFAULT 5,
        story_text TEXT,
        is_active TINYINT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        FOREIGN KEY (story_section_id) REFERENCES customer_story_sections(story_section_id) ON DELETE CASCADE
      )`);
    } catch (e) { console.error("customer_stories creation error:", e.message); }

    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS policy_pages (
        page_id INT AUTO_INCREMENT PRIMARY KEY,
        page_key VARCHAR(100) NOT NULL UNIQUE,
        hero_eyebrow VARCHAR(100) DEFAULT 'Policy',
        hero_title VARCHAR(255) NOT NULL,
        hero_subtitle VARCHAR(500) NULL,
        intro_note TEXT NULL,
        is_active TINYINT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`);
    } catch (e) { console.error("policy_pages creation error:", e.message); }

    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS policy_sections (
        section_id INT AUTO_INCREMENT PRIMARY KEY,
        page_id INT NOT NULL,
        group_name VARCHAR(50) NOT NULL,
        section_type VARCHAR(20) NOT NULL,
        icon VARCHAR(50) NULL,
        title VARCHAR(255) NULL,
        content TEXT NULL,
        stat_value VARCHAR(50) NULL,
        stat_unit VARCHAR(50) NULL,
        stat_label VARCHAR(150) NULL,
        stat_caption VARCHAR(255) NULL,
        order_no INT DEFAULT 0,
        is_active TINYINT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        FOREIGN KEY (page_id) REFERENCES policy_pages(page_id) ON DELETE CASCADE
      )`);
    } catch (e) { console.error("policy_sections creation error:", e.message); }


    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS home_review_section_settings (
        setting_id INT PRIMARY KEY DEFAULT 1,
        heading VARCHAR(255) DEFAULT 'Your Delight is Our Mission',
        subheading VARCHAR(255) DEFAULT 'Over 1000+ 5-star reviews',
        is_visible TINYINT DEFAULT 1,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CHECK (setting_id = 1)
      )`);
    } catch (e) { console.error("home_review_section_settings creation error:", e.message); }

    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS home_customer_reviews (
        review_id INT AUTO_INCREMENT PRIMARY KEY,
        order_no INT DEFAULT 0,
        customer_image VARCHAR(500) NOT NULL,
        quote TEXT NOT NULL,
        author_name VARCHAR(150) NOT NULL,
        author_location VARCHAR(150) NULL,
        is_active TINYINT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL
      )`);
    } catch (e) { console.error("home_customer_reviews creation error:", e.message); }

    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS art_of_perfect_fit_section (
        section_id INT NOT NULL AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL DEFAULT 'The Art of the Perfect Fit',
        is_active TINYINT DEFAULT 1,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (section_id)
      )`);
      
      await conn.query(`CREATE TABLE IF NOT EXISTS art_of_perfect_fit_steps (
        step_id INT NOT NULL AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        image_url VARCHAR(500) DEFAULT NULL,
        display_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (step_id),
        KEY idx_display_order (display_order)
      )`);
    } catch (e) { console.error("art_of_perfect_fit creation error:", e.message); }

    conn.release();
  } catch (err) {
    console.error("❌ MySQL connection failed:", err.message);
    process.exit(1);
  }   
};

module.exports = { pool, testConnection };
