// daylight-backend/routes.js
const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');    // Import admin to use firestore.FieldValue

// Get a reference to the Firestore database
const db = admin.firestore();

// Middleware to verify Firebase ID Token (assuming it's passed from server.js)
// This middleware ensures only authenticated users can access this route
const verifyFirebaseIdToken = async (req, res, next) => {
    const idToken = req.headers.authorization?.split('Bearer ')[1];

    if (!idToken) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.firebaseUid = decodedToken.uid; // Add Firebase UID to request
        next(); // Proceed to the next middleware/route handler
    } catch (error) {
        console.error('Error verifying Firebase ID token:', error.message);
        return res.status(401).json({ message: 'Invalid token' });
    }
};

// Endpoint to submit a mood entry (POST)
router.post('/', verifyFirebaseIdToken, async (req, res) => {
    const { firebaseUid } = req;    // User's Firebase UID from token verification
    const { moodValue, notes, recordedAt } = req.body;  // Data sent from frontend

    if (!moodValue) {
        return res.status(400).json({ message: 'Mood value is required.' });
    }
    if (!recordedAt) {
        return res.status(400).json({ message: 'Recorded date and time is required.' });
    }
    
    try {
        // Convert ISO string to Firestore Timestamp
        const timestamp = admin.firestore.Timestamp.fromDate(new Date(recordedAt));

        const moodRef = db.collection('mood_ratings').add({
            userId: firebaseUid,    // Link the user via their Firebase UID
            moodValue: parseInt(moodValue), // Ensure it's an integer
            notes: notes || '', // Optional notes
            recordedAt: timestamp   // Use the provided timestamp
        });

        res.status(201).json({
            message: 'Mood entry added successfully.',
            moodId: moodRef.id
        });
    
    } catch (error) {
        console.error('Error adding mood entry to Firestore:', error);
        res.status(500).json({ error: 'Internal Server Error while adding mood.' });
    }
});

// Endpoint to fetch recent mood entries (GET)
router.get('/recent', verifyFirebaseIdToken, async (req, res) => {
    const { firebaseUid } = req;
    const days = parseInt(req.query.days || '30');   // Fetch moods from the last N days (default 30)

    const cutOffDate = new Date();
    cutOffDate.setDate(cutOffDate.getDate() - days);

    try {
        const moodQuery = db.collection('mood_ratings')
            .where('userId', '==', firebaseUid)
            .where('recordedAt', '>=', admin.firestore.Timestamp.fromDate(cutOffDate))  // Convert to Timestamp for query
            .orderBy('recordedAt', 'desc'); // Order by newest first

        const snapshot = await moodQuery.get();
        const moods = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        res.status(200).json({ moods });

    } catch (error) {
        console.error('Error fetching recent moods from Firestore:', error);
        res.status(500).json({ error: 'Internal Server Error while fetching moods.' });
    }
});

// Endpoint to update a mood entry (PUT)
router.put('/:id', verifyFirebaseIdToken, async (req, res) => {
    const { firebaseUid } = req;
    const moodId = req.params.id; // Get the mood document ID from the URL parameter
    const { moodValue, notes, recordedAt } = req.body;

    try {
        const moodRef = db.collection('mood_ratings').doc(moodId);
        const doc = await moodRef.get();

        if (!doc.exists) {
            return res.status(404).json({ message: 'Mood entry not found.' });
        }

        // Security check: Ensure the user trying to update owns this mood entry
        if (doc.data().userId !== firebaseUid) {
            return res.status(403).json({ message: 'Unauthorized to update this mood entry.' });
        }

        const updateData = {};
        if (moodValue !== undefined) {
            updateData.moodValue = parseInt(moodValue);
        }
        if (notes !== undefined) {
            updateData.notes = notes;
        }
        // If recordedAt is provided, convert it to a Firestore Timestamp and add to updateData
        if (recordedAt !== undefined) {
            updateData.recordedAt = admin.firestore.Timestamp.fromDate(new Date(recordedAt));
        }

        await moodRef.update(updateData);

        res.status(200).json({ message: 'Mood entry updated successfully.' });

    } catch (error) {
        console.error('Error updating mood entry in Firestore:', error);
        res.status(500).json({ error: 'Internal Server Error while updating mood.' });
    }
});

// Endpoint to delete a mood entry (DELETE)
router.delete('/:id', verifyFirebaseIdToken, async (req, res) => {
    const { firebaseUid } = req;
    const moodId = req.params.id; // Get the mood document ID from the URL parameter

    try {
        const moodRef = db.collection('mood_ratings').doc(moodId);
        const doc = await moodRef.get();

        if (!doc.exists) {
            return res.status(404).json({ message: 'Mood entry not found.' });
        }

        // Security check: Ensure the user trying to delete owns this mood entry
        if (doc.data().userId !== firebaseUid) {
            return res.status(403).json({ message: 'Unauthorized to delete this mood entry.' });
        }

        await moodRef.delete();

        res.status(204).send(); // 204 No Content, indicating successful deletion

    } catch (error) {
        console.error('Error deleting mood entry from Firestore:', error);
        res.status(500).json({ error: 'Internal Server Error while deleting mood.' });
    }
});

module.exports = router;