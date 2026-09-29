const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const timeDisplay = document.getElementById('time-display');
const stateLabel = document.getElementById('state-label');
const cycleCount = document.getElementById('cycle-count');
const timerContainer = document.getElementById('timer-container');
const summaryOverlay = document.getElementById('summary-overlay');
const summaryText = document.getElementById('summary-text');
const closeSummaryBtn = document.getElementById('close-summary-btn');
const gpsStatus = document.getElementById('gps-status');
const distanceDisplay = document.getElementById('distance-display');

const RUN_SECONDS = 60;
const SPRINT_SECONDS = 15;

let timerInterval;
let isRunning = false;
let currentState = 'READY'; // READY, RUN, SPRINT
let timeRemaining = RUN_SECONDS; // Initialize display with RUN_SECONDS
let totalRunCycles = 0;
let totalRunSeconds = 0;

// GPS and Tracking
let watchId = null;
let lastLat = null;
let lastLon = null;
let totalDistanceKm = 0;
let wakeLock = null;

// AudioContext for synthetic beep
let audioCtx;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playBeep() {
    if (!audioCtx) return;
    
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 frequency
    
    gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.5);
    
    // Web Vibration API
    if ('vibrate' in navigator) {
        navigator.vibrate([500, 200, 500]);
    }
}

function updateDisplay() {
    timeDisplay.textContent = timeRemaining.toString().padStart(2, '0');
    stateLabel.textContent = currentState;
    cycleCount.textContent = `Cycles: ${totalRunCycles}`;
    
    timerContainer.className = 'timer-container';
    if (currentState === 'RUN') {
        timerContainer.classList.add('run');
    } else if (currentState === 'SPRINT') {
        timerContainer.classList.add('sprint');
    }
}

function switchState(newState) {
    currentState = newState;
    if (newState === 'RUN') {
        timeRemaining = RUN_SECONDS;
    } else if (newState === 'SPRINT') {
        timeRemaining = SPRINT_SECONDS;
    }
    updateDisplay();
}

function tick() {
    if (timeRemaining > 0) {
        timeRemaining--;
        if (currentState === 'RUN') {
            totalRunSeconds++;
        }
        updateDisplay();
    } else {
        playBeep();
        if (currentState === 'RUN') {
            totalRunCycles++;
            switchState('SPRINT');
        } else if (currentState === 'SPRINT') {
            switchState('RUN');
        }
    }
}

// Haversine formula to calculate distance between two coordinates in km
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c;
}

async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
        }
    } catch (err) {
        console.error(`${err.name}, ${err.message}`);
    }
}

function releaseWakeLock() {
    if (wakeLock !== null) {
        wakeLock.release().then(() => {
            wakeLock = null;
        });
    }
}

function handlePosition(position) {
    const { latitude, longitude, accuracy } = position.coords;
    
    // Only use coordinates with reasonable accuracy (< 50 meters)
    if (accuracy > 50) return;

    if (lastLat !== null && lastLon !== null) {
        const dist = calculateDistance(lastLat, lastLon, latitude, longitude);
        totalDistanceKm += dist;
        distanceDisplay.textContent = `${totalDistanceKm.toFixed(2)} km`;
    }
    
    lastLat = latitude;
    lastLon = longitude;
    
    gpsStatus.textContent = 'GPS: Tracking';
    gpsStatus.className = 'gps-status active';
}

function handlePositionError(error) {
    gpsStatus.textContent = 'GPS: Error';
    gpsStatus.className = 'gps-status error';
    console.error('GPS Error:', error);
}

function startGPS() {
    if ('geolocation' in navigator) {
        gpsStatus.textContent = 'GPS: Locating...';
        gpsStatus.className = 'gps-status';
        watchId = navigator.geolocation.watchPosition(handlePosition, handlePositionError, {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 5000
        });
    } else {
        gpsStatus.textContent = 'GPS: Not Supported';
        gpsStatus.className = 'gps-status error';
    }
}

function stopGPS() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    gpsStatus.textContent = 'GPS: Standby';
    gpsStatus.className = 'gps-status';
}

function startTimer() {
    initAudio();
    
    if (!isRunning) {
        isRunning = true;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        
        // Reset tracking vars
        lastLat = null;
        lastLon = null;
        
        requestWakeLock();
        startGPS();
        
        // Start run cycle immediately
        switchState('RUN');
        timerInterval = setInterval(tick, 1000);
    }
}

function stopTimer() {
    if (isRunning) {
        clearInterval(timerInterval);
        isRunning = false;
        
        startBtn.disabled = false;
        stopBtn.disabled = true;
        
        stopGPS();
        releaseWakeLock();
        
        // Calculate and show summary
        const minutes = Math.floor(totalRunSeconds / 60);
        const seconds = totalRunSeconds % 60;
        
        let timeString = '';
        if (minutes > 0) {
            timeString += `${minutes} minute${minutes !== 1 ? 's' : ''}`;
        }
        if (seconds > 0) {
            if (timeString) timeString += ' and ';
            timeString += `${seconds} second${seconds !== 1 ? 's' : ''}`;
        }
        if (totalRunSeconds === 0) {
            timeString = '0 seconds';
        }
        
        summaryText.innerHTML = `You completed <strong>${totalRunCycles}</strong> full cycles<br>ran for <strong>${timeString}</strong><br>and covered <strong>${totalDistanceKm.toFixed(2)} km</strong>.`;
        summaryOverlay.classList.remove('hidden');
        
        // Reset state for next session
        currentState = 'READY';
        timeRemaining = RUN_SECONDS;
        totalRunCycles = 0;
        totalRunSeconds = 0;
        totalDistanceKm = 0;
        distanceDisplay.textContent = '0.00 km';
        updateDisplay();
    }
}

startBtn.addEventListener('click', startTimer);
stopBtn.addEventListener('click', stopTimer);
closeSummaryBtn.addEventListener('click', () => {
    summaryOverlay.classList.add('hidden');
});

// Initialize display on load
updateDisplay();
