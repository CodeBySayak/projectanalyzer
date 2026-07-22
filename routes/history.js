const express = require("express");
const requireAuth = require("../middleware/auth");
const Analysis = require("../models/Analysis");

const router = express.Router();

router.get("/history", requireAuth, async (req, res) => {
    try {
        const analyses = await Analysis.find({ userId: req.session.userId })
            .sort({ analyzedAt: -1 })
            .lean();

        const history = analyses.map((analysis) => ({
            id: analysis._id.toString(),
            repoName: analysis.repositoryName,
            repoOwner: analysis.owner,
            repoUrl: analysis.repositoryUrl,
            score: analysis.overallScore,
            date: new Date(analysis.analyzedAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric"
            })
        }));

        return res.render("history", { activePage: "history", history });
    } catch (error) {
        console.error("History retrieval failed:", error.message);
        return res.status(500).render("error", { errorType: "network_error" });
    }
});

module.exports = router;
