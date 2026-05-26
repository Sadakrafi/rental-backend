const mongoose = require('mongoose');

const applicantSchema = new mongoose.Schema({
    firstName: { type: String, required: true }, lastName: { type: String, required: true },
    email: { type: String, required: true }, phone: { type: String, required: true },
    creditScore: { type: String }, moveInDate: { type: String }, // number এর বদলে string করে দেওয়া হলো, সেফটির জন্য
    gender: { type: String }, maritalStatus: { type: String },
    smoke: { type: String }, vehicle: { type: String },
    pets: { type: String }, petDetails: { type: String }, 
    profilePhoto: { type: String }, street: { type: String },
    city: { type: String }, state: { type: String }, zipCode: { type: String },
    felony: { type: String }, felonyDetails: { type: String },
    paymentType: { type: String }, paymentMethod: { type: String },
    paymentProof: { type: String }, 
    ipAddress: { type: String, default: "Tracking block/Error" }, // আইপি ডাটার ফিল্ড যুক্ত
    deviceInfo: { type: String, default: "Device Info Unavailable" }, // ডিভাইস ডাটা যুক্ত
    applyDate: { type: Date, default: Date.now }
}, { strict: false }); // ম্যাজিক কোড: যদি ফর্মে এমন কোনো ডাটা থাকে যা এই লিস্টে নেই, তাও যেন রিজেক্ট না হয়!

module.exports = mongoose.model('Applicant', applicantSchema);
