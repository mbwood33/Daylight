import React, { useState, useEffect } from 'react';
import { 
  AppBar, Toolbar, Typography, Container, Box, Button, TextField,
  CircularProgress, Alert, Paper
} from '@mui/material';

// Import Firebase auth
import { auth } from './firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from 'firebase/auth';

// Import the MoodTracker component
import MoodTracker from './components/MoodTracker';

function App() {
  // Backend connection state
  const [backendMessage, setBackendMessage] = useState('');
  const [dbCurrentTime, setDbCurrentTime] = useState('');
  const [backendError, setBackendError] = useState(null);

  // Auth state
  const [user, setUser] = useState(null);  // Firebase user object
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState(null);
  const [isSignUp, setIsSignUp] = useState(false);  // Toggle for signup/login form

  // Firestore User Sync State (stores Firebase UID, which is the "userId")
  const [firestoreUserId, setFirestoreUserId] = useState(null); // This will be the Firebase UID
  const [syncingUser, setSyncingUser] = useState(false);
  const [syncError, setSyncError] = useState(null);
  
  // --- Backend API Calls ---
  const fetchWelcomeMessage = async () => {
    try {
      const response = await fetch('http://localhost:5000/api');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setBackendMessage(data.message);
      setBackendError(null);
    } catch (err) {
      console.error("Error fetching welcome message:", err);
      setBackendError(`Failed to fetch welcome message: ${err.message}. Is the backend running?`);
      setBackendMessage('');  // Clear message on error
    }
  };

  // Function to fetch database current time
  const fetchDbTime = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/data');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setDbCurrentTime(new Date(data.currentTime).toLocaleString());
      setBackendError(null);
    } catch (err) {
      console.error("Error fetching DB time:", err);
      setBackendError(`Failed to fetch DB time: ${err.message}. Is the backend running?`);
      setDbCurrentTime('');  // Clear time on error
    }
  };

  // --- Backend User Sync Function ---
  const syncUserWithBackend = async (firebaseUser) => {
    setSyncingUser(true);
    setSyncError(null);
    try {
      const idToken = await firebaseUser.getIdToken();  // Get the Firebase ID token

      const response = await fetch('http://localhost:5000/api/auth/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Backend sync failed: ${errorData.message || response.statusText}`);
      }

      const data = await response.json();
      setFirestoreUserId(data.userId);
      console.log("User synced successfully with Firestore:", data);
    } catch (err) {
      console.error("Error syncing user with backend (Firestore):", err);
      setSyncError(`Failed to sync user with backend: ${err.message}.`);
      setFirestoreUserId(null);
    } finally {
      setSyncingUser(false);
    }
  };


  // --- Firebase Authentication Handlers ---
  useEffect(() => {
    // Listener for Firebase Auth state changes
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
      if (currentUser) {
        syncUserWithBackend(currentUser);
      } else {
        setFirestoreUserId(null);  // Clear Firestore user ID on logout
      }
    });
    return () => unsubscribe();
  }, []);

  const handleAuthAction = async () => {
    setAuthError(null);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
        alert('Signed up successfully! You are now logged in.');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        alert('Logged in successfully!');
      }
    } catch (error) {
      console.error("Auth error:", error.message);
      setAuthError(error.message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      alert('Logged out successfully!');
      setEmail('');
      setPassword('');
    } catch (error) {
      console.error("Logout error:", error.message);
      setAuthError(error.message);
    }
  };


  // --- Initial Data Fetch on Mount ---
  useEffect(() => {
    fetchWelcomeMessage();
    fetchDbTime();
  }, []); // Empty dependency array means this runs once after the initial render


  // --- UI Loading State ---
  if (loadingAuth) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>Loading authentication...</Typography>
      </Box>
    );
  }


  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          {/* Logo in Top Bar */}
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
            <img
              src="/daylight_icon.png"
              alt="Daylight Icon"
              style={{ height: '32px', marginRight: '8px' }}
            />
          </Box>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Daylight
          </Typography>
          {user ? (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="subtitle1" sx={{ mr: 2 }}>
                Welcome, {user.email || 'User'}!
              </Typography>
              <Button color="inherit" onClick={handleLogout}>
                Logout
              </Button>
            </Box>
          ) : (
            <Typography variant="subtitle1">Not logged in</Typography>
          )}
        </Toolbar>
      </AppBar>
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Mood Tracker (Daylight)
        </Typography>
        <Typography variant="body1" paragraph>
          This is your React frontend for the mental health mood tracker.
        </Typography>

        {/* Backend Connection Status */}
        <Box sx={{ mt: 4, p: 2, border: '1px solid #ccc', borderRadius: '4px' }}>
          <Typography variant="h5" component="h2" gutterBottom>
            Backend Connection Test
          </Typography>
          {backendError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {backendError}
            </Alert>
          )}
          {backendMessage ? (
            <Typography variant="body1">
              Message from Backend: {backendMessage}
            </Typography>
          ) : (
            <Typography variant="body1">
              Attempting to connect to backend...
            </Typography>
          )}
          {dbCurrentTime && (
            <Typography variant="body1" sx={{ mt:1 }}>
              Current Server Time: {dbCurrentTime} (fetched from backend)
            </Typography>
          )}
          <Box sx={{ mt: 2 }}>
            <Button variant="contained" onClick={fetchWelcomeMessage} sx={{ mr: 1 }}>
              Refresh Welcome Message
            </Button>
            <Button variant="outlined" onClick={fetchDbTime}>
              Refresh Server Time
            </Button>
          </Box>
        </Box>

        {/* Authentication Section */}
        {!user && (
          <Paper elevation={3} sx={{ mt: 4, p: 3 }}>
            <Typography variant="h5" component="h2" gutterBottom>
              {isSignUp ? 'Sign Up' : 'Log In'}
            </Typography>
            {authError && <Alert severity="error" sx={{ mb: 2 }}>{authError}</Alert>}
            <TextField
              label="Email"
              type="email"
              fullWidth
              margin="normal"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              label="Password"
              type="password"
              fullWidth
              margin="normal"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              variant="contained"
              sx={{ mt: 2, mr: 2 }}
              onClick={handleAuthAction}
            >
              {isSignUp ? 'Sign Up' : 'Log In'}
            </Button>
            <Button
              variant="text"
              sx={{ mt: 2 }}
              onClick={() => setIsSignUp(!isSignUp)}
            >
              {isSignUp ? 'Already have an account? Log In' : 'Need an account? Sign Up'}
            </Button>
          </Paper>
        )}

        {/* Render MoodTracker only if user is logged in and synced */}
        {user && (
          <>
            {syncingUser && (
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 4, p: 3, justifyContent: 'center' }}>
                <CircularProgress size={24} sx={{ mr: 1 }} />
                <Typography variant="body2">Syncing user with backend...</Typography>
              </Box>
            )}
            {syncError && (
              <Alert severity="error" sx={{ mt: 4 }}>{syncError}</Alert>
            )}
            {/* Only render MoodTracker if sync is complete and successful */}
            {!syncingUser && firestoreUserId && (
              <MoodTracker user={user} firestoreUserId={firestoreUserId} />
            )}
          </>
        )}
        
      </Container>
    </Box>
  );
}

export default App;