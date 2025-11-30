AI Story Weave - Local Setup Instructions
This guide will walk you through setting up and running the AI Story Weave game on your local machine.

Prerequisites
Node.js and npm: You must have Node.js (which includes npm) installed. You can download it from nodejs.org.

Firebase Project: You need a Firebase project to handle the database and authentication.

Go to the Firebase Console.

Click "Add project" and follow the steps to create a new project.

Once your project is created, go to Project Settings (click the gear icon).

In the "General" tab, scroll down to "Your apps".

Click the web icon (</>) to create a new web app.

Give it a nickname (e.g., "AI Story Weave App") and register the app.

After registering, Firebase will show you a firebaseConfig object. Copy this object. You will need it soon.

Enable Firebase Services:

In your Firebase project, go to the Authentication section. Click "Get started" and enable the Anonymous sign-in provider.

Go to the Firestore Database section. Click "Create database", start in test mode for easy setup (you can secure it later), and choose a location.

Enable Gemini API:

Go to Google AI Studio.

Click "Get API key" and create a new API key. Copy this key. You will need it for the AI to work.

Step-by-Step Setup
1. Create Project Folder

Create a new folder for your project and navigate into it using your terminal:

mkdir ai-story-weave
cd ai-story-weave

2. Create package.json

Create a file named package.json in the root of your project folder and paste the following content into it. This file defines the project's dependencies.

(See the package.json file in the next artifact).

3. Install Dependencies

Once package.json is created, run the following command in your terminal to install all the necessary libraries:

npm install

4. Create Project Structure

Create the following folder and file structure inside your ai-story-weave folder:

ai-story-weave/
├── public/
│   └── index.html
├── src/
│   ├── App.js
│   ├── index.css
│   └── index.js
└── package.json

5. Populate the Files

Copy the code from the artifacts I'm providing into the corresponding files:

public/index.html

src/index.css

src/index.js

src/App.js

6. Configure Firebase and Gemini

Open the src/App.js file. You will need to make two important changes:

Firebase Config: Find the firebaseConfig object near the top of the file and replace the placeholder values with the actual config object you copied from your Firebase project.

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_FROM_FIREBASE",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

Gemini API Key: Find the triggerAITurn function. Inside it, locate the apiKeyGen constant and paste your Google AI API key there.

//... inside triggerAITurn function
const apiKeyGen = "YOUR_GEMINI_API_KEY"; // <-- PASTE YOUR KEY HERE
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKeyGen}`;
//...

7. Run the Application

After completing all the steps, run the following command in your terminal from the project's root directory:

npm start

This will start the development server, and your browser should automatically open to http://localhost:3000, where you can see and play the game!