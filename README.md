# Dominion Control Panel - User Guide

This is a step-by-step guide to running the Dominion Control Panel application on a Windows computer.

---

## Before You Start

Make sure you have the following software installed on your computer:
1.  **Node.js**: This runs the user interface.
2.  **Python**: This runs the application's backend server.

---

## Important Prerequisites for Target Machines

For the application's tools to function correctly, you must enable and start the **Remote Registry** service on all computers you intend to manage.

This service allows tools like `PsInfo` to gather detailed system information.

#### How to Enable via Group Policy (Recommended for Domains)

You can enable this for all computers in your domain at once using Group Policy:
1.  Open **Group Policy Management**.
2.  Create or edit a Group Policy Object (GPO) that is linked to the Organizational Unit (OU) containing your computers.
3.  Navigate to: `Computer Configuration` -> `Policies` -> `Windows Settings` -> `Security Settings` -> `System Services`.
4.  Find **Remote Registry** in the list.
5.  Define the policy setting and set the service startup mode to **Automatic**.

---

## Setup and Run Instructions

Follow these steps in order to get the application working correctly. All commands should be run from the main project folder.

### Step 1: Set Up Essential Tools

These are external tools that give the application its core functionality.

1.  **PsTools**:
    *   Download **PsTools** from the official Microsoft website.
    *   Unzip the downloaded file.
    *   **Important:** Copy all the executable files (files ending in `.exe`) from the folder you unzipped and paste them directly into the `pstools_app` folder in this project.
2.  **Masscan**:
    *   Download the latest **Masscan** Windows binary from its official GitHub releases page. Look for a file named something like `masscan-version-win.zip`.
    *   Unzip the downloaded file.
    *   Find `masscan.exe` inside the `bin` subfolder.
    *   **Important:** Copy `masscan.exe` and paste it directly into the `pstools_app` folder in this project.

### Step 2: Install Required Libraries

You need to install the necessary components for both the user interface and the backend.

1.  Open a command window (like Command Prompt or PowerShell) in the main project folder.
2.  **Install Python Libraries:** Run the following command:
    ```bash
    python -m pip install -r pstools_app/requirements.txt
    ```
3.  **Install Node.js Libraries:** After the first command finishes, run this command in the **same window**:
    ```bash
    npm install
    ```

### Step 3: Run the Application

Now, you will need to run the two parts of the application (backend and frontend) in two separate command windows.

**First Window: Run the Server (Backend)**

1.  Open a **new** command window in the main project folder.
2.  Run the server with the following command. **Leave this window open.**
    ```bash
    python -m flask run --host=0.0.0.0 --port=5000
    ```
    *If this command doesn't work, make sure Python is installed correctly and added to your system's PATH.*

**Second Window: Run the User Interface (Frontend)**

1.  Open another **new** command window.
2.  In the same main project folder, run the user interface with this command:
    ```bash
    npm run dev
    ```

### Step 4: Use the Application

1.  Open your web browser and go to: `http://localhost:9002`
2.  You will see a login form in the top bar. Use the credentials of a network administrator (Domain Admin).
    *   **Email:** `admin_user@your_domain.com`
    *   **Password:** The administrator's account password
3.  After a successful login, you can start discovering and managing devices on your network.

**Important Note:** The application must be run on a Windows machine that is connected to a domain. The account used to log in must be a member of the "Domain Admins" group.
