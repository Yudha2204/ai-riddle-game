import * as THREE from 'three';

export class SceneGame {
    constructor(game) {
        this.game = game;
        this.scene = new THREE.Scene();
        this.textureLoader = new THREE.TextureLoader();
    }

    init() {
        this.setupBackground();
    }

    cleanup() {

    }

    setupBackground() {
        const loader = this.textureLoader;
        loader.load('image/bg.jpg', (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            this.scene.background = texture;
        });
    }

    update(time) {
        if (this.mysterySprite) {
            this.mysterySprite.position.y = 0.5 + Math.sin(time * 1.5) * 0.1;
            this.mysterySprite.material.rotation = Math.sin(time * 0.5) * 0.05;
        }
    }
}
