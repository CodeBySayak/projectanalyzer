const express = require("express");
const router = express.Router();
const githubService = require("../services/githubService");
const scoreService = require("../services/scoreService");

// Renders the dashboard page
router.get("/dashboard", (req, res) => {
    res.render("dashboard", { activePage: "dashboard" });
});

// Handles the repository analysis request and renders results or errors
router.get("/result", async (req, res) => {
    const url = req.query.url;
    let selectedParams = req.query.params;

    try {
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

        // 8. Integration hook: Save history entry if MongoDB Model and User Session exist
        try {
            const Analysis = require("../models/Analysis");
            if (Analysis && typeof Analysis.create === "function" && req.session && req.session.user) {
                await Analysis.create({
                    userId: req.session.user._id,
                    repoName: repoData.name,
                    repoOwner: repoData.owner,
                    repoUrl: url,
                    score: overallScore,
                    parameters: allParameters,
                    selectedParams: selectedParams,
                    date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
                });
            }
        } catch (dbErr) {
            // Keep integration minimal; if DB/auth is not fully ready, do not disrupt the render flow.
            console.warn("History integration hook skipped (DB model or user session inactive):", dbErr.message);
        }

        // 9. Render the results page with computed metrics
        return res.render("result", {
            repoName: repoData.name,
            repoOwner: repoData.owner,
            repoAvatar: repoData.avatarUrl,
            overallScore: overallScore,
            parameters: allParameters,
            selectedParams: selectedParams
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
