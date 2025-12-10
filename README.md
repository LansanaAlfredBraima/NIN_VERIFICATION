# NIN Verification System

The **NIN Verification System** is a comprehensive identity management and verification platform built for the **National Civil Registration Authority (NCRA)**. It facilitates citizen identity management and provides secure verification services for external institutions like **Banks** and **Telecommunication Companies**.

![Architecture](ARCHITECTURE.png)

## Features

### 1. NCRA Administration (Super Admin & NCRA Admin)
-   **User Management**: Create and manage system users (admins, bank officers, telecom officers).
-   **Citizen Management**: Register, update, and delete National Identity Number (NIN) records.
-   **System Logs**: View comprehensive audit logs for all system actions.
-   **Dashboard**: Overview of total records and system stats.

### 2. Bank Verification (Bank Officer)
-   **Account Creation**: Open new bank accounts linked to a verified NIN.
    -   *Fraud Check*: Enforces a maximum of **3 accounts per NIN**.
-   **Account Management**: Search, view, and update account statuses (Active, Frozen, Closed).
-   **Fraud Detection**: Real-time alerts for rapid account creation or duplicate account attempts.

### 3. Telecom Verification (Telecom Officer)
-   **SIM Registration**: Register new SIM cards linked to a verified NIN.
    -   *Validation*: Ensures valid Orange SL phone number formats.
    -   *Fraud Check*: Enforces a maximum of **2 SIM cards per NIN**.
-   **Blacklist Management**: Blacklist suspicious NINs to prevent further registrations.
-   **SIM Management**: Search and update SIM statuses (Active, Blocked, Lost).
-   **Analytics**: View registration statistics and fraud alerts.

## Technology Stack

-   **Backend**: Node.js, Express.js
-   **Database**: SQLite (Zero-configuration, persistent file storage)
-   **Frontend**: HTML5, CSS3, Vanilla JavaScript
-   **Security**: `bcrypt` for password hashing, `helmet` for HTTP headers, `express-session` for session management.

## Prerequisites

-   [Node.js](https://nodejs.org/) (v14 or higher recommended)
-   NPM (Node Package Manager)

## Installation

1.  **Clone the repository** (or extract the project files).
2.  **Navigate to the project directory** in your terminal.
3.  **Install dependencies**:
    ```bash
    npm install
    ```

## Usage

1.  **Start the server**:
    ```bash
    npm start
    ```
    *Or for development with auto-restart:*
    ```bash
    npm run dev
    ```

2.  **Access the application**:
    Open your browser and go to: `http://localhost:3000`

## Default Credentials

The system comes seeded with the following default accounts.
**Default Password for ALL accounts:** `password123`

| Role | Username | Organization |
| :--- | :--- | :--- |
| **Super Admin** | `admin` | NCRA |
| **NCRA Admin** | `ncra_admin` | NCRA |
| **Bank Officer** | `bank_user` | Bank of Sierra Leone |
| **Telecom Officer** | `telecom_user` | Orange SL |

> [!IMPORTANT]
> Change these passwords immediately after deployment in a production environment.

## Project Structure

-   `server.js`: Main application entry point and API routes.
-   `database.js`: Database connection and schema initialization (SQLite).
-   `public/`: Static frontend files (HTML, CSS, JS).
-   `database/`: Contains the persistent SQLite database file (`nin_db.sqlite`).

## License
This project is an academic work developed for educational purposes.
