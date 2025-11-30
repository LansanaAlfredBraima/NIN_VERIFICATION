const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'database', 'nin_db.sqlite');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Users Table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        organization TEXT NOT NULL
    )`);

    // NIN Records table
    db.run(`CREATE TABLE IF NOT EXISTS nin_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nin TEXT UNIQUE NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        middle_name TEXT,
        dob TEXT NOT NULL,
        gender TEXT NOT NULL,
        height TEXT,
        address TEXT NOT NULL,
        photo_url TEXT,
        expiry_date TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // SIM Registrations Table
    db.run(`CREATE TABLE IF NOT EXISTS sim_registrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nin TEXT,
        phone_number TEXT,
        registration_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'ACTIVE',
        FOREIGN KEY(nin) REFERENCES nin_records(nin)
    )`);

    // Bank Verifications Table (Updated for Account Management)
    db.run(`CREATE TABLE IF NOT EXISTS bank_verifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nin TEXT,
        account_number TEXT UNIQUE NOT NULL,
        account_type TEXT NOT NULL,
        balance REAL DEFAULT 0.00,
        status TEXT DEFAULT 'ACTIVE',
        created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(nin) REFERENCES nin_records(nin)
    )`);

    // Logs Table
    db.run(`CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT,
        details TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Seed Data
    const saltRounds = 10;
    const password = 'password123';

    bcrypt.hash(password, saltRounds, (err, hash) => {
        if (err) {
            console.error(err);
            return;
        }

        // Super Admin
        db.run(`INSERT OR IGNORE INTO users (username, password, role, organization) VALUES (?, ?, ?, ?)`,
            ['admin', hash, 'super_admin', 'NCRA']);

        // NCRA Admin
        db.run(`INSERT OR IGNORE INTO users (username, password, role, organization) VALUES (?, ?, ?, ?)`,
            ['ncra_admin', hash, 'ncra_admin', 'NCRA']);

        // Bank Officer
        db.run(`INSERT OR IGNORE INTO users (username, password, role, organization) VALUES (?, ?, ?, ?)`,
            ['bank_user', hash, 'bank_officer', 'Bank of Sierra Leone']);

        // Telecom Officer
        db.run(`INSERT OR IGNORE INTO users (username, password, role, organization) VALUES (?, ?, ?, ?)`,
            ['telecom_user', hash, 'telecom_officer', 'Orange SL']);
    });

    // Blacklist Table for Fraud Prevention
    db.run(`CREATE TABLE IF NOT EXISTS blacklist (\r
        id INTEGER PRIMARY KEY AUTOINCREMENT,\r
        nin TEXT UNIQUE,\r
        reason TEXT,\r
        added_by INTEGER,\r
        added_date DATETIME DEFAULT CURRENT_TIMESTAMP,\r
        status TEXT DEFAULT 'ACTIVE',\r
        FOREIGN KEY(added_by) REFERENCES users(id)\r
    )`);

    console.log("Database initialized and seeded.");
});

module.exports = db;
