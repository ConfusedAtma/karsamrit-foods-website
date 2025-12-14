const axios = require("axios");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const crypto = require("crypto");

const Order = require("./models/order");

dotenv.config({
    path: __dirname + "/.env",
    override: true
});
console.log("DEBUG ADMIN ENV:", {
    ADMIN_USERNAME: process.env.ADMIN_USERNAME,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    MAX_ADMIN_SESSIONS: process.env.MAX_ADMIN_SESSIONS
});


const app = express();

// --- CONFIG ---
const MAX_ADMIN_SESSIONS = parseInt(process.env.MAX_ADMIN_SESSIONS || "2", 10);
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "changeme";

// In-memory session store: token -> { username, createdAt }
const activeAdminSessions = new Map();

// Middlewares
app.use(cors());
app.use(express.json());

// MongoDB connect
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB connected"))
    .catch(err => console.error("MongoDB error:", err));

// --- UTILS ---
function generateToken() {
    return crypto.randomBytes(24).toString("hex");
}

// Simple username validation: only letters & digits
function isValidAdminUsername(username) {
    return /^[a-zA-Z0-9]+$/.test(username);
}

// Middleware to protect admin routes
function requireAdmin(req, res, next) {
    const token = req.headers["x-admin-token"];

    if (!token) {
        return res.status(401).json({ error: "Missing admin token" });
    }

    const session = activeAdminSessions.get(token);
    if (!session) {
        return res.status(401).json({ error: "Invalid or expired admin session" });
    }

    // (optionally add expiry logic later)
    req.adminUser = session.username;
    next();
}

// --- HEALTH CHECK ---
app.get("/", (req, res) => {
    res.json({ ok: true, message: "Karsamrit backend with MongoDB running" });
});

// --- ADMIN AUTH ROUTES ---

// Login
app.post("/api/admin/login", (req, res) => {
    const { username, password } = req.body || {};

    console.log("LOGIN ATTEMPT:");
    console.log("  from client:", { username, password });
    console.log("  env:", {
        ADMIN_USERNAME,
        ADMIN_PASSWORD_LEN: ADMIN_PASSWORD ? ADMIN_PASSWORD.length : null
    });

    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
    }

    if (!isValidAdminUsername(username)) {
        return res.status(400).json({
            error: "Invalid username format. Only letters and digits are allowed."
        });
    }

    // Check credentials
    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: "Invalid credentials" });
    }

    // Enforce concurrent session limit
    if (activeAdminSessions.size >= MAX_ADMIN_SESSIONS) {
        return res.status(429).json({
            error: "Admin user limit exceeded. Please try again later."
        });
    }

    const token = generateToken();
    activeAdminSessions.set(token, {
        username,
        createdAt: new Date()
    });

    return res.json({
        success: true,
        token,
        maxSessions: MAX_ADMIN_SESSIONS
    });
});

// Logout
app.post("/api/admin/logout", (req, res) => {
    const token = req.headers["x-admin-token"] || (req.body && req.body.token);

    if (token && activeAdminSessions.has(token)) {
        activeAdminSessions.delete(token);
    }

    return res.json({ success: true });
});

// Check current session (optional)
app.get("/api/admin/session", (req, res) => {
    const token = req.headers["x-admin-token"];
    if (!token || !activeAdminSessions.has(token)) {
        return res.status(401).json({ active: false });
    }

    const session = activeAdminSessions.get(token);
    return res.json({
        active: true,
        username: session.username,
        createdAt: session.createdAt,
        maxSessions: MAX_ADMIN_SESSIONS
    });
});

// --- ORDER ROUTES ---

// Create order (customer side)
app.post("/api/orders", async (req, res) => {
    try {
        const {
            name,
            phone,
            email,
            address,
            items,
            itemsTotal,
            shipping,
            grandTotal,
            paymentMethod
        } = req.body;

        if (!name || !phone || !address || !items || !items.length) {
            return res
                .status(400)
                .json({ error: "Missing required fields or empty cart" });
        }

        // Random 2–5 days from now
        let estimatedDelivery = new Date();
        const daysToAdd = Math.floor(Math.random() * 4) + 2; // 2,3,4,5
        estimatedDelivery.setDate(estimatedDelivery.getDate() + daysToAdd);

        const order = await Order.create({
            name,
            phone,
            email,
            address,
            items,
            itemsTotal,
            shipping,
            grandTotal,
            paymentMethod: paymentMethod || "COD",
            paymentStatus: "pending",
            estimatedDelivery
        });

        res.status(201).json({
            success: true,
            orderId: order._id,
            estimatedDelivery: order.estimatedDelivery,
            order: {
                items: order.items,
                itemsTotal: order.itemsTotal,
                shipping: order.shipping,
                grandTotal: order.grandTotal,
                address: order.address
            },
            message: "Order created successfully"
        });
    } catch (err) {
        console.error("Error creating order:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Get all orders (ADMIN ONLY)
app.get("/api/admin/orders", requireAdmin, async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 });
        res.json(orders);
    } catch (err) {
        console.error("Error fetching orders:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Update order status (ADMIN ONLY)
app.patch("/api/admin/orders/:id/status", requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body || {};

    const allowed = ["placed", "packed", "shipped", "delivered"];
    if (!status || !allowed.includes(status)) {
        return res.status(400).json({ error: "Invalid status value" });
    }

    try {
        const order = await Order.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        );

        if (!order) {
            return res.status(404).json({ error: "Order not found" });
        }

        return res.json({
            success: true,
            order
        });
    } catch (err) {
        console.error("Error updating order status:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});


// (If you still want the old /api/orders GET open, keep this, else remove it)
// app.get("/api/orders", async (req, res) => {
//     try {
//         const orders = await Order.find().sort({ createdAt: -1 });
//         res.json(orders);
//     } catch (err) {
//         console.error("Error fetching orders:", err);
//         res.status(500).json({ error: "Internal server error" });
//     }
// });

// --- PINCODE LOOKUP ---
app.get("/api/pincode/:pin", async (req, res) => {
    const { pin } = req.params;

    if (!/^\d{6}$/.test(pin)) {
        return res.status(400).json({ error: "Invalid pincode" });
    }

    try {
        const response = await axios.get(`https://api.postalpincode.in/pincode/${pin}`);
        const data = response.data && response.data[0];

        if (!data || data.Status !== "Success" || !data.PostOffice || !data.PostOffice.length) {
            return res.status(404).json({ error: "Pincode not found" });
        }

        const po = data.PostOffice[0];

        res.json({
            city: po.District,
            state: po.State,
            postOffice: po.Name
        });
    } catch (err) {
        console.error("Pincode lookup error:", err.message);
        res.status(500).json({ error: "Failed to lookup pincode" });
    }
});

// --- START SERVER ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log("Server listening on port", PORT);
});
