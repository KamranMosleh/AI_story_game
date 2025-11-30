# AI Story Weave --- Local Setup Guide

This README explains how to set up and run the **AI Story Weave** game
on your local machine.\
It is based on the documentation you provided. fileciteturn0file0

------------------------------------------------------------------------

## 🚀 Prerequisites

Before starting, make sure you have:

### **1. Node.js + npm**

Download and install from: https://nodejs.org/

### **2. A Firebase Project**

Used for authentication and Firestore database. 1. Visit Firebase
Console. 2. Create a new project. 3. Go to **Project Settings → General
→ Your Apps**. 4. Register a **Web App** and copy the `firebaseConfig`
object. 5. Enable: - **Authentication → Anonymous Sign‑in** -
**Firestore Database → Test Mode**

### **3. A Gemini API Key**

Used for AI story generation. - Visit **Google AI Studio** - Create and
copy an API key

------------------------------------------------------------------------

## 📁 Project Setup

### **1. Create Project Folder**

``` bash
mkdir ai-story-weave
cd ai-story-weave
```

### **2. Create `package.json`**

Paste the provided package.json content into a new file called
`package.json`.

### **3. Install Dependencies**

``` bash
npm install
```

### **4. Create the Project Structure**

    ai-story-weave/
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── App.js
    │   ├── index.css
    │   └── index.js
    └── package.json

### **5. Add Code Files**

Copy the appropriate code into:

-   `public/index.html`
-   `src/index.css`
-   `src/index.js`
-   `src/App.js`

------------------------------------------------------------------------

## 🔧 Configuration

### **1. Firebase Configuration**

In `src/App.js`, replace the placeholder config with your actual
Firebase config:

``` js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_FROM_FIREBASE",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### **2. Gemini API Key**

Inside the `triggerAITurn` function in `App.js`, replace:

``` js
const apiKeyGen = "YOUR_GEMINI_API_KEY";
```

with your actual key.

------------------------------------------------------------------------

## ▶️ Run the Application

Start the development server:

``` bash
npm start
```

Your browser should automatically open:

    http://localhost:3000

You are now ready to play **AI Story Weave**!

------------------------------------------------------------------------

## 📄 License

This project is provided as-is based on user-supplied documentation.

------------------------------------------------------------------------

## 🙌 Enjoy building and storytelling!
