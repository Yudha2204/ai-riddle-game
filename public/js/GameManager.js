import * as THREE from 'three';
import { SceneHome } from './SceneHome.js';
import { SceneDifficulty } from './SceneDifficulty.js';
import { SceneGame } from './SceneGame.js';
import { API } from './API.js';

export class GameManager {
    constructor() {
        this.container = document.getElementById('canvas-container');
        this.renderer = null;
        this.camera = null;
        this.currentScene = null;
        this.listener = null;

        // State
        this.currentLevel = 1;
        this.difficultyMode = 'easy'; // Default
        this.riddlesOriginal = []; // Raw data from API
        this.riddleData = null; // Current active riddle

        this.chatHistory = []; // Local history for context

        // UI References
        this.ui = {
            loading: document.getElementById('loading-screen'),
            helpModal: document.getElementById('help-modal'),
            apiLoadingModal: document.getElementById('api-loading-modal'),
            apiLoadingImage: document.getElementById('api-loading-image'),
            apiLoadingText: document.getElementById('api-loading-text'),
            apiLoadingCloseBtn: document.getElementById('api-loading-close-btn'),
            apiLoadingCloseBtn: document.getElementById('api-loading-close-btn'),
            closeHelpBtn: document.getElementById('close-help-btn'),
            aboutModal: document.getElementById('about-modal'),
            closeAboutBtn: document.getElementById('close-about-btn'),
            hud: document.getElementById('game-hud'),
            levelDisplay: document.getElementById('level-display'),
            riddleImage: document.getElementById('riddle-image-placeholder'),
            hintText: document.getElementById('riddle-hint-text'),
            chatHistory: document.getElementById('chat-history'),
            input: document.getElementById('player-input'),
            sendBtn: document.getElementById('send-btn'),
            backBtn: document.getElementById('back-home-btn')
        };
    }

    async init() {
        // Setup Three.js Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x0f172a); // Fallback color
        this.container.appendChild(this.renderer.domElement);

        // Setup Camera
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(0, 0, 10);
        this.listener = new THREE.AudioListener();
        this.camera.add(this.listener);

        this.hoverSound = new THREE.Audio(this.listener);
        const audioLoader = new THREE.AudioLoader();
        audioLoader.load('./sounds/hover.mp3', (buffer) => {
            if (this.hoverSound) {
                this.hoverSound.setBuffer(buffer);
                this.hoverSound.setLoop(false);
                this.hoverSound.setVolume(1);
            }
        });

        this.musicSound = new THREE.Audio(this.listener);
        audioLoader.load('./sounds/music.mp3', (buffer) => {
            if (this.musicSound) {
                this.musicSound.setBuffer(buffer);
                this.musicSound.setLoop(true);
                this.musicSound.setVolume(0.1);
            }
        });

        // Resume AudioContext on first interaction
        const resumeAudio = () => {
            if (this.listener.context.state === 'suspended') {
                this.listener.context.resume();
            }
            // Play music if it's ready
            if (this.musicSound && !this.musicSound.isPlaying) {
                this.musicSound.play();
            }

            window.removeEventListener('click', resumeAudio);
            window.removeEventListener('keydown', resumeAudio);
        };
        window.addEventListener('click', resumeAudio);
        window.addEventListener('keydown', resumeAudio);



        // Handle Resize
        window.addEventListener('resize', () => this.onWindowResize());

        // Event Listeners
        this.setupUIEvents();
        this.setupButtonHoverSounds();

        // Load Data
        await this.loadRiddles();

        // Start Home Scene
        this.switchScene('home');

        // Animation Loop
        this.animate();

        // Hide Loading
        this.ui.loading.classList.remove('active');
        this.ui.loading.classList.add('hidden');
    }

    async loadRiddles() {
        try {
            this.riddlesOriginal = await API.getRiddles();
            console.log("Riddles loaded:", this.riddlesOriginal);
        } catch (e) {
            console.error("Failed to load riddles", e);
            alert("Failed to connect to server.");
        }
    }

    setupUIEvents() {
        this.ui.closeHelpBtn.onclick = () => {
            this.ui.helpModal.classList.add('hidden');
        };

        this.ui.closeAboutBtn.onclick = () => {
            this.ui.aboutModal.classList.add('hidden');
        };

        this.ui.sendBtn.onclick = () => this.handleChatSubmit();
        this.ui.input.onkeydown = (e) => {
            if (e.key === 'Enter') this.handleChatSubmit();
        };

        this.ui.backBtn.onclick = () => this.switchScene('home');
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    switchScene(sceneName, data = null) {
        // Cleanup old scene
        if (this.currentScene) {
            this.currentScene.cleanup();
        }

        this.hideAllUI();

        switch (sceneName) {
            case 'home':
                this.currentScene = new SceneHome(this);
                break;
            case 'difficulty':
                this.currentScene = new SceneDifficulty(this);
                break;
            case 'game':
                this.currentScene = new SceneGame(this);
                this.ui.hud.classList.remove('hidden');
                this.startLevel(data); // data should contain difficulty/level info
                break;
        }

        if (this.currentScene) {
            this.currentScene.init();
        }
    }

    hideAllUI() {
        this.ui.hud.classList.add('hidden');
        this.ui.helpModal.classList.add('hidden');
        this.ui.aboutModal.classList.add('hidden');
        this.ui.apiLoadingModal.classList.add('hidden');
        this.ui.apiLoadingCloseBtn.classList.add('hidden');
        this.ui.apiLoadingCloseBtn.onclick = () => this.ui.apiLoadingModal.classList.add('hidden');
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const time = performance.now() * 0.001;

        if (this.currentScene) {
            this.currentScene.update(time);
        }

        this.renderer.render(this.currentScene.scene, this.camera);
    }

    playHoverSound() {
        if (this.hoverSound && this.hoverSound.buffer) {
            if (this.listener.context.state === 'running') {
                if (this.hoverSound.isPlaying) this.hoverSound.stop();
                this.hoverSound.play();
            }
        }
    }

    setupButtonHoverSounds() {
        const buttons = document.querySelectorAll('button');
        buttons.forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                this.playHoverSound();
            });
        });
    }

    // ================= GAME LOGIC =================

    showHelp() {
        this.ui.helpModal.classList.remove('hidden');
    }

    showAbout() {
        this.ui.aboutModal.classList.remove('hidden');
    }

    startGameWithDifficulty(difficultyStr) {
        // difficultyStr: 'easy', 'medium', 'hard'
        this.difficultyMode = difficultyStr;
        this.currentLevel = 1;

        this.switchScene('game', { level: this.currentLevel });
    }

    startLevel({ level }) {
        const riddle = this.riddlesOriginal.find(r => r.level === level);
        if (!riddle) {
            console.error("Riddle not found");
            return;
        }

        this.riddleData = riddle;
        this.chatHistory = []; // Reset history
        this.ui.chatHistory.innerHTML = '';
        this.ui.levelDisplay.textContent = `(${this.difficultyMode}) Level ${level}`;
        this.ui.hintText.textContent = `"${riddle.initialHint}"`;
        if (riddle.image) {
            this.ui.riddleImage.src = `./image/riddle/${riddle.image}`;
        }

        // Visibility Logic based on Difficulty Mode
        // Easy: Image + Text
        // Medium: Image Only
        // Hard: Text Only

        this.ui.riddleImage.classList.remove('hidden');
        this.ui.hintText.classList.remove('hidden');

        if (this.difficultyMode === 'medium') {
            this.ui.hintText.classList.add('hidden');
        } else if (this.difficultyMode === 'hard') {
            this.ui.riddleImage.classList.add('hidden');
        }

        this.addChatMessage('system', `Selamat datang di Level ${level}! Tebak apakah aku?`);
    }

    async handleChatSubmit() {
        const text = this.ui.input.value.trim();
        if (!text) return;

        this.ui.input.value = '';
        this.addChatMessage('user', text);

        // Show loading modal
        this.ui.apiLoadingCloseBtn.onclick = () => this.ui.apiLoadingModal.classList.add('hidden');
        this.ui.apiLoadingCloseBtn.textContent = 'Okay';
        this.ui.apiLoadingCloseBtn.classList.add('hidden');
        this.ui.apiLoadingModal.classList.remove('hidden');
        this.ui.apiLoadingImage.src = './image/Think.png';
        this.ui.apiLoadingText.textContent = 'sebentar aku berpikir';

        // Call API
        try {
            const payload = {
                playerInput: text,
                level: this.currentLevel,
                revealAnswer: false,
                history: this.chatHistory
            };

            const historyForApi = this.chatHistory.filter(c => c.role !== 'system').map(c => ({
                [c.role === 'user' ? 'user' : 'assistant']: c.content
            }));

            const result = await API.interact({ ...payload, history: historyForApi });

            // Switch to Ahaa.png
            this.ui.apiLoadingImage.src = result.type === 'answer_check' && result.result === 'SALAH' ? './image/Wrong.png' : './image/Ahaa.png';
            this.ui.apiLoadingText.textContent = result.message;

            this.ui.apiLoadingCloseBtn.classList.remove('hidden');

            if (result.ok) {
                if (result.message) {
                    this.addChatMessage('ai', result.message);
                }

                if (result.result === "BENAR") {
                    this.ui.apiLoadingImage.src = './image/Ahaa.png';
                    this.ui.apiLoadingText.textContent = `Kelas kink, ${result.message}`;
                    this.ui.apiLoadingCloseBtn.classList.remove('hidden');
                    this.ui.apiLoadingCloseBtn.textContent = 'Level Berikutnya';
                    this.ui.apiLoadingCloseBtn.onclick = () => {
                        this.ui.apiLoadingModal.classList.add('hidden');
                        this.handleWin();
                    };
                } else if (result.isLose) {
                    // to do
                }
            } else {
                this.addChatMessage('system', "Error: " + (result.error || "Unknown error"));
            }

        } catch (e) {
            this.ui.apiLoadingModal.classList.add('hidden');
            this.addChatMessage('system', "Connection error.");
        }
    }

    addChatMessage(role, text) {
        // UI
        const div = document.createElement('div');
        div.className = `msg ${role}`;
        div.textContent = text;
        this.ui.chatHistory.appendChild(div);
        this.ui.chatHistory.scrollTop = this.ui.chatHistory.scrollHeight;

        // Data (for history)
        if (role !== 'system') {
            this.chatHistory.push({ role, content: text });
        }
    }

    handleWin() {
        this.currentLevel++;
        // Check if next riddle exists
        const nextRiddle = this.riddlesOriginal.find(l => l.level === this.currentLevel);

        if (nextRiddle) {
            this.startLevel({ level: this.currentLevel });
        } else {
            alert("Level Complete! Returning Home.");
            this.switchScene('home');
        }
    }
}
