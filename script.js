document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const patInput = document.getElementById('pat-input');
    const savePatButton = document.getElementById('save-pat');
    const addPrForm = document.getElementById('add-pr-form');
    const prUrlInput = document.getElementById('pr-url-input');
    const dashboard = document.getElementById('dashboard');

    // --- PAT Management ---
    patInput.value = localStorage.getItem('github_pat') || '';
    
    savePatButton.addEventListener('click', () => {
        localStorage.setItem('github_pat', patInput.value);
        alert('Token saved! Refreshing dashboard...');
        renderDashboard();
    });

    // --- PR Management ---
    addPrForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const prUrl = prUrlInput.value.trim();
        if (prUrl) {
            addPrToList(prUrl);
            prUrlInput.value = '';
        }
    });

    function addPrToList(url) {
        let prs = JSON.parse(localStorage.getItem('prs')) || [];
        if (!prs.includes(url)) {
            prs.push(url);
            localStorage.setItem('prs', JSON.stringify(prs));
            renderDashboard();
        } else {
            alert('This PR is already on the dashboard.');
        }
    }

    function removePrFromList(url) {
        let prs = JSON.parse(localStorage.getItem('prs')) || [];
        prs = prs.filter(pr => pr !== url);
        localStorage.setItem('prs', JSON.stringify(prs));
        renderDashboard();
    }
    
    // --- API & Rendering ---
    
    async function renderDashboard() {
        dashboard.innerHTML = 'Loading...';
        const prs = JSON.parse(localStorage.getItem('prs')) || [];
        if (prs.length === 0) {
            dashboard.innerHTML = 'Add a PR URL to get started.';
            return;
        }

        dashboard.innerHTML = '';
        const prPromises = prs.map(url => fetchPrData(url));
        const prDataArray = await Promise.all(prPromises);

        for (const prData of prDataArray) {
            if (prData) {
                const prCard = createPrCard(prData);
                dashboard.appendChild(prCard);
            }
        }
    }
    
    async function fetchPrData(url) {
        const pat = localStorage.getItem('github_pat');
        if (!pat) {
            dashboard.innerHTML = 'Please save your GitHub Personal Access Token first.';
            return null;
        }
        
        const prRegex = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/;
        const match = url.match(prRegex);

        if (!match) {
            console.error('Invalid PR URL:', url);
            return { title: `Invalid PR URL`, url, checks: [] };
        }

        const [, owner, repo, pull_number] = match;
        const fetchOptions = {
            headers: { 'Authorization': `token ${pat}` },
            cache: 'no-store'
        };

        try {
            const prApiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${pull_number}`;
            const prResponse = await fetch(prApiUrl, fetchOptions);
            if (!prResponse.ok) throw new Error(`Failed to fetch PR data: ${prResponse.statusText}`);
            const prData = await prResponse.json();
            const headSha = prData.head.sha;

            const checkRunsUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${headSha}/check-runs`;
            const statusesUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${headSha}/statuses`;

            const [checkRunsResponse, statusesResponse] = await Promise.all([
                fetch(checkRunsUrl, fetchOptions),
                fetch(statusesUrl, fetchOptions)
            ]);

            const checkRunsData = await checkRunsResponse.json();
            const statusesData = await statusesResponse.json();
            
            const combinedChecks = new Map();
            
            // ⭐ --- THE FIX: The order of these blocks is now swapped --- ⭐

            // 1. Process Statuses API FIRST to build the baseline list
            if (Array.isArray(statusesData)) {
                statusesData.forEach(status => {
                    // Only add the newest status for each unique check
                    if (!combinedChecks.has(status.context)) {
                        combinedChecks.set(status.context, {
                            name: status.context,
                            conclusion: status.state,
                        });
                    }
                });
            }
            
            // 2. Process Check Runs API SECOND, only adding checks that are missing from the baseline
            if (checkRunsData.check_runs) {
                checkRunsData.check_runs.forEach(check => {
                    if (!combinedChecks.has(check.name)) {
                        combinedChecks.set(check.name, {
                            name: check.name,
                            conclusion: check.conclusion || 'pending',
                        });
                    }
                });
            }
            
            const finalChecks = Array.from(combinedChecks.values());

            return {
                title: prData.title,
                url: prData.html_url,
                checks: finalChecks,
            };

        } catch (error) {
            console.error(`Error fetching data for ${url}:`, error);
            return { title: `Failed to load PR`, url, checks: [] };
        }
    }

    function createPrCard(data) {
        const card = document.createElement('div');
        card.className = 'pr-card';

        let checksHtml = '<ul class="checks-list">';
        if (data.checks.length > 0) {
            data.checks.forEach(check => {
                let icon = '🟡';
                let statusClass = 'status-pending';
                if (check.conclusion === 'success') {
                    icon = '✅';
                    statusClass = 'status-success';
                } else if (['failure', 'error', 'cancelled'].includes(check.conclusion)) {
                    icon = '❌';
                    statusClass = 'status-failure';
                }
                checksHtml += `<li class="check-item"><span class="status-icon ${statusClass}">${icon}</span> ${check.name}</li>`;
            });
        } else {
            checksHtml += '<li>No checks found.</li>';
        }
        checksHtml += '</ul>';

        card.innerHTML = `
            <button class="remove-btn" title="Remove PR">&times;</button>
            <h3><a href="${data.url}" target="_blank" rel="noopener noreferrer">${data.title}</a></h3>
            ${checksHtml}
        `;

        card.querySelector('.remove-btn').addEventListener('click', () => removePrFromList(data.url));
        
        return card;
    }

    // --- Initial Load ---
    renderDashboard();
});