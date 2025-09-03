# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Local Setup Guide

This application consists of two main parts: a Next.js frontend and a Flask (Python) backend. To run it on your local machine, please follow these steps.

**Prerequisites:**
*   Node.js and npm (or a similar package manager)
*   Python 3 and pip
*   PsTools downloaded and extracted.

### 1. Backend Setup (Flask)

The backend is responsible for all interactions with PsTools and network scanning.

a. **Install Python Dependencies:**
Navigate to the `pstools_app` directory and install the required packages using the `requirements.txt` file.
```bash
cd pstools_app
pip install -r requirements.txt
```

b. **Configure Environment Variables:**
Create a file named `.env` inside the `pstools_app` directory. This file will hold the path to your PsTools utilities and a secret key for the Flask session.

```env
# Path to the folder containing PsTools executables (e.g., PsExec.exe)
PSTOOLS_DIR="C:\\Path\\To\\Your\\Sysinternals"

# A random string to secure user sessions
FLASK_SECRET_KEY="your-super-secret-key"

# Optional: Define the network range for scanning, e.g., "192.168.1.0/24"
# If not set, it will try to determine it automatically.
# SCAN_CIDR="192.168.1.0/24"
```
**Note:** You must run this application on a Windows machine that is part of a domain for the PsTools commands and admin validation to work correctly.

c. **Run the Backend Server:**
From within the `pstools_app` directory, start the Flask server.
```bash
flask run --host=0.0.0.0 --port=5000
```
The backend server will now be running on `http://127.0.0.1:5000`.

### 2. Frontend Setup (Next.js)

The frontend provides the user interface for interacting with the backend.

a. **Install Node.js Dependencies:**
In the project's root directory, install the necessary npm packages.
```bash
npm install
```

b. **Run the Frontend Development Server:**
Start the Next.js application.
```bash
npm run dev
```
The frontend will be available at `http://localhost:9002`. The Next.js app is configured to proxy API requests from `/api/*` to the Flask backend running on port 5000.

### 3. Usage

1.  Open your browser and go to `http://localhost:9002`.
2.  Log in using an email address of a user who is a member of the "Domain Admins" group on your network. The password field can be anything, as it's not currently validated against the actual user password (for security reasons, password validation should be handled carefully, e.g., via LDAP).
3.  Once logged in, you will be taken to the dashboard where you can discover and manage devices on your network.
