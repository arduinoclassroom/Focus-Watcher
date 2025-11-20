document.addEventListener('DOMContentLoaded', () => {
    const searchView = document.getElementById('search-view');
    const playerView = document.getElementById('player-view');
    const videoUrlInput = document.getElementById('video-url');
    const watchBtn = document.getElementById('watch-btn');
    const backBtn = document.getElementById('back-btn');
    const errorMsg = document.getElementById('error-msg');

    // Control Elements
    const playPauseBtn = document.getElementById('play-pause-btn');
    const iconPlay = document.querySelector('.icon-play');
    const iconPause = document.querySelector('.icon-pause');
    const progressBar = document.getElementById('progress-bar');
    const progressFill = document.getElementById('progress-fill');
    const currentTimeEl = document.getElementById('current-time');
    const totalTimeEl = document.getElementById('total-time');
    const muteBtn = document.getElementById('mute-btn');
    const iconVolumeHigh = document.querySelector('.icon-volume-high');
    const iconVolumeMuted = document.querySelector('.icon-volume-muted');
    const volumeSlider = document.getElementById('volume-slider');
    const speedBtn = document.getElementById('speed-btn');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const videoWrapper = document.querySelector('.video-wrapper');

    let player;
    let progressInterval;
    let isDragging = false;

    // Load YouTube IFrame API
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    // Extract Video ID
    const getVideoId = (url) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    // Initialize Player
    window.onYouTubeIframeAPIReady = () => {
        // API is ready, but we wait for user to click watch
    };

    const createPlayer = (videoId) => {
        if (player) {
            player.destroy();
        }

        player = new YT.Player('player-container', {
            height: '100%',
            width: '100%',
            videoId: videoId,
            playerVars: {
                'playsinline': 1,
                'controls': 0, // Hide default controls
                'rel': 0,
                'modestbranding': 1,
                'disablekb': 1 // Disable default keyboard controls to prevent conflicts
            },
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange
            }
        });
    };

    const onPlayerReady = (event) => {
        event.target.playVideo();
        updateVolumeUI();
        startProgressLoop();
    };

    const onPlayerStateChange = (event) => {
        if (event.data == YT.PlayerState.PLAYING) {
            iconPlay.style.display = 'none';
            iconPause.style.display = 'block';
            startProgressLoop();
        } else {
            iconPlay.style.display = 'block';
            iconPause.style.display = 'none';
            clearInterval(progressInterval);
        }
    };

    // Control Logic
    const togglePlay = () => {
        if (!player) return;
        const state = player.getPlayerState();
        if (state === YT.PlayerState.PLAYING) {
            player.pauseVideo();
        } else {
            player.playVideo();
        }
    };

    const formatTime = (seconds) => {
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${min}:${sec < 10 ? '0' : ''}${sec}`;
    };

    const updateProgress = () => {
        if (!player || !player.getDuration || isDragging) return;

        const current = player.getCurrentTime();
        const duration = player.getDuration();

        if (duration) {
            const percent = (current / duration) * 100;
            progressBar.value = percent;
            progressFill.style.width = `${percent}%`;

            currentTimeEl.textContent = formatTime(current);
            totalTimeEl.textContent = formatTime(duration);
        }
    };

    const startProgressLoop = () => {
        clearInterval(progressInterval);
        progressInterval = setInterval(updateProgress, 500);
    };

    // Event Listeners
    watchBtn.addEventListener('click', () => {
        const url = videoUrlInput.value.trim();
        const videoId = getVideoId(url);

        if (videoId) {
            errorMsg.textContent = '';
            searchView.classList.remove('active');
            playerView.classList.add('active');
            createPlayer(videoId);
        } else {
            errorMsg.textContent = 'Please enter a valid YouTube URL';
            videoUrlInput.classList.add('shake');
            setTimeout(() => videoUrlInput.classList.remove('shake'), 500);
        }
    });

    backBtn.addEventListener('click', () => {
        if (player) {
            player.stopVideo();
            player.destroy();
            player = null;
        }
        clearInterval(progressInterval);
        playerView.classList.remove('active');
        searchView.classList.add('active');
        videoUrlInput.value = '';
        videoUrlInput.focus();
    });

    playPauseBtn.addEventListener('click', togglePlay);

    // Progress Bar Interaction
    progressBar.addEventListener('input', (e) => {
        isDragging = true;
        const percent = e.target.value;
        progressFill.style.width = `${percent}%`;

        if (player && player.getDuration) {
            const duration = player.getDuration();
            const time = (percent / 100) * duration;
            currentTimeEl.textContent = formatTime(time);
        }
    });

    progressBar.addEventListener('change', (e) => {
        isDragging = false;
        if (player && player.getDuration) {
            const duration = player.getDuration();
            const seekTo = (e.target.value / 100) * duration;
            player.seekTo(seekTo, true);
        }
    });

    // Volume
    const updateVolumeUI = () => {
        if (!player) return;
        const vol = player.getVolume();
        const isMuted = player.isMuted();

        volumeSlider.value = isMuted ? 0 : vol;

        if (isMuted || vol === 0) {
            iconVolumeHigh.style.display = 'none';
            iconVolumeMuted.style.display = 'block';
        } else {
            iconVolumeHigh.style.display = 'block';
            iconVolumeMuted.style.display = 'none';
        }
    };

    muteBtn.addEventListener('click', () => {
        if (!player) return;
        if (player.isMuted()) {
            player.unMute();
            player.setVolume(volumeSlider.value || 50); // Restore volume
        } else {
            player.mute();
        }
        updateVolumeUI();
    });

    volumeSlider.addEventListener('input', (e) => {
        if (!player) return;
        const vol = e.target.value;
        player.setVolume(vol);
        if (vol > 0 && player.isMuted()) {
            player.unMute();
        }
        updateVolumeUI();
    });

    // Speed
    const speeds = [1, 1.5, 2, 0.5];
    let speedIndex = 0;
    speedBtn.addEventListener('click', () => {
        if (!player) return;
        speedIndex = (speedIndex + 1) % speeds.length;
        const newSpeed = speeds[speedIndex];
        player.setPlaybackRate(newSpeed);
        speedBtn.textContent = `${newSpeed}x`;
    });

    // Fullscreen
    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            videoWrapper.requestFullscreen().catch(err => {
                console.log(`Error attempting to enable fullscreen: ${err.message}`);
            });
            videoWrapper.classList.add('fullscreen');
        } else {
            document.exitFullscreen();
            videoWrapper.classList.remove('fullscreen');
        }
    });

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            videoWrapper.classList.remove('fullscreen');
        }
    });

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        if (!playerView.classList.contains('active')) return;

        if (e.code === 'Space') {
            e.preventDefault();
            togglePlay();
        } else if (e.code === 'ArrowRight') {
            if (player) player.seekTo(player.getCurrentTime() + 5, true);
        } else if (e.code === 'ArrowLeft') {
            if (player) player.seekTo(player.getCurrentTime() - 5, true);
        }
    });
});
