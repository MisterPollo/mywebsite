// Speed Reader Application - Capacitor Version
// Plugins will be available via Capacitor.Plugins
let App, ScreenOrientation, KeepAwake;

// Use Capacitor's platform ready event
document.addEventListener('DOMContentLoaded', onDeviceReady, false);

let words = [];
let currentWordIndex = 0;
let currentPartIndex = 0;
let timer = null;
let wordsPerMinute = 250;
let interval = 0;
let isRunning = false;
let isRepeatEnabled = false;
let repeatCount = 0;
let audioContext = null;
let currentTextSize = 32;
let sleepTimer = null;
let sleepTimeRemaining = 0;
let currentOrientation = 'auto';
let autoSaveTimer = null;
const AUTO_SAVE_INTERVAL = 5000; // Auto-save every 5 seconds
let currentFileName = null;
const STORAGE_PREFIX = 'speedreader_';
let mainTextOpacity = 100;
let sideTextOpacity = 50;
let backgroundOpacity = 100;
let yellowGuideEnabled = false;
let sentencePauseEnabled = true;

// DOM Elements
const leftBox = document.getElementById('leftBox');
const middleBox = document.getElementById('middleBox');
const rightBox = document.getElementById('rightBox');
const toastElement = document.getElementById('toast');
const browseBtn = document.getElementById('browseBtn');
const browseDocBtn = document.getElementById('browseDocBtn');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const fileInput = document.getElementById('fileInput');
const docInput = document.getElementById('docInput');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const progressContainer = document.getElementById('progressContainer');
const loopCheckbox = document.getElementById('loopCheckbox');
const progressToggle = document.getElementById('progressToggle');
const menuBtn = document.getElementById('menuBtn');
const menuOverlay = document.getElementById('menuOverlay');
const closeMenuBtn = document.getElementById('closeMenuBtn');
const textDisplay = document.getElementById('textDisplay');
const currentWpmDisplay = document.getElementById('currentWpm');
const timerDisplay = document.getElementById('timerDisplay');
const progressBarFill = document.getElementById('progressBarFill');
const progressBarThumb = document.getElementById('progressBarThumb');
const proUpgradeBanner = document.getElementById('proUpgradeBanner');
const upgradeModal = document.getElementById('upgradeModal');
const closeUpgradeModal = document.getElementById('closeUpgradeModal');
const purchaseProBtn = document.getElementById('purchaseProBtn');
const restorePurchaseBtn = document.getElementById('restorePurchaseBtn');
const mainTextOpacitySlider = document.getElementById('mainTextOpacity');
const mainTextOpacityValue = document.getElementById('mainTextOpacityValue');
const sideTextOpacitySlider = document.getElementById('sideTextOpacity');
const sideTextOpacityValue = document.getElementById('sideTextOpacityValue');
const backgroundOpacitySlider = document.getElementById('backgroundOpacity');
const backgroundOpacityValue = document.getElementById('backgroundOpacityValue');
const yellowGuideToggle = document.getElementById('yellowGuideToggle');
const sentencePauseToggle = document.getElementById('sentencePauseToggle');
const mainLoadTextBtn = document.getElementById('mainLoadTextBtn');
const mainLoadDocBtn = document.getElementById('mainLoadDocBtn');
const mainLoadButtons = document.querySelector('.main-load-buttons');
const reloadIcon = document.getElementById('reloadIcon');

function onDeviceReady() {
    console.log('Device is ready');

    // Initialize Capacitor plugins if available
    if (typeof Capacitor !== 'undefined' && Capacitor.Plugins) {
        App = Capacitor.Plugins.App;
        ScreenOrientation = Capacitor.Plugins.ScreenOrientation;
        KeepAwake = Capacitor.Plugins.KeepAwake;
        console.log('Capacitor plugins initialized');
    } else {
        console.log('Running in browser mode - Capacitor plugins not available');
    }

    // Initialize Purchase Manager
    if (typeof PurchaseManager !== 'undefined') {
        PurchaseManager.init();
    }

    // Initialize event listeners
    initEventListeners();

    // Update Pro UI based on purchase status
    updateProUI();

    // Listen for Pro status changes
    document.addEventListener('proStatusChanged', function(event) {
        updateProUI();
    });

    // Handle Android back button using Capacitor (only if App plugin is available)
    if (App && App.addListener) {
        App.addListener('backButton', ({ canGoBack }) => {
            console.log('Back button pressed');

            // If upgrade modal is open, close it
            if (upgradeModal && upgradeModal.classList.contains('active')) {
                console.log('Closing upgrade modal');
                closeUpgradeModal();
                return;
            }

            // If menu is open, close it
            if (menuOverlay && menuOverlay.classList.contains('active')) {
                console.log('Closing menu');
                closeMenu();
                return;
            }

            console.log('Exiting app');
            // Otherwise, exit the app
            App.exitApp();
        });
    }

    // Set initial WPM value
    updateWPMDisplay();

    // Apply initial opacity settings
    updateMainTextOpacity();
    updateSideTextOpacity();
    updateBackgroundOpacity();

    // Set default portrait orientation (only if plugin is available)
    if (ScreenOrientation) {
        setOrientation('portrait');
    }

    // Hide ad banner for Pro users
    updateAdBannerVisibility();

    // Initialize with sample text
    initializeSampleText();

    // Initialize AdMob after a delay to ensure plugin is fully loaded
    setTimeout(function() {
        console.log('Attempting AdMob initialization...');
        console.log('window.admob available?', typeof window.admob);
        if (window.AdManager) {
            AdManager.initialize();
        }
    }, 2000);
}

function initEventListeners() {
    // Menu controls
    menuBtn.addEventListener('click', openMenu);
    closeMenuBtn.addEventListener('click', closeMenu);
    menuOverlay.addEventListener('click', function(e) {
        if (e.target === menuOverlay) closeMenu();
    });
    
    // Main controls
    browseBtn.addEventListener('click', loadTextFile);
    browseDocBtn.addEventListener('click', loadDocFile);
    startBtn.addEventListener('click', toggleStartPause);
    restartBtn.addEventListener('click', restartReading);

    // Reload icon click
    if (reloadIcon) {
        reloadIcon.addEventListener('click', function() {
            restartReading();
            hideReloadIcon();
        });
    }
    fileInput.addEventListener('change', handleFileSelect);
    docInput.addEventListener('change', handleDocSelect);

    // Main screen load buttons
    if (mainLoadTextBtn) {
        mainLoadTextBtn.addEventListener('click', loadTextFile);
    }
    if (mainLoadDocBtn) {
        mainLoadDocBtn.addEventListener('click', loadDocFile);
    }
    loopCheckbox.addEventListener('change', toggleLoop);
    progressToggle.addEventListener('change', toggleProgress);
    
    // WPM controls
    document.querySelectorAll('.wpm-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            setWPM(parseInt(this.dataset.wpm));
        });
    });
    document.getElementById('wpmUp').addEventListener('click', () => adjustWPM(10));
    document.getElementById('wpmDown').addEventListener('click', () => adjustWPM(-10));
    
    // Sleep timer controls
    document.querySelectorAll('.timer-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            if (this.id === 'timerOff') {
                setSleepTimer(0);
            } else {
                setSleepTimer(parseInt(this.dataset.minutes));
            }
        });
    });
    
    // Orientation controls
    document.getElementById('orientationAuto').addEventListener('click', () => setOrientation('auto'));
    document.getElementById('orientationPortrait').addEventListener('click', () => setOrientation('portrait'));
    document.getElementById('orientationLandscape').addEventListener('click', () => setOrientation('landscape'));
    
    // Text display interactions
    textDisplay.addEventListener('click', toggleStartPause);
    
    // Touch events for pinch-to-zoom
    let initialDistance = 0;
    let initialTextSize = currentTextSize;
    
    // Note: Side touch functionality is now handled in initSideTouchControls()
    // Keep pinch-to-zoom for 2 fingers
    textDisplay.addEventListener('touchstart', function(e) {
        if (e.touches.length === 2) {
            initialDistance = getDistance(e.touches[0], e.touches[1]);
            initialTextSize = currentTextSize;
        }
    }, { passive: true });
    
    textDisplay.addEventListener('touchmove', function(e) {
        if (e.touches.length === 2) {
            e.preventDefault();
            const currentDistance = getDistance(e.touches[0], e.touches[1]);
            const scale = currentDistance / initialDistance;
            const newSize = Math.max(16, Math.min(60, initialTextSize * scale));
            updateTextSize(newSize);
        }
    });
    
    // Progress bar slider functionality
    initProgressBarSlider();
    
    // Left/right side touch and hold functionality
    initSideTouchControls();

    // Pro upgrade controls
    proUpgradeBanner.addEventListener('click', showUpgradeModal);
    closeUpgradeModal.addEventListener('click', hideUpgradeModal);
    purchaseProBtn.addEventListener('click', handlePurchase);
    restorePurchaseBtn.addEventListener('click', handleRestore);
    upgradeModal.addEventListener('click', function(e) {
        if (e.target === upgradeModal) hideUpgradeModal();
    });

    // Display settings controls
    mainTextOpacitySlider.addEventListener('input', function() {
        mainTextOpacity = parseInt(this.value);
        mainTextOpacityValue.textContent = mainTextOpacity + '%';
        updateMainTextOpacity();
    });

    sideTextOpacitySlider.addEventListener('input', function() {
        sideTextOpacity = parseInt(this.value);
        sideTextOpacityValue.textContent = sideTextOpacity + '%';
        updateSideTextOpacity();
    });

    backgroundOpacitySlider.addEventListener('input', function() {
        backgroundOpacity = parseInt(this.value);
        backgroundOpacityValue.textContent = backgroundOpacity + '%';
        updateBackgroundOpacity();
    });

    // Reading guide
    yellowGuideToggle.addEventListener('change', function() {
        yellowGuideEnabled = this.checked;
        updateGuides();
    });

    // Sentence pause toggle
    sentencePauseToggle.addEventListener('change', function() {
        sentencePauseEnabled = this.checked;
    });

    // Keyboard events
    document.addEventListener('keydown', function(event) {
        if (event.key === ' ') {
            toggleStartPause();
            event.preventDefault();
        }
    });
}

function initializeSampleText() {
    // Show main load buttons
    showMainButtons();

    // Clear text display
    words = [];
    currentWordIndex = 0;
    currentPartIndex = 0;

    middleBox.textContent = "";
    leftBox.textContent = "";
    rightBox.textContent = "";
}

// Helper function to show upgrade modal from global scope
window.SpeedReader = window.SpeedReader || {};
window.SpeedReader.showUpgradeModal = function() {
    showUpgradeModal();
};

function loadTextFile() {
    fileInput.click();
}

function loadDocFile() {
    if (!checkProFeature('PDF/EPUB support')) return;
    docInput.click();
}

function hideMainButtons() {
    if (mainLoadButtons) {
        mainLoadButtons.style.display = 'none';
    }
}

function showMainButtons() {
    if (mainLoadButtons) {
        mainLoadButtons.style.display = 'flex';
    }
}

function showReloadIcon() {
    if (reloadIcon) {
        reloadIcon.style.display = 'flex';
    }
}

function hideReloadIcon() {
    if (reloadIcon) {
        reloadIcon.style.display = 'none';
    }
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        // Hide buttons immediately when file is selected
        hideMainButtons();

        // Accept text files, even if MIME type is not correctly detected
        const fileName = file.name.toLowerCase();
        const isTextFile = file.type === 'text/plain' ||
                          fileName.endsWith('.txt') ||
                          fileName.endsWith('.text') ||
                          file.type === '' || // Sometimes Android doesn't set MIME type
                          file.type.startsWith('text/');

        if (isTextFile) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const text = e.target.result;
                // Split by whitespace and filter out empty strings
                words = text.split(/\s+/).filter(word => word.length > 0);
                if (words.length > 0) {
                    currentFileName = file.name;
                    currentWordIndex = 0;
                    currentPartIndex = 0;

                    // Hide reload icon when loading new file
                    hideReloadIcon();

                    // Try to load saved progress for this file
                    const progressLoaded = loadProgress(currentFileName);

                    if (!progressLoaded) {
                        updateDisplayWithParts();
                        updateProgressBar();

                        // Show success toast
                        showToast(`File loaded successfully (${words.length} words)`);
                    }

                    startBtn.textContent = 'Start';
                    isRunning = false;
                }
            };
            reader.onerror = function() {
                middleBox.textContent = "Error reading file";
                middleBox.style.color = "#ff5555";
            };
            reader.readAsText(file);
        } else {
            middleBox.textContent = "Please select a text file";
            middleBox.style.color = "#ff5555";
            setTimeout(() => {
                updateDisplayWithParts();
            }, 2000);
        }
    }
}

function handleDocSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Hide buttons immediately when file is selected
    hideMainButtons();

    const fileName = file.name.toLowerCase();

    if (file.type === 'application/pdf' || fileName.endsWith('.pdf')) {
        handlePdfFile(file);
    } else if (file.type === 'application/epub+zip' || fileName.endsWith('.epub')) {
        handleEpubFile(file);
    } else {
        middleBox.textContent = "Unsupported file type";
        middleBox.style.color = "#ff5555";
        setTimeout(() => {
            updateDisplayWithParts();
        }, 2000);
    }
}

async function handlePdfFile(file) {
    middleBox.textContent = "Loading PDF...";
    middleBox.style.color = "#4caf50";

    try {
        const arrayBuffer = await file.arrayBuffer();

        // Use PDF.js if available
        if (typeof pdfjsLib !== 'undefined') {
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullText = '';

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += pageText + ' ';
            }

            processDocumentText(fullText, file.name);
        } else {
            // Fallback: Try simple text extraction
            const text = await extractTextFromPDF(arrayBuffer);
            if (text) {
                processDocumentText(text, file.name);
            } else {
                throw new Error('PDF.js library not loaded');
            }
        }
    } catch (error) {
        console.error('PDF loading error:', error);
        middleBox.textContent = "Error loading PDF";
        middleBox.style.color = "#ff5555";
        setTimeout(() => {
            updateDisplayWithParts();
        }, 2000);
    }
}

async function handleEpubFile(file) {
    middleBox.textContent = "Loading EPUB...";
    middleBox.style.color = "#4caf50";

    try {
        const arrayBuffer = await file.arrayBuffer();

        // Use JSZip to extract EPUB contents
        if (typeof JSZip !== 'undefined') {
            const zip = await JSZip.loadAsync(arrayBuffer);
            let fullText = '';

            // Get all HTML/XHTML files from the EPUB
            const htmlFiles = Object.keys(zip.files).filter(name =>
                name.endsWith('.html') || name.endsWith('.xhtml') || name.endsWith('.htm')
            );

            // Extract text from each HTML file
            for (const fileName of htmlFiles) {
                const content = await zip.files[fileName].async('text');
                // Remove HTML tags and extract text
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = content;
                const text = tempDiv.textContent || tempDiv.innerText || '';
                fullText += text + ' ';
            }

            processDocumentText(fullText, file.name);
        } else {
            throw new Error('JSZip library not loaded');
        }
    } catch (error) {
        console.error('EPUB loading error:', error);
        middleBox.textContent = "Error loading EPUB";
        middleBox.style.color = "#ff5555";
        setTimeout(() => {
            updateDisplayWithParts();
        }, 2000);
    }
}

// Simple PDF text extraction fallback (limited functionality)
async function extractTextFromPDF(arrayBuffer) {
    // This is a very basic fallback that won't work for all PDFs
    // Real implementation should use PDF.js
    const text = new TextDecoder().decode(arrayBuffer);
    const matches = text.match(/\(([^)]+)\)/g);
    if (matches) {
        return matches.map(m => m.slice(1, -1)).join(' ');
    }
    return null;
}

function processDocumentText(text, fileName) {
    // Clean up the text
    text = text.replace(/\s+/g, ' ').trim();

    // Split into words
    words = text.split(/\s+/).filter(word => word.length > 0);

    if (words.length > 0) {
        currentFileName = fileName;
        currentWordIndex = 0;
        currentPartIndex = 0;

        // Hide reload icon when loading new file
        hideReloadIcon();

        // Try to load saved progress for this file
        const progressLoaded = loadProgress(currentFileName);

        if (!progressLoaded) {
            updateDisplayWithParts();
            updateProgressBar();

            // Show success toast
            showToast(`File loaded successfully (${words.length} words)`);
        }

        startBtn.textContent = 'Start';
        isRunning = false;
        closeMenu();
    } else {
        middleBox.textContent = "No text found in document";
        middleBox.style.color = "#ff5555";
        setTimeout(() => {
            updateDisplayWithParts();
        }, 2000);
    }
}

function toggleStartPause() {
    if (words.length === 0) return;

    if (isRunning) {
        stopTimer();
        startBtn.textContent = 'Resume';
    } else {
        startTimer();
        startBtn.textContent = 'Pause';
    }
    closeMenu();
}

function startTimer() {
    if (timer) return;

    // Hide reload icon when starting to read
    hideReloadIcon();

    isRunning = true;
    interval = Math.floor(60000 / wordsPerMinute);

    timer = setInterval(function() {
        processNextWord();
    }, interval);
    
    // Start auto-save timer when reading begins
    startAutoSaveTimer();
}

function stopTimer() {
    if (timer) {
        clearInterval(timer);
        timer = null;
        isRunning = false;
    }
    
    // Stop auto-save timer when reading stops
    stopAutoSaveTimer();
    
    // Do one final auto-save when stopping
    autoSaveProgress();
}

function restartReading() {
    stopTimer();
    currentWordIndex = 0;
    currentPartIndex = 0;
    startBtn.textContent = 'Start';
    updateDisplay();
    updateProgressBar();
    closeMenu();
}

// Menu functions
function openMenu() {
    menuOverlay.classList.add('active');
}

function closeMenu() {
    menuOverlay.classList.remove('active');
}

// WPM functions
function setWPM(wpm) {
    // Check if this is a Pro feature
    if (wpm >= 500 && !checkProFeature('high WPM')) return;

    wordsPerMinute = Math.max(50, Math.min(600, wpm));
    updateWPMDisplay();
    updateActiveWPMButton();
    if (isRunning) {
        stopTimer();
        startTimer();
    }
    closeMenu();
}

function adjustWPM(delta) {
    if (!checkProFeature('WPM adjustment')) return;
    setWPM(wordsPerMinute + delta);
}

function updateWPMDisplay() {
    if (currentWpmDisplay) {
        currentWpmDisplay.textContent = wordsPerMinute;
    }
}

function updateActiveWPMButton() {
    document.querySelectorAll('.wpm-btn').forEach(btn => {
        btn.classList.remove('active');
        if (parseInt(btn.dataset.wpm) === wordsPerMinute) {
            btn.classList.add('active');
        }
    });
}

// Progress bar toggle
function toggleProgress() {
    if (progressToggle.checked) {
        progressContainer.classList.remove('hidden');
    } else {
        progressContainer.classList.add('hidden');
    }
}

// Text size functions
function getDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function updateTextSize(size) {
    currentTextSize = size;
    const textBoxes = document.querySelectorAll('.text-box');
    textBoxes.forEach(box => {
        box.style.fontSize = `${size}px`;
    });
    updateGuides(); // Update guide positions when text size changes
}

// Display settings functions
function updateMainTextOpacity() {
    if (middleBox) {
        middleBox.style.opacity = mainTextOpacity / 100;
    }
}

function updateSideTextOpacity() {
    if (leftBox) {
        leftBox.style.opacity = sideTextOpacity / 100;
    }
    if (rightBox) {
        rightBox.style.opacity = sideTextOpacity / 100;
    }
}

function updateBackgroundOpacity() {
    if (textDisplay) {
        textDisplay.style.backgroundColor = `rgba(18, 18, 18, ${backgroundOpacity / 100})`;
    }
}

// Reading guide functions
function updateGuides() {
    if (yellowGuideEnabled) {
        middleBox.classList.add('yellow-guide-active');
    } else {
        middleBox.classList.remove('yellow-guide-active');
    }
}

function toggleLoop() {
    if (!checkProFeature('options')) return;
    isRepeatEnabled = loopCheckbox.checked;
}

function processNextWord() {
    if (words.length === 0 || currentWordIndex >= words.length) {
        if (isRepeatEnabled) {
            // Reset to beginning and play sound
            currentWordIndex = 0;
            currentPartIndex = 0;
            repeatCount++;
            
            // Play beep sound if available
            playBeepSound();
        } else {
            // End of text
            stopTimer();
            middleBox.textContent = "End of text";
            middleBox.style.color = "#757575";
            leftBox.textContent = "";
            rightBox.textContent = "";
            showReloadIcon();
            return;
        }
    }
    
    if (currentWordIndex < words.length) {
        const currentWord = words[currentWordIndex];
        
        if (currentWord.length > 6) {
            // Word is longer than 6 characters - split into parts
            const partsCount = Math.ceil(currentWord.length / 6);
            const startIndex = (currentPartIndex % partsCount) * 6;
            const length = Math.min(6, currentWord.length - startIndex);
            const currentPart = currentWord.substring(startIndex, startIndex + length);
            
            // Display the current part in middle box
            middleBox.textContent = currentPart;
            middleBox.style.color = "#4caf50";
            
            // Prepare upcoming parts for right box
            let upcomingParts = [];
            if (currentPartIndex < partsCount - 1) {
                const remainingParts = partsCount - 1 - currentPartIndex;
                for (let i = 1; i <= Math.min(remainingParts, 3); i++) { // Show max 3 upcoming parts
                    const partIndex = (currentPartIndex + i) % partsCount;
                    const partStart = partIndex * 6;
                    const partLength = Math.min(6, currentWord.length - partStart);
                    if (partLength > 0) {
                        upcomingParts.push(currentWord.substring(partStart, partStart + partLength));
                    }
                }
            }
            rightBox.textContent = upcomingParts.join('');
            rightBox.style.color = "#757575";
            
            // Prepare passed parts for left box
            let passedParts = [];
            if (currentPartIndex > 0) {
                const maxPassedParts = Math.min(currentPartIndex, 3); // Show max 3 passed parts
                for (let i = currentPartIndex - 1; i >= Math.max(0, currentPartIndex - maxPassedParts); i--) {
                    const partStart = i * 6;
                    const partLength = Math.min(6, currentWord.length - partStart);
                    if (partLength > 0) {
                        passedParts.unshift(currentWord.substring(partStart, partStart + partLength));
                    }
                }
            }
            leftBox.textContent = passedParts.join('');
            leftBox.style.color = "#757575";
            
            // Move to next part
            currentPartIndex++;
            
            if (currentPartIndex >= partsCount) {
                // Finished showing all parts of the word
                currentPartIndex = 0;
                currentWordIndex++;

                // Add a small delay for better readability (if enabled)
                if (sentencePauseEnabled && (currentWord.endsWith('.') || currentWord.endsWith('!') || currentWord.endsWith('?'))) {
                    stopTimer();
                    setTimeout(() => {
                        startTimer();
                    }, interval * 1.5);
                }
            }
        } else {
            // Word is 6 characters or less - show entire word
            middleBox.textContent = currentWord;
            middleBox.style.color = "#4caf50";
            leftBox.textContent = "";
            rightBox.textContent = "";

            currentWordIndex++;

            // Add a small delay for sentence endings (same as for long words, if enabled)
            if (sentencePauseEnabled && (currentWord.endsWith('.') || currentWord.endsWith('!') || currentWord.endsWith('?'))) {
                stopTimer();
                setTimeout(() => {
                    startTimer();
                }, interval * 1.5);
            }
        }

        updateProgressBar();
    }
}

function updateDisplay() {
    if (words.length > 0 && currentWordIndex < words.length) {
        const currentWord = words[currentWordIndex];
        if (currentWord.length > 6) {
            // For long words, show the first part
            const partsCount = Math.ceil(currentWord.length / 6);
            const startIndex = 0;
            const length = Math.min(6, currentWord.length - startIndex);
            const currentPart = currentWord.substring(startIndex, startIndex + length);
            
            middleBox.textContent = currentPart;
            middleBox.style.color = "#4caf50";
            rightBox.textContent = "";
            leftBox.textContent = "";
        } else {
            // For short words
            middleBox.textContent = currentWord;
            middleBox.style.color = "#4caf50";
            leftBox.textContent = "";
            rightBox.textContent = "";
        }
    } else {
        middleBox.textContent = "No text loaded";
        middleBox.style.color = "#757575";
        leftBox.textContent = "";
        rightBox.textContent = "";
    }

    // Update guides after display update
    updateGuides();
}

function updateProgressBar() {
    if (words.length > 0) {
        // Calculate progress based on word parts, not just word index
        let totalSteps = 0;
        let currentSteps = 0;
        
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const steps = word.length > 6 ? Math.ceil(word.length / 6) : 1;
            
            if (i < currentWordIndex) {
                currentSteps += steps;
            } else if (i === currentWordIndex) {
                currentSteps += currentPartIndex;
            }
            
            totalSteps += steps;
        }
        
        const progress = (currentSteps / totalSteps) * 100;
        
        if (progressBarFill) {
            progressBarFill.style.width = `${progress}%`;
        } else {
            progressBar.style.width = `${progress}%`;
        }
        progressText.textContent = `${Math.round(progress)}%`;
    } else {
        if (progressBarFill) {
            progressBarFill.style.width = "0%";
        } else {
            progressBar.style.width = "0%";
        }
        progressText.textContent = "0%";
    }
}

function playBeepSound() {
    // In a real implementation, this would play an actual sound
    // For now, we'll just log to console
    console.log("Beep sound played for loop reset");
    
    // If we had audioContext available:
    /*
    if (audioContext) {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'beep';
        oscillator.frequency.value = 800;
        gainNode.gain.value = 0.3;
        
        oscillator.start(0);
        oscillator.stop(audioContext.currentTime + 0.1);
    }
    */
}

// Sleep Timer Functions using Capacitor
async function setSleepTimer(minutes) {
    if (minutes > 0 && !checkProFeature('sleep timer')) return;

    // Clear existing timer
    if (sleepTimer) {
        clearInterval(sleepTimer);
        sleepTimer = null;
    }

    // Update UI
    document.querySelectorAll('.timer-btn').forEach(btn => btn.classList.remove('active'));

    if (minutes === 0) {
        // Turn off timer
        sleepTimeRemaining = 0;
        timerDisplay.textContent = 'Off';
        document.getElementById('timerOff').classList.add('active');
        // Allow device to sleep (only if plugin is available)
        if (KeepAwake) {
            try {
                await KeepAwake.allowSleep();
            } catch (error) {
                console.error('Failed to allow sleep:', error);
            }
        }
    } else {
        // Set timer
        sleepTimeRemaining = minutes * 60; // Convert to seconds
        updateTimerDisplay();
        document.querySelector(`[data-minutes="${minutes}"]`).classList.add('active');

        // Keep device awake while timer is running (only if plugin is available)
        if (KeepAwake) {
            try {
                await KeepAwake.keepAwake();
            } catch (error) {
                console.error('Failed to keep awake:', error);
            }
        }

        // Start countdown
        sleepTimer = setInterval(async () => {
            sleepTimeRemaining--;
            updateTimerDisplay();

            if (sleepTimeRemaining <= 0) {
                // Time's up - put device to sleep
                await setSleepTimer(0);
                // Optionally pause reading
                if (isRunning) {
                    toggleStartPause();
                }
            }
        }, 1000);
    }

    closeMenu();
}

function updateTimerDisplay() {
    if (sleepTimeRemaining <= 0) {
        timerDisplay.textContent = 'Off';
        return;
    }
    
    const hours = Math.floor(sleepTimeRemaining / 3600);
    const minutes = Math.floor((sleepTimeRemaining % 3600) / 60);
    const seconds = sleepTimeRemaining % 60;
    
    if (hours > 0) {
        timerDisplay.textContent = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
        timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

// Orientation Functions using Capacitor
async function setOrientation(orientation) {
    // Portrait is always allowed (free), other orientations require Pro
    if (orientation !== 'portrait' && !checkProFeature('screen orientation')) return;

    currentOrientation = orientation;

    // Update UI
    document.querySelectorAll('.orientation-btn').forEach(btn => btn.classList.remove('active'));

    // Only try to lock orientation if plugin is available
    if (ScreenOrientation) {
        try {
            switch (orientation) {
                case 'portrait':
                    await ScreenOrientation.lock({ orientation: 'portrait' });
                    document.getElementById('orientationPortrait').classList.add('active');
                    break;
                case 'landscape':
                    await ScreenOrientation.lock({ orientation: 'landscape' });
                    document.getElementById('orientationLandscape').classList.add('active');
                    break;
                case 'auto':
                    await ScreenOrientation.unlock();
                    document.getElementById('orientationAuto').classList.add('active');
                    break;
            }
        } catch (error) {
            console.log('Orientation lock not supported:', error);
            // Fallback to portrait as default
            document.getElementById('orientationPortrait').classList.add('active');
        }
    } else {
        // Browser mode - just update UI
        console.log('Browser mode: orientation lock not available');
        document.getElementById('orientationPortrait').classList.add('active');
    }

    closeMenu();
}

// Periodic auto-save functionality
function startAutoSaveTimer() {
    if (autoSaveTimer) return;
    
    autoSaveTimer = setInterval(() => {
        autoSaveProgress();
    }, AUTO_SAVE_INTERVAL);
}

function stopAutoSaveTimer() {
    if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
        autoSaveTimer = null;
    }
}

// Progress bar slider functionality
let isDragging = false;

function initProgressBarSlider() {
    if (!progressBar) return;
    
    // Mouse events
    progressBar.addEventListener('mousedown', startDrag);
    progressBar.addEventListener('mouseenter', showProgressBarActive);
    progressBar.addEventListener('mouseleave', hideProgressBarActiveDelayed);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag);
    
    // Touch events
    progressBar.addEventListener('touchstart', startDragTouch, { passive: false });
    document.addEventListener('touchmove', dragTouch, { passive: false });
    document.addEventListener('touchend', endDrag);
}

function showProgressBarActive() {
    clearTimeout(progressBarActiveTimer);
    progressBar.classList.add('active');
    if (progressContainer) {
        progressContainer.classList.add('active');
    }
}

function hideProgressBarActiveDelayed() {
    if (!isDragging) {
        progressBarActiveTimer = setTimeout(() => {
            progressBar.classList.remove('active');
            if (progressContainer) {
                progressContainer.classList.remove('active');
            }
        }, 1000);
    }
}

function hideProgressBarActive() {
    clearTimeout(progressBarActiveTimer);
    progressBar.classList.remove('active');
    if (progressContainer) {
        progressContainer.classList.remove('active');
    }
}

function startDrag(event) {
    if (words.length === 0) return;
    
    // Pause reading during drag
    wasRunningBeforeSkip = isRunning;
    if (isRunning) {
        stopTimer();
    }
    isSkipping = true;
    
    isDragging = true;
    progressBar.classList.add('dragging');
    showProgressBarActive();
    
    // Jump immediately to clicked position
    const rect = progressBar.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const newProgress = Math.max(0, Math.min(1, clickX / rect.width));
    seekToProgress(newProgress);
    
    event.preventDefault();
}

function startDragTouch(event) {
    if (words.length === 0) return;
    
    // Pause reading during drag
    wasRunningBeforeSkip = isRunning;
    if (isRunning) {
        stopTimer();
    }
    isSkipping = true;
    
    const touch = event.touches[0];
    isDragging = true;
    progressBar.classList.add('dragging');
    showProgressBarActive();
    
    // Jump immediately to touched position
    const rect = progressBar.getBoundingClientRect();
    const touchX = touch.clientX - rect.left;
    const newProgress = Math.max(0, Math.min(1, touchX / rect.width));
    seekToProgress(newProgress);
    
    event.preventDefault();
}

function drag(event) {
    if (!isDragging || words.length === 0) return;
    
    const rect = progressBar.getBoundingClientRect();
    const currentX = event.clientX - rect.left;
    const newProgress = Math.max(0, Math.min(1, currentX / rect.width));
    seekToProgress(newProgress);
    
    event.preventDefault();
}

function dragTouch(event) {
    if (!isDragging || words.length === 0) return;
    
    const touch = event.touches[0];
    const rect = progressBar.getBoundingClientRect();
    const currentX = touch.clientX - rect.left;
    const newProgress = Math.max(0, Math.min(1, currentX / rect.width));
    seekToProgress(newProgress);
    
    event.preventDefault();
}

function endDrag() {
    if (!isDragging) return;
    
    isDragging = false;
    isSkipping = false;
    progressBar.classList.remove('dragging');
    
    // Resume reading if it was running before
    if (wasRunningBeforeSkip) {
        startTimer();
        wasRunningBeforeSkip = false;
    }
    
    hideProgressBarActiveDelayed();
}

function seekToProgress(progress) {
    if (words.length === 0) return;
    
    // Calculate total "steps" (parts + words)
    let totalSteps = 0;
    let wordSteps = [];
    
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const steps = word.length > 6 ? Math.ceil(word.length / 6) : 1;
        wordSteps.push({ wordIndex: i, steps: steps, startStep: totalSteps });
        totalSteps += steps;
    }
    
    // Find the step we're seeking to
    const targetStep = Math.floor(progress * totalSteps);
    
    // Find which word and part this step corresponds to
    for (let i = 0; i < wordSteps.length; i++) {
        const wordInfo = wordSteps[i];
        if (targetStep >= wordInfo.startStep && targetStep < wordInfo.startStep + wordInfo.steps) {
            currentWordIndex = wordInfo.wordIndex;
            currentPartIndex = targetStep - wordInfo.startStep;
            break;
        }
    }
    
    // Ensure we don't go out of bounds
    currentWordIndex = Math.max(0, Math.min(words.length - 1, currentWordIndex));
    
    // Use the proper display function with parts
    updateDisplayWithParts();
    updateProgressBar();
}


// Left/right side touch and hold functionality
let touchHoldTimer = null;
let skipDirection = 0; // -1 for backward, 1 for forward
let skipSpeed = 0;
let wasRunningBeforeSkip = false;
let isSkipping = false;
let progressBarActiveTimer = null;

function initSideTouchControls() {
    if (!textDisplay) return;
    
    // Modify existing touch events to handle side skip without interfering with existing functionality
    const originalTouchStart = textDisplay.ontouchstart;
    
    textDisplay.addEventListener('touchstart', function(event) {
        // Don't interfere with pinch-to-zoom (2 fingers)
        if (event.touches.length === 2) return;
        
        if (words.length === 0) return;
        
        const touch = event.touches[0];
        const rect = event.currentTarget.getBoundingClientRect();
        const touchX = touch.clientX - rect.left;
        const screenWidth = rect.width;
        
        // Determine which side was touched (10% from each side)
        if (touchX < screenWidth * 0.1) {
            // Left side - skip backward
            skipDirection = -1;
            startSkipping();
            event.preventDefault();
        } else if (touchX > screenWidth * 0.9) {
            // Right side - skip forward
            skipDirection = 1;
            startSkipping();
            event.preventDefault();
        }
        // Middle area - let normal touch handling continue
    }, { passive: false });
    
    textDisplay.addEventListener('touchend', function(event) {
        stopSkipping();
    });
}

function startSkipping() {
    if (touchHoldTimer) return;
    
    // Pause reading during skip
    wasRunningBeforeSkip = isRunning;
    if (isRunning) {
        stopTimer();
    }
    isSkipping = true;
    
    // Add visual indication for skip direction
    if (skipDirection === -1) {
        addBackwardSkipClass();
    } else if (skipDirection === 1) {
        addForwardSkipClass();
    }
    
    // Set skip speed to double the current WPM
    skipSpeed = wordsPerMinute * 2;
    const skipInterval = Math.floor(60000 / skipSpeed);
    
    touchHoldTimer = setInterval(() => {
        if (skipDirection === 1) {
            // Skip forward - use the natural progression logic
            skipForwardStep();
        } else {
            // Skip backward - use reverse progression logic
            skipBackwardStep();
        }
        updateDisplayWithParts();
        updateProgressBar();
    }, skipInterval);
}

function addBackwardSkipClass() {
    removeForwardSkipClass(); // Remove any forward skip class first
    leftBox.classList.add('backward-skip');
    middleBox.classList.add('backward-skip');
    rightBox.classList.add('backward-skip');
}

function removeBackwardSkipClass() {
    leftBox.classList.remove('backward-skip');
    middleBox.classList.remove('backward-skip');
    rightBox.classList.remove('backward-skip');
}

function addForwardSkipClass() {
    removeBackwardSkipClass(); // Remove any backward skip class first
    leftBox.classList.add('forward-skip');
    middleBox.classList.add('forward-skip');
    rightBox.classList.add('forward-skip');
}

function removeForwardSkipClass() {
    leftBox.classList.remove('forward-skip');
    middleBox.classList.remove('forward-skip');
    rightBox.classList.remove('forward-skip');
}

// Enhanced display function that properly shows word parts (like processNextWord but without advancement)
function updateDisplayWithParts() {
    if (words.length === 0 || currentWordIndex >= words.length) {
        middleBox.textContent = "No text loaded";
        middleBox.style.color = "#757575";
        leftBox.textContent = "";
        rightBox.textContent = "";
        return;
    }
    
    const currentWord = words[currentWordIndex];
    
    if (currentWord.length > 6) {
        // Word is longer than 6 characters - split into parts
        const partsCount = Math.ceil(currentWord.length / 6);
        const startIndex = (currentPartIndex % partsCount) * 6;
        const length = Math.min(6, currentWord.length - startIndex);
        const currentPart = currentWord.substring(startIndex, startIndex + length);
        
        // Display the current part in middle box
        middleBox.textContent = currentPart;
        middleBox.style.color = "#4caf50";
        
        // Prepare upcoming parts for right box
        let upcomingParts = [];
        if (currentPartIndex < partsCount - 1) {
            const remainingParts = partsCount - 1 - currentPartIndex;
            for (let i = 1; i <= Math.min(remainingParts, 3); i++) { // Show max 3 upcoming parts
                const partIndex = (currentPartIndex + i) % partsCount;
                const partStart = partIndex * 6;
                const partLength = Math.min(6, currentWord.length - partStart);
                if (partLength > 0) {
                    upcomingParts.push(currentWord.substring(partStart, partStart + partLength));
                }
            }
        }
        rightBox.textContent = upcomingParts.join('');
        rightBox.style.color = "#757575";
        
        // Prepare passed parts for left box
        let passedParts = [];
        if (currentPartIndex > 0) {
            const maxPassedParts = Math.min(currentPartIndex, 3); // Show max 3 passed parts
            for (let i = currentPartIndex - 1; i >= Math.max(0, currentPartIndex - maxPassedParts); i--) {
                const partStart = i * 6;
                const partLength = Math.min(6, currentWord.length - partStart);
                if (partLength > 0) {
                    passedParts.unshift(currentWord.substring(partStart, partStart + partLength));
                }
            }
        }
        leftBox.textContent = passedParts.join('');
        leftBox.style.color = "#757575";
        
    } else {
        // Word is 6 characters or less - show entire word
        middleBox.textContent = currentWord;
        middleBox.style.color = "#4caf50";
        leftBox.textContent = "";
        rightBox.textContent = "";
    }

    // Update guides after display update
    updateGuides();
}

// Forward skip step - mirrors the natural word progression
function skipForwardStep() {
    if (words.length === 0 || currentWordIndex >= words.length) return;
    
    const currentWord = words[currentWordIndex];
    
    if (currentWord.length > 6) {
        // Word is longer than 6 characters - advance through parts
        const partsCount = Math.ceil(currentWord.length / 6);
        
        currentPartIndex++;
        
        if (currentPartIndex >= partsCount) {
            // Finished showing all parts of the word, move to next word
            currentPartIndex = 0;
            currentWordIndex++;
        }
    } else {
        // Word is 6 characters or less - move to next word
        currentWordIndex++;
        currentPartIndex = 0;
    }
}

// Backward skip step - reverses the word progression
function skipBackwardStep() {
    if (words.length === 0 || currentWordIndex < 0) return;
    
    if (currentPartIndex > 0) {
        // We're in the middle of a long word, go to previous part
        currentPartIndex--;
    } else {
        // We're at the beginning of a word, go to previous word
        if (currentWordIndex > 0) {
            currentWordIndex--;
            
            const newCurrentWord = words[currentWordIndex];
            if (newCurrentWord.length > 6) {
                // Previous word is long, go to its last part
                const partsCount = Math.ceil(newCurrentWord.length / 6);
                currentPartIndex = partsCount - 1;
            } else {
                // Previous word is short
                currentPartIndex = 0;
            }
        }
    }
}

function stopSkipping() {
    if (touchHoldTimer) {
        clearInterval(touchHoldTimer);
        touchHoldTimer = null;
        
        // Remove visual indication
        removeBackwardSkipClass();
        removeForwardSkipClass();
        
        // Resume reading if it was running before
        if (wasRunningBeforeSkip && !isRunning) {
            startTimer();
            wasRunningBeforeSkip = false;
        }
        
        skipDirection = 0;
        isSkipping = false;
    }
}

// Auto-save and manual save/load functionality
function autoSaveProgress() {
    if (!currentFileName || words.length === 0) return;
    
    const progressData = {
        currentWordIndex: currentWordIndex,
        currentPartIndex: currentPartIndex,
        wordsPerMinute: wordsPerMinute,
        totalWords: words.length,
        timestamp: Date.now()
    };
    
    try {
        localStorage.setItem(STORAGE_PREFIX + currentFileName, JSON.stringify(progressData));
    } catch (error) {
        console.warn('Failed to auto-save progress:', error);
    }
}

function loadProgress(fileName) {
    try {
        const savedData = localStorage.getItem(STORAGE_PREFIX + fileName);
        if (savedData) {
            const progressData = JSON.parse(savedData);

            // Only load if the total words match (same file)
            if (progressData.totalWords === words.length) {
                // Check if the file was completed (at 100%)
                const isCompleted = progressData.currentWordIndex >= words.length - 1;

                if (isCompleted) {
                    // File was finished - restart from beginning
                    currentWordIndex = 0;
                    currentPartIndex = 0;

                    // Optionally restore WPM
                    if (progressData.wordsPerMinute) {
                        wordsPerMinute = progressData.wordsPerMinute;
                        updateWPMDisplay();
                        updateActiveWPMButton();
                    }

                    updateDisplayWithParts();
                    updateProgressBar();
                    showToast(`File completed previously - restarting from beginning`);
                    return true;
                } else {
                    // Resume from saved position
                    currentWordIndex = progressData.currentWordIndex || 0;
                    currentPartIndex = progressData.currentPartIndex || 0;

                    // Optionally restore WPM
                    if (progressData.wordsPerMinute) {
                        wordsPerMinute = progressData.wordsPerMinute;
                        updateWPMDisplay();
                        updateActiveWPMButton();
                    }

                    updateDisplayWithParts();
                    updateProgressBar();

                    // Calculate progress percentage
                    const progressPercent = Math.round((currentWordIndex / words.length) * 100);
                    showToast(`Resuming from ${progressPercent}%`);
                    return true;
                }
            }
        }
    } catch (error) {
        console.warn('Failed to load progress:', error);
    }
    return false;
}

// Pro Features Functions
function updateProUI() {
    const isPro = window.PurchaseManager && window.PurchaseManager.isPro();

    // Update banner visibility
    if (proUpgradeBanner) {
        if (isPro) {
            proUpgradeBanner.classList.add('hidden');
        } else {
            proUpgradeBanner.classList.remove('hidden');
        }
    }

    // Update ad banner visibility
    updateAdBannerVisibility();

    // Update AdMob ads
    if (window.AdManager) {
        if (isPro) {
            AdManager.hideBanner();
        } else {
            AdManager.showBanner();
        }
    }

    // Update Pro feature sections
    document.querySelectorAll('.pro-feature-section').forEach(section => {
        if (isPro) {
            section.classList.add('unlocked');
        } else {
            section.classList.remove('unlocked');
        }
    });

    // Update individual Pro features
    document.querySelectorAll('.pro-feature').forEach(feature => {
        if (isPro) {
            feature.classList.add('unlocked');
        } else {
            feature.classList.remove('unlocked');
        }
    });

    // Update main screen PDF/EPUB button
    if (mainLoadDocBtn) {
        if (isPro) {
            mainLoadDocBtn.classList.remove('disabled');
            mainLoadDocBtn.innerHTML = 'Load PDF/EPUB';
        } else {
            mainLoadDocBtn.classList.add('disabled');
            mainLoadDocBtn.innerHTML = 'Load PDF/EPUB 🔒';
        }
    }
}

function checkProFeature(featureName) {
    const isPro = window.PurchaseManager && window.PurchaseManager.isPro();

    if (!isPro) {
        showUpgradeModal();
        return false;
    }

    return true;
}

function showUpgradeModal() {
    if (upgradeModal) {
        upgradeModal.classList.add('active');
    }
}

function hideUpgradeModal() {
    if (upgradeModal) {
        upgradeModal.classList.remove('active');
    }
}

function handlePurchase() {
    if (window.PurchaseManager) {
        window.PurchaseManager.purchasePro();
        hideUpgradeModal();
    } else {
        alert('Purchase system not available');
    }
}

function handleRestore() {
    if (window.PurchaseManager) {
        window.PurchaseManager.restorePurchases();
        hideUpgradeModal();
    } else {
        alert('Purchase system not available');
    }
}

// Toast notification function
function showToast(message, duration = 2000) {
    if (toastElement) {
        toastElement.textContent = message;
        toastElement.classList.add('show');

        setTimeout(() => {
            toastElement.classList.remove('show');
        }, duration);
    }
}

// Update ad banner visibility based on Pro status
function updateAdBannerVisibility() {
    const adBanner = document.getElementById('adBanner');
    const isPro = window.PurchaseManager && window.PurchaseManager.isPro();

    if (adBanner) {
        if (isPro) {
            adBanner.classList.add('hidden');
            document.body.classList.add('pro');
        } else {
            adBanner.classList.remove('hidden');
            document.body.classList.remove('pro');
        }
    }
}

// Export functions for testing or external use if needed
window.SpeedReader = {
    loadTextFile,
    toggleStartPause,
    restartReading,
    toggleLoop,
    setSleepTimer,
    setOrientation,
    seekToProgress
};
