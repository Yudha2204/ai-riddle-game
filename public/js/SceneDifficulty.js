import * as THREE from 'three';

export class SceneDifficulty {
    constructor(game) {
        this.game = game;
        this.scene = new THREE.Scene();
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.interactiveObjects = [];
        this.textureLoader = new THREE.TextureLoader();

        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);

        this.hoveredObject = null;
    }

    init() {
        this.setupBackground();
        this.createObjects();
        this.createTitle();
        window.addEventListener('mousedown', this.onMouseDown);
        window.addEventListener('mousemove', this.onMouseMove);
    }

    createTitle() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 2048; // Increased width to fit long text
        canvas.height = 512;

        // Title "Choose Difficulty"
        ctx.font = '900 130px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Gradient for Title
        const gradient = ctx.createLinearGradient(0, 50, 0, 250);
        gradient.addColorStop(0, '#facc15'); // Yellow-400
        gradient.addColorStop(1, '#eab308'); // Yellow-500

        ctx.fillStyle = gradient;
        ctx.lineWidth = 15;
        ctx.strokeStyle = '#ffffff'; // White outline
        ctx.strokeText('Pilih Mode', 1024, 256); // Center at 1024
        ctx.fillText('Pilih Mode', 1024, 256);

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;

        const mat = new THREE.SpriteMaterial({ map: texture });
        this.titleSprite = new THREE.Sprite(mat);
        // Aspect ratio 2048:512 = 4:1. Maintain height 2.5 -> Width 10.
        this.titleSprite.scale.set(10, 2.5, 1);
        this.titleSprite.position.set(0, 1.8, 0); // Position above buttons

        this.scene.add(this.titleSprite);
    }

    cleanup() {
        window.removeEventListener('mousedown', this.onMouseDown);
        window.removeEventListener('mousemove', this.onMouseMove);
    }

    setupBackground() {
        const loader = this.textureLoader;
        // Reuse background from home or load new
        loader.load('image/bg.jpg', (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            this.scene.background = texture;
        });
    }

    createObjects() {
        const difficulties = ['Easy', 'Medium', 'Hard'];

        difficulties.forEach((diff, index) => {
            const map = this.textureLoader.load(`image/${diff}.png`);
            map.colorSpace = THREE.SRGBColorSpace;
            const mat = new THREE.SpriteMaterial({ map: map });
            const sprite = new THREE.Sprite(mat);

            // Position
            // Spread x: -3, 0, 3
            sprite.position.set((index - 1) * 3, 0, 0);

            // Scale (Assuming images are roughly button shaped)
            sprite.scale.set(2.5, 1, 1);

            sprite.userData = {
                difficulty: diff.toLowerCase(),
                originalScale: { x: 2.5, y: 1 }
            };

            this.scene.add(sprite);
            this.interactiveObjects.push(sprite);
        });
    }

    update(time) {
        this.interactiveObjects.forEach((obj, i) => {
            // Floating
            obj.position.y = Math.sin(time * 2 + i) * 0.05;
        });

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

        // Reset
        this.interactiveObjects.forEach(obj => {
            obj.scale.set(obj.userData.originalScale.x, obj.userData.originalScale.y, 1);
        });

        if (intersects.length > 0) {
            const obj = intersects[0].object;
            hovered = true;

            if (this.hoveredObject !== obj) {
                this.hoveredObject = obj;
                this.game.playHoverSound();
            }

            obj.scale.set(
                obj.userData.originalScale.x * 1.1,
                obj.userData.originalScale.y * 1.1,
                1
            );
        }
        if (!hovered) {
            this.hoveredObject = null;
        }
        document.body.style.cursor = hovered ? 'pointer' : 'default';
    }

    onMouseDown(event) {
        if (event.target.tagName !== 'CANVAS') return;
        if (event.button !== 0) return;

        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        const intersects = this.getIntersects();

        if (intersects.length > 0) {
            const diff = intersects[0].object.userData.difficulty;
            this.game.startGameWithDifficulty(diff);
        }
    }
}
