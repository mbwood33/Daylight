import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Button, TextField, CircularProgress, Alert, Paper, Slider, Grid, Typography
} from '@mui/material';

// MoodTracker component will receive 'user' and 'firestoreUserId' as props
function MoodTracker({ user, firestoreUserId }) {
    // Mood Tracking State
    const [moodValue, setMoodValue] = useState(3);  // Default mood value
    const [moodNotes, setMoodNotes] = useState('');
    const [submittingMood, setSubmittingMood] = useState(false);
    const [moodSubmitError, setMoodSubmitError] = useState(null);
    const [moodSubmitSuccess, setMoodSubmitSuccess] = useState(false);
    const [recentMoods, setRecentMoods] = useState([]);
    const [fetchingMoods, setFetchingMoods] = useState(true);
    const [fetchMoodsError, setFetchMoodsError] = useState(null);

    const moodMarks = [
        { value: 1, label: 'Very Bad' },
        { value: 2, label: 'Bad' },
        { value: 3, label: 'Neutral' },
        { value: 4, label: 'Good' },
        { value: 5, label: 'Very Good' },
    ];

    // --- Submit Mood Function ---
    const handleSubmitMood = async () => {
        if (!user) {
            setMoodSubmitError("You must be logged in to submit a mood.");
            return;
        }
        if (moodValue < 1 || moodValue > 5) {
            setMoodSubmitError("Mood value must be between 1 and 5.");
            return;
        }

        setSubmittingMood(true);
        setMoodSubmitError(null);
        setMoodSubmitSuccess(false);

        try {
            const idToken = await user.getIdToken(true);    // Force refresh token

            const response = await fetch('http://localhost:5000/api/moods', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({ moodValue: moodValue, notes: moodNotes })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Failed to submit mood: ${errorData.message || response.statusText}`);
            }

            const data = await response.json();
            console.log("Mood submitted successfully:", data);
            setMoodSubmitSuccess(true);
            setMoodNotes('');   // Clear notes after submission
            setMoodValue(3);    // Reset mood slider
            fetchRecentMoods(); // Refresh recent moods after submission
        } catch (err) {
            console.error("Error submitting mood:", err);
            setMoodSubmitError(`Error submitting mood: ${err.message}`);
        } finally {
            setSubmittingMood(false);
        }
    };

    // --- Fetch Recent Moods Function ---
    const fetchRecentMoods = useCallback(async () => {
        if (!user) {
            setFetchMoodsError("You must be logged in to fetch moods.");
            setRecentMoods([]);
            return;
        }

        setFetchingMoods(true);
        setFetchMoodsError(null);
        try {
            const idToken = await user.getIdToken(true);    // Force refresh token

            const response = await fetch('http://localhost:5000/api/moods/recent?days=7', {
                headers: {
                    'Authorization': `Bearer ${idToken}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Failed to fetch moods: ${errorData.message || response.statusText}`);
            }

            const data = await response.json();
            setRecentMoods(data.moods);
        } catch (err) {
            console.error("Error fetching recent moods:", err);
            setFetchMoodsError(`Error fetching recent moods: ${err.message}`);
            setRecentMoods([]);
        } finally {
            setFetchingMoods(false);
        }
    }, [user, firestoreUserId]);

    // Fetch recent moods whenever the user or firestoreUserId changes
    useEffect(() => {
        if (user && firestoreUserId) {  // Only fetch if user is logged in AND synced
            fetchRecentMoods();
        }
    }, [user, firestoreUserId, fetchRecentMoods]);    // Dependencies: user and firestoreUserId


    return (
        <Paper elevation={3} sx={{ mt: 4, p: 3 }}>
            {/* Logo */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                <img
                    src="/daylight_logo_cropped.png"
                    alt="Daylight Logo"
                    style={{ maxWidth: '600px', heigth: 'auto' }}
                />
            </Box>
            <Typography variant="h5" component="h2" gutterBottom>
                Hello, {user?.email || 'User'}!
            </Typography>
            <Typography variant="body1">
                Your Firebase UID: {user?.uid}
            </Typography>
            {firestoreUserId && (   // firestoreUserId is passed as prop, so no sync logic here
                <Typography variant="body1" sx={{ mt: 1 }}>
                    Your Firestore User ID: {firestoreUserId}
                </Typography>
            )}

            <Box sx={{ mt: 4 }}>
                <Typography variant="h6" gutterBottom>
                    Log Your Mood
                </Typography>
                {moodSubmitError && <Alert severity="error" sx={{ mb: 2 }}>{moodSubmitError}</Alert>}
                {moodSubmitSuccess && <Alert severity="success" sx={{ mb: 2 }}>Mood submitted successfully!</Alert>}
                {/* --- Grid for Log Your Mood Section (Vertically Aligned & Centered) --- */}
                <Grid container spacing={2} direction="column" alignItems="center">
                    <Grid xs={12}>
                        <Typography id="mood-slider" gutterBottom>
                            Mood Rating (1-5)
                        </Typography>
                        <Slider
                            aria-labelledby="mood-slider"
                            value={moodValue}
                            onChange={(event, newValue) => setMoodValue(newValue)}
                            step={1}
                            marks={moodMarks}
                            min={1}
                            max={5}
                            valueLabelDisplay="auto"
                            sx={{ width: '400px' }}
                        />
                    </Grid>
                    <Grid xs={12}>
                        <TextField
                            label="Notes (optional)"
                            multiline
                            rows={3}
                            fullWidth
                            value={moodNotes}
                            onChange={(event) => setMoodNotes(event.target.value)}
                            variant="outlined"
                            sx={{ width: '400px' }}
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <Button
                            variant="contained"
                            onClick={handleSubmitMood}
                            disabled={submittingMood}
                            fullWidth
                            sx={{ width: '140px' }}
                        >
                            {submittingMood ? <CircularProgress size={24} /> : 'Submit Mood'}
                        </Button>
                    </Grid>
                </Grid>
            </Box>

            <Box sx={{ mt: 4 }}>
                <Typography variant="h6" gutterBottom>
                    Recent Mood Entries
                </Typography>
                {fetchMoodsError && <Alert severity="error" sx={{ mb: 2 }}>{fetchMoodsError}</Alert>}
                {fetchingMoods ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    recentMoods.length > 0 ? (
                        recentMoods.map((mood) => (
                            <Paper key={mood.id} elevation={1} sx={{ p: 2, mb: 1 }}>
                                <Typography variant="body2">
                                    Rating: {mood.moodValue} / 5
                                </Typography>
                                <Typography variant="body2">
                                    Notes: {mood.notes || '(No notes)'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {/* Ensure recordedAt exists and has _seconds before accessing */}
                                    {mood.recordedAt && mood.recordedAt._seconds ? new Date(mood.recordedAt._seconds * 1000).toLocaleString() : 'Date unavailable'}
                                </Typography>
                            </Paper>
                        ))
                    ) : (
                        <Typography variant="body2" color="text.secondary">
                            No recent mood entries found. Log your first mood!
                        </Typography>
                    )
                )}
                <Button variant="outlined" onClick={fetchRecentMoods} sx={{ mt: 2 }}>
                    Refresh Moods
                </Button>
            </Box>
        </Paper>
    );
}

export default MoodTracker;