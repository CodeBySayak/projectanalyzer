const express = require("express");
const router = express.Router();
const githubService = require("../services/githubService");
const scoreService = require("../services/scoreService");
const agentService = require("../services/agentService");
const requireAuth = require("../middleware/auth");
const Analysis = require("../models/Analysis");

// Renders the dashboard page
router.get("/dashboard", requireAuth, (req, res) => {
    res.render("dashboard", { activePage: "dashboard" });
});

// Handles the repository analysis request and renders results or errors
router.get("/result", requireAuth, async (req, res) => {
    const url = req.query.url;
    let selectedParams = req.query.params;

    try {
        if (req.query.id) {
            const savedAnalysis = await Analysis.findOne({
                _id: req.query.id,
                userId: req.session.userId
            }).lean();

            if (!savedAnalysis) {
                return res.render("error", { errorType: "not_found" });
            }

            return res.render("result", {
                repoName: savedAnalysis.repositoryName,
                repoOwner: savedAnalysis.owner,
                repoAvatar: "",
                overallScore: savedAnalysis.overallScore,
                parameters: savedAnalysis.individualScores,
                selectedParams: savedAnalysis.selectedParameters,
                scrapeData: null,
                agentReview: null
            });
        }

        // 1. Validate empty repository URL
        if (!url || !url.trim()) {
            return res.render("error", { errorType: "invalid_url" });
        }

        // 2. Normalize and validate parameter selection (must select at least one)
        if (!selectedParams) {
            selectedParams = [];
        } else if (!Array.isArray(selectedParams)) {
            selectedParams = [selectedParams];
        }

        if (selectedParams.length === 0) {
            return res.render("error", { errorType: "invalid_url" });
        }

        // 3. Validate and parse GitHub URL
        const { owner, repo } = githubService.parseGitHubUrl(url);

        // 4. Fetch data from GitHub API
        const repoData = await githubService.fetchRepositoryData(owner, repo);

        // 5. Check if scraperService is available and execute it
        let scrapeData = null;
        try {
            const scraperService = require("../services/scraperService");
            if (scraperService && typeof scraperService.scrapeRepository === "function") {
                scrapeData = await scraperService.scrapeRepository(owner, repo);
            }
        } catch (scrapErr) {
            console.warn("Scraper service is not yet implemented or failed:", scrapErr.message);
        }

        // 6. Combine repo data and scraper details to calculate scores
        const allParameters = scoreService.evaluateRepository(repoData, scrapeData);

        // 7. Calculate overall weighted/averaged score for ONLY selected parameters
        const overallScore = scoreService.calculateOverallScore(allParameters, selectedParams);

        // 8. Run the staged Agentic AI review. This is non-critical and must never block scoring.
        let agentReview = null;
        try {
            if (agentService && typeof agentService.reviewRepository === "function") {
                agentReview = await agentService.reviewRepository(repoData, allParameters, scrapeData);
            }
        } catch (agentErr) {
            console.warn("Agentic AI review skipped:", agentErr.message);
        }

        // 9. Save history entry for the logged-in user without blocking result rendering.
        try {
            if (Analysis && typeof Analysis.create === "function" && req.session && req.session.userId) {
                await Analysis.create({
                    userId: req.session.userId,
                    repositoryUrl: url,
                    repositoryName: repoData.name,
                    owner,
                    individualScores: allParameters,
                    selectedParameters: selectedParams,
                    overallScore
                });
            }
        } catch (dbErr) {
            // Keep integration minimal; if DB/auth is not fully ready, do not disrupt the render flow.
            console.warn("History integration hook skipped (DB model or user session inactive):", dbErr.message);
        }

        // 10. Render the results page with computed metrics
        return res.render("result", {
            repoName: repoData.name,
            repoOwner: repoData.owner,
            repoAvatar: repoData.avatarUrl,
            overallScore: overallScore,
            parameters: allParameters,
            selectedParams: selectedParams,
            scrapeData,
            agentReview
        });

    } catch (error) {
        console.error("Repository analysis pipeline failed:", error.message);

        // Map internal error states to pre-configured EJS error pages
        let errorType = "invalid_url";
        if (error.message === "invalid_url") {
            errorType = "invalid_url";
        } else if (error.message === "not_found") {
            errorType = "not_found";
        } else if (error.message === "rate_limit") {
            errorType = "rate_limit";
        } else if (error.message === "network_error") {
            errorType = "network_error";
        } else {
            // Check Axios status error properties if uncaught
            if (error.response) {
                if (error.response.status === 404) {
                    errorType = "not_found";
                } else if (error.response.status === 403 || error.response.status === 429) {
                    errorType = "rate_limit";
                } else {
                    errorType = "network_error";
                }
            } else if (error.request) {
                errorType = "network_error";
            }
        }

        return res.render("error", { errorType });
    }
});

module.exports = router;
