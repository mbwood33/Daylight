// server.js
require('dotenv').config(); // Load environment variables from .env

const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');    // Import Firebase Admin SDK

// Initialize Firebase Admin SDK (using the downloaded service account key)
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// Get a reference to the Firestore database
const db = admin.firestore();

const app = express();
const port = process.env.PORT || 5000;  // Use port from .env or default to 5000

// Middleware
app.use(cors());    // Enable CORS for all routes
app.use(express.json());    // Enable parsing of JSON request bodies


// --- Middleware to verify Firebase ID Token ---
// This middleware will be used by routes that require authentication
const verifyFirebaseIdToken = async (req, res, next) => {
    const idToken = req.headers.authorization?.split('Bearer ')[1];

    if (!idToken) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.firebaseUid = decodedToken.uid; // Add Firebase UID to request
        req.userEmail = decodedToken.email; // Add user email to request
        next(); // Proceed to the next middleware/route handler
    } catch (error) {
        console.error('Error verifying Firebase ID token:', error.message);
        return res.status(401).json({ message: 'Invalid token' });
    }
}

// Import the moods router
const moodsRouter = require('./routes/moods');

// --- API Routes ---
app.get('/api', (req, res) => {
    res.json({ message: 'Welcome to the Daylight App API!' });
});

// Example: Fetching data (no auth required for now, but will be protected later)
app.get('/api/data', async (req, res) => {
    // This will return current server time
    res.json({ currentTime: new Date().toISOString() });
});

// Endpoint to handle user login/registration (sync Firebase user with Firestore)
app.post('/api/auth/sync', verifyFirebaseIdToken, async (req, res) => {
    const { firebaseUid, userEmail } = req;

    try {
        const userRef = db.collection('users').doc(firebaseUid);
        const doc = await userRef.get();

        let userId; // In Firestore, we often just use the Firebase UID as the document ID
        
        if (!doc.exists) {
            // User does not exist, create a new entry in Firestore
            console.log(`Registering new user in Firestore: ${userEmail}`);
            await userRef.set({
                email: userEmail,
                firebaseUid: firebaseUid,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            userId = firebaseUid;   // Use Firebase UID as the user ID for Firestore
        } else {
            // User exists, retrieve their data (and confirm their ID)
            console.log(`User already exists in Firestore: ${userEmail}`);
            userId = doc.id;    // The doc.id is the firebaseUid here
        }

        res.status(200).json({
            message: 'User synced successfully with Firestore.',
            userId: userId, // This will be the FirebaseUid
            firebaseUid: firebaseUid
        });

    } catch (error) {
        console.error('Error syncing user with PostgreSQL:', error);
        res.status(500).json({ error: 'Internal Server Error during user sync.' });
    }
});

// Use the moods router for all requests strating with /api/moods
// Pass the verifyFirebaseIdToken middleware to the router directly
// This ensures all routes defined in moodsRouter are protected
app.use('/api/moods', verifyFirebaseIdToken, moodsRouter);

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});