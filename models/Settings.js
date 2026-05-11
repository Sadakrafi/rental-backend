const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    applicationFee: { type: Number, default: 80 },
    securityDeposit: { type: Number, default: 1000 },
    
    zelleInfo: { type: String, default: "123-456-7890" }, // Email বা Number যা খুশি দেওয়া যাবে
    zelleQR: { type: String, default: "" },
    
    chimeTag: { type: String, default: "$DHProperties" },
    chimeQR: { type: String, default: "" },
    
    cashAppTag: { type: String, default: "$DHRentals" },
    cashAppQR: { type: String, default: "" },
    
    venmoTag: { type: String, default: "@DH-Properties" },
    venmoQR: { type: String, default: "" },
    
    applePayInfo: { type: String, default: "123-456-7890" },
    applePayQR: { type: String, default: "" },
    
    bankDetails: { type: String, default: "Chase Bank, A/C: 123456789, Routing: 987654321" },
    
    isZelleActive: { type: Boolean, default: true },
    isChimeActive: { type: Boolean, default: true },
    isCashAppActive: { type: Boolean, default: true },
    isVenmoActive: { type: Boolean, default: true },
    isApplePayActive: { type: Boolean, default: true },
    isBankActive: { type: Boolean, default: true }
});

module.exports = mongoose.model('Settings', settingsSchema);
