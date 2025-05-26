// src/components/MoodTracker.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Button, TextField, CircularProgress, Alert, Paper, Slider, Grid, Typography,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow
} from '@mui/material';
// Import Highcharts
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

// Import Date/Time Pickers
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs from 'dayjs';

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
    const [editingMoodId, setEditingMoodId] = useState(null);   // State to store the ID of the mood being edited
    const [chartOptions, setChartOptions] = useState({});   // State for Highcharts options
    const [selectedDateTime, setSelectedDateTime] = useState(dayjs());  // State for the date/time picker
    const [highchartsReady, setHighchartsReady] = useState(false);  // State to track Highcharts module loading

    const moodMarks = [
        { value: 1, label: 'Very Bad' },
        { value: 2, label: 'Bad' },
        { value: 3, label: 'Neutral' },
        { value: 4, label: 'Good' },
        { value: 5, label: 'Very Good' },
    ];

    const API_BASE_URL = 'http://localhost:5000/api/moods';

    // Define mood colors
    const moodColors = {
        1: '#FF0000',
        2: '#FFA500',
        3: '#FFFF00',
        4: '#008000',
        5: '#0000FF',
    };

    // --- Effect to dynamically import and apply Highcharts modules ---
    // This ensures 'highcharts-more' is loaded and applied after the component mounts
    useEffect(() => {
        const loadHighchartsModules = async () => {
            try {
                // Dynamically import highcharts-more
                const HighchartsMoreModule = await import('highcharts/highcharts-more');
                if (HighchartsMoreModule && typeof HighchartsMoreModule === 'funtion') {
                    HighchartsMoreModule(Highcharts);
                } else if (HighchartsMoreModule && typeof HighchartsMoreModule.default === 'function') {
                    HighchartsMoreModule.default(Highcharts);
                } else {
                    console.warn("HighchartsMore module could not be initialized. Check its export strucutre.");
                }
            } catch (error) {
                console.error("Failed to load Highcharts modules:", error);
            }
        };

        loadHighchartsModules();
    }, []); // Empty dependency array means this runs once on mount    

    // --- Submit/Update Mood Function ---
    const handleSubmitMood = async () => {
        if (!user) {
            setMoodSubmitError("You must be logged in to submit a mood.");
            return;
        }
        if (moodValue < 1 || moodValue > 5) {
            setMoodSubmitError("Mood value must be between 1 and 5.");
            return;
        }
        if (!selectedDateTime || !selectedDateTime.isValid()) {
            setMoodSubmitError("Please select a valid date and time for your mood.");
            return;
        }

        setSubmittingMood(true);
        setMoodSubmitError(null);
        setMoodSubmitSuccess(false);

        try {
            const idToken = await user.getIdToken(true);    // Force refresh token

            let response;
            const moodData = { 
                moodValue: moodValue, 
                notes: moodNotes,
                recordedAt: selectedDateTime.toISOString()
            };
                
            if (editingMoodId) {
                // If editingMoodId is set, it's an update operation (PUT)
                response = await fetch(`${API_BASE_URL}/${editingMoodId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${idToken}`
                    },
                    body: JSON.stringify(moodData)
                });
            } else {
                // Otherwise, it's a new mood submission (POST)
                response = await fetch(API_BASE_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${idToken}`
                    },
                    body: JSON.stringify(moodData)
                });
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Failed to ${editingMoodId ? 'update' : 'submit' } mood: ${errorData.message || response.statusText}`);
            }

            console.log(`Mood ${editingMoodId ? 'updated' : 'submitted'} successfully.`);
            setMoodSubmitSuccess(true);
            setMoodNotes('');   // Clear notes after submission
            setMoodValue(3);    // Reset mood slider
            setSelectedDateTime(dayjs());   // Reset date/time to current
            setEditingMoodId(null); // Clear editing state
            fetchRecentMoods(); // Refresh recent moods after submission
        } catch (err) {
            console.error(`Error ${editingMoodId ? 'updating' : 'submitting'} mood:`, err);
            setMoodSubmitError(`Error ${editingMoodId ? 'updating' : 'submitting'} mood: ${err.message}`);
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

            const response = await fetch(`${API_BASE_URL}/recent?days=30`, {
                headers: {
                    'Authorization': `Bearer ${idToken}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Failed to fetch moods: ${errorData.message || response.statusText}`);
            }

            const data = await response.json();
            // Firestore timestamps come as { _seconds, _nanoseconds } objects.
            // Convert them to Date objects for better handling.
            const moodsWithDates = data.moods.map(mood => ({
                ...mood,
                recordedAt: mood.recordedAt && mood.recordedAt._seconds
                    ? new Date(mood.recordedAt._seconds * 1000)
                    : new Date()    // Fallback to current date if timestamp is missing
            }));
            setRecentMoods(moodsWithDates);
        } catch (err) {
            console.error("Error fetching recent moods:", err);
            setFetchMoodsError(`Error fetching recent moods: ${err.message}`);
            setRecentMoods([]);
        } finally {
            setFetchingMoods(false);
        }
    }, [user]);

    // --- Edit Mood Handler ---
    const handleEditMood = (mood) => {
        setMoodValue(mood.moodValue);
        setMoodNotes(mood.notes);
        setEditingMoodId(mood.id);  // Set the ID of the mood being edited
        setSelectedDateTime(dayjs(mood.recordedAt));    // Set the date/time picker to the mood's recordedAt
        setMoodSubmitError(null);   // Clear any previous errors
        setMoodSubmitSuccess(false);    // Clear any previous success messages
    };

    // --- Delete Mood Hanlder ---
    const handleDeleteMood = async (moodId) => {
        if (!user) {
            alert("You must be logged in to delete a mood.");
            return;
        }
        if (window.confirm("Are you sure you want to delete this mood entry?")) {
            setSubmittingMood(true);    // Use submitingMood for delete operation's loading state
            try {
                const idToken = await user.getIdToken(true);

                const response = await fetch(`${API_BASE_URL}/${moodId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${idToken}`
                    }
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(`Failed to delete mood: ${errorData.message || response.statusText}`);
                }

                console.log("Mood deleted successfully.");
                fetchRecentMoods(); // Refresh recent moods after deletion
            } catch (err) {
                console.error("Error deleting mood:", err);
                alert(`Error deleting mood: ${err.message}`);   // Use alert for immediate feedback
            } finally {
                setSubmittingMood(false);
            }
        }
    };

    // --- Highcharts Logic ---
    const prepareChartData = useCallback((moods) => {
        // Group moods by day and calculate average rating
        const dailyMoods = {};
        moods.forEach(mood => {
            const date = mood.recordedAt instanceof Date ? mood.recordedAt : new Date(mood.recordedAt._seconds * 1000);
            const dateString = date.toISOString().split('T')[0];    // Format as YYYY-MM-DD for consistent grouping

            if (!dailyMoods[dateString]) {
                dailyMoods[dateString] = { totalRating: 0, count: 0, originalDate: date };
            }
            dailyMoods[dateString].totalRating += mood.moodValue;
            dailyMoods[dateString].count++;
        });

        // Sort dates and prepare data points for Highcharts
        const sortedDates = Object.keys(dailyMoods).sort((a, b) => new Date(a) - new Date(b));
        const chartData = sortedDates.map(dateString => {
            const date = dailyMoods[dateString].originalDate;
            const avgRating = dailyMoods[dateString].totalRating / dailyMoods[dateString].count;
            const roundedRating = Math.round(avgRating);    // Round to nearest integer for color mapping

            return {
                x: date.getTime(),   // Highcharts expects milliseconds for datetime axis
                y: parseFloat(avgRating.toFixed(2)),    // Keep two decimal places for display
                marker: {
                    fillColor: moodColors[roundedRating] || '#CCCCCC',  // Use moodColors, fallback to grey
                    radius: 5,
                    symbol: 'circle'
                },
                dataLabels: {
                    enabled: true,
                    format: '{y:.2f}',  // Display average rating on points
                    style: {
                        fontSize: '10px',
                        fontWeight: 'bold',
                        color: 'black', // Ensure visibility
                        textOutline: '1px contrast' // Add outline for better contrast
                    }
                }
            };
        });

        return chartData;
    }, [moodColors]);

    // Effect to update chart options when recentMoods change
    useEffect(() => {
        if (recentMoods.length > 0) {
            const data = prepareChartData(recentMoods);
            setChartOptions({
                chart: {
                    type: 'spline',
                    zoomType: 'x',
                    height: 400
                },
                title: {
                    text: 'Daily Average Mood Over Time',
                    style: {
                        fontSize: '18px'
                    }
                },
                xAxis: {
                    type: 'datetime',
                    title: {
                        text: 'Date'
                    },
                    labels: {
                        format: '{value:%b %e}' // e.g., May 25
                    }
                },
                yAxis: {
                    title: {
                        text: 'Rating (1-5)'
                    },
                    min: 0,
                    max: 5,
                    tickInterval: 1 // Ensure ticks at 1, 2, 3, 4, 5
                },
                tooltip: {
                    headerFormat: '<b>{point.x:%A, %b, %e, %Y}</b><br/>',
                    pointFormat: 'Average Mood: {point.y:.2f} / 5'
                },
                legend: {
                    enabled: false  // No legend needed for single series
                },
                plotOptions: {
                    spline: {
                        lineWidth: 2,
                        states: {
                            hover: {
                                lineWidth: 3
                            }
                        },
                        marker: {
                            enabled: true,  // Enable markers on points
                            symbol: 'circle',
                            radius: 4,
                            lineWidth: 1,
                            lineColor: '#FFFFFF'    // White border for points
                        }
                    }
                },
                series: [{
                    name: 'Average Mood',
                    data: data,
                    color: 'rgb(75, 192, 192)'  // Default line color
                }],
                credits: {
                    enabled: false  // Hide Hicharts.com credit
                }
            });
        } else {
            setChartOptions({});    // Clear chart options if no data
        }
    }, [recentMoods, prepareChartData]);


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
                    <Grid item xs={12}>
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
                    <Grid item sx={12}>
                        <LocalizationProvider dateAdapter={AdapterDayjs}>
                            <DateTimePicker
                                label="Date & Time"
                                value={selectedDateTime}
                                onChange={(newValue) => setSelectedDateTime(newValue)}
                                renderInput={(params) => <TextField {...params} fullWidth sx={{ width: '400px' }} />}
                            />
                        </LocalizationProvider>
                    </Grid>
                    <Grid item xs={12}>
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
                            {submittingMood ? <CircularProgress size={24} /> : (editingMoodId ? 'Update Mood' : 'Submit Mood')}
                        </Button>
                        {editingMoodId && (
                            <Button
                                variant="outlined"
                                onClick={() => {
                                    setEditingMoodId(null);
                                    setMoodValue(3);
                                    setMoodNotes('');
                                    setSelectedDateTime(dayjs());   // Reset date/time on cancel
                                    setMoodSubmitError(null);
                                    setMoodSubmitSuccess(false);
                                }}
                                disabled={submittingMood}
                                sx={{ width: '140px' }}
                            >
                                Cancel Edit
                            </Button>
                        )}
                    </Grid>
                </Grid>
            </Box>

            <Box sx={{ mt: 4 }}>
                <Typography variant="h6" gutterBottom>
                    Your Mood History
                </Typography>
                {fetchMoodsError && <Alert severity="error" sx={{ mb: 2 }}>{fetchMoodsError}</Alert>}
                {fetchingMoods ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    recentMoods.length > 0 ? (
                        <TableContainer component={Paper} elevation={1}>
                            <Table sx={{ minWidth: 650 }} aria-label="mood history table">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Date/Time</TableCell>
                                        <TableCell align="right">Rating</TableCell>
                                        <TableCell>Notes</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {recentMoods.map((mood) => (
                                        <TableRow
                                            key={mood.id}
                                            sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                                        >
                                            <TableCell component="th" scope="row">
                                                {mood.recordedAt ? mood.recordedAt.toLocaleString() : 'Date unavailable'}
                                            </TableCell>
                                            <TableCell align="right">{mood.moodValue} / 5</TableCell>
                                            <TableCell>
                                                {mood.notes || '(No notes)'}
                                            </TableCell>
                                            <TableCell align="center">
                                                <Button variant="outlined" size="small" onClick={() => handleEditMood(mood)}>Edit</Button>
                                                <Button variant="outlined" color="error" size="small" onClick={() => handleDeleteMood(mood.id)}>Delete</Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
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

            <Box sx={{ mt: 4, height: 400 }}>   {/* Set a fixed height for the chart container */}
                <Typography variant="h6" guuterBottom>
                    Mood Over Time
                </Typography>
                {fetchingMoods ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                        <CircularProgress />
                    </Box>
                ): (
                    recentMoods.length > 0 ? (
                        <HighchartsReact highcharts={Highcharts} options={chartOptions} />
                    ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
                            No data available to display the mood graph.
                        </Typography>
                    )
                )}
            </Box>
        </Paper>
    );
}

export default MoodTracker;