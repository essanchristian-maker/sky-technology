/* Caméra de surveillance 3D (three.js) : suit la souris, balaie la scène, réagit au défilement. */
(function () {
  var box = document.getElementById('cam3d');
  if (!box || !window.THREE) return;
  var T = window.THREE;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var renderer;
  try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { return; }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  box.appendChild(renderer.domElement);
  box.classList.add('ready');

  var scene = new T.Scene();
  var cam = new T.PerspectiveCamera(32, 1, 0.1, 100);
  cam.position.set(0, 0.6, 9);

  scene.add(new T.HemisphereLight(0xffffff, 0x0a2a1e, 1.1));
  var key = new T.DirectionalLight(0xffffff, 2.2); key.position.set(4, 6, 6); scene.add(key);
  var rim = new T.DirectionalLight(0x34c38f, 2.4); rim.position.set(-6, 2, -4); scene.add(rim);
  var fill = new T.PointLight(0x7be3b6, 18, 20); fill.position.set(0, -2, 4); scene.add(fill);

  var white = new T.MeshStandardMaterial({ color: 0xf4f5f7, roughness: 0.32, metalness: 0.15 });
  var dark = new T.MeshStandardMaterial({ color: 0x15171a, roughness: 0.25, metalness: 0.6 });
  var glass = new T.MeshPhysicalMaterial({ color: 0x0b1a2a, roughness: 0.05, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 });
  var green = new T.MeshStandardMaterial({ color: 0x0a7d55, emissive: 0x0a7d55, emissiveIntensity: 0.6, roughness: 0.4 });

  // Support mural + bras
  var rig = new T.Group(); scene.add(rig);
  var plate = new T.Mesh(new T.CylinderGeometry(0.75, 0.75, 0.18, 48), white);
  plate.rotation.x = Math.PI / 2; plate.position.set(0, 0, -2.3); rig.add(plate);
  var arm = new T.Mesh(new T.CylinderGeometry(0.16, 0.2, 1.6, 24), white);
  arm.rotation.x = Math.PI / 2; arm.position.set(0, 0, -1.5); rig.add(arm);
  var joint = new T.Mesh(new T.SphereGeometry(0.3, 32, 16), dark); joint.position.set(0, 0, -0.7); rig.add(joint);

  // Tête de caméra (pivote)
  var head = new T.Group(); head.position.set(0, 0, -0.7); rig.add(head);
  var body = new T.Mesh(new T.CylinderGeometry(0.62, 0.62, 2.6, 64), white);
  body.rotation.x = Math.PI / 2; body.position.set(0, 0.42, 0.9); head.add(body);
  var back = new T.Mesh(new T.SphereGeometry(0.62, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), white);
  back.rotation.x = -Math.PI / 2; back.position.set(0, 0.42, -0.4); head.add(back);
  var hood = new T.Mesh(new T.CylinderGeometry(0.74, 0.74, 2.9, 64, 1, true, -Math.PI * 0.62, Math.PI * 1.24), white);
  hood.material = white.clone(); hood.material.side = T.DoubleSide;
  hood.rotation.x = Math.PI / 2; hood.rotation.y = Math.PI; hood.position.set(0, 0.42, 1.05); head.add(hood);
  var face = new T.Mesh(new T.CylinderGeometry(0.6, 0.6, 0.06, 64), dark);
  face.rotation.x = Math.PI / 2; face.position.set(0, 0.42, 2.21); head.add(face);
  var ring = new T.Mesh(new T.TorusGeometry(0.34, 0.035, 16, 64), green); ring.position.set(0, 0.42, 2.25); head.add(ring);
  var lens = new T.Mesh(new T.SphereGeometry(0.3, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), glass);
  lens.rotation.x = Math.PI / 2; lens.position.set(0, 0.42, 2.22); head.add(lens);
  var irs = [];
  for (var i = 0; i < 10; i++) {
    var a = i / 10 * Math.PI * 2;
    var ir = new T.Mesh(new T.SphereGeometry(0.035, 12, 8), new T.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2a2a, emissiveIntensity: 0.4 }));
    ir.position.set(Math.cos(a) * 0.48, 0.42 + Math.sin(a) * 0.48, 2.25); head.add(ir); irs.push(ir);
  }
  var led = new T.Mesh(new T.SphereGeometry(0.05, 12, 8), new T.MeshBasicMaterial({ color: 0xff3b30 }));
  led.position.set(0.42, 0.95, 1.9); head.add(led);

  // Faisceau de vision
  var coneGeo = new T.ConeGeometry(1.9, 6, 64, 1, true);
  coneGeo.translate(0, -3, 0); coneGeo.rotateX(-Math.PI / 2);
  var coneMat = new T.ShaderMaterial({
    transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uTime; varying vec3 vP; void main(){ float d = clamp(vP.z/6.0,0.0,1.0); float scan = 0.5+0.5*sin(vP.z*3.0-uTime*4.0); float a = (1.0-d)*0.22*(0.6+0.4*scan); gl_FragColor = vec4(0.2,0.85,0.56,a); }'
  });
  var cone = new T.Mesh(coneGeo, coneMat); cone.position.set(0, 0.42, 2.25); head.add(cone);

  // Particules
  var N = 380, pos = new Float32Array(N * 3);
  for (var j = 0; j < N; j++) { pos[j * 3] = (Math.random() - 0.5) * 16; pos[j * 3 + 1] = (Math.random() - 0.5) * 9; pos[j * 3 + 2] = (Math.random() - 0.5) * 10 - 2; }
  var pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(pos, 3));
  var dots = new T.Points(pg, new T.PointsMaterial({ color: 0x7be3b6, size: 0.035, transparent: true, opacity: 0.7 }));
  scene.add(dots);

  // Grille au sol
  var grid = new T.GridHelper(30, 40, 0x0a7d55, 0x0a7d55);
  grid.material.transparent = true; grid.material.opacity = 0.18; grid.position.y = -2.6; scene.add(grid);

  rig.position.set(-0.7, 0.3, 0); rig.scale.setScalar(0.88);
  rig.rotation.y = -0.5;

  var mx = 0, my = 0, tx = 0, ty = 0, sc = 0, visible = false, t0 = performance.now();
  // Elle suit la souris partout sur la page (ou le doigt sur mobile)
  addEventListener('pointermove', function (e) {
    var r = box.getBoundingClientRect();
    mx = Math.max(-1.4, Math.min(1.4, (e.clientX - (r.left + r.width * 0.4)) / (r.width * 0.6)));
    my = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height * 0.6)));
  }, { passive: true });
  document.addEventListener('pointerleave', function () { mx = 0; my = 0; });

  function size() {
    var w = box.clientWidth, h = box.clientHeight;
    renderer.setSize(w, h, false); cam.aspect = w / h;
    cam.position.z = w < 600 ? 12.5 : 9.5;
    cam.updateProjectionMatrix();
  }
  size(); addEventListener('resize', size);

  new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) loop(); }, { rootMargin: '100px' }).observe(box);

  function loop() {
    if (!visible) return;
    var t = (performance.now() - t0) / 1000;
    var r = box.getBoundingClientRect();
    sc = (r.top + r.height / 2 - innerHeight / 2) / innerHeight; // -1..1 selon le défilement
    var idle = reduce ? 0 : Math.sin(t * 0.6) * 0.5;
    tx += ((mx ? mx * 0.7 : idle) - tx) * 0.05;
    ty += ((my ? my * 0.35 : Math.sin(t * 0.9) * 0.08) - ty) * 0.05;
    head.rotation.y = tx + 0.5;
    head.rotation.x = ty;
    rig.rotation.y = -0.5 + sc * 0.6;
    rig.position.y = 0.2 + Math.sin(t * 1.2) * 0.08 - sc * 0.4;
    dots.rotation.y = t * 0.03 + sc * 0.3;
    coneMat.uniforms.uTime.value = t;
    led.visible = Math.floor(t * 1.5) % 2 === 0;
    var glow = 0.3 + 0.3 * Math.sin(t * 2);
    irs.forEach(function (m) { m.material.emissiveIntensity = glow; });
    renderer.render(scene, cam);
    if (!reduce) requestAnimationFrame(loop);
  }
})();
