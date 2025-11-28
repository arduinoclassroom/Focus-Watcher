// ========================================
// FOCUS WATCHER - Distraction-Free YouTube Player
// ========================================

(function () {
    'use strict';

    // ========================================
    // DOM ELEMENTS
    // ========================================

    // Pages
    const landingPage = document.getElementById('landing-page');
    const playerPage = document.getElementById('player-page');

    // Landing Page Elements
    const youtubeUrlInput = document.getElementById('youtube-url');
    const watchButton = document.getElementById('watch-button');
    const errorMessage = document.getElementById('error-message');

    // Player Elements
    const playerWrapper = document.getElementById('player-wrapper');
    const controlsContainer = document.getElementById('controls-container');
    const replayOverlay = document.getElementById('replay-overlay');
    const replayButton = document.getElementById('replay-button');

    // Controls
    const playPauseButton = document.getElementById('play-pause-button');
    const volumeButton = document.getElementById('volume-button');
    const volumeSlider = document.getElementById('volume-slider');
    const speedButton = document.getElementById('speed-button');
    const fullscreenButton = document.getElementById('fullscreen-button');
    const backButton = document.getElementById('back-button');

    // Progress
    const progressBarContainer = document.getElementById('progress-bar-container');
    const progressFilled = document.getElementById('progress-filled');
    const progressHandle = document.getElementById('progress-handle');

    // Time Display
    const currentTimeDisplay = document.getElementById('current-time');
    const totalTimeDisplay = document.getElementById('total-time');

    // Icons
    const iconPlay = playPauseButton.querySelector('.icon-play');
    const iconPause = playPauseButton.querySelector('.icon-pause');
    const iconVolumeHigh = volumeButton.querySelector('.icon-volume-high');
    const iconVolumeMuted = volumeButton.querySelector('.icon-volume-muted');
    const iconFullscreenEnter = fullscreenButton.querySelector('.icon-fullscreen-enter');
    const iconFullscreenExit = fullscreenButton.querySelector('.icon-fullscreen-exit');

    // ========================================
    // STATE
    // ========================================

    let player = null;
    let playerState = {
        isPlaying: false,
        isMuted: false,
        volume: 100,
        currentSpeed: 1,
        duration: 0,
        currentTime: 0
    };

    const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    let speedIndex = 3; // Start at 1x

    let progressUpdateInterval = null;
    let hideControlsTimeout = null;
    let isDraggingProgress = false;

    // ========================================
    // YOUTUBE API
    // ========================================

    // Load YouTube IFrame API
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    // API Ready Callback
    window.onYouTubeIframeAPIReady = function () {
        console.log('YouTube IFrame API Ready');
    };

    // ========================================
    // UTILITY FUNCTIONS
    // ========================================

    function extractVideoId(url) {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
            /youtube\.com\/watch\?.*v=([^&\n?#]+)/
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        return null;
    }

    function formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    function showError(message) {
        errorMessage.textContent = message;
        setTimeout(() => {
            errorMessage.textContent = '';
        }, 3000);
    }

    function switchToPage(page) {
        landingPage.classList.remove('active');
        playerPage.classList.remove('active');
        page.classList.add('active');
    }

    // ========================================
    // PLAYER FUNCTIONS
    // ========================================

    function createPlayer(videoId) {
        if (player) {
            player.destroy();
        }

        player = new YT.Player('youtube-player', {
            videoId: videoId,
            playerVars: {
                autoplay: 1,
                controls: 0,
                disablekb: 1,
                fs: 0,
                modestbranding: 1,
                rel: 0,
                iv_load_policy: 3,
                playsinline: 1
            },
            events: {
                onReady: onPlayerReady,
                onStateChange: onPlayerStateChange
            }
        });
    }

    function onPlayerReady(event) {
        playerState.duration = player.getDuration();
        playerState.volume = player.getVolume();
        totalTimeDisplay.textContent = formatTime(playerState.duration);
        volumeSlider.value = playerState.volume;

        startProgressUpdate();
        resetHideControlsTimer();
    }

    function onPlayerStateChange(event) {
        const state = event.data;

        if (state === YT.PlayerState.PLAYING) {
            playerState.isPlaying = true;
            iconPlay.classList.add('hidden');
            iconPause.classList.remove('hidden');
            playerWrapper.classList.remove('paused');
            replayOverlay.classList.remove('active');
            startProgressUpdate();
            resetHideControlsTimer();
        }
        else if (state === YT.PlayerState.PAUSED) {
            playerState.isPlaying = false;
            iconPlay.classList.remove('hidden');
            iconPause.classList.add('hidden');
            playerWrapper.classList.add('paused');
            stopProgressUpdate();
            clearTimeout(hideControlsTimeout);
            playerWrapper.classList.remove('hide-controls');
        }
        else if (state === YT.PlayerState.ENDED) {
            playerState.isPlaying = false;
            iconPlay.classList.remove('hidden');
            iconPause.classList.add('hidden');
            playerWrapper.classList.add('paused');
            stopProgressUpdate();

            // Show replay overlay to prevent YouTube's related videos
            replayOverlay.classList.add('active');

            // Exit fullscreen if active
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(err => console.log(err));
            }
        }
    }

    // ========================================
    // PROGRESS BAR
    // ========================================

    function startProgressUpdate() {
        stopProgressUpdate();
        progressUpdateInterval = setInterval(updateProgress, 100);
    }

    function stopProgressUpdate() {
        if (progressUpdateInterval) {
            clearInterval(progressUpdateInterval);
            progressUpdateInterval = null;
        }
    }

    function updateProgress() {
        if (!player || !player.getCurrentTime || isDraggingProgress) return;

        playerState.currentTime = player.getCurrentTime();
        const progress = (playerState.currentTime / playerState.duration) * 100;

        progressFilled.style.width = `${progress}%`;
        progressHandle.style.left = `${progress}%`;
        currentTimeDisplay.textContent = formatTime(playerState.currentTime);
    }

    function seekToPosition(event) {
        if (!player) return;

        const rect = progressBarContainer.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, clickX / rect.width));
        const seekTime = percentage * playerState.duration;

        player.seekTo(seekTime, true);
        updateProgress();
    }

    // ========================================
    // CONTROLS
    // ========================================

    function togglePlayPause() {
        if (!player) return;

        if (playerState.isPlaying) {
            player.pauseVideo();
        } else {
            player.playVideo();
        }
    }

    function toggleMute() {
        if (!player) return;

        if (playerState.isMuted) {
            player.unMute();
            playerState.isMuted = false;
            iconVolumeHigh.classList.remove('hidden');
            iconVolumeMuted.classList.add('hidden');
            volumeSlider.value = playerState.volume;
        } else {
            player.mute();
            playerState.isMuted = true;
            iconVolumeHigh.classList.add('hidden');
            iconVolumeMuted.classList.remove('hidden');
        }
    }

    function setVolume(volume) {
        if (!player) return;

        playerState.volume = volume;
        player.setVolume(volume);

        if (volume === 0) {
            playerState.isMuted = true;
            iconVolumeHigh.classList.add('hidden');
            iconVolumeMuted.classList.remove('hidden');
        } else {
            if (playerState.isMuted) {
                player.unMute();
                playerState.isMuted = false;
            }
            iconVolumeHigh.classList.remove('hidden');
            iconVolumeMuted.classList.add('hidden');
        }
    }

    function cycleSpeed() {
        if (!player) return;

        speedIndex = (speedIndex + 1) % speeds.length;
        playerState.currentSpeed = speeds[speedIndex];
        player.setPlaybackRate(playerState.currentSpeed);
        speedButton.textContent = `${playerState.currentSpeed}x`;
    }

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            playerWrapper.requestFullscreen().catch(err => {
                console.error('Fullscreen error:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }

    function goBackToHome() {
        if (player) {
            player.stopVideo();
            player.destroy();
            player = null;
        }

        stopProgressUpdate();
        clearTimeout(hideControlsTimeout);
        replayOverlay.classList.remove('active');
        playerWrapper.classList.remove('hide-controls', 'paused');
        youtubeUrlInput.value = '';

        switchToPage(landingPage);
    }

    // ========================================
    // AUTO-HIDE CONTROLS
    // ========================================

    function resetHideControlsTimer() {
        playerWrapper.classList.remove('hide-controls');
        clearTimeout(hideControlsTimeout);

        if (playerState.isPlaying) {
            hideControlsTimeout = setTimeout(() => {
                playerWrapper.classList.add('hide-controls');
            }, 3000);
        }
    }

    // ========================================
    // EVENT LISTENERS
    // ========================================

    // Landing Page
    watchButton.addEventListener('click', () => {
        const url = youtubeUrlInput.value.trim();
        const videoId = extractVideoId(url);

        if (!videoId) {
            showError('Please enter a valid YouTube URL');
            return;
        }

        errorMessage.textContent = '';
        switchToPage(playerPage);
        createPlayer(videoId);
    });

    youtubeUrlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            watchButton.click();
        }
    });

    // Player Controls
    playPauseButton.addEventListener('click', togglePlayPause);
    volumeButton.addEventListener('click', toggleMute);
    volumeSlider.addEventListener('input', (e) => setVolume(e.target.value));
    speedButton.addEventListener('click', cycleSpeed);
    fullscreenButton.addEventListener('click', toggleFullscreen);
    backButton.addEventListener('click', goBackToHome);
    replayButton.addEventListener('click', () => {
        if (player) {
            player.seekTo(0);
            player.playVideo();
            replayOverlay.classList.remove('active');
        }
    });

    // Progress Bar
    progressBarContainer.addEventListener('click', seekToPosition);

    progressBarContainer.addEventListener('mousedown', (e) => {
        isDraggingProgress = true;
        seekToPosition(e);
    });

    document.addEventListener('mouseup', () => {
        isDraggingProgress = false;
    });

    document.addEventListener('mousemove', (e) => {
        if (isDraggingProgress) {
            seekToPosition(e);
        }
    });

    // Auto-hide controls
    playerWrapper.addEventListener('mousemove', resetHideControlsTimer);
    playerWrapper.addEventListener('mouseleave', () => {
        if (playerState.isPlaying) {
            playerWrapper.classList.add('hide-controls');
        }
    });

    // Click on player to toggle play/pause
    playerWrapper.addEventListener('click', (e) => {
        if (e.target === playerWrapper || e.target.id === 'youtube-player') {
            togglePlayPause();
        }
    });

    // Fullscreen change
    document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement) {
            playerWrapper.classList.add('fullscreen');
            iconFullscreenEnter.classList.add('hidden');
            iconFullscreenExit.classList.remove('hidden');
        } else {
            playerWrapper.classList.remove('fullscreen');
            iconFullscreenEnter.classList.remove('hidden');
            iconFullscreenExit.classList.add('hidden');
        }
    });

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        if (!playerPage.classList.contains('active')) return;
        if (document.activeElement.tagName === 'INPUT') return;

        switch (e.key) {
            case ' ':
            case 'k':
            case 'K':
                e.preventDefault();
                togglePlayPause();
                break;
            case 'f':
            case 'F':
                e.preventDefault();
                toggleFullscreen();
                break;
            case 'm':
            case 'M':
                e.preventDefault();
                toggleMute();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                if (player) player.seekTo(Math.max(0, player.getCurrentTime() - 5), true);
                break;
            case 'ArrowRight':
                e.preventDefault();
                if (player) player.seekTo(Math.min(playerState.duration, player.getCurrentTime() + 5), true);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setVolume(Math.min(100, playerState.volume + 5));
                volumeSlider.value = playerState.volume;
                break;
            case 'ArrowDown':
                e.preventDefault();
                setVolume(Math.max(0, playerState.volume - 5));
                volumeSlider.value = playerState.volume;
                break;
        }
    });

})();
