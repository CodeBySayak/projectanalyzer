const express = require("express");
const User = require("../models/User");

const router = express.Router();

router.get("/login", (req, res) => {
    if (req.session && req.session.userId) {
        return res.redirect("/dashboard");
    }

    return res.render("login", { activePage: "login" });
});

router.get("/signup", (req, res) => {
    if (req.session && req.session.userId) {
        return res.redirect("/dashboard");
    }

    return res.render("signup", { activePage: "signup" });
});

router.post("/signup", async (req, res) => {
    const { name, email, password, confirmPassword } = req.body;

    try {
        if (!name || !email || !password || !confirmPassword) {
            return res.status(400).render("signup", { activePage: "signup", error: "All fields are required." });
        }

        if (password.length < 8) {
            return res.status(400).render("signup", { activePage: "signup", error: "Password must be at least 8 characters." });
        }

        if (password !== confirmPassword) {
            return res.status(400).render("signup", { activePage: "signup", error: "Passwords do not match." });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const existingUser = await User.findOne({ email: normalizedEmail });

        if (existingUser) {
            return res.status(409).render("signup", { activePage: "signup", error: "An account with this email already exists." });
        }

        await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password
        });

        return res.redirect("/login");
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).render("signup", { activePage: "signup", error: "An account with this email already exists." });
        }

        console.error("Signup failed:", error.message);
        return res.status(500).render("signup", { activePage: "signup", error: "Signup failed. Please try again." });
    }
});

router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        if (!email || !password) {
            return res.status(400).render("login", { activePage: "login", error: "Email and password are required." });
        }

        const user = await User.findOne({ email: email.trim().toLowerCase() });
        const isValidPassword = user ? await user.comparePassword(password) : false;

        if (!user || !isValidPassword) {
            return res.status(401).render("login", { activePage: "login", error: "Invalid email or password." });
        }

        req.session.userId = user._id.toString();
        return req.session.save((error) => {
            if (error) {
                console.error("Session save failed:", error.message);
                return res.status(500).render("login", { activePage: "login", error: "Login failed. Please try again." });
            }

            return res.redirect("/dashboard");
        });
    } catch (error) {
        console.error("Login failed:", error.message);
        return res.status(500).render("login", { activePage: "login", error: "Login failed. Please try again." });
    }
});

router.get("/logout", (req, res) => {
    if (!req.session) {
        return res.redirect("/login");
    }

    return req.session.destroy((error) => {
        if (error) {
            console.error("Logout failed:", error.message);
        }

        res.clearCookie("connect.sid");
        return res.redirect("/login");
    });
});

router.post("/logout", (req, res) => {
    if (!req.session) {
        return res.redirect("/login");
    }

    return req.session.destroy((error) => {
        if (error) {
            console.error("Logout failed:", error.message);
        }

        res.clearCookie("connect.sid");
        return res.redirect("/login");
    });
});

module.exports = router;
