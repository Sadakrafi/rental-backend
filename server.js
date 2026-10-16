const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Applicant = require('./models/Applicant');
const Settings = require('./models/Settings');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Default fallback settings
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

// Local JSON Storage setup for offline / localhost testing
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

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
    fs.writeFileSync(APPLICANTS_FILE, JSON.stringify(data, null, 2), 'utf-8');
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
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

let isMongoConnected = false;

if (process.env.MONGO_URI) {
    console.log("Connecting to MongoDB Atlas...");
    mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 4000 })
        .then(() => {
            isMongoConnected = true;
            console.log("MongoDB Atlas Connected Successfully!");
        })
        .catch((error) => {
            isMongoConnected = false;
            console.log("MongoDB Atlas connection unavailable:", error.message);
            console.log("Using Local Storage for localhost testing.");
        });
} else {
    console.log("No MONGO_URI specified. Using Local Storage.");
}

// ইমেইল পাঠানোর সেটআপ
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// ==========================================
// ১. ফর্ম রিসিভ এবং ইমেইল পাঠানোর রাস্তা
// ==========================================
app.post('/api/apply', async (req, res) => {
    try {
        // Run Mongoose schema validation to ensure clean data
        const applicantDoc = new Applicant(req.body);
        const validationError = applicantDoc.validateSync();
        if (validationError) {
            console.error("Validation error:", validationError);
            return res.status(400).json({ message: "Validation error: " + validationError.message });
        }

        if (isMongoConnected) {
            await applicantDoc.save();
        } else {
            const applicants = readLocalApplicants();
            const newRecord = {
                ...req.body,
                _id: 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                applyDate: new Date()
            };
            applicants.unshift(newRecord);
            writeLocalApplicants(applicants);
            console.log("Applicant saved to local storage:", newRecord.firstName, newRecord.lastName);
        }

        // ডাটা সেভ হওয়ার পর অ্যাডমিনকে ইমেইল পাঠাবে (if configured)
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: process.env.EMAIL_USER,
                subject: '🎉 New Rental Application Received!',
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; background: #f8fafc; border-radius: 8px;">
                        <h2 style="color: #1e40af;">New Application Alert!</h2>
                        <p>Someone just submitted a new rental application on your website.</p>
                        <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1;">
                            <p><strong>Name:</strong> ${req.body.firstName} ${req.body.lastName}</p>
                            <p><strong>Email:</strong> ${req.body.email}</p>
                            <p><strong>Phone:</strong> ${req.body.phone}</p>
                            <p><strong>Payment Method:</strong> ${req.body.paymentMethod}</p>
                        </div>
                        <p style="margin-top: 20px;">Please login to your Admin Dashboard to view full details, photos, and payment proof.</p>
                    </div>
                `
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) console.log("Email error: ", error);
                else console.log('Email sent: ' + info.response);
            });
        }

        res.status(201).json({ message: "Application submitted successfully!" });
    } catch (error) {
        console.error("Error saving data:", error);
        res.status(500).json({ message: "Server Error!" });
    }
});

// ==========================================
// ২. ড্যাশবোর্ড এবং অ্যাপ্লিকেন্ট ম্যানেজমেন্ট
// ==========================================
app.get('/api/applicants', async (req, res) => {
    try {
        if (isMongoConnected) {
            const applicants = await Applicant.find().sort({ applyDate: -1 });
            res.status(200).json(applicants);
        } else {
            const applicants = readLocalApplicants();
            res.status(200).json(applicants);
        }
    } catch (error) {
        console.error("Error fetching applicants:", error);
        res.status(500).json({ message: "Server Error!" });
    }
});

app.delete('/api/applicants/clear/all', async (req, res) => {
    try {
        if (isMongoConnected) {
            await Applicant.deleteMany({});
        } else {
            writeLocalApplicants([]);
        }
        res.status(200).json({ message: "All deleted!" });
    } catch (error) {
        res.status(500).json({ message: "Server Error!" });
    }
});

app.delete('/api/applicants/:id', async (req, res) => {
    try {
        const id = req.params.id;
        if (isMongoConnected) {
            const deletedData = await Applicant.deleteOne({ _id: id });
            if (deletedData.deletedCount === 0) {
                return res.status(404).json({ message: "Application not found!" });
            }
        } else {
            let applicants = readLocalApplicants();
            const initialLength = applicants.length;
            applicants = applicants.filter(a => String(a._id) !== String(id));
            if (applicants.length === initialLength) {
                return res.status(404).json({ message: "Application not found!" });
            }
            writeLocalApplicants(applicants);
        }
        res.status(200).json({ message: "Deleted!" });
    } catch (error) {
        res.status(500).json({ message: "Server Error!" });
    }
});

app.get('/api/settings', async (req, res) => {
    try {
        if (isMongoConnected) {
            let settings = await Settings.findOne();
            if (!settings) settings = await Settings.create({});
            res.status(200).json(settings);
        } else {
            res.status(200).json(readLocalSettings());
        }
    } catch (error) {
        res.status(500).json({ message: "Server Error!" });
    }
});

app.post('/api/settings', async (req, res) => {
    try {
        if (isMongoConnected) {
            await Settings.deleteMany({}); 
            const newSettings = new Settings(req.body);
            await newSettings.save();
        } else {
            writeLocalSettings(req.body);
        }
        res.status(200).json({ message: "Settings Updated!" });
    } catch (error) {
        res.status(500).json({ message: "Server Error!" });
    }
});

app.get('/', (req, res) => {
    res.send('Rental Application API is running!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));