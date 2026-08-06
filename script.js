const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const timeDisplay = document.getElementById('time-display');
const stateLabel = document.getElementById('state-label');
const cycleCount = document.getElementById('cycle-count');
const timerContainer = document.getElementById('timer-container');
const summaryOverlay = document.getElementById('summary-overlay');
const summaryText = document.getElementById('summary-text');
const closeSummaryBtn = document.getElementById('close-summary-btn');

const RUN_SECONDS = 60;
const SPRINT_SECONDS = 15;

let timerInterval;
let isRunning = false;
let currentState = 'READY'; // READY, RUN, SPRINT
let timeRemaining = RUN_SECONDS; // Initialize display with RUN_SECONDS
let totalRunCycles = 0;
let totalRunSeconds = 0;

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

function startTimer() {
    initAudio();
    
    if (!isRunning) {
        isRunning = true;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        
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
        
        summaryText.innerHTML = `You completed <strong>${totalRunCycles}</strong> full cycles<br>and ran for <strong>${timeString}</strong>.`;
        summaryOverlay.classList.remove('hidden');
        
        // Reset state for next session
        currentState = 'READY';
        timeRemaining = RUN_SECONDS;
        totalRunCycles = 0;
        totalRunSeconds = 0;
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
