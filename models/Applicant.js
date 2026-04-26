const mongoose = require('mongoose');

const applicantSchema = new mongoose.Schema({
    firstName: { type: String, required: true }, lastName: { type: String, required: true },
    email: { type: String, required: true }, phone: { type: String, required: true },
    creditScore: { type: Number }, moveInDate: { type: String },
    gender: { type: String }, maritalStatus: { type: String },
    smoke: { type: String }, vehicle: { type: String },
    pets: { type: String }, petDetails: { type: String }, 
    profilePhoto: { type: String }, street: { type: String },
    city: { type: String }, state: { type: String }, zipCode: { type: String },
    felony: { type: String }, felonyDetails: { type: String },
    paymentType: { type: String }, paymentMethod: { type: String },
    paymentProof: { type: String }, applyDate: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Applicant', applicantSchema);