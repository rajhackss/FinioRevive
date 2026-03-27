# Finio Dues Recovery Platform

Finio is a web-based platform designed for dues recovery management. It provides a role-based system to handle different stages of the recovery process, ensuring secure and assigned access to societies and members. The platform uses Firebase for authentication and real-time database management using Firestore.

## Features

- **Role-Based Access Control:** Distinct portals for various roles including Admin, Business Development Manager (BDM), Agent, Telecaller, Accounts, and Legal.
- **Real-Time Recovery Tracking:** Track dues and recovery progress in real-time.
- **Document Management:** Securely manage and access documents related to recovery processes.
- **Firebase Backend:** Utilizes Firebase Authentication for secure login and Firestore for scalable, real-time database queries structured around user permissions.

## Project Structure

The project consists of front-end web files connected to Firebase:

- **Authentication:** `login.html`, `login_style.css`, `script.js`
- **Role Modules:** 
  - `admin.html` / `.js` / `.css`
  - `bdm.html` / `.js` / `.css`
  - `agent.html` / `.js` / `.css`
  - `telecaller.html` / `.js` / `.css`
  - `legal.html` / `.js` / `.css`
  - `accounts.html` / `.js`
- **Configuration:** `firebase-config.js`, `firestore.rules`, `firebase.json`

## Setup & Local Development

1. Clone the repository.
2. Serve the directory using a local web server (e.g., Live Server in VS Code, XAMPP, or simple Python HTTP server).
3. Access `login.html` (or `home.html` if starting from the landing page) in your web browser.
4. Ensure you have the correct Firebase configuration keys in `firebase-config.js` to connect to the backend.

## Deployment

This project includes a `vercel.json` file, indicating it can be easily deployed via [Vercel](https://vercel.com).
