import { GameManager } from './GameManager.js';

// Wait for DOM
document.addEventListener('DOMContentLoaded', () => {
    const game = new GameManager();
    game.init();

    window.game = game;
});
