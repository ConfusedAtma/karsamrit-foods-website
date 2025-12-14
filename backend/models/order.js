const mongoose = require("mongoose");

// Each item in an order
const itemSchema = new mongoose.Schema(
    {
        productId: { type: Number },
        title: { type: String, required: true },
        qty: { type: Number, required: true },
        unitPrice: { type: Number, required: true },
        lineTotal: { type: Number, required: true }
    },
    { _id: false }
);

// Address structure
const addressSchema = new mongoose.Schema(
    {
        house: String,
        street: String,
        area: String,
        city: String,
        state: String,
        pincode: String
    },
    { _id: false }
);

const orderSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        email: { type: String },

        address: {
            type: addressSchema,
            required: true
        },

        items: {
            type: [itemSchema],
            required: true
        },

        itemsTotal: { type: Number, required: true },
        shipping: { type: Number, required: true },
        grandTotal: { type: Number, required: true },

        paymentMethod: { type: String, default: "COD" },
        paymentStatus: { type: String, default: "pending" },

        // NEW: fulfilment status
        status: {
            type: String,
            enum: ["placed", "packed", "shipped", "delivered"],
            default: "placed"
        },

        estimatedDelivery: { type: Date }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Order", orderSchema);
