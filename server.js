const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer'); // ইমেইল সিস্টেম
require('dotenv').config();

const Applicant = require('./models/Applicant');
const Settings = require('./models/Settings');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB Connected Successfully!"))
    .catch((error) => console.log("Database connection failed!", error));

// ইমেইলের পিয়ন সেটআপ (The Ultimate Connection Fix)
const transporter = nodemailer.createTransport({
    service: 'gmail', // সরাসরি গুগল সার্ভিস ব্যবহার করবে
    host: 'smtp.gmail.com',
    port: 587, // 465 কাজ না করলে 587 সবসময় কাজ করে (Secure TLS)
    secure: false, // 587 এর জন্য এটা false রাখতে হয়
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS ? process.env.EMAIL_PASS.replace(/\s+/g, '') : ''
    },
    tls: {
        rejectUnauthorized: false
    },
    connectionTimeout: 10000, // ম্যাজিক: গুগল দরজা খুলতে দেরি করলে সার্ভার যেন রাগ করে ফিরে না আসে, তার জন্য ১০ সেকেন্ড সময় দিয়েছি!
    greetingTimeout: 10000,
    socketTimeout: 10000
});

// ১. ফর্ম রিসিভ এবং ইমেইল পাঠানোর রাস্তা
app.post('/api/apply', async (req, res) => {
    try {
        const newApplicant = new Applicant(req.body);
        await newApplicant.save();

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER, 
            subject: '🎉 New Rental Application Received!',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; background: #f8fafc; border-radius: 8px;">
                    <h2 style="color: #1e40af;">New Application Alert!</h2>
                    <p>Someone just submitted a new rental application on your website.</p>
                    <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1;">
                        <p><strong>Name:</strong> ${req.body.firstName || 'N/A'} ${req.body.lastName || ''}</p>
                        <p><strong>Email:</strong> ${req.body.email || 'N/A'}</p>
                        <p><strong>Phone:</strong> ${req.body.phone || 'N/A'}</p>
                        <p><strong>Payment Method:</strong> ${req.body.paymentMethod || 'N/A'}</p>
                    </div>
                    <p style="margin-top: 20px;">Please login to your Admin Dashboard to view full details.</p>
                </div>
            `
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log("Email error (Did not send): ", error);
            } else {
                console.log('✅ Email sent magically! Response: ' + info.response);
            }
        });

        // ইমেইল যাক বা না যাক, আমরা ক্লায়েন্টকে ২ সেকেন্ডে 'Success' বলে দেবো!
        res.status(201).json({ message: "Success!" });
    } catch (error) { 
        console.log(error);
        res.status(500).json({ message: "Server Error!" }); 
    }
});

        res.status(201).json({ message: "Success!" });
    } catch (error) { res.status(500).json({ message: "Server Error!" }); }
});

app.get('/api/applicants', async (req, res) => {
    try {
        const applicants = await Applicant.find().sort({ applyDate: -1 });
        res.status(200).json(applicants);
    } catch (error) { res.status(500).json({ message: "Server Error!" }); }
});

app.delete('/api/applicants/clear/all', async (req, res) => {
    try {
        await Applicant.deleteMany({});
        res.status(200).json({ message: "All deleted!" });
    } catch (error) { res.status(500).json({ message: "Server Error!" }); }
});

app.delete('/api/applicants/:id', async (req, res) => {
    try {
        await Applicant.deleteOne({ _id: req.params.id });
        res.status(200).json({ message: "Deleted!" });
    } catch (error) { res.status(500).json({ message: "Server Error!" }); }
});

app.get('/api/settings', async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) settings = await Settings.create({});
        res.status(200).json(settings);
    } catch (error) { res.status(500).json({ message: "Server Error!" }); }
});

app.post('/api/settings', async (req, res) => {
    try {
        await Settings.deleteMany({}); 
        const newSettings = new Settings(req.body);
        await newSettings.save();
        res.status(200).json({ message: "Settings Updated!" });
    } catch (error) { res.status(500).json({ message: "Server Error!" }); }
});

app.get('/', (req, res) => { res.send('Rental Application API is running!'); });

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
