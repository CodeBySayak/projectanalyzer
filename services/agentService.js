const axios = require("axios");

const AI_API_URL = process.env.AI_API_URL || process.env.OPENAI_API_URL || "https://api.openai.com/v1/chat/completions";
const AI_API_KEY = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
const AI_MODEL = process.env.AI_MODEL || "gpt-4o-mini";

function scoreLabel(score) {
    if (score >= 8) return "strong";
    if (score >= 5) return "acceptable";
    return "weak";
}

function normalizeScores(scores) {
    return (scores || []).map(item => ({
        name: item.name,
        score: Number(item.score || 0),
        remarks: item.remarks || ""
    }));
}

function analyzeRepository(repoData = {}, scores = [], scrapeData = {}) {
    const normalizedScores = normalizeScores(scores);
    const average = normalizedScores.length
        ? normalizedScores.reduce((sum, item) => sum + item.score, 0) / normalizedScores.length
        : 0;

    return {
        repoName: repoData.name || "Unknown repository",
        owner: repoData.owner || "Unknown owner",
        overallHealth: Number(average.toFixed(1)),
        healthClass: scoreLabel(average),
        evidence: {
            stars: repoData.stars || 0,
            forks: repoData.forks || 0,
            contributors: repoData.contributorCount || 0,
            commits: repoData.commitCount || 0,
            pullRequests: repoData.prCount || 0,
            lastPush: repoData.pushedAt || null,
            languages: Object.keys(repoData.languages || {}),
            readme: scrapeData.readme || {},
            structure: scrapeData.structure || {}
        },
        scores: normalizedScores
    };
}

function identifyWeakAreas(analysis) {
    const weakScores = analysis.scores
        .filter(item => item.score < 6)
        .map(item => ({
            area: item.name,
            score: item.score,
            evidence: item.remarks
        }));

    const readme = analysis.evidence.readme || {};
    const structure = analysis.evidence.structure || {};

    if (!readme.exists) {
        weakScores.push({ area: "README", score: 1, evidence: "No visible README was found by the scraper." });
    } else {
        if (!readme.hasInstallation) weakScores.push({ area: "Installation Documentation", score: 4, evidence: "README does not clearly expose setup or installation guidance." });
        if (!readme.hasUsage) weakScores.push({ area: "Usage Documentation", score: 4, evidence: "README does not clearly expose usage examples or run instructions." });
    }

    if (!structure.hasTests) {
        weakScores.push({ area: "Testing Structure", score: 4, evidence: "No common root-level test directory was detected." });
    }

    return weakScores;
}

function generateRecommendations(weakAreas) {
    const templates = {
        README: "Add a README with project purpose, setup, usage, screenshots or examples, and maintenance notes.",
        "Installation Documentation": "Add a clear installation/setup section with exact commands and required environment variables.",
        "Usage Documentation": "Add a usage or getting-started section with a minimal working example.",
        "Testing Structure": "Add a test directory and document how contributors can run the test suite.",
        Documentation: "Improve public-facing documentation with setup, usage, feature, and license sections.",
        "README Quality": "Expand the README with structured headings, examples, and links to supporting docs.",
        "Folder Structure": "Group source, routes/services, tests, docs, and configuration files into predictable directories.",
        "Pull Requests": "Use pull requests for changes so review and integration history are visible.",
        Responsiveness: "Triage issues and keep recent maintenance activity visible through regular pushes or releases.",
        "Code Organization": "Add organization files such as .gitignore, license, dependency manifest, and lint configuration."
    };

    return weakAreas.map(area => ({
        issue: area.area,
        evidence: area.evidence,
        recommendation: templates[area.area] || `Improve ${area.area.toLowerCase()} using the evidence found during repository analysis.`
    }));
}

function prioritizeRecommendations(recommendations) {
    const priorityOrder = ["README", "Documentation", "README Quality", "Installation Documentation", "Usage Documentation", "Testing Structure"];

    return recommendations
        .map(item => {
            const index = priorityOrder.indexOf(item.issue);
            const priority = index >= 0 && index <= 2 ? "High" : index >= 0 ? "Medium" : "Low";
            return { priority, ...item };
        })
        .sort((a, b) => {
            const weight = { High: 0, Medium: 1, Low: 2 };
            return weight[a.priority] - weight[b.priority];
        })
        .slice(0, 6);
}

function buildLocalReview(analysis, weakAreas, recommendations) {
    const strongScores = analysis.scores.filter(item => item.score >= 8).map(item => item.name);
    const weakNames = weakAreas.map(item => item.area);

    return {
        provider: AI_API_KEY ? "local_fallback_after_ai_failure" : "local_agentic_fallback",
        summary: `${analysis.repoName} has ${analysis.healthClass} repository health with an evidence score of ${analysis.overallHealth}/10.`,
        strengths: strongScores.length ? strongScores.slice(0, 4) : ["Basic repository metadata was available for evaluation."],
        weaknesses: weakNames.length ? [...new Set(weakNames)].slice(0, 5) : ["No major weak area was detected from the selected evidence."],
        recommendations,
        finalVerdict: recommendations.length
            ? "The fastest improvement path is to address the high-priority documentation and structure gaps first."
            : "The repository appears healthy across the selected metrics; continue maintaining documentation, activity, and review practices."
    };
}

async function callAiReview(analysis, weakAreas, recommendations) {
    if (!AI_API_KEY) return null;

    const payload = {
        model: AI_MODEL,
        response_format: { type: "json_object" },
        messages: [
            {
                role: "system",
                content: "You are ProjectAnalyzer's repository review agent. Return compact JSON with summary, strengths, weaknesses, recommendations, and finalVerdict. Use only supplied evidence."
            },
            {
                role: "user",
                content: JSON.stringify({ analysis, weakAreas, recommendations })
            }
        ]
    };

    const response = await axios.post(AI_API_URL, payload, {
        timeout: 15000,
        headers: {
            Authorization: `Bearer ${AI_API_KEY}`,
            "Content-Type": "application/json"
        }
    });

    const content = response.data && response.data.choices && response.data.choices[0] &&
        response.data.choices[0].message && response.data.choices[0].message.content;

    if (!content) return null;
    return JSON.parse(content);
}

function generateFinalReview(analysis, weakAreas, recommendations, aiReview) {
    if (aiReview && typeof aiReview === "object") {
        return {
            provider: "configured_ai_provider",
            summary: aiReview.summary || "",
            strengths: Array.isArray(aiReview.strengths) ? aiReview.strengths : [],
            weaknesses: Array.isArray(aiReview.weaknesses) ? aiReview.weaknesses : [],
            recommendations: Array.isArray(aiReview.recommendations) ? aiReview.recommendations : recommendations,
            finalVerdict: aiReview.finalVerdict || ""
        };
    }

    return buildLocalReview(analysis, weakAreas, recommendations);
}

async function reviewRepository(repoData, scores, scrapeData) {
    const analysis = analyzeRepository(repoData, scores, scrapeData);
    const weakAreas = identifyWeakAreas(analysis);
    const recommendations = prioritizeRecommendations(generateRecommendations(weakAreas));

    try {
        const aiReview = await callAiReview(analysis, weakAreas, recommendations);
        return generateFinalReview(analysis, weakAreas, recommendations, aiReview);
    } catch (error) {
        return {
            ...generateFinalReview(analysis, weakAreas, recommendations, null),
            aiUnavailableReason: error.message
        };
    }
}

module.exports = {
    analyzeRepository,
    identifyWeakAreas,
    generateRecommendations,
    prioritizeRecommendations,
    generateFinalReview,
    reviewRepository
};
