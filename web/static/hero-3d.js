/**
 * =========================================================================
 * CHESS ARENA — 3D Hero Background (Three.js)
 * =========================================================================
 * Creates an interactive, impressive 3D scene for the landing page.
 * Uses Three.js for rendering.
 */

class HeroScene {
    constructor() {
        this.container = document.querySelector('#mode-select-screen');
        this.canvas = document.querySelector('#hero-canvas');
        
        if (!this.canvas) return;

        // Scene Setup
        this.scene = new THREE.Scene();
        // Soft fog for depth
        this.scene.fog = new THREE.Fog(0xf5f7fa, 10, 50);

        // Camera
        this.camera = new THREE.PerspectiveCamera(
            45, 
            window.innerWidth / window.innerHeight, 
            0.1, 
            1000
        );
        this.camera.position.z = 30;
        this.camera.position.y = 5;

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Objects
        this.objects = [];
        this.time = 0;

        this.initLights();
        this.initObjects();
        this.addEventListeners();
        this.animate();
    }

    initLights() {
        // Ambient Light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        // Main Directional Light (Sun)
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        this.scene.add(dirLight);

        // Accent Light (Blue/Purple from bottom)
        const spotLight = new THREE.SpotLight(0x4f46e5, 2);
        spotLight.position.set(-10, -10, 10);
        spotLight.lookAt(0, 0, 0);
        this.scene.add(spotLight);
    }

    initObjects() {
        // Material for "Chess Pieces" (Abstract Glass/Ceramic)
        const material = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            metalness: 0.1,
            roughness: 0.2,
            transmission: 0.1, // Glass-like
            thickness: 1.0,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1
        });

        const accentMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x4f46e5,
            metalness: 0.2,
            roughness: 0.2,
            transmission: 0.2,
            thickness: 1.5,
            clearcoat: 1.0
        });

        // Create abstract shapes
        const geometries = [
            new THREE.IcosahedronGeometry(1.5, 0), // Knight-ish
            new THREE.OctahedronGeometry(1.5, 0),  // Bishop-ish
            new THREE.BoxGeometry(2, 2, 2),        // Rook
            new THREE.SphereGeometry(1.2, 32, 32), // Pawn
            new THREE.ConeGeometry(1.5, 3, 32),    // Queen
        ];

        // Scatter them
        for (let i = 0; i < 15; i++) {
            const isAccent = Math.random() > 0.7;
            const geo = geometries[Math.floor(Math.random() * geometries.length)];
            const mesh = new THREE.Mesh(geo, isAccent ? accentMaterial : material);

            // Random positions
            mesh.position.x = (Math.random() - 0.5) * 40;
            mesh.position.y = (Math.random() - 0.5) * 20;
            mesh.position.z = (Math.random() - 0.5) * 20;

            // Random rotation speed
            mesh.userData = {
                rotSpeedX: (Math.random() - 0.5) * 0.02,
                rotSpeedY: (Math.random() - 0.5) * 0.02,
                floatSpeed: 0.002 + Math.random() * 0.005,
                floatOffset: Math.random() * Math.PI * 2,
                initialY: mesh.position.y
            };

            mesh.castShadow = true;
            mesh.receiveShadow = true;
            
            this.scene.add(mesh);
            this.objects.push(mesh);
        }

        // Add a floor plane for shadows (invisible but receives shadows)
        const planeGeo = new THREE.PlaneGeometry(200, 200);
        const planeMat = new THREE.ShadowMaterial({ opacity: 0.05 });
        const plane = new THREE.Mesh(planeGeo, planeMat);
        plane.rotation.x = -Math.PI / 2;
        plane.position.y = -10;
        plane.receiveShadow = true;
        this.scene.add(plane);
    }


    addEventListeners() {
        this.mouseX = 0;
        this.mouseY = 0;

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        document.addEventListener('mousemove', (e) => {
            this.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        this.time += 0.01;

        // Smooth camera follow
        const targetX = this.mouseX * 3;
        const targetY = 5 + this.mouseY * 3;
        
        // Simple lerp
        this.camera.position.x += (targetX - this.camera.position.x) * 0.05;
        this.camera.position.y += (targetY - this.camera.position.y) * 0.05;
        this.camera.lookAt(0, 0, 0);

        // Animate objects
        this.objects.forEach((obj, i) => {
            obj.rotation.x += obj.userData.rotSpeedX;
            obj.rotation.y += obj.userData.rotSpeedY;
            
            // Floating motion
            obj.position.y = obj.userData.initialY + Math.sin(this.time + obj.userData.floatOffset) * 0.5;
        });

        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize once the DOM is ready — the canvas is now fixed in <body>
document.addEventListener('DOMContentLoaded', () => {
    new HeroScene();
});
