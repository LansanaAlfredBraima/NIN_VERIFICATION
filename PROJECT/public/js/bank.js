// Bank Dashboard JavaScript
let verificationCount = 0;
let recentVerifications = [];

function updateTime() {
    const now = new Date();
    document.getElementById('currentTime').textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
setInterval(updateTime, 1000);
updateTime();

let modalInstance = null;

function showModal(title, message, type = 'info', onConfirm = null) {
    const modalEl = document.getElementById('customModal');
    const titleEl = document.getElementById('modalTitle');
    const msgEl = document.getElementById('modalMessage');
    const iconEl = document.getElementById('modalIcon');
    const confirmBtn = document.getElementById('modalConfirmBtn');
    const cancelBtn = document.getElementById('modalCancelBtn');

    if (!modalInstance) {
        modalInstance = new bootstrap.Modal(modalEl);
    }

    titleEl.textContent = title;
    msgEl.textContent = message;

    // Reset classes
    iconEl.className = 'fas fa-2x me-3';
    confirmBtn.className = 'btn btn-sm';
    confirmBtn.style.backgroundColor = '#ED1C24';
    confirmBtn.style.color = 'white';

    // Configure based on type
    if (type === 'success') {
        iconEl.classList.add('fa-check-circle', 'text-success');
        confirmBtn.style.display = 'none';
        cancelBtn.textContent = 'OK';
        cancelBtn.className = 'btn btn-success btn-sm';
    } else if (type === 'error') {
        iconEl.classList.add('fa-exclamation-circle', 'text-danger');
        confirmBtn.style.display = 'none';
        cancelBtn.textContent = 'Close';
        cancelBtn.className = 'btn btn-danger btn-sm';
    } else if (type === 'confirm') {
        iconEl.classList.add('fa-question-circle', 'text-warning');
        confirmBtn.style.display = 'inline-block';
        confirmBtn.textContent = 'Yes, Proceed';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'btn btn-secondary btn-sm';

        // Remove old listeners
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

        newConfirmBtn.addEventListener('click', () => {
            if (onConfirm) onConfirm();
            modalInstance.hide();
        });
    } else {
        iconEl.classList.add('fa-info-circle', 'text-primary');
        confirmBtn.style.display = 'none';
        cancelBtn.textContent = 'OK';
        cancelBtn.className = 'btn btn-secondary btn-sm';
    }

    modalInstance.show();
}


function getStatusBadge(status) {
    const badges = {
        'ACTIVE': 'badge-active',
        'FROZEN': 'badge-frozen',
        'CLOSED': 'badge-closed',
        'SUSPENDED': 'badge-suspended'
    };
    return badges[status] || 'badge-uba';
}

function getAccountActions(accountNumber, currentStatus) {
    const actions = [];
    if (currentStatus !== 'ACTIVE') {
        actions.push(`<button class="btn btn-success btn-sm-action" onclick="updateAccountStatus('${accountNumber}', 'ACTIVE')"><i class="fas fa-check"></i> Activate</button>`);
    }
    if (currentStatus !== 'FROZEN') {
        actions.push(`<button class="btn btn-primary btn-sm-action" onclick="updateAccountStatus('${accountNumber}', 'FROZEN')"><i class="fas fa-snowflake"></i> Freeze</button>`);
    }
    if (currentStatus !== 'CLOSED') {
        actions.push(`<button class="btn btn-secondary btn-sm-action" onclick="updateAccountStatus('${accountNumber}', 'CLOSED')"><i class="fas fa-times-circle"></i> Close</button>`);
    }
    actions.push(`<button class="btn btn-outline-danger btn-sm-action" onclick="deleteAccount('${accountNumber}')" title="Delete Account"><i class="fas fa-trash"></i></button>`);
    return actions.join(' ');
}

window.updateAccountStatus = (accountNumber, status) => {
    showModal('Update Account Status', `Change status of ${accountNumber} to ${status}?`, 'confirm', async () => {
        try {
            const res = await fetch('/bank/account-status', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ account_number: accountNumber, status: status })
            });

            const data = await res.json();
            if (data.success) {
                showModal('Success', 'Account status updated successfully!', 'success');
                loadBankAccounts();
                loadAnalytics();
            } else {
                showModal('Error', 'Error: ' + data.error, 'error');
            }
        } catch (err) {
            showModal('System Error', 'An unexpected error occurred', 'error');
        }
    });
};

window.deleteAccount = (accountNumber) => {
    showModal('Delete Account', `Are you sure you want to DELETE account ${accountNumber}?\n\nThis action cannot be undone!`, 'confirm', async () => {
        try {
            const res = await fetch(`/bank/account/${encodeURIComponent(accountNumber)}`, {
                method: 'DELETE'
            });

            const data = await res.json();
            if (data.success) {
                showModal('Success', 'Account deleted successfully!', 'success');
                loadBankAccounts();
                loadAnalytics();
            } else {
                showModal('Error', 'Error: ' + data.error, 'error');
            }
        } catch (err) {
            showModal('System Error', 'An unexpected error occurred', 'error');
        }
    });
};

document.getElementById('searchBtn').addEventListener('click', async () => {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) {
        showModal('Input Required', 'Please enter a search term', 'error');
        return;
    }

    try {
        const res = await fetch(`/bank/search?query=${encodeURIComponent(query)}`);
        const data = await res.json();

        if (data.success && data.data.length > 0) {
            displaySearchResults(data.data);
        } else {
            showModal('No Results', 'No matching records found', 'info');
        }
    } catch (err) {
        showModal('Search Failed', 'Unable to perform search', 'error');
    }
});

function displaySearchResults(results) {
    const container = document.getElementById('accountsList');
    container.innerHTML = results.map(acc => `
        <div class="account-card">
            <div class="d-flex justify-content-between align-items-start">
                <div class="flex-grow-1">
                    <div class="account-number mb-2">${acc.account_number}</div>
                    <div class="row">
                        <div class="col-md-4 mb-2">
                            <div class="info-label">Customer Name</div>
                            <div class="fw-bold">${acc.first_name || 'N/A'} ${acc.last_name || ''}</div>
                        </div>
                        <div class="col-md-3 mb-2">
                            <div class="info-label">NIN</div>
                            <div class="fw-bold">${acc.nin}</div>
                        </div>
                        <div class="col-md-3 mb-2">
                            <div class="info-label">Account Type</div>
                            <div class="fw-bold">${acc.account_type}</div>
                        </div>
                        <div class="col-md-2 mb-2">
                            <div class="info-label">Balance</div>
                            <div class="fw-bold">Le ${parseFloat(acc.balance || 0).toFixed(2)}</div>
                        </div>
                    </div>
                    <div class="mt-2">
                        <small class="text-muted">
                            <i class="fas fa-calendar me-1"></i>Created: ${new Date(acc.created_date).toLocaleDateString()}
                        </small>
                    </div>
                </div>
                <div class="ms-3">
                    <span class="badge ${getStatusBadge(acc.status)} mb-2">${acc.status}</span>
                    <div>${getAccountActions(acc.account_number, acc.status)}</div>
                </div>
            </div>
        </div>
    `).join('');
}

document.getElementById('verifyBtn').addEventListener('click', async () => {
    const nin = document.getElementById('ninInput').value.trim();
    const resultArea = document.getElementById('resultArea');
    const errorArea = document.getElementById('errorArea');

    if (!nin) {
        errorArea.querySelector('#errorMessage').textContent = 'Please enter a NIN';
        errorArea.style.display = 'block';
        resultArea.style.display = 'none';
        return;
    }

    try {
        const response = await fetch(`/verify/${nin}`);
        const data = await response.json();

        if (data.success) {
            document.getElementById('firstName').textContent = data.data.first_name;
            document.getElementById('lastName').textContent = data.data.last_name;
            document.getElementById('dob').textContent = data.data.dob;
            document.getElementById('gender').textContent = data.data.gender;
            document.getElementById('address').textContent = data.data.address;
            document.getElementById('ninDisplay').textContent = data.data.nin;
            document.getElementById('userPhoto').src = data.data.photo_url || 'https://via.placeholder.com/180?text=No+Photo';

            resultArea.style.display = 'block';
            errorArea.style.display = 'none';

            verificationCount++;
            document.getElementById('verificationCount').textContent = verificationCount;

            recentVerifications.unshift({
                time: new Date().toLocaleTimeString(),
                nin: data.data.nin,
                name: data.data.first_name + ' ' + data.data.last_name,
                status: 'Success'
            });
            if (recentVerifications.length > 5) recentVerifications.pop();
            updateRecentTable();

            // Check for fraud
            checkFraud(nin);
        } else {
            resultArea.style.display = 'none';
            errorArea.querySelector('#errorMessage').textContent = data.message || 'Verification failed';
            errorArea.style.display = 'block';
        }
    } catch (err) {
        console.error(err);
        errorArea.querySelector('#errorMessage').textContent = 'An error occurred';
        errorArea.style.display = 'block';
        resultArea.style.display = 'none';
    }
});

async function checkFraud(nin) {
    try {
        const res = await fetch(`/bank/fraud-check/${nin}`);
        const data = await res.json();

        const fraudAlert = document.getElementById('fraudAlert');
        const fraudMessage = document.getElementById('fraudMessage');

        if (data.blacklisted) {
            fraudMessage.textContent = data.alert + ' Reason: ' + data.reason;
            fraudAlert.style.display = 'block';
            fraudAlert.className = 'alert alert-danger';
        } else if (data.isExceeded) {
            fraudMessage.textContent = data.alert;
            fraudAlert.style.display = 'block';
            fraudAlert.className = 'alert alert-warning';
        } else {
            fraudMessage.textContent = `This NIN has ${data.accountCount} account(s). ${data.maxAllowed - data.accountCount} more allowed.`;
            fraudAlert.style.display = 'block';
            fraudAlert.className = 'alert alert-uba';
        }
    } catch (err) {
        console.error('Fraud check error:', err);
    }
}

function updateRecentTable() {
    const tbody = document.getElementById('recentVerifications');
    if (recentVerifications.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">No recent verifications</td></tr>';
    } else {
        tbody.innerHTML = recentVerifications.map(v => '<tr><td>' + v.time + '</td><td><strong>' + v.nin + '</strong></td><td>' + v.name + '</td><td><span class="badge-uba">Verified</span></td></tr>').join('');
    }
}

document.getElementById('createAccountBtn').addEventListener('click', async () => {
    const nin = document.getElementById('ninDisplay').textContent;
    const accountType = document.getElementById('accountTypeInput').value;
    const initialBalance = document.getElementById('initialBalanceInput').value || 0;

    if (!accountType) {
        alert('Please select an account type');
        return;
    }

    if (confirm(`Create ${accountType} account for NIN: ${nin}?`)) {
        try {
            const res = await fetch('/bank/create-account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nin: nin, account_type: accountType, initial_balance: parseFloat(initialBalance) })
            });

            const data = await res.json();

            if (data.success) {
                document.getElementById('generatedAccountNumber').value = data.account_number;
                alert('Account Successfully Created!\nAccount Number: ' + data.account_number);
                document.getElementById('accountTypeInput').value = '';
                document.getElementById('initialBalanceInput').value = '';
                loadBankAccounts();
                loadAnalytics();
            } else {
                alert('Error: ' + data.error);
            }
        } catch (err) {
            alert('System error occurred');
        }
    }
});

function loadBankAccounts() {
    fetch('/bank/verifications')
        .then(res => {
            if (!res.ok) throw new Error('Failed');
            return res.json();
        })
        .then(data => {
            const container = document.getElementById('accountsList');
            const totalAccounts = document.getElementById('totalAccounts');

            if (data.success && data.data && data.data.length > 0) {
                totalAccounts.textContent = data.data.length;
                container.innerHTML = data.data.map(acc => `
                    <div class="account-card">
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="flex-grow-1">
                                <div class="account-number mb-2">${acc.account_number}</div>
                                <div class="row">
                                    <div class="col-md-4 mb-2">
                                        <div class="info-label">Customer Name</div>
                                        <div class="fw-bold">${acc.first_name || 'N/A'} ${acc.last_name || ''}</div>
                                    </div>
                                    <div class="col-md-3 mb-2">
                                        <div class="info-label">NIN</div>
                                        <div class="fw-bold">${acc.nin}</div>
                                    </div>
                                    <div class="col-md-3 mb-2">
                                        <div class="info-label">Account Type</div>
                                        <div class="fw-bold">${acc.account_type}</div>
                                    </div>
                                    <div class="col-md-2 mb-2">
                                        <div class="info-label">Balance</div>
                                        <div class="fw-bold">Le ${parseFloat(acc.balance || 0).toFixed(2)}</div>
                                    </div>
                                </div>
                                <div class="mt-2">
                                    <small class="text-muted">
                                        <i class="fas fa-calendar me-1"></i>Created: ${new Date(acc.created_date).toLocaleDateString()}
                                    </small>
                                </div>
                            </div>
                            <div class="ms-3">
                                <span class="badge ${getStatusBadge(acc.status)} mb-2">${acc.status}</span>
                                <div>${getAccountActions(acc.account_number, acc.status)}</div>
                            </div>
                        </div>
                    </div>
                `).join('');
            } else {
                totalAccounts.textContent = '0';
                container.innerHTML = '<p class="text-center text-muted py-4">No accounts yet</p>';
            }
        })
        .catch(err => {
            console.error('Error:', err);
            document.getElementById('accountsList').innerHTML = '<p class="text-center text-danger py-4">Error loading account data</p>';
        });
}

function loadAnalytics() {
    fetch('/bank/analytics')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                document.getElementById('todayCount').textContent = data.data.today || 0;
                document.getElementById('weekCount').textContent = data.data.week || 0;

                const typeBreakdown = document.getElementById('typeBreakdown');
                if (data.data.byType && data.data.byType.length > 0) {
                    typeBreakdown.innerHTML = '<small class="text-muted">Account Types:</small><br>' +
                        data.data.byType.map(t =>
                            `<span class="badge badge-uba me-2 mt-2">${t.account_type}: ${t.count}</span>`
                        ).join('');
                }

                const statusBreakdown = document.getElementById('statusBreakdown');
                if (data.data.byStatus && data.data.byStatus.length > 0) {
                    statusBreakdown.innerHTML = '<small class="text-muted">Status Breakdown:</small><br>' +
                        data.data.byStatus.map(s =>
                            `<span class="badge ${getStatusBadge(s.status)} me-2 mt-2">${s.status}: ${s.count}</span>`
                        ).join('');
                }
            }
        })
        .catch(err => console.error('Analytics error:', err));
}

fetch('/check-auth')
    .then(res => res.json())
    .then(data => {
        if (!data.authenticated) {
            window.location.href = '/index.html';
        } else {
            document.getElementById('orgName').textContent = data.organization;
            loadBankAccounts();
            loadAnalytics();
        }
    });

fetch('/stats/total-records')
    .then(res => res.json())
    .then(data => {
        document.getElementById('totalRecords').textContent = data.count || 0;
    })
    .catch(() => {
        document.getElementById('totalRecords').textContent = '0';
    });

// Navigation Logic
document.addEventListener('DOMContentLoaded', function () {
    const navLinks = {
        'nav-dashboard': 'view-dashboard',
        'nav-customers': 'view-customers',
        'nav-accounts': 'view-accounts',
        'nav-transactions': 'view-transactions',
        'nav-reports': 'view-reports',
        'nav-settings': 'view-settings'
    };

    const pageTitles = {
        'view-dashboard': { title: 'Dashboard Overview', desc: "Welcome back, here's what's happening today." },
        'view-customers': { title: 'Customer Management', desc: 'Search, verify, and manage bank customers.' },
        'view-accounts': { title: 'Bank Accounts', desc: 'Overview of all customer accounts and balances.' },
        'view-transactions': { title: 'Transactions', desc: 'View and manage recent transactions.' },
        'view-reports': { title: 'Financial Reports', desc: 'Generate and view system reports.' },
        'view-settings': { title: 'System Settings', desc: 'Configure application preferences.' }
    };

    function switchView(viewId) {
        // Hide all views
        document.querySelectorAll('.view-section').forEach(el => el.style.display = 'none');
        // Show selected view
        const targetView = document.getElementById(viewId);
        if (targetView) targetView.style.display = 'block';

        // Update Nav Active State
        document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
        const activeNavId = Object.keys(navLinks).find(key => navLinks[key] === viewId);
        if (activeNavId) {
            const activeNav = document.getElementById(activeNavId);
            if (activeNav) activeNav.classList.add('active');
        }

        // Update Title
        if (pageTitles[viewId]) {
            document.getElementById('pageTitle').textContent = pageTitles[viewId].title;
            document.getElementById('pageDesc').textContent = pageTitles[viewId].desc;
        }
    }

    // Attach Click Listeners
    Object.keys(navLinks).forEach(navId => {
        const link = document.getElementById(navId);
        if (link) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                switchView(navLinks[navId]);
                // Load reports data when Reports view is opened
                if (navLinks[navId] === 'view-reports') {
                    loadReportsData();
                }
            });
        }
    });
});

// Financial Reports Module
let statusChartInstance = null;
let typeChartInstance = null;

function loadReportsData() {
    fetch('/bank/verifications')
        .then(res => res.json())
        .then(response => {
            // Extract accounts from the response (API returns {success: true, data: rows})
            const accounts = response.data || response || [];

            // Calculate summary metrics
            const totalAccounts = accounts.length;
            const activeAccounts = accounts.filter(a => a.status === 'ACTIVE').length;
            const frozenAccounts = accounts.filter(a => a.status === 'FROZEN').length;
            const totalBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);

            // Update summary cards
            document.getElementById('report-total-accounts').textContent = totalAccounts;
            document.getElementById('report-active-accounts').textContent = activeAccounts;
            document.getElementById('report-frozen-accounts').textContent = frozenAccounts;
            document.getElementById('report-total-balance').textContent = `Le ${totalBalance.toLocaleString()}`;

            // Prepare data for charts
            const statusCounts = {
                'ACTIVE': accounts.filter(a => a.status === 'ACTIVE').length,
                'FROZEN': accounts.filter(a => a.status === 'FROZEN').length,
                'CLOSED': accounts.filter(a => a.status === 'CLOSED').length,
                'SUSPENDED': accounts.filter(a => a.status === 'SUSPENDED').length
            };

            const typeCounts = {};
            accounts.forEach(acc => {
                const type = acc.account_type || 'Unknown';
                typeCounts[type] = (typeCounts[type] || 0) + 1;
            });

            // Render charts
            renderStatusChart(statusCounts);
            renderTypeChart(typeCounts);

            // Populate reports table
            populateReportsTable(accounts);

            // Update summaries
            updateAccountTypeSummary(typeCounts);
            updateStatusSummary(statusCounts);
        })
        .catch(err => {
            console.error('Error loading reports:', err);
            document.getElementById('reportsTableBody').innerHTML =
                '<tr><td colspan="6" class="text-center text-danger py-4">Error loading reports data</td></tr>';
        });
}

function renderStatusChart(statusCounts) {
    const ctx = document.getElementById('statusChart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (statusChartInstance) {
        statusChartInstance.destroy();
    }

    statusChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(statusCounts),
            datasets: [{
                data: Object.values(statusCounts),
                backgroundColor: [
                    '#1e7e34',  // ACTIVE - green
                    '#1967d2',  // FROZEN - blue
                    '#5f6368',  // CLOSED - gray
                    '#f29900'   // SUSPENDED - orange
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            family: 'Poppins',
                            size: 12
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function renderTypeChart(typeCounts) {
    const ctx = document.getElementById('typeChart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (typeChartInstance) {
        typeChartInstance.destroy();
    }

    typeChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(typeCounts),
            datasets: [{
                label: 'Number of Accounts',
                data: Object.values(typeCounts),
                backgroundColor: '#ED1C24',
                borderColor: '#c41e3a',
                borderWidth: 1,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `Accounts: ${context.parsed.y}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        font: {
                            family: 'Poppins'
                        }
                    },
                    grid: {
                        color: '#f0f0f0'
                    }
                },
                x: {
                    ticks: {
                        font: {
                            family: 'Poppins',
                            size: 11
                        }
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

function populateReportsTable(accounts) {
    const tbody = document.getElementById('reportsTableBody');
    if (!tbody) return;

    if (accounts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No accounts found</td></tr>';
        return;
    }

    // Sort by created date (newest first) and take top 20
    const recentAccounts = accounts
        .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
        .slice(0, 20);

    tbody.innerHTML = recentAccounts.map(acc => {
        const statusBadge = getStatusBadge(acc.status);
        const balance = acc.balance ? `Le ${parseFloat(acc.balance).toLocaleString()}` : 'Le 0';
        const createdDate = new Date(acc.created_date).toLocaleDateString('en-GB');

        return `
            <tr>
                <td><span class="account-number" style="font-size: 0.9rem;">${acc.account_number}</span></td>
                <td>${acc.first_name} ${acc.last_name}</td>
                <td>${acc.account_type || 'N/A'}</td>
                <td class="fw-bold">${balance}</td>
                <td>${statusBadge}</td>
                <td>${createdDate}</td>
            </tr>
        `;
    }).join('');
}

function updateAccountTypeSummary(typeCounts) {
    const container = document.getElementById('accountTypeSummary');
    if (!container) return;

    const total = Object.values(typeCounts).reduce((a, b) => a + b, 0);

    if (total === 0) {
        container.innerHTML = '<p class="text-muted small">No accounts to display</p>';
        return;
    }

    container.innerHTML = Object.entries(typeCounts).map(([type, count]) => {
        const percentage = ((count / total) * 100).toFixed(1);
        return `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <div>
                    <div class="fw-bold">${type}</div>
                    <div class="small text-muted">${count} accounts</div>
                </div>
                <div class="text-end">
                    <div class="fw-bold text-danger">${percentage}%</div>
                </div>
            </div>
            <div class="progress mb-3" style="height: 8px;">
                <div class="progress-bar bg-danger" role="progressbar" style="width: ${percentage}%"></div>
            </div>
        `;
    }).join('');
}

function updateStatusSummary(statusCounts) {
    const container = document.getElementById('accountStatusSummary');
    if (!container) return;

    const statusColors = {
        'ACTIVE': 'success',
        'FROZEN': 'primary',
        'CLOSED': 'secondary',
        'SUSPENDED': 'warning'
    };

    const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);

    if (total === 0) {
        container.innerHTML = '<p class="text-muted small">No accounts to display</p>';
        return;
    }

    container.innerHTML = Object.entries(statusCounts).map(([status, count]) => {
        const percentage = ((count / total) * 100).toFixed(1);
        const color = statusColors[status] || 'secondary';
        return `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <div>
                    <div class="fw-bold">${status}</div>
                    <div class="small text-muted">${count} accounts</div>
                </div>
                <div class="text-end">
                    <div class="fw-bold text-${color}">${percentage}%</div>
                </div>
            </div>
            <div class="progress mb-3" style="height: 8px;">
                <div class="progress-bar bg-${color}" role="progressbar" style="width: ${percentage}%"></div>
            </div>
        `;
    }).join('');
}
