const axios = require("axios");
const cheerio = require("cheerio");

const GITHUB_BASE_URL = "https://github.com";

const scraperClient = axios.create({
    timeout: 12000,
    headers: {
        "User-Agent": "ProjectAnalyzer/1.0 educational repository scraper",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
});

function createFallback(owner, repo, reason = "not_scraped") {
    return {
        ok: false,
        owner,
        repo,
        repositoryUrl: `${GITHUB_BASE_URL}/${owner}/${repo}`,
        reason,
        documentationScoreBonus: 0,
        readme: {
            exists: false,
            visible: false,
            characterCount: 0,
            headings: 0,
            links: 0,
            images: 0,
            codeBlocks: 0,
            lists: 0,
            hasInstallation: false,
            hasUsage: false,
            hasContributing: false,
            hasLicense: false,
            detectedSections: []
        },
        structure: {
            files: [],
            directories: [],
            hasSourceDirectory: false,
            hasTests: false,
            hasDocumentation: false,
            hasConfigFile: false,
            hasLicenseFile: false,
            hasGitignore: false
        },
        documentationSignals: {
            readmeDepth: "missing",
            setupGuidance: false,
            usageGuidance: false,
            contributionGuidance: false,
            mediaRichness: false,
            linkedReferences: false
        }
    };
}

function isValidOwnerRepo(owner, repo) {
    return /^[a-z0-9_-]+$/i.test(owner || "") && /^[a-z0-9_.-]+$/i.test(repo || "");
}

function includesAny(text, keywords) {
    const normalized = (text || "").toLowerCase();
    return keywords.some(keyword => normalized.includes(keyword));
}

function extractReadme($) {
    const readmeRoot = $("#readme, article.markdown-body").first();
    const readmeText = readmeRoot.text().replace(/\s+/g, " ").trim();
    const headings = readmeRoot.find("h1, h2, h3, h4, h5, h6").length;
    const links = readmeRoot.find("a[href]").length;
    const images = readmeRoot.find("img").length;
    const codeBlocks = readmeRoot.find("pre, div.highlight, code").length;
    const lists = readmeRoot.find("ul, ol").length;
    const headingText = readmeRoot.find("h1, h2, h3, h4, h5, h6")
        .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
        .get()
        .filter(Boolean);

    const hasInstallation = includesAny(readmeText, ["installation", "install", "setup", "getting started", "npm install", "pip install"]);
    const hasUsage = includesAny(readmeText, ["usage", "how to use", "example", "run locally", "quick start"]);
    const hasContributing = includesAny(readmeText, ["contributing", "contribution", "pull request", "code of conduct"]);
    const hasLicense = includesAny(readmeText, ["license", "licence", "mit", "apache", "gpl"]);

    return {
        exists: readmeRoot.length > 0 && readmeText.length > 0,
        visible: readmeRoot.length > 0,
        characterCount: readmeText.length,
        headings,
        links,
        images,
        codeBlocks,
        lists,
        hasInstallation,
        hasUsage,
        hasContributing,
        hasLicense,
        detectedSections: headingText.slice(0, 12)
    };
}

function extractStructure($) {
    const names = new Map();

    $("[aria-labelledby='folders-and-files'] a[href], div[role='rowheader'] a[href], tr.js-navigation-item a.js-navigation-open, a.Link--primary[href]").each((_, el) => {
        const name = $(el).text().replace(/\s+/g, " ").trim();
        if (!name || name === ".." || name.length > 120) return;

        const href = $(el).attr("href") || "";
        if (href.includes("/tree/")) {
            names.set(name, "dir");
        } else if (href.includes("/blob/")) {
            names.set(name, "file");
        }
    });

    const files = [];
    const directories = [];
    names.forEach((type, name) => {
        if (type === "dir") directories.push(name);
        if (type === "file") files.push(name);
    });

    const lowerFiles = files.map(name => name.toLowerCase());
    const lowerDirs = directories.map(name => name.toLowerCase());
    const hasDir = options => options.some(name => lowerDirs.includes(name));
    const hasFile = options => options.some(name => lowerFiles.includes(name));

    return {
        files,
        directories,
        hasSourceDirectory: hasDir(["src", "lib", "app", "source"]),
        hasTests: hasDir(["test", "tests", "spec", "specs", "__tests__"]),
        hasDocumentation: hasDir(["docs", "doc", "documentation", "website"]) || hasFile(["readme.md", "readme"]),
        hasConfigFile: hasFile(["package.json", "requirements.txt", "go.mod", "cargo.toml", "pom.xml", "gemfile", "makefile"]),
        hasLicenseFile: hasFile(["license", "license.md", "licence", "licence.md", "copying"]),
        hasGitignore: hasFile([".gitignore"])
    };
}

function calculateDocumentationBonus(readme) {
    if (!readme.exists) return 0;
    let bonus = 0.5;
    if (readme.characterCount >= 1200) bonus += 0.5;
    if (readme.headings >= 3) bonus += 0.4;
    if (readme.links > 0) bonus += 0.2;
    if (readme.hasInstallation) bonus += 0.4;
    if (readme.hasUsage) bonus += 0.4;
    if (readme.hasContributing) bonus += 0.2;
    return Number(Math.min(2, bonus).toFixed(1));
}

async function scrapeRepository(owner, repo) {
    if (!isValidOwnerRepo(owner, repo)) {
        return createFallback(owner, repo, "invalid_owner_or_repo");
    }

    const repositoryUrl = `${GITHUB_BASE_URL}/${owner}/${repo}`;

    try {
        const response = await scraperClient.get(repositoryUrl);
        const $ = cheerio.load(response.data);

        const isRepositoryPage = $("meta[name='octolytics-dimension-repository_id']").length > 0 ||
            $(`a[href='/${owner}/${repo}']`).length > 0 ||
            $("strong[itemprop='name'] a").text().trim().toLowerCase() === repo.toLowerCase();

        if (!isRepositoryPage) {
            return createFallback(owner, repo, "unexpected_github_page");
        }

        const readme = extractReadme($);
        const structure = extractStructure($);
        const hasReadmeFile = structure.files.some(file => /^readme(\.|$)/i.test(file));

        if (!readme.exists && hasReadmeFile) {
            readme.exists = true;
        }

        return {
            ok: true,
            owner,
            repo,
            repositoryUrl,
            scrapedAt: new Date().toISOString(),
            documentationScoreBonus: calculateDocumentationBonus(readme),
            readme,
            structure,
            documentationSignals: {
                readmeDepth: readme.characterCount >= 3000 ? "strong" : readme.characterCount >= 800 ? "moderate" : readme.exists ? "thin" : "missing",
                setupGuidance: readme.hasInstallation,
                usageGuidance: readme.hasUsage,
                contributionGuidance: readme.hasContributing,
                mediaRichness: readme.images > 0 || readme.codeBlocks > 2,
                linkedReferences: readme.links > 0
            }
        };
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return createFallback(owner, repo, "not_found");
        }
        if (error.code === "ECONNABORTED") {
            return createFallback(owner, repo, "timeout");
        }
        return createFallback(owner, repo, "network_or_selector_error");
    }
}

module.exports = {
    scrapeRepository
};
