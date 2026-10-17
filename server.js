const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Load environment variables from local .env if available
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Applicant = require('./models/Applicant');
const Settings = require('./models/Settings');

const app = express();

const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

// ==========================================
// 1. CORS & Request Parsing Middleware
// ==========================================
const allowedOrigins = [
    'https://securerentalform.site',
    'https://www.securerentalform.site',
    'http://localhost:8080',
    'http://localhost:3000',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:5500'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (
            allowedOrigins.includes(origin) ||
            origin.endsWith('.vercel.app') ||
            origin.endsWith('.netlify.app')
        ) {
            return callback(null, true);
        }
        // In local development, allow any origin
        if (!isProduction) {
            return callback(null, true);
        }
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ==========================================
// 2. MongoDB Serverless Connection Caching
// ==========================================
let cached = global.mongoose;
if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

async function connectToDatabase() {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
        if (!isProduction) {
            console.warn("⚠️ [DEV] No MONGO_URI configured. Running in local fallback mode.");
            return null;
        }
        throw new Error("MONGO_URI environment variable is not defined in production.");
    }

    if (cached.conn && mongoose.connection.readyState === 1) {
        return cached.conn;
    }

    if (!cached.promise) {
        const opts = {
            bufferCommands: false,
            serverSelectionTimeoutMS: 5000,
        };

        cached.promise = mongoose.connect(mongoUri, opts).then((mongooseInstance) => {
            console.log("✅ MongoDB Atlas Connected Successfully!");
            return mongooseInstance;
        }).catch((err) => {
            cached.promise = null;
            console.error("❌ MongoDB Atlas Connection Error:", err.message);
            throw err;
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        throw e;
    }

    return cached.conn;
}

// Ensure database connection for all /api requests
app.use(async (req, res, next) => {
    // Health check endpoint can run without blocking on database
    if (req.path === '/' || req.path === '/api/health') {
        return next();
    }

    try {
        await connectToDatabase();
        next();
    } catch (err) {
        if (isProduction) {
            console.error("Database connection failure in production:", err.message);
            return res.status(500).json({
                error: "Database Connection Error",
                message: "Unable to connect to MongoDB Atlas. Please ensure MONGO_URI is configured correctly in Vercel and Network Access includes 0.0.0.0/0."
            });
        }
        // In local development, fall through to local fallback
        next();
    }
});

// ==========================================
// 3. Local Storage Helpers (DEV ONLY)
// ==========================================
const DEFAULT_SETTINGS = {
    applicationFee: 80,
    securityDeposit: 1000,
    zelleEmail: "pay@dhproperties.com",
    zelleInfo: "pay@dhproperties.com",
    zelleQR: "",
    chimeTag: "$DHProperties",
    chimeQR: "",
    cashAppTag: "$DHRentals",
    cashAppQR: "",
    venmoTag: "@DHProperties",
    venmoQR: "",
    applePayInfo: "+1234567890",
    applePayQR: "",
    bankDetails: "Chase Bank, A/C: 123456789, Routing: 987654321",
    isZelleActive: true,
    isChimeActive: true,
    isCashAppActive: true,
    isBankActive: true,
    isVenmoActive: true,
    isApplePayActive: true
};

const DATA_DIR = path.join(__dirname, 'data');
const APPLICANTS_FILE = path.join(DATA_DIR, 'applicants.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

function readLocalApplicants() {
    try {
        if (!fs.existsSync(APPLICANTS_FILE)) return [];
        return JSON.parse(fs.readFileSync(APPLICANTS_FILE, 'utf-8'));
    } catch (e) {
        return [];
    }
}

function writeLocalApplicants(data) {
    if (isProduction) return;
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(APPLICANTS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
        console.error("Local file write error:", e.message);
    }
}

function readLocalSettings() {
    try {
        if (!fs.existsSync(SETTINGS_FILE)) return DEFAULT_SETTINGS;
        return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')) };
    } catch (e) {
        return DEFAULT_SETTINGS;
    }
}

function writeLocalSettings(data) {
    if (isProduction) return;
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
        console.error("Local file write error:", e.message);
    }
}

// ==========================================
// 4. API Routes
// ==========================================

// Health Check / Root Endpoint
app.get('/', async (req, res) => {
    let dbStatus = "disconnected";
    try {
        if (mongoose.connection && mongoose.connection.readyState === 1) {
            dbStatus = "connected";
        }
    } catch (e) {}

    res.status(200).json({
        status: "ok",
        message: "Rental Application API is running!",
        environment: isProduction ? "production" : "development",
        database: dbStatus,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: "ok",
        database: (mongoose.connection && mongoose.connection.readyState === 1) ? "connected" : "disconnected"
    });
});

// Submit Application
app.post('/api/apply', async (req, res) => {
    try {
        const applicantDoc = new Applicant(req.body);
        const validationError = applicantDoc.validateSync();
        if (validationError) {
            console.error("Validation error:", validationError.message);
            return res.status(400).json({
                error: "Validation Error",
                message: validationError.message
            });
        }

        const isDbReady = mongoose.connection && mongoose.connection.readyState === 1;

        if (isDbReady) {
            await applicantDoc.save();
        } else if (!isProduction) {
            const applicants = readLocalApplicants();
            const newRecord = {
                ...req.body,
                _id: 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                applyDate: new Date()
            };
            applicants.unshift(newRecord);
            writeLocalApplicants(applicants);
        } else {
            return res.status(500).json({
                error: "Persistence Error",
                message: "Production database is not connected. Data could not be persisted."
            });
        }

        // Email Notification (Optional, non-blocking failure)
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            try {
                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASS
                    }
                });

                // Sanitize user inputs for HTML email body to prevent HTML injection
                const safeName = `${req.body.firstName || ''} ${req.body.lastName || ''}`.replace(/[<>]/g, '');
                const safeEmail = String(req.body.email || '').replace(/[<>]/g, '');
                const safePhone = String(req.body.phone || '').replace(/[<>]/g, '');
                const safePayment = String(req.body.paymentMethod || '').replace(/[<>]/g, '');

                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: process.env.EMAIL_USER,
                    subject: '🎉 New Rental Application Received!',
                    html: `
                        <div style="font-family: Arial, sans-serif; padding: 20px; background: #f8fafc; border-radius: 8px;">
                            <h2 style="color: #1e40af;">New Application Alert!</h2>
                            <p>Someone just submitted a new rental application on your website.</p>
                            <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1;">
                                <p><strong>Name:</strong> ${safeName}</p>
                                <p><strong>Email:</strong> ${safeEmail}</p>
                                <p><strong>Phone:</strong> ${safePhone}</p>
                                <p><strong>Payment Method:</strong> ${safePayment}</p>
                            </div>
                            <p style="margin-top: 20px;">Please login to your Admin Dashboard to view full details, photos, and payment proof.</p>
                        </div>
                    `
                };

                await transporter.sendMail(mailOptions);
                console.log("Notification email sent successfully.");
            } catch (emailErr) {
                console.error("Email notification error (non-fatal):", emailErr.message);
            }
        }

        res.status(201).json({ message: "Application submitted successfully!" });
    } catch (error) {
        console.error("Error submitting application:", error);
        res.status(500).json({ error: "Server Error", message: error.message || "Failed to process application." });
    }
});

// Get Applicants
app.get('/api/applicants', async (req, res) => {
    try {
        const isDbReady = mongoose.connection && mongoose.connection.readyState === 1;
        if (isDbReady) {
            const applicants = await Applicant.find().sort({ applyDate: -1 });
            return res.status(200).json(applicants);
        } else if (!isProduction) {
            return res.status(200).json(readLocalApplicants());
        } else {
            return res.status(500).json({ error: "Database Error", message: "Database unavailable." });
        }
    } catch (error) {
        console.error("Error fetching applicants:", error);
        res.status(500).json({ error: "Server Error", message: "Failed to fetch applicants." });
    }
});

// Delete All Applicants
app.delete('/api/applicants/clear/all', async (req, res) => {
    try {
        const isDbReady = mongoose.connection && mongoose.connection.readyState === 1;
        if (isDbReady) {
            await Applicant.deleteMany({});
            return res.status(200).json({ message: "All deleted!" });
        } else if (!isProduction) {
            writeLocalApplicants([]);
            return res.status(200).json({ message: "All deleted!" });
        } else {
            return res.status(500).json({ error: "Database Error", message: "Database unavailable." });
        }
    } catch (error) {
        console.error("Error clearing applicants:", error);
        res.status(500).json({ error: "Server Error", message: "Failed to clear applicants." });
    }
});

// Delete Single Applicant by ID
app.delete('/api/applicants/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const isDbReady = mongoose.connection && mongoose.connection.readyState === 1;
        if (isDbReady) {
            const deletedData = await Applicant.deleteOne({ _id: id });
            if (deletedData.deletedCount === 0) {
                return res.status(404).json({ message: "Application not found!" });
            }
            return res.status(200).json({ message: "Deleted!" });
        } else if (!isProduction) {
            let applicants = readLocalApplicants();
            const initialLength = applicants.length;
            applicants = applicants.filter(a => String(a._id) !== String(id));
            if (applicants.length === initialLength) {
                return res.status(404).json({ message: "Application not found!" });
            }
            writeLocalApplicants(applicants);
            return res.status(200).json({ message: "Deleted!" });
        } else {
            return res.status(500).json({ error: "Database Error", message: "Database unavailable." });
        }
    } catch (error) {
        console.error("Error deleting applicant:", error);
        res.status(500).json({ error: "Server Error", message: "Failed to delete applicant." });
    }
});

// Get Settings
app.get('/api/settings', async (req, res) => {
    try {
        const isDbReady = mongoose.connection && mongoose.connection.readyState === 1;
        if (isDbReady) {
            let settings = await Settings.findOne();
            if (!settings) {
                settings = await Settings.create({});
            }
            return res.status(200).json(settings);
        } else if (!isProduction) {
            return res.status(200).json(readLocalSettings());
        } else {
            return res.status(500).json({ error: "Database Error", message: "Database unavailable." });
        }
    } catch (error) {
        console.error("Error fetching settings:", error);
        res.status(500).json({ error: "Server Error", message: "Failed to fetch settings." });
    }
});

// Update Settings
app.post('/api/settings', async (req, res) => {
    try {
        const isDbReady = mongoose.connection && mongoose.connection.readyState === 1;
        if (isDbReady) {
            await Settings.deleteMany({});
            const newSettings = new Settings(req.body);
            await newSettings.save();
            return res.status(200).json({ message: "Settings Updated!" });
        } else if (!isProduction) {
            writeLocalSettings(req.body);
            return res.status(200).json({ message: "Settings Updated!" });
        } else {
            return res.status(500).json({ error: "Database Error", message: "Database unavailable." });
        }
    } catch (error) {
        console.error("Error updating settings:", error);
        res.status(500).json({ error: "Server Error", message: "Failed to update settings." });
    }
});

// ==========================================
// 5. Server Export & Port Listener
// ==========================================
const PORT = process.env.PORT || 5000;
if (!process.env.VERCEL) {
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}

module.exports = app;