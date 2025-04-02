/*********************
* RESPONSIVE WARNING *
*********************/

const responsiveWarning = document.getElementById("responsive-warning");
// "true" if the site is optimized for responsive design, "false" if not.
const responsiveDesign = true;

// Show mobile warning if the user is on mobile and responsive-design is false.
if (!responsiveDesign && window.innerWidth <= 768) {
	responsiveWarning.classList.add("show");
}


/***********************
* MODE TOGGLE BEHAVIOR *
***********************/

// Get elements that change with the mode.
const toggleModeBtn = document.getElementById("toggle-mode-btn");
const portfolioLink = document.getElementById("portfolio-link");
const body = document.body;

// Function to apply mode.
function applyMode(mode) {
	body.classList.remove("light-mode", "dark-mode");
	body.classList.add(mode);

	if (mode === "dark-mode") {
		// Set dark mode styles.
		toggleModeBtn.style.color = "rgb(245, 245, 245)";
		toggleModeBtn.innerHTML = '<i class="bi bi-sun-fill"></i>';

		portfolioLink.style.color = "rgb(245, 245, 245)";

		responsiveWarning.style.backgroundColor = "rgb(2, 4, 8)";
	} else {
		// Set light mode styles.
		toggleModeBtn.style.color = "rgb(2, 4, 8)";
		toggleModeBtn.innerHTML = '<i class="bi bi-moon-stars-fill"></i>';

		portfolioLink.style.color = "rgb(2, 4, 8)";

		responsiveWarning.style.backgroundColor = "rgb(245, 245, 245)";
	}
}

// Check and apply saved mode on page load
let savedMode = localStorage.getItem("mode");

if (savedMode === null) {
	savedMode = "light-mode"; // Default mode.
}
applyMode(savedMode);

// Toggle mode and save preference.
toggleModeBtn.addEventListener("click", function () {
	let newMode;

	if (body.classList.contains("light-mode")) {
		newMode = "dark-mode";
	} else {
		newMode = "light-mode";
	}

	applyMode(newMode);

	// Save choice.
	localStorage.setItem("mode", newMode);
});


/*****************
* THREE.JS SETUP *
*****************/

// Detect if the user is on a mobile device.
const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);

// Get the canvas element.
const canvas = document.getElementById("webgl-canvas");

// Initialize Three.js renderer.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xeeeeee, 0);

// Create scene and camera.
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 3;

// Resize listener.
window.addEventListener("resize", function () {
	renderer.setSize(window.innerWidth, window.innerHeight);
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
});

// Card dimensions.
const width = 1;
const height = 1.5;
const radius = 0.05;

// Create a rounded rectangle shape.
const shape = new THREE.Shape();
shape.moveTo(-width / 2 + radius, -height / 2);
shape.lineTo(width / 2 - radius, -height / 2);
shape.quadraticCurveTo(width / 2, -height / 2, width / 2, -height / 2 + radius);
shape.lineTo(width / 2, height / 2 - radius);
shape.quadraticCurveTo(width / 2, height / 2, width / 2 - radius, height / 2);
shape.lineTo(-width / 2 + radius, height / 2);
shape.quadraticCurveTo(-width / 2, height / 2, -width / 2, height / 2 - radius);
shape.lineTo(-width / 2, -height / 2 + radius);
shape.quadraticCurveTo(-width / 2, -height / 2, -width / 2 + radius, -height / 2);

// Create geometry from the shape.
const geometry = new THREE.ShapeGeometry(shape);
geometry.computeBoundingBox();

// Generate UVs manually.
const bbox = geometry.boundingBox;
const offset = new THREE.Vector2(-bbox.min.x, -bbox.min.y);
const range = new THREE.Vector2(bbox.max.x - bbox.min.x, bbox.max.y - bbox.min.y);
const posAttr = geometry.attributes.position;
const uvArray = new Float32Array(posAttr.count * 2);

for (let i = 0; i < posAttr.count; i++) {
	const x = posAttr.getX(i);
	const y = posAttr.getY(i);
	uvArray[2 * i] = (x + offset.x) / range.x;
	uvArray[2 * i + 1] = (y + offset.y) / range.y;
}

geometry.setAttribute("uv", new THREE.BufferAttribute(uvArray, 2));

// Shader uniforms.
const uniforms = {
	uFrontTexture: { value: null },
	uBackTexture: { value: null },
	uMetalMap: { value: null },
	uLightDirection: { value: new THREE.Vector3(0.5, 0.5, 1.0).normalize() },
	uSpecularIntensity: { value: 0.05 },
	uShininess: { value: 20.0 },
	uMouse: { value: new THREE.Vector2(0.5, 0.5) },
	uEnvColor: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
	uContrast: { value: 1.5 },
	uOverallBrightness: { value: 0.8 },
	uTime: { value: 0 },
	uEnvMapIntensity: { value: 0.4 }
};

// Vertex shader.
const vertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main(){
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Fragment shader
const fragmentShader = `
  uniform sampler2D uFrontTexture;
  uniform sampler2D uBackTexture;
  uniform sampler2D uMetalMap;
  uniform vec3 uLightDirection;
  uniform float uSpecularIntensity;
  uniform float uShininess;
  uniform vec2 uMouse;
  uniform vec3 uEnvColor;
  uniform float uContrast;
  uniform float uOverallBrightness;
  uniform float uTime;
  uniform float uEnvMapIntensity;

  varying vec2 vUv;
  varying vec3 vNormal;

  void main(){
    vec2 flippedUV = vec2(vUv.x, 1.0 - vUv.y);
    vec4 baseColor;
    float metalMask = 0.0;

    if(gl_FrontFacing){
      baseColor = texture2D(uFrontTexture, flippedUV);
      metalMask = texture2D(uMetalMap, flippedUV).r;
    } else {
      baseColor = texture2D(uBackTexture, vec2(1.0 - flippedUV.x, flippedUV.y));
    }

    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    vec3 reflDir = reflect(-normalize(uLightDirection), normalize(vNormal));
    float spec = pow(max(dot(reflDir, viewDir), 0.0), uShininess);
    vec3 specular = uSpecularIntensity * spec * vec3(1.0);

    float fresnel = pow(1.0 - max(dot(normalize(vNormal), viewDir), 0.0), 2.0);
    vec3 envReflection = uEnvColor * fresnel * uEnvMapIntensity;

    float flicker = sin(uTime * 4.0 + vUv.x * 20.0 + vUv.y * 30.0) * 0.5 + 0.5;
    vec3 flickerColor = vec3(1.0) * flicker * 0.2;

    float d = distance(flippedUV, uMouse);
    float glint = 1.0 - smoothstep(0.0, 0.6, d);
    vec3 glintColor = glint * 0.1 * vec3(1.0);

    vec3 finalColor = baseColor.rgb + metalMask * (specular + envReflection + flickerColor) + glintColor;

    vec3 contrasted = (finalColor - vec3(0.5)) * uContrast + vec3(0.5);
    contrasted *= uOverallBrightness;

    gl_FragColor = vec4(contrasted, baseColor.a);
  }
`;

// Create shader material.
const material = new THREE.ShaderMaterial({
	vertexShader,
	fragmentShader,
	uniforms,
	side: THREE.DoubleSide,
	transparent: true
});

// Create and add the card mesh.
const card = new THREE.Mesh(geometry, material);
scene.add(card);

// Clock to update uTime.
const clock = new THREE.Clock();


/************************
* INTERACTION & CURSOR *
************************/

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let flipped = false;
let isTilting = false;
let isPointerDown = false;
let startedOverCard = false;
let pressStartTime = 0;
let pressStartPos = { x: 0, y: 0 };
let targetRotationX = 0;
let targetRotationY = 0;

// Pointer move.
canvas.addEventListener("pointermove", function (e) {
	const x = (e.clientX / window.innerWidth) * 2 - 1;
	const y = -(e.clientY / window.innerHeight) * 2 + 1;
	mouse.set(x, y);

	raycaster.setFromCamera(mouse, camera);
	const intersects = raycaster.intersectObject(card);
	const overCard = intersects.length > 0;

	const elapsed = Date.now() - pressStartTime;

	if (isPointerDown && startedOverCard && elapsed > 150) {
		canvas.style.cursor = "grabbing";
	} else {
		if (overCard) {
			canvas.style.cursor = "pointer";
		} else {
			canvas.style.cursor = "default";
		}
	}

	if (isPointerDown && startedOverCard) {
		const dx = e.clientX - pressStartPos.x;
		const dy = e.clientY - pressStartPos.y;
		const dist = Math.sqrt(dx * dx + dy * dy);

		if (isMobile && dist > 10) {
			isTilting = true;
		}

		if (isTilting) {
			targetRotationX = y * -0.5;
			if (flipped) {
				targetRotationY = Math.PI + x * 0.75;
			} else {
				targetRotationY = x * 0.75;
			}
			uniforms.uMouse.value.set(e.clientX / window.innerWidth, 1 - e.clientY / window.innerHeight);
		}
	}
});

// Pointer down.
canvas.addEventListener("pointerdown", function (e) {
	const x = (e.clientX / window.innerWidth) * 2 - 1;
	const y = -(e.clientY / window.innerHeight) * 2 + 1;
	mouse.set(x, y);

	raycaster.setFromCamera(mouse, camera);
	const intersects = raycaster.intersectObject(card);
	const overCard = intersects.length > 0;

	isPointerDown = true;
	startedOverCard = overCard;
	pressStartTime = Date.now();
	pressStartPos = { x: e.clientX, y: e.clientY };
	isTilting = !isMobile;
});

// Pointer up.
canvas.addEventListener("pointerup", function (e) {
	const dt = Date.now() - pressStartTime;
	const dx = e.clientX - pressStartPos.x;
	const dy = e.clientY - pressStartPos.y;
	const dist = Math.sqrt(dx * dx + dy * dy);

	let isClick = false;
	if (dt < 150 && dist < 10) {
		isClick = true;
	}

	const x = (e.clientX / window.innerWidth) * 2 - 1;
	const y = -(e.clientY / window.innerHeight) * 2 + 1;
	mouse.set(x, y);

	raycaster.setFromCamera(mouse, camera);
	const intersects = raycaster.intersectObject(card);
	const overCard = intersects.length > 0;

	if (startedOverCard && isClick) {
		flipped = !flipped;
	}

	targetRotationX = 0;
	if (flipped) {
		targetRotationY = Math.PI;
	} else {
		targetRotationY = 0;
	}

	uniforms.uMouse.value.set(0.5, 0.5);
	isPointerDown = false;
	isTilting = false;

	if (overCard) {
		canvas.style.cursor = "pointer";
	} else {
		canvas.style.cursor = "default";
	}
});


/*************************
* RENDER LOOP & TEXTURES *
*************************/

function animate() {
	requestAnimationFrame(animate);
	uniforms.uTime.value = clock.getElapsedTime();
	card.rotation.x += (targetRotationX - card.rotation.x) * 0.1;
	card.rotation.y += (targetRotationY - card.rotation.y) * 0.1;
	renderer.render(scene, camera);
}

animate();

// Texture loader utility.
function loadTexture(path, onLoad) {
	const loader = new THREE.TextureLoader();
	loader.load(path, texture => {
		texture.minFilter = THREE.LinearMipMapLinearFilter;
		texture.magFilter = THREE.LinearFilter;
		texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
		texture.flipY = false;
		onLoad(texture);
	});
}

// Load card textures.
loadTexture("./assets/images/front.webp", tex => uniforms.uFrontTexture.value = tex);
loadTexture("./assets/images/alpha.webp", tex => uniforms.uMetalMap.value = tex);
loadTexture("./assets/images/back.webp", tex => uniforms.uBackTexture.value = tex);
