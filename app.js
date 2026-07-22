const express = require("express");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Set EJS view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Static files
app.use(express.static(path.join(__dirname, "public")));

// Body parsers
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Connect to database if implemented
try {
    const connectDB = require("./config/db");
    if (typeof connectDB === "function") {
        connectDB();
    }
} catch (err) {
    console.warn("Could not load database configuration:", err.message);
}

// Routes configuration
const analysisRoutes = require("./routes/analysis");
if (analysisRoutes && (typeof analysisRoutes === "function" || analysisRoutes.stack || Object.getPrototypeOf(analysisRoutes) === express.Router)) {
    app.use("/", analysisRoutes);
}

// Gracefully handle auth routes if they are implemented
try {
    const authRoutes = require("./routes/auth");
    if (authRoutes && (typeof authRoutes === "function" || authRoutes.stack || Object.getPrototypeOf(authRoutes) === express.Router)) {
        app.use("/", authRoutes);
    }
} catch (err) {
    console.warn("Could not load auth routes:", err.message);
}

// Gracefully handle history routes if they are implemented
try {
    const historyRoutes = require("./routes/history");
    if (historyRoutes && (typeof historyRoutes === "function" || historyRoutes.stack || Object.getPrototypeOf(historyRoutes) === express.Router)) {
        app.use("/", historyRoutes);
    }
} catch (err) {
    console.warn("Could not load history routes:", err.message);
}

// Redirect root to dashboard
app.get("/", (req, res) => {
    res.redirect("/dashboard");
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;