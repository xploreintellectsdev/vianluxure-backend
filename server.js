require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const path = require('path');
const { testConnection } = require('./src/config/db'); 

const optionalAuth = require('./src/middleware/optionalauth.middleware');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // ICICI's payment callback posts x-www-form-urlencoded

// Decodes a Bearer token into req.user when one is present; leaves
// req.user = null for guests instead of blocking the request. Must come
// before any route that reads req.user (addresses, orders, etc).
app.use(optionalAuth);

// ── FIX: this was missing entirely — multer saves files to
// `src/uploads/<folder>/...` and the frontend requests them at
// `${API_URL}/uploads/<folder>/<file>`, but there was no static route
// mounted for `/uploads` at all, so every image request 404'd.
app.use('/uploads', express.static(path.join(__dirname, 'src/uploads')));

// Import Routes
const productTypeRoutes = require('./src/routes/productType.routes');
const fabricCategoryRoutes = require('./src/routes/fabricCategory.routes');
const originRoutes = require('./src/routes/origin.routes');
const weightRoutes = require('./src/routes/weight.routes');
const weaveRoutes = require('./src/routes/weave.routes');
const patternRoutes = require('./src/routes/pattern.routes');
const styleRoutes = require('./src/routes/style.routes');
const colorRoutes = require('./src/routes/color.routes');
const fabricRoutes = require('./src/routes/fabric.routes');
const searchRoutes = require('./src/routes/search.routes'); // ── NEW: Imported Search Route ──
const rtwRoutes = require('./src/routes/rtw.routes');
const customStyleRoutes = require('./src/routes/customStyle.routes');

const orderRoutes = require('./src/routes/order.routes');
const addressRoutes = require('./src/routes/address.routes');
const authRoutes = require('./src/routes/auth.routes');
const userRoutes = require('./src/routes/user.routes');
const paymentRoutes = require('./src/routes/payment.routes');
const uploadRoutes = require('./src/routes/upload.routes'); // ── ADDED ──
const shippingRoutes = require('./src/routes/shipping.routes'); // ── DELHIVERY SHIPPING ──
const reviewRoutes = require('./src/routes/Review.routes');
const customStyleCategoryRoutes = require('./src/routes/customStyleCategory.routes');
const walletRoutes = require('./src/routes/wallet.routes'); // ── WALLET ROUTE ──
const adminRoutes = require('./src/routes/admin.routes'); // ── ADMIN DASHBOARD ──
const blogRoutes = require('./src/routes/blog.routes'); // ── BLOGS ROUTE ──
const eventRoutes = require('./src/routes/event.routes'); // ── EVENTS ROUTE ──
const corporateOrderRoutes = require('./src/routes/corporateOrder.routes'); // ── CORPORATE ORDERS ──
const monogramRoutes = require('./src/routes/monogram.routes'); // ── MONOGRAMS ──
const heroRoutes = require('./src/routes/hero.routes'); // ── HERO ROUTE ──
const storySectionRoutes = require('./src/routes/storySection.routes'); // ── STORY SECTION ROUTE ──
const bannerRoutes = require('./src/routes/banner.routes'); // ── BANNERS ROUTE ──
const menuItemRoutes = require('./src/routes/menuItem.routes'); // ── MENU ITEMS ROUTE ──
const aboutRoutes = require('./src/routes/about.routes'); // ── ABOUT PAGE ROUTE ──
const contactRoutes = require('./src/routes/contact.routes'); // ── CONTACT PAGE ROUTE ──
const pageInfoRoutes = require('./src/routes/pageInfo.routes'); // ── PAGE INFO ──
const pageFaqRoutes = require('./src/routes/pageFaq.routes'); // ── PAGE FAQ ──
const policyPageRoutes = require('./src/routes/policyPage.routes'); // ── POLICY PAGES ──
const customerStoryRoutes = require('./src/routes/customerStory.routes'); // ── CUSTOMER STORIES ──
const homeReviewRoutes = require('./src/routes/homeReview.routes'); // ── HOME REVIEWS ──
const artOfPerfectFitRoutes = require('./src/routes/artOfPerfectFit.routes'); // ── ART OF PERFECT FIT ──

const API = "/api";

// Use Routes
app.use(`${API}/auth`, authRoutes);
app.use(`${API}/users`, userRoutes);
app.use(`${API}/story-sections`, storySectionRoutes);
app.use(`${API}/about-page`, aboutRoutes);
app.use(`${API}/contact-page`, contactRoutes);
app.use(`${API}/banners`, bannerRoutes);
app.use(`${API}/menu-items`, menuItemRoutes);
app.use(`${API}/product-types`, productTypeRoutes);
app.use(`${API}/fabric-categories`, fabricCategoryRoutes);
app.use(`${API}/origins`, originRoutes);
app.use(`${API}/weights`, weightRoutes);
app.use(`${API}/weaves`, weaveRoutes);
app.use(`${API}/patterns`, patternRoutes);
app.use(`${API}/styles`, styleRoutes);
app.use(`${API}/colors`, colorRoutes);
app.use(`${API}/fabrics`, fabricRoutes);
app.use(`${API}/search`, searchRoutes); // ── NEW: Registered Search Route ──
app.use(`${API}/ready-to-wear`, rtwRoutes);
app.use(`${API}/custom-styles`, customStyleRoutes);
app.use(`${API}/custom-style-categories`, customStyleCategoryRoutes);
app.use(`${API}/orders`, orderRoutes);
app.use(`${API}/addresses`, addressRoutes);
app.use(`${API}/payment`, paymentRoutes);
app.use(`${API}/upload-reference`, uploadRoutes); // ── ADDED ──
app.use(`${API}/shipping`, shippingRoutes); // ── DELHIVERY SHIPPING ──
app.use(`${API}/reviews`, reviewRoutes);
app.use(`${API}/wallets`, walletRoutes); // ── WALLET ROUTE ──
app.use(`${API}/admin`, adminRoutes); // ── ADMIN DASHBOARD ──
app.use(`${API}/blogs`, blogRoutes); // ── BLOGS ROUTE ──
app.use(`${API}/events`, eventRoutes); // ── EVENTS ROUTE ──
app.use(`${API}/corporate-orders`, corporateOrderRoutes); // ── CORPORATE ORDERS ──
app.use(`${API}/monogram`, monogramRoutes.publicRoutes);
app.use(`${API}/admin/monogram`, monogramRoutes.adminRoutes);
app.use(`${API}/hero`, heroRoutes); // ── HERO ROUTE ──
app.use(`${API}/page-info`, pageInfoRoutes); // ── PAGE INFO ──
app.use(`${API}/page-faq`, pageFaqRoutes); // ── PAGE FAQ ──
app.use(`${API}/policy-pages`, policyPageRoutes); // ── POLICY PAGES ──
app.use(`${API}/customer-stories`, customerStoryRoutes); // ── CUSTOMER STORIES ──
app.use(`${API}/home-reviews`, homeReviewRoutes); // ── HOME REVIEWS ──
app.use(`${API}/art-of-perfect-fit`, artOfPerfectFitRoutes); // ── ART OF PERFECT FIT ──
const { initScheduler } = require('./src/services/tracking.scheduler');

const PORT = process.env.PORT || 5000;

testConnection().then(() => {
    initScheduler();
    app.listen(PORT, () => {
        console.log(`🚀 Server is running on port ${PORT}`);
    });
});