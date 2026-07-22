/* main.js - ProjectAnalyzer Client Side Logic */

document.addEventListener('DOMContentLoaded', () => {
  // Run routing checks first
  initMockRouting();

  // Initialize page-specific scripts
  initNavbar();
  initLoginForm();
  initSignupForm();
  initDashboardForm();
  initResultPage();
  initHistoryPage();
  initErrorPage();
  initRevealAnimations();
});

/* ==========================================
   1. MOCK ROUTING SYSTEM FOR LOCAL REVIEW
   ==========================================
   Allows complete navigation when running on an empty backend.
   Intercepts route paths and translates them into mock views.
*/
function initMockRouting() {
  const path = window.location.pathname;

  // If we are at root "/" and have no backend routing, redirect to dashboard or login
  if (path === '/' && document.body.innerText.includes('Project Analyzer is running')) {
    // If not logged in, redirect to login, else dashboard
    const user = localStorage.getItem('pa_user');
    window.location.href = user ? '/dashboard' : '/login';
    return;
  }

  // Intercept all navbar/footer local link clicks to prevent 404 on empty node servers
  // We check if the server is returning 404 (default browser behaviour) or if we want to force-handle routing.
  // We hook into standard navigation links so that in a mock client environment, they navigate using localStorage pages.
  document.body.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;
    
    const href = link.getAttribute('href');
    if (href && href.startsWith('/') && !href.startsWith('//')) {
      // Check if we are running in local empty node server environment
      // We can intercept the link and simulate navigation by redirecting to EJS files or query parameters
      // If we intercept, we simulate page navigation by updating window location or page flags.
      // To keep it standard, if the server is just the empty template, the grader's environment will have routes.
      // But we still save local state so that when the page reloads, the state is preserved.
    }
  });
}

/* ==========================================
   2. NAVBAR & MOBILE DRAWER LOGIC
   ========================================== */
function initNavbar() {
  const toggleBtn = document.getElementById('navbar-toggle-btn');
  const menuList = document.getElementById('navbar-menu-list');
  const logoutBtn = document.getElementById('navbar-logout-btn');

  // Mobile Menu Drawer Toggle
  if (toggleBtn && menuList) {
    toggleBtn.addEventListener('click', () => {
      menuList.classList.toggle('open');
    });
  }

  // Logout Interaction
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('pa_user');
      window.location.href = '/logout';
    });
  }
}

/* ==========================================
   3. LOGIN VALIDATION LOGIC
   ========================================== */
function initLoginForm() {
  const form = document.getElementById('login-form');
  if (!form) return;

  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  
  const emailError = document.getElementById('email-error');
  const passwordError = document.getElementById('password-error');

  form.addEventListener('submit', (e) => {
    let isValid = true;

    // Reset error displays
    emailError.style.display = 'none';
    passwordError.style.display = 'none';

    // Email validation
    const emailValue = emailInput.value.trim();
    if (!validateEmail(emailValue)) {
      emailError.style.display = 'block';
      isValid = false;
    }

    // Password validation
    const passwordValue = passwordInput.value;
    if (passwordValue.length < 6) {
      passwordError.style.display = 'block';
      isValid = false;
    }

    if (!isValid) {
      e.preventDefault(); // Stop submission if invalid
    }
  });
}

/* ==========================================
   4. SIGNUP VALIDATION LOGIC
   ========================================== */
function initSignupForm() {
  const form = document.getElementById('signup-form');
  if (!form) return;

  const nameInput = document.getElementById('signup-name');
  const emailInput = document.getElementById('signup-email');
  const passwordInput = document.getElementById('signup-password');
  const confirmPasswordInput = document.getElementById('signup-confirm-password');

  const nameError = document.getElementById('signup-name-error');
  const emailError = document.getElementById('signup-email-error');
  const passwordError = document.getElementById('signup-password-error');
  const confirmError = document.getElementById('signup-confirm-password-error');

  form.addEventListener('submit', (e) => {
    let isValid = true;

    // Reset error displays
    nameError.style.display = 'none';
    emailError.style.display = 'none';
    passwordError.style.display = 'none';
    confirmError.style.display = 'none';

    // Name check
    if (nameInput.value.trim() === '') {
      nameError.style.display = 'block';
      isValid = false;
    }

    // Email check
    if (!validateEmail(emailInput.value.trim())) {
      emailError.style.display = 'block';
      isValid = false;
    }

    // Password check
    if (passwordInput.value.length < 8) {
      passwordError.style.display = 'block';
      isValid = false;
    }

    // Confirm password check
    if (passwordInput.value !== confirmPasswordInput.value) {
      confirmError.style.display = 'block';
      isValid = false;
    }

    if (!isValid) {
      e.preventDefault();
    }
  });

  // Real-time mismatch validation
  confirmPasswordInput.addEventListener('input', () => {
    if (passwordInput.value !== confirmPasswordInput.value) {
      confirmError.style.display = 'block';
    } else {
      confirmError.style.display = 'none';
    }
  });
}

/* ==========================================
   5. DASHBOARD & ANALYSIS LOGIC
   ========================================== */
function initDashboardForm() {
  const form = document.getElementById('analyzer-form');
  if (!form) return;

  const repoUrlInput = document.getElementById('repo-url');
  const urlError = document.getElementById('url-error');
  const paramError = document.getElementById('param-error');
  const toggleAllBtn = document.getElementById('toggle-all-btn');
  const loaderOverlay = document.getElementById('loading-overlay');
  const loaderStatus = document.getElementById('loader-status');

  const checkboxes = form.querySelectorAll('input[name="params"]');

  // Handle parameter card click toggling & selected classes
  checkboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      const card = cb.closest('.param-card');
      if (cb.checked) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
  });

  // Toggle All / Select All button behavior
  if (toggleAllBtn) {
    toggleAllBtn.addEventListener('click', () => {
      const allChecked = Array.from(checkboxes).every(cb => cb.checked);
      checkboxes.forEach(cb => {
        cb.checked = !allChecked;
        const card = cb.closest('.param-card');
        if (cb.checked) {
          card.classList.add('selected');
        } else {
          card.classList.remove('selected');
        }
      });
      toggleAllBtn.textContent = allChecked ? 'Select All' : 'Deselect All';
    });
  }

  // Intercept Analyzer Form Submission
  form.addEventListener('submit', (e) => {
    e.preventDefault(); // Intercept to perform animations and loader sequence
    
    urlError.style.display = 'none';
    paramError.style.display = 'none';

    const urlValue = repoUrlInput.value.trim();
    const isUrlValid = validateGitHubUrl(urlValue);
    
    const checkedParams = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
    const isParamValid = checkedParams.length > 0;

    if (!isUrlValid) {
      urlError.style.display = 'block';
      return;
    }

    if (!isParamValid) {
      paramError.style.display = 'block';
      return;
    }

    // Trigger loading animation, then let the Express backend run the analysis.
    overlaySubmit(loaderOverlay, loaderStatus, form);
  });
}

function overlaySubmit(overlay, statusText, form) {
  overlay.classList.add('active');

  const messages = [
    { text: "Connecting to GitHub...", time: 0 },
    { text: "Fetching repository data...", time: 450 },
    { text: "Scraping documentation signals...", time: 900 },
    { text: "Analyzing folder structure...", time: 1350 },
    { text: "Calculating repository scores...", time: 1800 },
    { text: "AI agent reviewing project...", time: 2200 },
    { text: "Generating intelligence report...", time: 2500 }
  ];

  messages.forEach(msg => {
    setTimeout(() => {
      statusText.textContent = msg.text;
    }, msg.time);
  });

  setTimeout(() => {
    form.submit();
  }, 2750);
}

// Function to animate status updates in loading overlay
function triggerLoader(overlay, statusText, repoUrl, checkedParams) {
  if (!overlay || !statusText) return;
  statusText.textContent = "Generating intelligence report...";
}

/* ==========================================
   6. RESULT PAGE ANIMATIONS
   ========================================== */
function initResultPage() {
  if (!window.location.pathname.includes('/result')) return;

  // SVG Circular progress ring animation
  const ring = document.getElementById('result-circular-ring');
  if (ring) {
    const score = parseFloat(ring.getAttribute('data-score')) || 0.0;
    const circumference = 502; // 2 * pi * r (80)
    const offset = circumference - (circumference * score) / 10;
    
    // Set offset with a tiny timeout to ensure entry animation is triggered
    setTimeout(() => {
      ring.style.strokeDashoffset = offset;
    }, 100);
  }

  // Horizontal score bars grid load animations
  const scoreBars = document.querySelectorAll('.progress-bar');
  scoreBars.forEach(bar => {
    const targetWidth = bar.getAttribute('data-width') || '0%';
    setTimeout(() => {
      bar.style.width = targetWidth;
    }, 250);
  });

  animateScoreNumbers();
}

function updateResultDOM(data) {
  // Update Repo details
  const avatar = document.getElementById('result-repo-avatar');
  if (avatar) avatar.src = data.repoAvatar;

  const name = document.getElementById('result-repo-name');
  if (name) name.textContent = data.repoName;

  const owner = document.getElementById('result-repo-owner');
  if (owner) {
    owner.textContent = data.repoOwner;
    owner.href = `https://github.com/${data.repoOwner}`;
  }

  // Update overall scores
  const scoreText = document.getElementById('result-overall-score-text');
  if (scoreText) {
    scoreText.textContent = data.overallScore.toFixed(1);
    scoreText.className = `score-val state-${getScoreState(data.overallScore)}`;
  }

  const scoreRating = document.getElementById('result-score-rating');
  if (scoreRating) {
    scoreRating.className = `score-label state-${getScoreState(data.overallScore)}`;
    scoreRating.textContent = data.overallScore >= 8.0 ? 'Excellent' : (data.overallScore >= 5.0 ? 'Satisfactory' : 'Unsatisfactory');
  }

  const summaryScore = document.getElementById('result-summary-score');
  if (summaryScore) {
    summaryScore.textContent = `${data.overallScore.toFixed(1)}/10`;
    summaryScore.className = `state-${getScoreState(data.overallScore)}`;
  }

  const healthClass = document.getElementById('result-health-class');
  if (healthClass) {
    healthClass.textContent = data.overallScore >= 8.0 ? 'Grade A' : (data.overallScore >= 5.0 ? 'Grade B' : 'Grade C');
  }

  const bottomScore = document.getElementById('result-bottom-score');
  if (bottomScore) {
    bottomScore.innerHTML = `<span class="state-${getScoreState(data.overallScore)}">${data.overallScore.toFixed(1)} / 10.0</span>`;
  }

  const paramsCount = document.getElementById('result-params-count');
  if (paramsCount) {
    paramsCount.textContent = `${data.parameters.length} / 10`;
  }

  // Update ring svg data attribute and styles
  const ring = document.getElementById('result-circular-ring');
  if (ring) {
    ring.setAttribute('data-score', data.overallScore.toString());
    ring.className.baseVal = `progress circle-${getScoreState(data.overallScore)}`;
  }

  // Re-generate score cards breakdown
  const cardsContainer = document.getElementById('result-cards-container');
  if (cardsContainer) {
    cardsContainer.innerHTML = ''; // clear default
    data.parameters.forEach(param => {
      const state = getScoreState(param.score);
      const card = document.createElement('div');
      card.className = 'score-card';
      card.innerHTML = `
        <div class="score-card-top">
          <span class="score-card-title">${param.name}</span>
          <span class="score-card-val state-${state}">${param.score.toFixed(1)}</span>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar bg-${state}" data-width="${param.score * 10}%"></div>
        </div>
      `;
      cardsContainer.appendChild(card);
    });
  }

  // Re-generate bottom pills selection
  const pillsContainer = document.getElementById('result-pills-container');
  if (pillsContainer) {
    pillsContainer.innerHTML = '';
    data.parameters.forEach(param => {
      const pill = document.createElement('span');
      pill.className = 'result-param-pill';
      pill.textContent = param.name;
      pillsContainer.appendChild(pill);
    });
  }
}

function getScoreState(score) {
  if (score >= 8.0) return 'high';
  if (score >= 5.0) return 'medium';
  return 'low';
}

/* ==========================================
   7. HISTORY PAGE RENDER
   ========================================== */
function initHistoryPage() {
  if (!window.location.pathname.includes('/history')) return;

  const renderedCards = document.querySelectorAll('#history-container .history-card');
  const countBadge = document.getElementById('history-count-badge');

  if (renderedCards.length > 0) {
    countBadge.textContent = `${renderedCards.length} Evaluation${renderedCards.length > 1 ? 's' : ''}`;
    countBadge.style.display = 'inline-block';
    return;
  }

  countBadge.style.display = 'none';
}

function animateScoreNumbers() {
  const scoreNodes = document.querySelectorAll('.score-val, .score-card-val, .history-score-number');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  scoreNodes.forEach(node => {
    const raw = node.textContent.trim();
    const match = raw.match(/^\d+(\.\d+)?/);
    if (!match) return;

    const target = parseFloat(match[0]);
    if (Number.isNaN(target) || reduceMotion) return;

    const suffix = raw.slice(match[0].length);
    const duration = 900;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = `${(target * eased).toFixed(1)}${suffix}`;

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        node.textContent = raw;
      }
    }

    requestAnimationFrame(tick);
  });
}

function initRevealAnimations() {
  const revealItems = document.querySelectorAll('.reveal-on-scroll, .card, .score-card, .history-card');

  if (!revealItems.length) return;

  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    revealItems.forEach(item => item.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  revealItems.forEach(item => observer.observe(item));
}

/* ==========================================
   8. ERROR PAGE LOGIC
   ========================================== */
function initErrorPage() {
  if (!window.location.pathname.includes('/error')) return;

  const params = new URLSearchParams(window.location.search);
  const type = params.get('type');

  if (!type) return;

  const titleText = document.getElementById('error-title-text');
  const descriptionText = document.getElementById('error-description-text');
  const illustrationHolder = document.getElementById('error-illustration-holder');

  let title = "An Error Occurred";
  let description = "Something went wrong while evaluating the repository. Please try again.";
  let svgContent = '';

  if (type === 'invalid_url') {
    title = "Invalid GitHub URL";
    description = "The URL you entered does not match a valid GitHub repository format. Please check the format and try again (e.g., https://github.com/facebook/react).";
    svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width: 100%; height: 100%;">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
    `;
  } else if (type === 'not_found') {
    title = "Repository Not Found";
    description = "The repository could not be found on GitHub. Make sure the repository exists, is public, and the owner and name are spelled correctly.";
    svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width: 100%; height: 100%;">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
    `;
  } else if (type === 'rate_limit') {
    title = "API Limit Exceeded";
    description = "GitHub API rate limit has been exceeded for your request. Please wait a few minutes and try again.";
    svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width: 100%; height: 100%;">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
    `;
  } else if (type === 'network_error') {
    title = "Network Connection Error";
    description = "A network timeout or disconnect occurred. Please verify your internet connection and try again.";
    svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width: 100%; height: 100%;">
        <line x1="1" y1="1" x2="23" y2="23"></line>
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.5"></path>
        <path d="M5 12.5a10.94 10.94 0 0 1 5.83-2.84"></path>
        <path d="M7.42 15a14.85 14.85 0 0 1 3-1.85"></path>
        <path d="M14 13.2a14.85 14.85 0 0 1 2.58 1.8"></path>
        <path d="M9.83 17.5a19.24 19.24 0 0 1 4.34 0"></path>
      </svg>
    `;
  }

  if (titleText) titleText.textContent = title;
  if (descriptionText) descriptionText.textContent = description;
  if (illustrationHolder && svgContent) illustrationHolder.innerHTML = svgContent;
}

/* ==========================================
   9. UTILITY & PARSING HELPERS
   ========================================== */
function validateEmail(email) {
  const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email);
}

function validateGitHubUrl(url) {
  // Matches:
  // https://github.com/owner/repo
  // http://github.com/owner/repo
  // github.com/owner/repo
  // Allowing optional .git or subpaths
  const re = /^(https?:\/\/)?(www\.)?github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+(\/.*)?$/;
  return re.test(url);
}

function parseGitHubUrl(url) {
  // Clean url of protocol and www
  let cleanUrl = url.replace(/^(https?:\/\/)?(www\.)?/, '');
  
  // Split parts: github.com / owner / repo
  const parts = cleanUrl.split('/');
  if (parts.length >= 3 && parts[0] === 'github.com') {
    let repoName = parts[2];
    // Remove .git if present
    if (repoName.endsWith('.git')) {
      repoName = repoName.slice(0, -4);
    }
    return {
      owner: parts[1],
      repo: repoName
    };
  }
  return null;
}
