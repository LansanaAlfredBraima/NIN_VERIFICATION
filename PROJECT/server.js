const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcrypt');
const db = require('./database');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true
}));

// Login Endpoint
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        bcrypt.compare(password, user.password, (err, result) => {
            if (result) {
                req.session.user = {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    organization: user.organization
                };
                res.json({ success: true, role: user.role });
            } else {
                res.status(401).json({ error: 'Invalid credentials' });
            }
        });
    });
});

// Logout Endpoint
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Check Auth Endpoint
app.get('/check-auth', (req, res) => {
    if (req.session.user) {
        res.json({ authenticated: true, role: req.session.user.role, organization: req.session.user.organization });
    } else {
        res.json({ authenticated: false });
    }
});

// Verify NIN Endpoint
app.get('/verify/:nin', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });

    const nin = req.params.nin;
    db.get('SELECT * FROM nin_records WHERE nin = ?', [nin], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (row) {
            // Log the verification
            db.run('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)',
                [req.session.user.id, 'VERIFY_NIN', `Verified NIN: ${nin}`]);
            res.json({ success: true, data: row });
        } else {
            res.status(404).json({ success: false, message: 'NIN not found' });
        }
    });
});

// Telecom: Register SIM
app.post('/telecom/register-sim', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'telecom_officer') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const { nin, phone_number } = req.body;
    const MAX_SIMS_PER_NIN = 2; // Maximum 2 SIMs per NIN

    if (!nin || !phone_number) return res.status(400).json({ error: 'Missing fields' });

    // Validate Orange SL Phone Number Format
    // Must start with 072, 073, 074, 075, 076, 078, 079 and be exactly 9 digits
    const validPrefixes = ['072', '073', '074', '075', '076', '078', '079'];
    const prefix = phone_number.substring(0, 3);
    const isValidFormat = /^\d{9}$/.test(phone_number) && validPrefixes.includes(prefix);

    if (!isValidFormat) {
        return res.status(400).json({
            error: 'Invalid Orange SL number. Must start with 072, 073, 074, 075, 076, 078, or 079 and be 9 digits long.'
        });
    }

    // Check if NIN is blacklisted
    db.get('SELECT * FROM blacklist WHERE nin = ? AND status = "ACTIVE"', [nin], (err, blacklisted) => {
        if (err) return res.status(500).json({ error: err.message });
        if (blacklisted) return res.status(403).json({ error: 'This NIN is blacklisted: ' + blacklisted.reason });

        // Check how many SIMs this NIN already has
        db.get('SELECT COUNT(*) as count FROM sim_registrations WHERE nin = ?', [nin], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });

            if (result.count >= MAX_SIMS_PER_NIN) {
                return res.status(400).json({
                    error: `Maximum SIM limit reached! This NIN already has ${result.count} SIM cards registered. Maximum allowed: ${MAX_SIMS_PER_NIN}`
                });
            }

            // Check for duplicate phone number
            db.get('SELECT * FROM sim_registrations WHERE phone_number = ?', [phone_number], (err, existing) => {
                if (err) return res.status(500).json({ error: err.message });
                if (existing) return res.status(400).json({ error: 'Phone number already registered' });

                // Check NIN exists
                db.get('SELECT * FROM nin_records WHERE nin = ?', [nin], (err, record) => {
                    if (err) return res.status(500).json({ error: err.message });
                    if (!record) return res.status(404).json({ error: 'NIN not found' });

                    db.run('INSERT INTO sim_registrations (nin, phone_number) VALUES (?, ?)', [nin, phone_number], function (err) {
                        if (err) return res.status(500).json({ error: err.message });

                        db.run('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)',
                            [req.session.user.id, 'REGISTER_SIM', `Linked ${phone_number} to ${nin}`]);

                        res.json({ success: true });
                    });
                });
            });
        });
    });
});

// Telecom: Delete SIM Registration
app.delete('/telecom/sim-registration/:phone_number', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'telecom_officer') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const phoneNumber = req.params.phone_number;

    db.run('DELETE FROM sim_registrations WHERE phone_number = ?', [phoneNumber], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'SIM not found' });

        db.run('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)',
            [req.session.user.id, 'DELETE_SIM', `Deleted SIM ${phoneNumber}`]);

        res.json({ success: true });
    });
});

// Telecom: Get All SIM Registrations
app.get('/telecom/sim-registrations', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'telecom_officer') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    db.all(`SELECT sr.*, nr.first_name, nr.last_name 
            FROM sim_registrations sr 
            LEFT JOIN nin_records nr ON sr.nin = nr.nin 
            ORDER BY sr.registration_date DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, data: rows });
    });
});

// Telecom: Search SIM by Phone or NIN
app.get('/telecom/search', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'telecom_officer') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const { query } = req.query;
    if (!query) return res.status(400).json({ error: 'Search query required' });

    db.all(`SELECT sr.*, nr.first_name, nr.last_name 
            FROM sim_registrations sr 
            LEFT JOIN nin_records nr ON sr.nin = nr.nin 
            WHERE sr.phone_number LIKE ? OR sr.nin LIKE ?
            ORDER BY sr.registration_date DESC`,
        [`%${query}%`, `%${query}%`], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, data: rows });
        });
});

// Telecom: Update SIM Status (Block/Unblock)
app.put('/telecom/sim-status', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'telecom_officer') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const { phone_number, status } = req.body;
    if (!phone_number || !status) return res.status(400).json({ error: 'Missing fields' });

    const validStatuses = ['ACTIVE', 'SUSPENDED', 'BLOCKED', 'LOST'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    db.run('UPDATE sim_registrations SET status = ? WHERE phone_number = ?',
        [status, phone_number], function (err) {
            if (err) return res.status(500).json({ error: err.message });

            db.run('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)',
                [req.session.user.id, 'UPDATE_SIM_STATUS', `Changed ${phone_number} to ${status}`]);

            res.json({ success: true });
        });
});

// Telecom: Get Analytics
app.get('/telecom/analytics', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'telecom_officer') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const analytics = {};

    // Total registrations
    db.get('SELECT COUNT(*) as total FROM sim_registrations', (err, row) => {
        analytics.total = row ? row.total : 0;

        // Status breakdown
        db.all('SELECT status, COUNT(*) as count FROM sim_registrations GROUP BY status', (err, rows) => {
            analytics.byStatus = rows || [];

            // Today's registrations
            db.get(`SELECT COUNT(*) as today FROM sim_registrations 
                    WHERE DATE(registration_date) = DATE('now')`, (err, row) => {
                analytics.today = row ? row.today : 0;

                // This week's registrations
                db.get(`SELECT COUNT(*) as week FROM sim_registrations 
                        WHERE DATE(registration_date) >= DATE('now', '-7 days')`, (err, row) => {
                    analytics.week = row ? row.week : 0;

                    res.json({ success: true, data: analytics });
                });
            });
        });
    });
});

// Telecom: Check for Fraud (Duplicate Detection)
app.get('/telecom/fraud-check/:nin', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'telecom_officer') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const nin = req.params.nin;
    const MAX_SIMS_PER_NIN = 2; // Configurable limit - Maximum 2 SIMs per NIN

    // Check if NIN is blacklisted
    db.get('SELECT * FROM blacklist WHERE nin = ? AND status = "ACTIVE"', [nin], (err, blacklisted) => {
        if (err) return res.status(500).json({ error: err.message });

        if (blacklisted) {
            return res.json({
                success: true,
                blacklisted: true,
                reason: blacklisted.reason,
                alert: 'CRITICAL: This NIN is blacklisted!'
            });
        }

        // Count existing SIMs for this NIN
        db.get('SELECT COUNT(*) as count FROM sim_registrations WHERE nin = ?', [nin], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });

            const simCount = row.count;
            const isDuplicate = simCount >= MAX_SIMS_PER_NIN;

            res.json({
                success: true,
                blacklisted: false,
                simCount: simCount,
                maxAllowed: MAX_SIMS_PER_NIN,
                isDuplicate: isDuplicate,
                alert: isDuplicate ? `WARNING: This NIN already has ${simCount} SIM cards registered!` : null
            });
        });
    });
});

// Telecom: Get Fraud Alerts
app.get('/telecom/fraud-alerts', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'telecom_officer') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const alerts = [];

    // Find NIns with too many SIMs (more than 2)
    db.all(`SELECT nin, COUNT(*) as count, 
            GROUP_CONCAT(phone_number) as phones
            FROM sim_registrations 
            GROUP BY nin 
            HAVING count > 2`, [], (err, duplicates) => {
        if (err) return res.status(500).json({ error: err.message });

        duplicates.forEach(d => {
            alerts.push({
                type: 'DUPLICATE',
                severity: 'HIGH',
                nin: d.nin,
                message: `NIN has ${d.count} SIM cards registered`,
                details: d.phones
            });
        });

        // Find recent rapid registrations (1 or more in last hour)
        db.all(`SELECT nin, COUNT(*) as count
                FROM sim_registrations 
                WHERE registration_date >= datetime('now', '-1 hour')
                GROUP BY nin 
                HAVING count >= 1`, [], (err, rapid) => {
            if (err) return res.status(500).json({ error: err.message });

            rapid.forEach(r => {
                alerts.push({
                    type: 'SUSPICIOUS',
                    severity: 'MEDIUM',
                    nin: r.nin,
                    message: `${r.count} SIMs registered in last hour`,
                    details: 'Possible bulk registration fraud'
                });
            });

            res.json({ success: true, alerts: alerts });
        });
    });
});

// Telecom: Add to Blacklist
app.post('/telecom/blacklist', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'telecom_officer') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const { nin, reason } = req.body;
    if (!nin || !reason) return res.status(400).json({ error: 'Missing fields' });

    db.run('INSERT INTO blacklist (nin, reason, added_by) VALUES (?, ?, ?)',
        [nin, reason, req.session.user.id], function (err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                    return res.status(400).json({ error: 'NIN already blacklisted' });
                }
                return res.status(500).json({ error: err.message });
            }

            db.run('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)',
                [req.session.user.id, 'BLACKLIST_NIN', `Blacklisted ${nin}: ${reason}`]);

            res.json({ success: true });
        });
});

// Telecom: Get Blacklist
app.get('/telecom/blacklist', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'telecom_officer') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    db.all(`SELECT b.*, u.username as added_by_user, nr.first_name, nr.last_name
            FROM blacklist b 
            LEFT JOIN users u ON b.added_by = u.id
            LEFT JOIN nin_records nr ON b.nin = nr.nin
            WHERE b.status = 'ACTIVE'
            ORDER BY b.added_date DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, data: rows });
    });
});

// Telecom: Remove from Blacklist
app.delete('/telecom/blacklist/:nin', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'telecom_officer') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const nin = req.params.nin;

    db.run('UPDATE blacklist SET status = "REMOVED" WHERE nin = ?', [nin], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        db.run('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)',
            [req.session.user.id, 'REMOVE_BLACKLIST', `Removed ${nin} from blacklist`]);

        res.json({ success: true });
    });
});


// Bank: Create New Account
app.post('/bank/create-account', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'bank_officer') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const { nin, account_type, initial_balance } = req.body;

    if (!nin || !account_type) return res.status(400).json({ error: 'Missing required fields' });

    const MAX_ACCOUNTS_PER_NIN = 3;

    // Check if NIN is blacklisted
    db.get('SELECT * FROM blacklist WHERE nin = ? AND status = "ACTIVE"', [nin], (err, blacklisted) => {
        if (err) return res.status(500).json({ error: err.message });
        if (blacklisted) {
            return res.status(403).json({ error: 'This NIN is blacklisted and cannot open accounts' });
        }

        // Check if NIN exists
        db.get('SELECT * FROM nin_records WHERE nin = ?', [nin], (err, record) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!record) return res.status(404).json({ error: 'NIN not found' });

            // Check max accounts per NIN
            db.get('SELECT COUNT(*) as count FROM bank_verifications WHERE nin = ?', [nin], (err, row) => {
                if (err) return res.status(500).json({ error: err.message });

                if (row.count >= MAX_ACCOUNTS_PER_NIN) {
                    return res.status(400).json({ error: `Maximum ${MAX_ACCOUNTS_PER_NIN} accounts per NIN reached` });
                }

                // Generate unique account number (UBA-XXXXXXXXXX)
                const generateAccountNumber = () => {
                    const randomDigits = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
                    return `UBA-${randomDigits}`;
                };

                let accountNumber = generateAccountNumber();

                // Check if account number already exists (very unlikely but safe)
                db.get('SELECT * FROM bank_verifications WHERE account_number = ?', [accountNumber], (err, existing) => {
                    if (existing) accountNumber = generateAccountNumber(); // Regenerate if collision

                    const balance = initial_balance || 0.00;

                    db.run(`INSERT INTO bank_verifications (nin, account_number, account_type, balance, status) 
                            VALUES (?, ?, ?, ?, ?)`,
                        [nin, accountNumber, account_type, balance, 'ACTIVE'], function (err) {
                            if (err) return res.status(500).json({ error: err.message });

                            db.run('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)',
                                [req.session.user.id, 'CREATE_ACCOUNT', `Created account ${accountNumber} for ${nin}`]);

                            res.json({ success: true, account_number: accountNumber });
                        });
                });
            });
        });
    });
});

// Bank: Search Accounts
app.get('/bank/search', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'bank_officer') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const query = req.query.query;
    if (!query) return res.status(400).json({ error: 'Search query required' });

    db.all(`SELECT bv.*, nr.first_name, nr.last_name, nr.dob, nr.gender, nr.address 
            FROM bank_verifications bv 
            LEFT JOIN nin_records nr ON bv.nin = nr.nin 
            WHERE bv.account_number LIKE ? OR bv.nin LIKE ?
            ORDER BY bv.created_date DESC`,
        [`%${query}%`, `%${query}%`], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, data: rows });
        });
});

// Bank: Update Account Status
app.put('/bank/account-status', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'bank_officer') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const { account_number, status } = req.body;

    if (!account_number || !status) return res.status(400).json({ error: 'Missing fields' });

    const validStatuses = ['ACTIVE', 'FROZEN', 'CLOSED', 'SUSPENDED'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    db.run('UPDATE bank_verifications SET status = ?, last_updated = CURRENT_TIMESTAMP WHERE account_number = ?',
        [status, account_number], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Account not found' });

            db.run('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)',
                [req.session.user.id, 'UPDATE_ACCOUNT_STATUS', `Changed ${account_number} to ${status}`]);

            res.json({ success: true });
        });
});

// Bank: Delete Account
app.delete('/bank/account/:account_number', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'bank_officer') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const accountNumber = req.params.account_number;

    db.run('DELETE FROM bank_verifications WHERE account_number = ?', [accountNumber], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Account not found' });

        db.run('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)',
            [req.session.user.id, 'DELETE_ACCOUNT', `Deleted account ${accountNumber}`]);

        res.json({ success: true });
    });
});

// Bank: Get Analytics
app.get('/bank/analytics', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'bank_officer') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const analytics = {};

    // Today's accounts
    db.get(`SELECT COUNT(*) as count FROM bank_verifications 
            WHERE DATE(created_date) = DATE('now')`, [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        analytics.today = row.count;

        // This week's accounts
        db.get(`SELECT COUNT(*) as count FROM bank_verifications 
                WHERE created_date >= DATE('now', '-7 days')`, [], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            analytics.week = row.count;

            // By account type
            db.all(`SELECT account_type, COUNT(*) as count 
                    FROM bank_verifications 
                    GROUP BY account_type`, [], (err, rows) => {
                if (err) return res.status(500).json({ error: err.message });
                analytics.byType = rows;

                // By status
                db.all(`SELECT status, COUNT(*) as count 
                        FROM bank_verifications 
                        GROUP BY status`, [], (err, rows) => {
                    if (err) return res.status(500).json({ error: err.message });
                    analytics.byStatus = rows;

                    res.json({ success: true, data: analytics });
                });
            });
        });
    });
});

// Bank: Fraud Check
app.get('/bank/fraud-check/:nin', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'bank_officer') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const nin = req.params.nin;
    const MAX_ACCOUNTS_PER_NIN = 3;

    // Check if NIN is blacklisted
    db.get('SELECT * FROM blacklist WHERE nin = ? AND status = "ACTIVE"', [nin], (err, blacklisted) => {
        if (err) return res.status(500).json({ error: err.message });

        if (blacklisted) {
            return res.json({
                success: true,
                blacklisted: true,
                reason: blacklisted.reason,
                alert: 'CRITICAL: This NIN is blacklisted!'
            });
        }

        // Count existing accounts for this NIN
        db.get('SELECT COUNT(*) as count FROM bank_verifications WHERE nin = ?', [nin], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });

            const accountCount = row.count;
            const isExceeded = accountCount >= MAX_ACCOUNTS_PER_NIN;

            res.json({
                success: true,
                blacklisted: false,
                accountCount: accountCount,
                maxAllowed: MAX_ACCOUNTS_PER_NIN,
                isExceeded: isExceeded,
                alert: isExceeded ? `WARNING: This NIN already has ${accountCount} accounts!` : null
            });
        });
    });
});

// Bank: Get Fraud Alerts
app.get('/bank/fraud-alerts', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'bank_officer') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const alerts = [];

    // Find NIns with too many accounts (more than 3)
    db.all(`SELECT nin, COUNT(*) as count, 
            GROUP_CONCAT(account_number) as accounts
            FROM bank_verifications 
            GROUP BY nin 
            HAVING count > 3`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        rows.forEach(row => {
            alerts.push({
                type: 'DUPLICATE_ACCOUNTS',
                nin: row.nin,
                count: row.count,
                accounts: row.accounts.split(','),
                severity: 'HIGH'
            });
        });

        // Find rapid account creation (2+ accounts in 1 hour)
        db.all(`SELECT nin, COUNT(*) as count, 
                GROUP_CONCAT(account_number) as accounts
                FROM bank_verifications 
                WHERE created_date >= DATETIME('now', '-1 hour')
                GROUP BY nin 
                HAVING count >= 2`, [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });

            rows.forEach(row => {
                alerts.push({
                    type: 'RAPID_CREATION',
                    nin: row.nin,
                    count: row.count,
                    accounts: row.accounts.split(','),
                    severity: 'MEDIUM'
                });
            });

            res.json({ success: true, data: alerts });
        });
    });
});

// Bank: Get All Accounts
app.get('/bank/verifications', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'bank_officer') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    db.all(`SELECT bv.*, nr.first_name, nr.last_name 
            FROM bank_verifications bv 
            LEFT JOIN nin_records nr ON bv.nin = nr.nin 
            ORDER BY bv.created_date DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, data: rows });
    });
});

// Admin: Get All Users
app.get('/admin/users', (req, res) => {
    if (!req.session.user || (req.session.user.role !== 'super_admin' && req.session.user.role !== 'ncra_admin')) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    db.all('SELECT id, username, role, organization FROM users', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Admin: Create User
app.post('/admin/users', (req, res) => {
    if (!req.session.user || (req.session.user.role !== 'super_admin' && req.session.user.role !== 'ncra_admin')) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const { username, role, organization } = req.body;
    const password = 'password123'; // Default password
    const saltRounds = 10;

    bcrypt.hash(password, saltRounds, (err, hash) => {
        if (err) return res.status(500).json({ error: err.message });

        db.run('INSERT INTO users (username, password, role, organization) VALUES (?, ?, ?, ?)',
            [username, hash, role, organization], function (err) {
                if (err) return res.status(500).json({ error: err.message });

                db.run('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)',
                    [req.session.user.id, 'CREATE_USER', `Created user ${username} as ${role}`]);

                res.json({ success: true, id: this.lastID });
            });
    });
});

// Admin: Get NIN Records
app.get('/admin/nin-records', (req, res) => {
    if (!req.session.user || (req.session.user.role !== 'super_admin' && req.session.user.role !== 'ncra_admin')) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    db.all('SELECT * FROM nin_records ORDER BY created_at DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Admin: Register Citizen
app.post('/admin/register-citizen', (req, res) => {
    if (!req.session.user || (req.session.user.role !== 'super_admin' && req.session.user.role !== 'ncra_admin')) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const { first_name, last_name, middle_name, dob, gender, height, address, expiry_date, photo_data } = req.body;

    // Generate Auto-NIN (SL + Year + Random 6 digits)
    const year = new Date().getFullYear().toString().substr(-2);
    const random = Math.floor(100000 + Math.random() * 900000);
    const nin = `SL${year}${random}`;

    db.run(`INSERT INTO nin_records (nin, first_name, last_name, middle_name, dob, gender, height, address, photo_url, expiry_date) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [nin, first_name, last_name, middle_name, dob, gender, height, address, photo_data, expiry_date],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });

            db.run('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)',
                [req.session.user.id, 'REGISTER_CITIZEN', `Registered citizen ${nin}`]);

            res.json({ success: true, citizen: { nin, first_name, last_name, middle_name, dob, gender, height, address, photo_url: photo_data, expiry_date } });
        }
    );
});

// Admin: Update Citizen
app.put('/admin/update-citizen', (req, res) => {
    if (!req.session.user || (req.session.user.role !== 'super_admin' && req.session.user.role !== 'ncra_admin')) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const { nin, first_name, last_name, middle_name, dob, gender, height, address, photo_data } = req.body;

    db.run(`UPDATE nin_records SET first_name = ?, last_name = ?, middle_name = ?, dob = ?, gender = ?, height = ?, address = ?, photo_url = ? WHERE nin = ?`,
        [first_name, last_name, middle_name, dob, gender, height, address, photo_data, nin],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });

            db.run('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)',
                [req.session.user.id, 'UPDATE_CITIZEN', `Updated citizen ${nin}`]);

            res.json({ success: true });
        }
    );
});

// Admin: Delete Citizen
app.delete('/admin/delete-citizen/:nin', (req, res) => {
    if (!req.session.user || (req.session.user.role !== 'super_admin' && req.session.user.role !== 'ncra_admin')) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const nin = req.params.nin;

    db.run('DELETE FROM nin_records WHERE nin = ?', [nin], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        db.run('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)',
            [req.session.user.id, 'DELETE_CITIZEN', `Deleted citizen ${nin}`]);

        res.json({ success: true });
    });
});

// Admin: Get Logs
app.get('/admin/logs', (req, res) => {
    if (!req.session.user || (req.session.user.role !== 'super_admin' && req.session.user.role !== 'ncra_admin')) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    db.all(`SELECT l.*, u.username FROM logs l LEFT JOIN users u ON l.user_id = u.id ORDER BY l.timestamp DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Stats Endpoint
app.get('/stats/total-records', (req, res) => {
    db.get('SELECT COUNT(*) as count FROM nin_records', (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ count: row.count });
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
