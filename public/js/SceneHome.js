import * as THREE from 'three';

export class SceneHome {
    constructor(game) {
        this.game = game;
        this.scene = new THREE.Scene();
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.interactiveObjects = [];
        this.textureLoader = new THREE.TextureLoader();

        // Bind events
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);

        this.hoveredObject = null;
    }

    init() {
        this.setupBackground();
        this.createTitle();
        this.createButtons();
        window.addEventListener('mousedown', this.onMouseDown);
        window.addEventListener('mousemove', this.onMouseMove);
    }

    createTitle() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 1024;
        canvas.height = 512;

        // Title "Riddle.Cyz"
        ctx.font = '900 180px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Gradient for Title
        const gradient = ctx.createLinearGradient(0, 50, 0, 250);
        gradient.addColorStop(0, '#facc15');
        gradient.addColorStop(1, '#eab308');

        ctx.fillStyle = gradient;
        ctx.lineWidth = 15;
        ctx.strokeStyle = '#ffffff';
        ctx.strokeText('Riddle.Cyz', 512, 200);
        ctx.fillText('Riddle.Cyz', 512, 200);

        // Subtitle "teka teki dengan ai"
        ctx.font = '600 60px "Outfit", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.strokeText('teka teki dengan ai', 512, 320);
        ctx.fillText('teka teki dengan ai', 512, 320);

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;

        const mat = new THREE.SpriteMaterial({ map: texture });
        this.titleSprite = new THREE.Sprite(mat);
        this.titleSprite.scale.set(6, 3, 1);
        this.titleSprite.position.set(0, 0, 0); // Position above buttons

        this.scene.add(this.titleSprite);
    }


    cleanup() {
        window.removeEventListener('mousedown', this.onMouseDown);
        window.removeEventListener('mousemove', this.onMouseMove);
    }

    setupBackground() {
        // Load background
        const loader = this.textureLoader;
        loader.load('image/bg.jpg', (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            this.scene.background = texture;
        });
    }

    createButtons() {
        // Helper to create button
        const createButton = (name, x, y, action) => {
            const map = this.textureLoader.load(`image/${name}.png`);
            map.colorSpace = THREE.SRGBColorSpace;
            const mat = new THREE.SpriteMaterial({ map: map });
            const sprite = new THREE.Sprite(mat);

            sprite.scale.set(3, 1.2, 1);
            sprite.position.set(x, y, 0);

            sprite.userData = { action: action, originalScale: { x: 3, y: 1.2 } };
            this.scene.add(sprite);
            this.interactiveObjects.push(sprite);
            return sprite;
        };

        this.playBtn = createButton('Play', 0, 0.5, 'play');
        this.helpBtn = createButton('Help', -1.6, -1.0, 'help');
        this.aboutBtn = createButton('About', 1.6, -1.0, 'about');
    }

    update(time) {
        // Floating effect
        if (this.playBtn) this.playBtn.position.y = 0.5 + Math.sin(time * 2) * 0.05;
        if (this.helpBtn) this.helpBtn.position.y = -1.0 + Math.sin(time * 2 + 1) * 0.05;
        if (this.aboutBtn) this.aboutBtn.position.y = -1.0 + Math.sin(time * 2 + 1.5) * 0.05;
        if (this.titleSprite) {
            this.titleSprite.position.y = 1.8 + Math.sin(time * 1.5) * 0.03;
            this.titleSprite.rotation.z = Math.sin(time * 0.5) * 0.02;
        }
    }

    getIntersects() {
        this.raycaster.setFromCamera(this.mouse, this.game.camera);
        return this.raycaster.intersectObjects(this.interactiveObjects, false);
    }

    onMouseMove(event) {
        if (event.target.tagName !== 'CANVAS') return;

        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        const intersects = this.getIntersects();
        let hovered = false;

        // Reset scales
        this.interactiveObjects.forEach(obj => {
            if (obj.userData.originalScale) {
                obj.scale.set(
                    obj.userData.originalScale.x,
                    obj.userData.originalScale.y,
                    1
                );
            }
        });

        if (intersects.length > 0) {
            const obj = intersects[0].object;
            if (obj.userData.action) {
                hovered = true;

                if (this.hoveredObject !== obj) {
                    this.hoveredObject = obj;
                    this.game.playHoverSound();
                }

                // Scale up
                obj.scale.set(
                    obj.userData.originalScale.x * 1.1,
                    obj.userData.originalScale.y * 1.1,
                    1
                );
            }
        }

        if (!hovered) {
            this.hoveredObject = null;
        }

        document.body.style.cursor = hovered ? 'pointer' : 'default';
    }

    onMouseDown(event) {
        if (event.target.tagName !== 'CANVAS') return;
        if (event.button !== 0) return; // Only left click

        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        const intersects = this.getIntersects();

        if (intersects.length > 0) {
            const action = intersects[0].object.userData.action;

            if (action === 'play') {
                this.game.switchScene('difficulty');
            } else if (action === 'help') {
                this.game.showHelp();
            } else if (action === 'about') {
                this.game.showAbout();
            }
        }
    }
}
