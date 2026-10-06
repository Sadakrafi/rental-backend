const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    applicationFee: { type: Number, default: 80 }, securityDeposit: { type: Number, default: 1000 },
    zelleEmail: { type: String, default: "pay@dhproperties.com" }, zelleInfo: { type: String, default: "pay@dhproperties.com" }, zelleQR: { type: String, default: "" },
    chimeTag: { type: String, default: "$DHProperties" }, chimeQR: { type: String, default: "" },
    cashAppTag: { type: String, default: "$DHRentals" }, cashAppQR: { type: String, default: "" },
    venmoTag: { type: String, default: "@DHProperties" }, venmoQR: { type: String, default: "" },
    applePayInfo: { type: String, default: "+1234567890" }, applePayQR: { type: String, default: "" },
    bankDetails: { type: String, default: "Chase Bank, A/C: 123456789, Routing: 987654321" },
    isZelleActive: { type: Boolean, default: true }, isChimeActive: { type: Boolean, default: true },
    isCashAppActive: { type: Boolean, default: true }, isBankActive: { type: Boolean, default: true },
    isVenmoActive: { type: Boolean, default: true }, isApplePayActive: { type: Boolean, default: true }
});

module.exports = mongoose.model('Settings', settingsSchema);