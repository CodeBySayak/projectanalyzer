/**
 * Reusable scoring engine service for ProjectAnalyzer.
 * Calculates deterministic, understandable scores (out of 10) for 10 distinct evaluation parameters.
 */

/**
 * Calculates Documentation score.
 * Based on description, wiki availability, github pages, and README size.
 */
function getDocumentationScore(repoData, scrapeData) {
    let score = 2.0; // Baseline score
    const details = [];

    if (repoData.description) {
        score += 2.0;
        details.push("description present");
    }
    if (repoData.hasWiki) {
        score += 2.0;
        details.push("wiki enabled");
    }
    if (repoData.hasPages) {
        score += 2.0;
        details.push("pages deployed");
    }
    
    const readmeLen = repoData.readmeText ? repoData.readmeText.length : 0;
    if (readmeLen > 0) {
        score += 2.0;
        details.push("README file present");
    }

    // Integrate optional scraper data if available
    if (scrapeData && scrapeData.documentationScoreBonus) {
        score += scrapeData.documentationScoreBonus;
        details.push("scraper documentation verification");
    }

    score = Math.min(10.0, score);
    const remarks = details.length > 0
        ? `Found ${details.join(", ")}. Documentation foundations are healthy.`
        : "Minimal repository documentation is available.";

    return {
        name: "Documentation",
        score: Number(score.toFixed(1)),
        maxScore: 10,
        remarks
    };
}

/**
 * Calculates Commits per Contributor score.
 * Evaluates development activity spread across contributors.
 */
function getCommitsPerContributorScore(repoData) {
    const commits = repoData.commitCount || 0;
    const contributors = repoData.contributorCount || 0;

    if (contributors === 0) {
        return {
            name: "Commits per Contributor",
            score: 1.0,
            maxScore: 10,
            remarks: "No contributors found. Unable to calculate density."
        };
    }

    const ratio = commits / contributors;
    let score = 1.0;
    let remarks = "";

    if (ratio >= 100) {
        score = 10.0;
        remarks = `Exceptional iteration density with ${ratio.toFixed(1)} commits per contributor. Highly collaborative and active repository.`;
    } else if (ratio >= 50) {
        score = 9.0;
        remarks = `Strong iteration density with ${ratio.toFixed(1)} commits per contributor, indicating significant developer involvement.`;
    } else if (ratio >= 20) {
        score = 8.0;
        remarks = `Healthy contribution velocity of ${ratio.toFixed(1)} commits per contributor. Codebase is updated regularly.`;
    } else if (ratio >= 10) {
        score = 6.5;
        remarks = `Moderate contribution velocity of ${ratio.toFixed(1)} commits per contributor. Core work is steady.`;
    } else if (ratio >= 5) {
        score = 5.0;
        remarks = `Lower-tier velocity of ${ratio.toFixed(1)} commits per contributor. Individual efforts might be sparse.`;
    } else if (ratio >= 1) {
        score = 3.0;
        remarks = `Very low velocity of ${ratio.toFixed(1)} commits per contributor. Development is inactive or flat.`;
    } else {
        score = 1.0;
        remarks = `Extremely sparse code history with only ${ratio.toFixed(1)} commits per contributor.`;
    }

    return {
        name: "Commits per Contributor",
        score,
        maxScore: 10,
        remarks
    };
}

/**
 * Calculates Total Contributors score.
 * Measures size and diversity of development team.
 */
function getTotalContributorsScore(repoData) {
    const count = repoData.contributorCount || 0;
    let score = 1.0;
    let remarks = "";

    if (count >= 50) {
        score = 10.0;
        remarks = `Outstanding community footprint with ${count} contributors. Very low single-developer risk.`;
    } else if (count >= 20) {
        score = 9.0;
        remarks = `Vibrant developer community with ${count} contributors supporting the project.`;
    } else if (count >= 10) {
        score = 8.0;
        remarks = `Healthy team size of ${count} contributors. Solid shared ownership.`;
    } else if (count >= 5) {
        score = 7.0;
        remarks = `Active crew of ${count} contributors. Suitable for small to medium projects.`;
    } else if (count >= 3) {
        score = 5.5;
        remarks = `Small group of ${count} core contributors. High dependency on key individuals.`;
    } else if (count === 2) {
        score = 4.0;
        remarks = "Dual-contributor project. Relies on closely coordinated pair development.";
    } else if (count === 1) {
        score = 2.5;
        remarks = "Single developer project. High bus-factor and single point of maintenance.";
    } else {
        score = 1.0;
        remarks = "No contributors registered. Codebase has not been populated by active accounts.";
    }

    return {
        name: "Total Contributors",
        score,
        maxScore: 10,
        remarks
    };
}

/**
 * Calculates Stars score.
 * Popularity/user-validation scoring on a stepped scale.
 */
function getStarsScore(repoData) {
    const count = repoData.stars || 0;
    let score = 1.0;
    let remarks = "";

    if (count >= 10000) {
        score = 10.0;
        remarks = `Top-tier industry validation with ${count.toLocaleString()} stars. Widely adopted.`;
    } else if (count >= 5000) {
        score = 9.5;
        remarks = `Exceptional validation with ${count.toLocaleString()} stars. High market presence.`;
    } else if (count >= 1000) {
        score = 9.0;
        remarks = `Very popular utility with ${count.toLocaleString()} stars from open-source developers.`;
    } else if (count >= 500) {
        score = 8.5;
        remarks = `Solid popular interest with ${count.toLocaleString()} stars. Frequently referenced.`;
    } else if (count >= 100) {
        score = 7.5;
        remarks = `Well-regarded project with ${count} stars. Possesses an established userbase.`;
    } else if (count >= 50) {
        score = 6.5;
        remarks = `Decent validation with ${count} stars. Standard for growing projects.`;
    } else if (count >= 10) {
        score = 5.0;
        remarks = `Fledgling validation with ${count} stars. Initial community reach is emerging.`;
    } else if (count >= 1) {
        score = 3.0;
        remarks = `Minimal validation with ${count} star(s) logged by early users.`;
    } else {
        score = 1.0;
        remarks = "No stars. Project has not gained community visibility yet.";
    }

    return {
        name: "Stars",
        score,
        maxScore: 10,
        remarks
    };
}

/**
 * Calculates Forks score.
 * Measures level of community extension, branching, and ecosystem building.
 */
function getForksScore(repoData) {
    const count = repoData.forks || 0;
    let score = 1.0;
    let remarks = "";

    if (count >= 2000) {
        score = 10.0;
        remarks = `Vast community extension with ${count.toLocaleString()} forks. Heavily integrated.`;
    } else if (count >= 500) {
        score = 9.0;
        remarks = `High-level ecosystem footprint with ${count.toLocaleString()} forks for independent modifications.`;
    } else if (count >= 100) {
        score = 8.0;
        remarks = `Active development sharing with ${count.toLocaleString()} forks from external developers.`;
    } else if (count >= 50) {
        score = 7.0;
        remarks = `Healthy development interest with ${count} forks. Common source codebase.`;
    } else if (count >= 10) {
        score = 5.5;
        remarks = `Modest community activity with ${count} forks. Some custom variations present.`;
    } else if (count >= 1) {
        score = 3.5;
        remarks = `Early branching with ${count} fork(s) created by interested developers.`;
    } else {
        score = 1.0;
        remarks = "No forks created. Development is contained within the primary repository.";
    }

    return {
        name: "Forks",
        score,
        maxScore: 10,
        remarks
    };
}

/**
 * Calculates Pull Requests score.
 * Measures code integration pipelines and developer review frequency.
 */
function getPullRequestsScore(repoData) {
    const count = repoData.prCount || 0;
    let score = 1.0;
    let remarks = "";

    if (count >= 500) {
        score = 10.0;
        remarks = `Robust open source integration pipeline with ${count.toLocaleString()} total PRs.`;
    } else if (count >= 100) {
        score = 9.0;
        remarks = `Very active PR registry with ${count} pull requests, indicating disciplined review cycles.`;
    } else if (count >= 50) {
        score = 8.0;
        remarks = `Steady integration cycles with ${count} pull requests. Standard collaborative workflow.`;
    } else if (count >= 20) {
        score = 7.0;
        remarks = `Structured code contribution flow with ${count} pull requests.`;
    } else if (count >= 5) {
        score = 5.0;
        remarks = `Limited contribution pipeline of ${count} pull requests. Most changes pushed directly.`;
    } else if (count >= 1) {
        score = 3.0;
        remarks = `Minimal pull request history (${count}). Low structured review.`;
    } else {
        score = 1.0;
        remarks = "No pull requests submitted. Lacks collaborative contribution history.";
    }

    return {
        name: "Pull Requests",
        score,
        maxScore: 10,
        remarks
    };
}

/**
 * Calculates Folder Structure score.
 * Evaluates repository organization by inspecting the root contents.
 */
function getFolderStructureScore(repoData) {
    let score = 1.0;
    const structuresFound = [];
    const contents = repoData.rootContents || [];

    // Helper to find root item by name (case-insensitive)
    const hasRootItem = (name, isDir = true) => {
        return contents.some(item => 
            item.name.toLowerCase() === name.toLowerCase() && 
            (isDir ? item.type === "dir" : item.type === "file")
        );
    };

    // Check for source folder
    const hasSource = hasRootItem("src") || hasRootItem("lib") || hasRootItem("app") || hasRootItem("source");
    if (hasSource) {
        score += 3.0;
        structuresFound.push("source directory (e.g. src/lib)");
    }

    // Check for test folder
    const hasTest = hasRootItem("test") || hasRootItem("tests") || hasRootItem("spec") || hasRootItem("specs") || hasRootItem("__tests__");
    if (hasTest) {
        score += 3.0;
        structuresFound.push("testing directory (e.g. test)");
    }

    // Check for documentation folder
    const hasDocs = hasRootItem("docs") || hasRootItem("doc") || hasRootItem("website");
    if (hasDocs) {
        score += 2.0;
        structuresFound.push("documentation directory (e.g. docs)");
    }

    // Check for root configurations (indicating managed project)
    const configs = ["package.json", "pom.xml", "go.mod", "cargo.toml", "requirements.txt", "gemfile", "makefile", "webpack.config.js", "tsconfig.json"];
    const hasConfig = contents.some(item => item.type === "file" && configs.includes(item.name.toLowerCase()));
    if (hasConfig) {
        score += 1.0;
        structuresFound.push("project configuration file");
    }

    score = Math.min(10.0, score);
    const remarks = structuresFound.length > 0
        ? `Found ${structuresFound.join(", ")}. Well-arranged workspace.`
        : "Flat repository structure without distinct directories for source, tests, or docs.";

    return {
        name: "Folder Structure",
        score: Number(score.toFixed(1)),
        maxScore: 10,
        remarks
    };
}

/**
 * Calculates README Quality score.
 * Measures content depth and section coverage.
 */
function getReadmeQualityScore(repoData) {
    const text = repoData.readmeText || "";
    if (!text) {
        return {
            name: "README Quality",
            score: 1.0,
            maxScore: 10,
            remarks: "README is missing or completely empty. Hard to understand setup."
        };
    }

    let score = 1.0;
    const sectionsFound = [];
    const len = text.length;

    // Length check
    if (len > 5000) {
        score += 3.0;
    } else if (len > 2000) {
        score += 2.0;
    } else if (len > 500) {
        score += 1.0;
    }

    // Section keyword presence check (case-insensitive)
    const hasKeyword = (keywords) => keywords.some(k => text.toLowerCase().includes(k.toLowerCase()));

    if (hasKeyword(["install", "setup", "npm i", "pip install", "bundle install"])) {
        score += 1.5;
        sectionsFound.push("Installation");
    }
    if (hasKeyword(["usage", "how to run", "getting started", "run locally"])) {
        score += 1.5;
        sectionsFound.push("Usage");
    }
    if (hasKeyword(["feature", "screenshot", "demo", "capabilities"])) {
        score += 1.5;
        sectionsFound.push("Features");
    }
    if (hasKeyword(["license", "copyright", "mit license", "apache license"])) {
        score += 1.5;
        sectionsFound.push("License");
    }

    score = Math.min(10.0, score);
    const remarks = sectionsFound.length > 0
        ? `README size is ${len.toLocaleString()} chars. Documented sections: ${sectionsFound.join(", ")}.`
        : `README size is ${len.toLocaleString()} chars, but lacks standard setup sections.`;

    return {
        name: "README Quality",
        score: Number(score.toFixed(1)),
        maxScore: 10,
        remarks
    };
}

/**
 * Calculates Responsiveness score.
 * Gauges responsiveness by comparing open issues with stars and frequency of recent pushes.
 */
function getResponsivenessScore(repoData) {
    const openIssues = repoData.openIssues || 0;
    const stars = repoData.stars || 0;
    let score = 1.0;
    const details = [];

    // 1. Recency of pushed code
    if (repoData.pushedAt) {
        const timeDiff = Date.now() - new Date(repoData.pushedAt).getTime();
        const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

        if (daysDiff <= 7) {
            score += 5.0;
            details.push("active code pushes (last 7 days)");
        } else if (daysDiff <= 30) {
            score += 4.0;
            details.push("steady code updates (last 30 days)");
        } else if (daysDiff <= 90) {
            score += 3.0;
            details.push("updates within past quarter");
        } else if (daysDiff <= 180) {
            score += 2.0;
            details.push("updates within past 6 months");
        } else {
            score += 1.0;
            details.push("stale project (no pushes in 6+ months)");
        }
    } else {
        score += 1.0;
        details.push("no push timestamp recorded");
    }

    // 2. Open issues ratio
    if (stars === 0) {
        if (openIssues <= 5) {
            score += 4.0;
            details.push("low issues queue");
        } else if (openIssues <= 20) {
            score += 3.0;
            details.push("moderate issues queue");
        } else {
            score += 1.0;
            details.push("unresolved backlog");
        }
    } else {
        const ratio = openIssues / stars;
        if (ratio <= 0.01) {
            score += 4.0;
            details.push("exceedingly low backlog ratio");
        } else if (ratio <= 0.05) {
            score += 3.5;
            details.push("healthy backlog ratio");
        } else if (ratio <= 0.10) {
            score += 3.0;
            details.push("acceptable backlog ratio");
        } else if (ratio <= 0.25) {
            score += 2.0;
            details.push("increasing issues backlog");
        } else {
            score += 1.0;
            details.push("high issues backlog ratio");
        }
    }

    score = Math.min(10.0, score);
    const remarks = `Activity status: ${details.join(", ")}. Issues are monitored appropriately.`;

    return {
        name: "Responsiveness",
        score: Number(score.toFixed(1)),
        maxScore: 10,
        remarks
    };
}

/**
 * Calculates Code Organization score.
 * Checks configurations, ignores, styling lint files, and licenses.
 */
function getCodeOrganizationScore(repoData) {
    let score = 1.0;
    const configsFound = [];
    const contents = repoData.rootContents || [];

    const hasRootFile = (name) => {
        return contents.some(item => item.name.toLowerCase() === name.toLowerCase() && item.type === "file");
    };

    // Check for gitignore
    if (hasRootFile(".gitignore")) {
        score += 2.0;
        configsFound.push(".gitignore");
    }

    // Check for lint configurations
    const lints = [".eslintrc", ".eslintrc.json", ".eslintrc.js", ".prettierrc", "eslint.config.js", ".editorconfig", "tslint.json"];
    const hasLint = contents.some(item => item.type === "file" && lints.includes(item.name.toLowerCase()));
    if (hasLint) {
        score += 3.0;
        configsFound.push("linter configuration");
    }

    // Check for license
    const licenseNames = ["license", "licence", "license.md", "licence.md", "copying"];
    const hasLicense = contents.some(item => item.type === "file" && licenseNames.includes(item.name.toLowerCase()));
    if (hasLicense) {
        score += 2.0;
        configsFound.push("LICENSE");
    }

    // Check for package or dependencies file
    const dependencies = ["package.json", "cargo.toml", "requirements.txt", "gemfile", "go.mod", "pom.xml", "build.gradle"];
    const hasDependencies = contents.some(item => item.type === "file" && dependencies.includes(item.name.toLowerCase()));
    if (hasDependencies) {
        score += 2.0;
        configsFound.push("dependency manifest");
    }

    score = Math.min(10.0, score);
    const remarks = configsFound.length > 0
        ? `Found organizational tokens: ${configsFound.join(", ")}.`
        : "Lacks core organization tokens like configurations, code stylers, or licenses.";

    return {
        name: "Code Organization",
        score: Number(score.toFixed(1)),
        maxScore: 10,
        remarks
    };
}

/**
 * Runs evaluation on all 10 distinct metrics.
 * @param {Object} repoData - Sanitized repository info.
 * @param {Object} [scrapeData] - Scraping info if available.
 * @returns {Array<Object>} List of evaluated scores.
 */
function evaluateRepository(repoData, scrapeData = null) {
    return [
        getDocumentationScore(repoData, scrapeData),
        getCommitsPerContributorScore(repoData),
        getTotalContributorsScore(repoData),
        getStarsScore(repoData),
        getForksScore(repoData),
        getPullRequestsScore(repoData),
        getFolderStructureScore(repoData),
        getReadmeQualityScore(repoData),
        getResponsivenessScore(repoData),
        getCodeOrganizationScore(repoData)
    ];
}

/**
 * Calculates overall weighted average score of ONLY selected parameters.
 * Throws error if no parameters selected or match.
 * @param {Array<Object>} parameters - Full evaluated metrics.
 * @param {Array<string>} selectedParamNames - User-selected metric names.
 * @returns {number} Average score out of 10.
 */
function calculateOverallScore(parameters, selectedParamNames) {
    if (!selectedParamNames || selectedParamNames.length === 0) {
        throw new Error("At least one parameter must be selected.");
    }

    const activeParams = parameters.filter(p => selectedParamNames.includes(p.name));
    if (activeParams.length === 0) {
        throw new Error("Selected parameters do not match any available parameters.");
    }

    const total = activeParams.reduce((sum, p) => sum + p.score, 0);
    const average = total / activeParams.length;
    return Number(average.toFixed(1));
}

module.exports = {
    evaluateRepository,
    calculateOverallScore
};
