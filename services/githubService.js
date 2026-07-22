const axios = require("axios");

// Read GitHub Token from environment variables
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GITHUB_API_TOKEN;

// Create standard axios client configured for GitHub API
const githubClient = axios.create({
    baseURL: "https://api.github.com",
    headers: {
        Accept: "application/vnd.github.v3+json",
        ...(GITHUB_TOKEN && { Authorization: `token ${GITHUB_TOKEN}` })
    },
    timeout: 15000 // 15 seconds timeout
});

/**
 * Parses a GitHub repository URL and extracts the owner and repository name.
 * Throws an Error with message 'invalid_url' if the URL is invalid.
 * @param {string} urlStr - The repository URL.
 * @returns {{owner: string, repo: string}} The extracted owner and repository name.
 */
function parseGitHubUrl(urlStr) {
    if (!urlStr || typeof urlStr !== "string") {
        throw new Error("invalid_url");
    }
    
    let url = urlStr.trim();
    if (!/^https?:\/\//i.test(url)) {
        url = "https://" + url;
    }

    try {
        const parsed = new URL(url);
        
        // Hostname must be github.com (or www.github.com)
        if (!/^(www\.)?github\.com$/i.test(parsed.hostname)) {
            throw new Error("invalid_url");
        }

        // Pathname should be /owner/repo/...
        const parts = parsed.pathname.split("/").filter(Boolean);
        if (parts.length < 2) {
            throw new Error("invalid_url");
        }

        const owner = parts[0];
        let repo = parts[1];

        // Trim .git suffix from repository name if present
        if (repo.endsWith(".git")) {
            repo = repo.slice(0, -4);
        }

        // Validate characters of owner and repo to prevent malicious strings
        if (!/^[a-z0-9_-]+$/i.test(owner) || !/^[a-z0-9_.-]+$/i.test(repo)) {
            throw new Error("invalid_url");
        }

        // Check for reserved words at root path
        const reserved = ["features", "marketplace", "pricing", "explore", "topics", "trending", "notifications", "login", "join", "about", "contact", "search"];
        if (reserved.includes(owner.toLowerCase())) {
            throw new Error("invalid_url");
        }

        return { owner, repo };
    } catch (e) {
        throw new Error("invalid_url");
    }
}

/**
 * Extracts total pages count from a GitHub paginated response Link header.
 * @param {string} linkHeader - The Link header string.
 * @returns {number} The total count of entries.
 */
function getCountFromLinkHeader(linkHeader) {
    if (!linkHeader) return 1;
    const match = linkHeader.match(/&page=(\d+)>;\s*rel="last"/);
    if (match) {
        return parseInt(match[1], 10);
    }
    return 1;
}

/**
 * Fetches all necessary repository data from the GitHub API.
 * Maps GitHub errors to deterministic system errors (e.g. 'not_found', 'rate_limit', 'network_error').
 * @param {string} owner - The owner name.
 * @param {string} repo - The repository name.
 * @returns {Promise<Object>} The compiled repository details.
 */
async function fetchRepositoryData(owner, repo) {
    try {
        // Essential call: Fetch main repo info (fails if repo is private/inaccessible or doesn't exist)
        let repoResponse;
        try {
            repoResponse = await githubClient.get(`/repos/${owner}/${repo}`);
        } catch (err) {
            if (err.response) {
                if (err.response.status === 404) {
                    throw new Error("not_found");
                }
                if (err.response.status === 403 || err.response.status === 429) {
                    throw new Error("rate_limit");
                }
            }
            throw new Error("network_error");
        }

        const data = repoResponse.data;

        // Parallel/secondary calls (non-critical, wrapped in individual try-catches to ensure high resilience)
        const [
            languagesRes,
            readmeRes,
            commitsRes,
            pullsRes,
            contributorsRes,
            contentsRes
        ] = await Promise.allSettled([
            githubClient.get(`/repos/${owner}/${repo}/languages`),
            githubClient.get(`/repos/${owner}/${repo}/readme`),
            githubClient.get(`/repos/${owner}/${repo}/commits?per_page=1`),
            githubClient.get(`/repos/${owner}/${repo}/pulls?state=all&per_page=1`),
            githubClient.get(`/repos/${owner}/${repo}/contributors?per_page=1`),
            githubClient.get(`/repos/${owner}/${repo}/contents`)
        ]);

        // 1. Languages
        const languages = languagesRes.status === "fulfilled" ? languagesRes.value.data : {};

        // 2. README Text content
        let readmeText = "";
        if (readmeRes.status === "fulfilled" && readmeRes.value.data && readmeRes.value.data.content) {
            readmeText = Buffer.from(readmeRes.value.data.content, "base64").toString("utf8");
        }

        // 3. Commit statistics & latest commit
        let commitCount = 0;
        let latestCommit = null;
        if (commitsRes.status === "fulfilled" && commitsRes.value.data && commitsRes.value.data.length > 0) {
            const firstCommit = commitsRes.value.data[0];
            latestCommit = {
                message: firstCommit.commit.message,
                date: firstCommit.commit.committer ? firstCommit.commit.committer.date : firstCommit.commit.author.date,
                author: firstCommit.commit.author ? firstCommit.commit.author.name : "Unknown"
            };
            const linkHeader = commitsRes.value.headers.link;
            commitCount = getCountFromLinkHeader(linkHeader);
        }

        // 4. Pull Requests
        let prCount = 0;
        if (pullsRes.status === "fulfilled" && pullsRes.value.data && pullsRes.value.data.length > 0) {
            const linkHeader = pullsRes.value.headers.link;
            prCount = getCountFromLinkHeader(linkHeader);
        }

        // 5. Contributors
        let contributorCount = 0;
        if (contributorsRes.status === "fulfilled" && contributorsRes.value.data && contributorsRes.value.data.length > 0) {
            const linkHeader = contributorsRes.value.headers.link;
            contributorCount = getCountFromLinkHeader(linkHeader);
        }

        // 6. Folder structure / root files list
        const rootContents = contentsRes.status === "fulfilled" ? (contentsRes.value.data || []) : [];

        // Return clean sanitized object mapping all metrics
        return {
            name: data.name,
            owner: data.owner ? data.owner.login : owner,
            avatarUrl: data.owner ? data.owner.avatar_url : "",
            description: data.description || "",
            stars: data.stargazers_count || 0,
            forks: data.forks_count || 0,
            openIssues: data.open_issues_count || 0,
            watchers: data.subscribers_count !== undefined ? data.subscribers_count : (data.watchers_count || 0),
            defaultBranch: data.default_branch || "main",
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            pushedAt: data.pushed_at,
            hasWiki: data.has_wiki || false,
            hasPages: data.has_pages || false,
            languages,
            readmeText,
            commitCount,
            latestCommit,
            prCount,
            contributorCount,
            rootContents
        };
    } catch (err) {
        // Pass system errors through
        if (["not_found", "rate_limit", "network_error"].includes(err.message)) {
            throw err;
        }
        
        // Handle axios specific details
        if (err.response) {
            if (err.response.status === 404) throw new Error("not_found");
            if (err.response.status === 403 || err.response.status === 429) throw new Error("rate_limit");
        }
        throw new Error("network_error");
    }
}

module.exports = {
    parseGitHubUrl,
    fetchRepositoryData
};
