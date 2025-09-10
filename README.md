# Dominion Control Panel - User Guide

This is a step-by-step guide to running the Dominion Control Panel application on a Windows computer.

---

## Before You Start

Make sure you have the following software installed on your computer:
1.  **Node.js**: This runs the user interface.
2.  **Python**: This runs the application's backend server.

---

## Important Prerequisites for Target Machines

For the application's tools to function correctly, you must enable and configure the following services and policies on all computers you intend to manage. The recommended way to do this is via Group Policy for domain environments.

### 1. Remote Registry Service

This service allows tools like `PsInfo` to gather detailed system information.

#### How to Enable via Group Policy (Recommended for Domains)

1.  Open **Group Policy Management**.
2.  Create or edit a Group Policy Object (GPO) that is linked to the Organizational Unit (OU) containing your computers.
3.  Navigate to: `Computer Configuration` -> `Policies` -> `Windows Settings` -> `Security Settings` -> `System Services`.
4.  Find **Remote Registry** in the list.
5.  Define the policy setting and set the service startup mode to **Automatic**.

### 2. User Rights Assignment

Ensure the administrator account being used has the correct permissions to connect remotely.

#### How to Configure via Group Policy

1.  In your GPO, navigate to: `Computer Configuration` -> `Policies` -> `Windows Settings` -> `Security Settings` -> `Local Policies` -> `User Rights Assignment`.
2.  Edit the following policies to include your administrator user or an appropriate admin group (e.g., "Domain Admins"):
    *   **Allow log on locally**
    *   **Log on as a service**
    *   **Allow log on through Remote Desktop Services** (if you intend to use RDP alongside this tool).
3.  Crucially, ensure the same user or group is **NOT** present in the following "Deny" policies:
    *   **Deny log on locally**
    *   **Deny log on as a service**
    *   **Deny log on through Remote Desktop Services**

---

## Setup and Run Instructions

Follow these steps in order to get the application working correctly. All commands should be run from the main project folder.

### Step 1: Set Up Essential Tools

These are external tools that give the application its core functionality.

1.  **PsTools**:
    *   Download **PsTools** from the official Microsoft website.
    *   Unzip the downloaded file.
    *   **Important:** Copy all the executable files (files ending in `.exe`) from the folder you unzipped and paste them directly into the `Tools` folder in this project.
2.  **Masscan (Required for Fast Network Discovery)**:
    *   **Masscan:** The application uses `masscan` for extremely fast network discovery.
        *   Download the latest **Masscan** Windows release from its [official GitHub releases page](https://github.com/robertdavidgraham/masscan/releases).
        *   On the releases page, find the latest version and download the file named `masscan-*.zip` (e.g., `masscan-2.0.5-win.zip`).
        *   Unzip the downloaded file.
        *   Find the `bin` directory, and inside it, you will find `masscan.exe`.
        *   **Important:** Copy `masscan.exe` and paste it directly into the `Tools` folder in this project.

### Step 2: Install Required Libraries

You need to install the necessary components for both the user interface and the backend.

1.  Open a command window (like Command Prompt or PowerShell) in the main project folder.
2.  **Install Python Libraries:** Run the following command:
    ```bash
    python -m pip install -r Tools/requirements.txt
    ```
3.  **Install Node.js Libraries:** After the first command finishes, run this command in the **same window**:
    ```bash
    npm install
    ```

### Step 3: Run the Application

Now, you will need to run the two parts of the application (backend and frontend) in two separate command windows.

**First Window: Run the Server (Backend)**

1.  Open a **new** command window.
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
