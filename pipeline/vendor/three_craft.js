/**
 * three_craft.js — dashi-studio 电影级 Three.js 美学工艺与复合构件库（100% 离线确定性）
 *
 * 解决原生 WebGL「塑料积木感」的五大核心工艺：
 *   1. 程序化摄影棚 HDR 环境反射贴图（PMREMGenerator 实时烘焙多灯位柔光箱，金属与清漆自然流淌高光）
 *   2. ACESFilmic 电影级色调映射 + PCFSoftShadowMap 真实柔和投影
 *   3. 全面淘汰生硬直角 BoxGeometry：内置 45° 圆润高光倒角（roundedBoxGeo / bevelRingGeo / hexCoreGeo）
 *   4. 高定复合构件工厂（精雕晶圆基座、三轴星环陀螺仪、矩阵显存抽屉舱、双层流光能量束、立体卡片与积木站）
 *   5. 2D 合成层双级光学泛光（Dual-Pass Screen Bloom）+ 纪录片级 3D→2D 折线引线标注（callout3D）
 */
(function (global) {
  'use strict';
  const THREE = global.THREE;
  if (!THREE) throw new Error('three_craft.js 需要先加载 three.min.js');

  const TAU = Math.PI * 2;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

  // ==================== 1. 五套风格专属程序化摄影棚 HDR 环境贴图 ====================
  const STUDIO_PRESETS = {
    // 黑底科技：暖香槟主柔光箱 + 琥珀侧金边光 + 冷藏青轮廓背光
    cinemaGold: {
      bg: 0x06080d,
      panels: [
        { pos: [0, 9, 2], look: [0, 0, 0], size: [12, 8], color: 0xffdfad, intensity: 2.6 },
        { pos: [-9, 4, 5], look: [0, 0, 0], size: [8, 8], color: 0xf0c26e, intensity: 2.4 },
        { pos: [9, 5, -5], look: [0, 0, 0], size: [10, 8], color: 0x4b6b94, intensity: 1.9 },
        { pos: [0, -7, 0], look: [0, 0, 0], size: [16, 16], color: 0x1a150d, intensity: 0.8 },
        { pos: [0, 3, -10], look: [0, 0, 0], size: [14, 4], color: 0xffdba0, intensity: 2.1 },
      ],
    },
    // 扁平流程图 / 超现实拼贴：明快奶油暖阳摄影棚
    warmDaylight: {
      bg: 0xfcf8eb,
      panels: [
        { pos: [-5, 10, 6], look: [0, 0, 0], size: [12, 12], color: 0xffffff, intensity: 1.35 },
        { pos: [8, 4, 4], look: [0, 0, 0], size: [10, 10], color: 0xffe094, intensity: 0.85 },
        { pos: [0, -6, 0], look: [0, 0, 0], size: [16, 16], color: 0xebd9b0, intensity: 0.55 },
      ],
    },
    // 立体卡通：C4D 柔光盲盒摄影棚（左上主柔光 + 右侧钴蓝氛围光 + 薄荷底反光）
    c4dClay: {
      bg: 0x25262b,
      panels: [
        { pos: [-6, 9, 7], look: [0, 0, 0], size: [11, 11], color: 0xffffff, intensity: 1.9 },
        { pos: [9, 3, 2], look: [0, 0, 0], size: [10, 10], color: 0x5c7ee6, intensity: 1.5 },
        { pos: [-4, -6, 4], look: [0, 0, 0], size: [12, 12], color: 0x5fd0b5, intensity: 0.9 },
        { pos: [0, 5, -9], look: [0, 0, 0], size: [14, 6], color: 0xdbe6ff, intensity: 1.3 },
      ],
    },
    // 手绘笔记 / 复古报刊：清透纸面漫反射光棚
    editorialPaper: {
      bg: 0xf6f5ee,
      panels: [
        { pos: [-4, 10, 6], look: [0, 0, 0], size: [14, 14], color: 0xffffff, intensity: 1.35 },
        { pos: [8, 4, 4], look: [0, 0, 0], size: [10, 10], color: 0xe8eef8, intensity: 0.85 },
        { pos: [0, -6, 2], look: [0, 0, 0], size: [14, 14], color: 0xf7efe2, intensity: 0.65 },
      ],
    },
    // 霓虹赛博：品红与青色双霓虹灯廊
    cyberNeon: {
      bg: 0x090418,
      panels: [
        { pos: [0, 8, 3], look: [0, 0, 0], size: [12, 6], color: 0x27e1ff, intensity: 2.3 },
        { pos: [-9, 2, 4], look: [0, 0, 0], size: [10, 8], color: 0xff2ea6, intensity: 2.2 },
        { pos: [9, 3, -3], look: [0, 0, 0], size: [10, 8], color: 0xf5e663, intensity: 1.6 },
      ],
    },
  };

  function buildStudioEnv(renderer, presetName = 'cinemaGold') {
    const cfg = STUDIO_PRESETS[presetName] || STUDIO_PRESETS.cinemaGold;
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(cfg.bg);
    for (const p of cfg.panels) {
      const geo = new THREE.PlaneGeometry(p.size[0], p.size[1]);
      const col = new THREE.Color(p.color).multiplyScalar(p.intensity);
      const mat = new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, toneMapped: false });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(p.pos[0], p.pos[1], p.pos[2]);
      mesh.lookAt(p.look[0], p.look[1], p.look[2]);
      envScene.add(mesh);
    }
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const tex = pmrem.fromScene(envScene, 0.035).texture;
    pmrem.dispose();
    return tex;
  }

  // 初始化带软阴影与 ACES 电影色调映射的透明 WebGL 舞台
  function createStage(glCanvas, opts = {}) {
    const W = glCanvas.width || 1920;
    const H = glCanvas.height || 1080;
    const renderer = new THREE.WebGLRenderer({
      canvas: glCanvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setSize(W, H, false);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = opts.exposure ?? 1.18;
    renderer.localClippingEnabled = opts.localClipping !== false;
    renderer.shadowMap.enabled = opts.shadows !== false;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    scene.environment = buildStudioEnv(renderer, opts.studio || 'cinemaGold');

    let camera;
    if (opts.ortho) {
      const frustumH = opts.frustumHeight || 9.0;
      const frustumW = frustumH * (W / H);
      camera = new THREE.OrthographicCamera(-frustumW / 2, frustumW / 2, frustumH / 2, -frustumH / 2, 0.1, 120);
      camera.position.set(10, 9, 10);
      camera.lookAt(0, 0, 0);
    } else {
      camera = new THREE.PerspectiveCamera(opts.fov || 36, W / H, 0.1, 120);
      camera.position.set(0, 3.2, 11.2);
      camera.lookAt(0, 0.2, 0);
    }

    // 标准电影三点布光（主投射阴影平行光 + 侧暖补光 + 逆轮廓聚光）
    const lights = {};
    lights.ambient = new THREE.AmbientLight(opts.ambientColor ?? 0xffeede, opts.ambientIntensity ?? 0.35);
    scene.add(lights.ambient);

    lights.key = new THREE.DirectionalLight(opts.keyColor ?? 0xfff3db, opts.keyIntensity ?? 2.6);
    lights.key.position.set(5.5, 9.5, 6.5);
    if (renderer.shadowMap.enabled) {
      lights.key.castShadow = true;
      lights.key.shadow.mapSize.width = 2048;
      lights.key.shadow.mapSize.height = 2048;
      lights.key.shadow.camera.near = 1;
      lights.key.shadow.camera.far = 28;
      const d = 8.5;
      lights.key.shadow.camera.left = -d;
      lights.key.shadow.camera.right = d;
      lights.key.shadow.camera.top = d;
      lights.key.shadow.camera.bottom = -d;
      lights.key.shadow.bias = -0.0005;
      lights.key.shadow.radius = 3.5;
    }
    scene.add(lights.key);

    lights.fill = new THREE.DirectionalLight(opts.fillColor ?? 0xe8c37e, opts.fillIntensity ?? 1.15);
    lights.fill.position.set(-7.5, 3.5, 4.5);
    scene.add(lights.fill);

    lights.rim = new THREE.DirectionalLight(opts.rimColor ?? 0x7ea2d6, opts.rimIntensity ?? 1.45);
    lights.rim.position.set(0, 5.5, -8.5);
    scene.add(lights.rim);

    // 导演级无损局部视锥裁切推镜（借鉴 whaleyxbt/claude-motion stage3d.setCrop，不改变透视畸变即可超清局部放大）
    const crop = { z: 1, fx: W * 0.5, fy: H * 0.5, x0: 0, y0: 0 };
    function setCrop(z = 1, fx = W * 0.5, fy = H * 0.5) {
      crop.z = Math.max(1, z);
      crop.fx = fx;
      crop.fy = fy;
      if (crop.z <= 1.0001) {
        crop.x0 = 0;
        crop.y0 = 0;
        if (camera.clearViewOffset) camera.clearViewOffset();
      } else {
        const cw = W / crop.z;
        const ch = H / crop.z;
        crop.x0 = clamp(fx - cw * 0.5, 0, W - cw);
        crop.y0 = clamp(fy - ch * 0.5, 0, H - ch);
        if (camera.setViewOffset) camera.setViewOffset(W, H, crop.x0, crop.y0, cw, ch);
      }
      camera.updateProjectionMatrix();
      return crop;
    }

    return { renderer, scene, camera, lights, setCrop, crop };
  }

  function setStageCrop(stage3D, z = 1, fx = 960, fy = 540) {
    if (stage3D && typeof stage3D.setCrop === 'function') return stage3D.setCrop(z, fx, fy);
    return null;
  }

  // ==================== 2. 精雕倒角几何体（消灭 90° 廉价直角积木） ====================
  const _geoCache = new Map();

  function roundedBoxGeo(w = 1, h = 1, d = 1, r = 0.08, segs = 4) {
    const key = `rbox:${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}_${r.toFixed(3)}_${segs}`;
    if (_geoCache.has(key)) return _geoCache.get(key);
    const rr = Math.min(r, w * 0.45, h * 0.45, d * 0.45);
    const iw = Math.max(0.001, w - rr * 2);
    const ih = Math.max(0.001, h - rr * 2);
    const shape = new THREE.Shape();
    const x0 = -iw / 2, y0 = -ih / 2;
    shape.moveTo(x0, y0 - rr);
    shape.lineTo(x0 + iw, y0 - rr);
    shape.absarc(x0 + iw, y0, rr, -Math.PI / 2, 0, false);
    shape.lineTo(x0 + iw + rr, y0 + ih);
    shape.absarc(x0 + iw, y0 + ih, rr, 0, Math.PI / 2, false);
    shape.lineTo(x0, y0 + ih + rr);
    shape.absarc(x0, y0 + ih, rr, Math.PI / 2, Math.PI, false);
    shape.lineTo(x0 - rr, y0);
    shape.absarc(x0, y0, rr, Math.PI, Math.PI * 1.5, false);

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(0.002, d - rr * 2),
      bevelEnabled: true,
      bevelSegments: segs,
      steps: 1,
      bevelSize: rr,
      bevelThickness: rr,
      curveSegments: segs * 2,
    });
    geo.center();
    geo.computeVertexNormals();
    _geoCache.set(key, geo);
    return geo;
  }

  // 精密机械金属环（矩形切面带微倒角，比甜甜圈 Torus 精致得多）
  function precisionRingGeo(innerR = 1.6, outerR = 1.78, height = 0.09, segs = 96) {
    const key = `pring:${innerR.toFixed(3)}_${outerR.toFixed(3)}_${height.toFixed(3)}_${segs}`;
    if (_geoCache.has(key)) return _geoCache.get(key);
    const b = Math.min(0.018, (outerR - innerR) * 0.22, height * 0.28);
    const pts = [
      new THREE.Vector2(innerR + b, -height / 2),
      new THREE.Vector2(outerR - b, -height / 2),
      new THREE.Vector2(outerR, -height / 2 + b),
      new THREE.Vector2(outerR, height / 2 - b),
      new THREE.Vector2(outerR - b, height / 2),
      new THREE.Vector2(innerR + b, height / 2),
      new THREE.Vector2(innerR, height / 2 - b),
      new THREE.Vector2(innerR, -height / 2 + b),
      new THREE.Vector2(innerR + b, -height / 2),
    ];
    const geo = new THREE.LatheGeometry(pts, segs);
    geo.computeVertexNormals();
    _geoCache.set(key, geo);
    return geo;
  }

  // 六棱倒角算力柱
  function hexPrismGeo(radius = 0.7, height = 0.45, bevel = 0.05) {
    const shape = new THREE.Shape();
    const r = Math.max(0.05, radius - bevel);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(0.01, height - bevel * 2),
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: bevel,
      bevelThickness: bevel,
    });
    geo.center();
    geo.rotateX(Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  }

  // ==================== 3. 高定 PBR 物理材质库 ====================
  const Materials = {
    brushedGold: (o = {}) => new THREE.MeshPhysicalMaterial({
      color: o.color ?? 0xe8cf96,
      metalness: o.metalness ?? 0.88,
      roughness: o.roughness ?? 0.21,
      clearcoat: o.clearcoat ?? 0.55,
      clearcoatRoughness: 0.15,
      emissive: o.emissive ?? 0x3b2a0e,
      emissiveIntensity: o.emissiveIntensity ?? 0.22,
      envMapIntensity: o.envMapIntensity ?? 1.85,
      transparent: o.opacity !== undefined && o.opacity < 1,
      opacity: o.opacity ?? 1,
    }),
    champagneGlow: (o = {}) => new THREE.MeshStandardMaterial({
      color: o.color ?? 0xfff2d2,
      emissive: o.emissive ?? 0xf5d487,
      emissiveIntensity: o.emissiveIntensity ?? 2.2,
      roughness: 0.15,
      metalness: 0.1,
      transparent: o.opacity !== undefined && o.opacity < 1,
      opacity: o.opacity ?? 1,
    }),
    obsidian: (o = {}) => new THREE.MeshPhysicalMaterial({
      color: o.color ?? 0x141821,
      metalness: o.metalness ?? 0.35,
      roughness: o.roughness ?? 0.16,
      clearcoat: 1.0,
      clearcoatRoughness: 0.09,
      envMapIntensity: o.envMapIntensity ?? 1.65,
      emissive: o.emissive ?? 0x07090e,
      emissiveIntensity: o.emissiveIntensity ?? 0.2,
      transparent: o.opacity !== undefined && o.opacity < 1,
      opacity: o.opacity ?? 1,
    }),
    cinnabar: (o = {}) => new THREE.MeshPhysicalMaterial({
      color: o.color ?? 0xbd332a,
      metalness: 0.18,
      roughness: 0.22,
      clearcoat: 0.9,
      clearcoatRoughness: 0.12,
      emissive: o.emissive ?? 0x520e0a,
      emissiveIntensity: o.emissiveIntensity ?? 0.45,
      envMapIntensity: 1.5,
      transparent: o.opacity !== undefined && o.opacity < 1,
      opacity: o.opacity ?? 1,
    }),
    crystal: (o = {}) => new THREE.MeshPhysicalMaterial({
      color: o.color ?? 0xf7eed7,
      metalness: 0.05,
      roughness: o.roughness ?? 0.08,
      transmission: o.transmission ?? 0.72,
      ior: 1.48,
      thickness: 0.9,
      clearcoat: 1.0,
      envMapIntensity: 2.1,
      transparent: true,
      opacity: o.opacity ?? 0.88,
    }),
    ivory: (o = {}) => new THREE.MeshPhysicalMaterial({
      color: o.color ?? 0xd8ccb0,
      metalness: 0.12,
      roughness: 0.34,
      clearcoat: 0.45,
      clearcoatRoughness: 0.24,
      envMapIntensity: 0.95,
      transparent: o.opacity !== undefined && o.opacity < 1,
      opacity: o.opacity ?? 1,
    }),
    clay: (hexColor = 0x569bd0, o = {}) => new THREE.MeshPhysicalMaterial({
      color: hexColor,
      metalness: 0.02,
      roughness: o.roughness ?? 0.28,
      clearcoat: o.clearcoat ?? 0.55,
      clearcoatRoughness: 0.18,
      envMapIntensity: o.envMapIntensity ?? 0.65,
      transparent: o.opacity !== undefined && o.opacity < 1,
      opacity: o.opacity ?? 1,
    }),
  };

  function enableShadow(obj, cast = true, receive = true) {
    obj.traverse((c) => {
      if (c.isMesh) {
        c.castShadow = cast;
        c.receiveShadow = receive;
      }
    });
    return obj;
  }

  function addFineRim(mesh, colorHex = 0xf5dfaa, opacity = 0.42) {
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry, 28),
      new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity })
    );
    mesh.add(edges);
    return edges;
  }

  // ==================== 4. 大师级复合 3D 构件工厂 ====================

  // (A) 哑光黑丝绒阳极氧化铝星盘底座（稳重承接真实投影、绝不死白反光 + 双圈精密金色刻度环）
  function createStarPedestal(radius = 4.6, opts = {}) {
    const grp = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius * 1.03, 0.14, 96),
      new THREE.MeshStandardMaterial({
        color: opts.baseColor ?? 0x0b0e14,
        metalness: 0.38,
        roughness: 0.74,
        envMapIntensity: 0.42,
      })
    );
    disc.position.y = -0.07;
    disc.receiveShadow = true;
    grp.add(disc);

    const outerRing = new THREE.Mesh(precisionRingGeo(radius * 0.96, radius * 0.995, 0.03, 120), Materials.brushedGold());
    outerRing.position.y = 0.015;
    grp.add(outerRing);

    const innerRing = new THREE.Mesh(precisionRingGeo(radius * 0.62, radius * 0.638, 0.025, 96), Materials.brushedGold({ opacity: 0.7 }));
    innerRing.position.y = 0.014;
    grp.add(innerRing);

    // 36 枚精密金色刻度齿
    const tickGeo = roundedBoxGeo(0.035, 0.02, 0.16, 0.006, 2);
    const tickMat = Materials.brushedGold();
    const ticks = new THREE.InstancedMesh(tickGeo, tickMat, 36);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * TAU;
      const r = radius * 0.88;
      dummy.position.set(Math.sin(a) * r, 0.012, Math.cos(a) * r);
      dummy.rotation.set(0, a, 0);
      dummy.scale.set(1, 1, i % 3 === 0 ? 1.45 : 0.75);
      dummy.updateMatrix();
      ticks.setMatrixAt(i, dummy.matrix);
    }
    grp.add(ticks);
    grp.userData = { outerRing, innerRing, ticks };
    return grp;
  }

  // (B) 三轴星环折射水晶陀螺核心（AI 核心 / Query 算子 / 枢纽）
  function createGyroCore(radius = 1.15, opts = {}) {
    const grp = new THREE.Group();
    // 内发光黄金十二面体核心
    const innerCore = new THREE.Mesh(
      new THREE.IcosahedronGeometry(radius * 0.36, 0),
      Materials.champagneGlow({ emissiveIntensity: 2.0 })
    );
    grp.add(innerCore);

    // 外包折射水晶八面体舱
    const shell = new THREE.Mesh(
      new THREE.OctahedronGeometry(radius * 0.62, 0),
      Materials.crystal({ color: opts.shellColor ?? 0xfff3d6 })
    );
    addFineRim(shell, 0xfae7b5, 0.55);
    shell.castShadow = true;
    grp.add(shell);

    // 三道正交精密金属倒角环
    const ring1 = new THREE.Mesh(precisionRingGeo(radius * 0.82, radius * 0.90, 0.055, 96), Materials.brushedGold());
    const ring2 = new THREE.Mesh(precisionRingGeo(radius * 0.98, radius * 1.05, 0.045, 96), Materials.brushedGold());
    ring2.rotation.x = Math.PI * 0.35;
    const ring3 = new THREE.Mesh(
      precisionRingGeo(radius * 1.14, radius * 1.19, 0.035, 96),
      opts.accentRed ? Materials.cinnabar() : Materials.obsidian()
    );
    ring3.rotation.y = Math.PI * 0.25;
    ring1.castShadow = ring2.castShadow = true;
    grp.add(ring1, ring2, ring3);

    // 环上游走卫星金珠
    const orb = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.075, 20, 20), Materials.champagneGlow({ emissiveIntensity: 2.6 }));
    orb.position.set(radius * 1.01, 0, 0);
    ring2.add(orb);

    grp.userData = {
      innerCore, shell, ring1, ring2, ring3,
      spin(t, speed = 1) {
        innerCore.rotation.y = t * 1.4 * speed;
        innerCore.rotation.x = t * 0.9 * speed;
        shell.rotation.y = -t * 0.55 * speed;
        ring1.rotation.z = t * 0.45 * speed;
        ring1.rotation.x = Math.PI * 0.18 + Math.sin(t * 0.7) * 0.15;
        ring2.rotation.y = -t * 0.62 * speed;
        ring3.rotation.x = Math.PI * 0.42 + Math.cos(t * 0.5) * 0.2;
        ring3.rotation.z = t * 0.3 * speed;
      },
    };
    return grp;
  }

  // (C) 精雕晶圆芯片单元 / 显存金砖（黑曜石底座 + 金属倒角盖板 + 四周金针引脚）
  function createChipTile(w = 1.1, h = 0.28, d = 1.1, kind = 'dark') {
    const grp = new THREE.Group();
    const baseMat = kind === 'gold' ? Materials.brushedGold()
      : kind === 'red' ? Materials.cinnabar()
      : kind === 'ivory' ? Materials.ivory()
      : Materials.obsidian();
    const body = new THREE.Mesh(roundedBoxGeo(w, h, d, Math.min(0.055, h * 0.28), 4), baseMat);
    body.castShadow = true;
    body.receiveShadow = true;
    grp.add(body);

    // 顶部嵌一块薄金属铭牌边框
    const capMat = kind === 'gold' ? Materials.obsidian() : Materials.brushedGold();
    const cap = new THREE.Mesh(roundedBoxGeo(w * 0.82, h * 0.18, d * 0.82, 0.02, 3), capMat);
    cap.position.y = h * 0.48;
    grp.add(cap);

    // 两侧精致金色触点引脚
    const pinGeo = roundedBoxGeo(0.06, h * 0.26, 0.035, 0.008, 2);
    const pinMat = Materials.brushedGold();
    const nPins = Math.max(3, Math.floor(d / 0.24));
    for (let i = 0; i < nPins; i++) {
      const z = ((i / (nPins - 1)) - 0.5) * (d * 0.72);
      const pL = new THREE.Mesh(pinGeo, pinMat);
      pL.position.set(-w * 0.51, -h * 0.15, z);
      const pR = new THREE.Mesh(pinGeo, pinMat);
      pR.position.set(w * 0.51, -h * 0.15, z);
      grp.add(pL, pR);
    }
    grp.userData = { body, cap };
    return grp;
  }

  // (D) 双层流光能量导管（内芯高光暖白细丝 + 外层半透明玻璃护套 + 奔涌流光粒子）
  function createEnergyStream(p0, ctrl, p1, opts = {}) {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(p0[0], p0[1], p0[2]),
      new THREE.Vector3(ctrl[0], ctrl[1], ctrl[2]),
      new THREE.Vector3(p1[0], p1[1], p1[2])
    );
    const grp = new THREE.Group();
    const r = opts.radius ?? 0.032;
    const colHex = opts.color ?? 0xf5d792;

    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xfff9e8,
      emissive: colHex,
      emissiveIntensity: opts.intensity ?? 2.4,
      roughness: 0.1,
      transparent: true,
      opacity: 1,
    });
    const core = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, r * 0.45, 8, false), coreMat);
    grp.add(core);

    const sheathMat = new THREE.MeshPhysicalMaterial({
      color: colHex,
      emissive: colHex,
      emissiveIntensity: 0.45,
      roughness: 0.15,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.32,
    });
    const sheath = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, r * 1.35, 12, false), sheathMat);
    grp.add(sheath);

    const nPulses = opts.pulses ?? 3;
    const pulseMeshes = [];
    const pGeo = new THREE.SphereGeometry(r * 2.1, 16, 16);
    const pMat = Materials.champagneGlow({ color: 0xfffdf5, emissive: colHex, emissiveIntensity: 3.2 });
    for (let i = 0; i < nPulses; i++) {
      const m = new THREE.Mesh(pGeo, pMat);
      grp.add(m);
      pulseMeshes.push(m);
    }

    grp.userData = {
      curve, core, sheath, pulseMeshes,
      update(t, reveal = 1, speed = 0.65, phaseOffset = 0) {
        const a = clamp(reveal, 0, 1);
        grp.visible = a > 0.01;
        if (!grp.visible) return;
        coreMat.opacity = a;
        sheathMat.opacity = 0.32 * a;
        for (let i = 0; i < pulseMeshes.length; i++) {
          const u = ((t * speed + phaseOffset + i / pulseMeshes.length) % 1 + 1) % 1;
          const pt = curve.getPoint(u);
          pulseMeshes[i].position.copy(pt);
          const edgeFade = Math.sin(Math.PI * u);
          pulseMeshes[i].scale.setScalar(Math.max(0.001, a * (0.55 + 0.75 * edgeFade)));
        }
      },
    };
    return grp;
  }

  // ==================== 5. 双级光学泛光合成器（Dual-Pass Screen Bloom） ====================
  let _b1 = null, _b2 = null;
  function compositeBloom(ctx2d, glCanvas, opts = {}) {
    const W = ctx2d.canvas.width, H = ctx2d.canvas.height;
    const strength = opts.strength ?? 0.42;
    ctx2d.save();
    ctx2d.setTransform(1, 0, 0, 1, 0, 0);
    // 1) 主清晰 3D 图层
    ctx2d.globalAlpha = opts.alpha ?? 1;
    ctx2d.globalCompositeOperation = 'source-over';
    ctx2d.drawImage(glCanvas, 0, 0, W, H);

    if (strength > 0.01) {
      if (!_b1) {
        _b1 = document.createElement('canvas'); _b1.width = 480; _b1.height = 270;
        _b2 = document.createElement('canvas'); _b2.width = 240; _b2.height = 135;
      }
      const x1 = _b1.getContext('2d'), x2 = _b2.getContext('2d');
      x1.clearRect(0, 0, 480, 270);
      // 先压暗漫反射中灰调、拉开对比度，只提取真正的高光棱边与自发光灯丝做光学泛光，避免大面积过曝发白
      x1.filter = 'brightness(0.62) contrast(1.65) blur(4px)';
      x1.drawImage(glCanvas, 0, 0, 480, 270);
      x1.filter = 'none';

      x2.clearRect(0, 0, 240, 135);
      x2.filter = 'blur(9px) brightness(1.15)';
      x2.drawImage(_b1, 0, 0, 240, 135);
      x2.filter = 'none';

      // 2) 紧致高光辉光 + 宽幅电影散射光晕
      ctx2d.globalCompositeOperation = 'lighter';
      ctx2d.globalAlpha = strength * 0.42;
      ctx2d.drawImage(_b1, 0, 0, W, H);
      ctx2d.globalAlpha = strength * 0.30;
      ctx2d.drawImage(_b2, 0, 0, W, H);
    }
    ctx2d.restore();
  }

  // ==================== 6. 纪录片级 3D→2D 折线引线标注 ====================
  const _tmpV = new THREE.Vector3();
  function projectToHUD(camera, wx, wy, wz, W = 1920, H = 1080) {
    _tmpV.set(wx, wy, wz).project(camera);
    return {
      x: (_tmpV.x * 0.5 + 0.5) * W,
      y: (-_tmpV.y * 0.5 + 0.5) * H,
      visible: _tmpV.z >= -1 && _tmpV.z <= 1,
    };
  }

  /**
   * 在 2D HUD 画布上绘制锚定到 3D 坐标的高级折线引线标注（告别网游血条方框！）
   * opts: { dx: 130, dy: -68, sub: '英文或补充说明', accent: '#e5cf95', textCol: '#f1efe4', subCol: '#9b9484', badge: 'red'|'gold'|null, fontMain, fontSub }
   */
  function drawLeaderCallout(g, camera, wx, wy, wz, title, progress = 1, opts = {}) {
    const p = clamp(progress, 0, 1);
    if (p <= 0.01 || !title) return;
    const W = g.canvas.width, H = g.canvas.height;
    const pt = opts._projPt || projectToHUD(camera, wx, wy, wz, W, H);
    if (!pt.visible) return;

    const ax = clamp(pt.x, 140, W - 140);
    const ay = clamp(pt.y, 175, H - 210);
    const side = opts.dx !== undefined ? Math.sign(opts.dx || 1) : (ax < W * 0.5 ? -1 : 1);
    const dx = opts.dx ?? (side * 135);
    const dy = opts.dy ?? -62;

    const fMain = opts.fontMain || '700 40px "Source Han Serif SC", "Songti SC", serif';
    const fSub = opts.fontSub || '500 25px "Baskerville", "PingFang SC", serif';
    g.save();
    g.font = fMain;
    const wMain = g.measureText(title).width;
    g.font = fSub;
    const wSub = opts.sub ? g.measureText(opts.sub).width : 0;
    const shelfW = Math.max(wMain, wSub) + 34;

    // 严格保证折点 kx 在展开 shelfW 后左右均留足 76px 安全页边距，且左列自动避让左上角章节号（y>=318）！
    const safeTop = side < 0 ? 318 : 225;
    const minKx = side > 0 ? 96 : shelfW + 76;
    const maxKx = side > 0 ? W - shelfW - 76 : W - 96;
    const kx = clamp(ax + dx, minKx, maxKx);
    const ky = opts._solvedKy !== undefined ? opts._solvedKy : clamp(ay + dy, safeTop, H - 235);
    const ex = kx + side * shelfW;

    const accent = opts.accent || '#e5cf95';
    const lineP = clamp(p * 1.45, 0, 1);
    const textP = clamp((p - 0.18) / 0.82, 0, 1);

    // 1) 锚点双圈呼吸靶心
    g.globalAlpha = lineP;
    g.fillStyle = accent;
    g.shadowColor = accent;
    g.shadowBlur = 12;
    g.beginPath();
    g.arc(ax, ay, 4.5, 0, TAU);
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = accent;
    g.lineWidth = 1.4;
    g.globalAlpha = lineP * 0.55;
    g.beginPath();
    g.arc(ax, ay, 10.5, 0, TAU);
    g.stroke();

    // 2) 45° 斜折线 + 水平托线（按进度一笔画出）
    const seg1 = Math.hypot(kx - ax, ky - ay);
    const seg2 = Math.abs(ex - kx);
    const totalLen = seg1 + seg2;
    g.globalAlpha = lineP * 0.88;
    g.strokeStyle = accent;
    g.lineWidth = 1.8;
    g.setLineDash([totalLen * lineP, totalLen + 20]);
    g.beginPath();
    g.moveTo(ax, ay);
    g.lineTo(kx, ky);
    g.lineTo(ex, ky);
    g.stroke();
    g.setLineDash([]);

    // 3) 主标题与副标（支持朱砂红印章底或纯净衬线排版）
    if (textP > 0) {
      const tx = side > 0 ? kx + 12 : kx - 12;
      const align = side > 0 ? 'left' : 'right';
      g.globalAlpha = textP;
      g.textAlign = align;
      g.textBaseline = 'bottom';

      if (opts.badge === 'red' || opts.badge === 'gold') {
        const bw = wMain + 28, bh = 54;
        const bx = side > 0 ? tx - 10 : tx - bw + 10;
        const by = ky - bh - 8 + (1 - textP) * 8;
        g.fillStyle = opts.badge === 'red' ? '#b1312a' : '#d8ba79';
        g.shadowColor = opts.badge === 'red' ? 'rgba(177,49,42,0.5)' : 'rgba(229,207,149,0.45)';
        g.shadowBlur = 18;
        g.beginPath();
        g.roundRect(bx, by, bw, bh, 6);
        g.fill();
        g.shadowBlur = 0;
        g.strokeStyle = opts.badge === 'red' ? 'rgba(252,208,192,0.55)' : 'rgba(26,19,10,0.35)';
        g.lineWidth = 1.3;
        g.stroke();
        g.font = fMain;
        g.fillStyle = opts.badge === 'red' ? '#fee5d5' : '#1a130a';
        g.textBaseline = 'middle';
        g.fillText(title, side > 0 ? bx + 14 : bx + bw - 14, by + bh / 2 + 1);
      } else {
        g.font = fMain;
        g.shadowColor = 'rgba(0,0,0,0.88)';
        g.shadowBlur = 14;
        g.fillStyle = opts.textCol || '#f5efe2';
        g.fillText(title, tx, ky - 9 + (1 - textP) * 8);
      }

      if (opts.sub) {
        g.font = fSub;
        g.textBaseline = 'top';
        g.shadowColor = 'rgba(0,0,0,0.85)';
        g.shadowBlur = 8;
        g.fillStyle = opts.subCol || '#b8ad96';
        g.fillText(opts.sub, tx, ky + 8 + (1 - textP) * 6);
      }
    }
    g.restore();
  }

  /**
   * 批量引线同侧 Y 轴双向松弛自动防撞求解器（借鉴并增强自 whaleyxbt/claude-motion engine labels 防撞算法）
   * 彻底杜绝同一镜头同侧出现 2~5 个 3D 标签时的文字碰撞或引线打结。
   */
  function drawLeaderCalloutBatch(g, camera, items, defaultOpts = {}) {
    if (!items || !items.length) return;
    const W = g.canvas.width, H = g.canvas.height;
    const maxY = defaultOpts.maxY ?? (H - 235);
    const minGap = defaultOpts.minGap ?? 96;

    const groups = { '-1': [], '1': [] };
    items.forEach((it, idx) => {
      const p = clamp(it.progress ?? 1, 0, 1);
      if (p <= 0.01 || !it.title) return;
      const pt = projectToHUD(camera, it.wx, it.wy, it.wz, W, H);
      if (!pt.visible) return;
      const merged = { ...defaultOpts, ...(it.opts || {}) };
      const ax = clamp(pt.x, 140, W - 140);
      const ay = clamp(pt.y, 175, H - 210);
      const side = merged.dx !== undefined ? (Math.sign(merged.dx || 1) >= 0 ? 1 : -1) : (ax < W * 0.5 ? -1 : 1);
      const minY = side < 0 ? (defaultOpts.minYLeft ?? 318) : (defaultOpts.minYRight ?? 225);
      const dy = merged.dy ?? -62;
      const wantKy = clamp(ay + dy, minY, maxY);
      groups[String(side)].push({ it, idx, pt, merged, wantKy, ky: wantKy, minY });
    });

    for (const key of ['-1', '1']) {
      const col = groups[key];
      if (!col.length) continue;
      const minY = col[0].minY;
      if (col.length > 1) {
        col.sort((a, b) => (a.wantKy - b.wantKy) || (a.idx - b.idx));
        const effGap = Math.min(minGap, (maxY - minY) / Math.max(1, col.length - 1));
        col[0].ky = Math.max(minY, col[0].wantKy);
        for (let i = 1; i < col.length; i++) {
          col[i].ky = Math.max(col[i].wantKy, col[i - 1].ky + effGap);
        }
        if (col[col.length - 1].ky > maxY) {
          col[col.length - 1].ky = maxY;
          for (let i = col.length - 2; i >= 0; i--) {
            col[i].ky = Math.min(col[i].ky, col[i + 1].ky - effGap);
          }
        }
        if (col[0].ky < minY) {
          col[0].ky = minY;
          for (let i = 1; i < col.length; i++) {
            col[i].ky = Math.max(col[i].ky, col[i - 1].ky + effGap);
          }
        }
      }
      for (const entry of col) {
        drawLeaderCallout(g, camera, entry.it.wx, entry.it.wy, entry.it.wz, entry.it.title, entry.it.progress, {
          ...entry.merged,
          _projPt: entry.pt,
          _solvedKy: entry.ky,
        });
      }
    }
  }

  // ==================== 7. 其余六套画风专属高定 3D 构件工厂 ====================

  // [立体卡通] C4D 水润光面胶囊（两端半球 + 圆柱中段 + 银色卡环可选）
  function createCapsulePill(length = 1.6, radius = 0.38, hexColor = 0x2fa35c, opts = {}) {
    const grp = new THREE.Group();
    const cylLen = Math.max(0.05, length - radius * 2);
    const mat = Materials.clay(hexColor, { roughness: 0.22, clearcoat: 0.85, envMapIntensity: 0.95 });
    let body;
    if (THREE.CapsuleGeometry) {
      body = new THREE.Mesh(new THREE.CapsuleGeometry(radius, cylLen, 16, 32), mat);
      body.rotation.z = Math.PI / 2;
    } else {
      body = new THREE.Mesh(roundedBoxGeo(length, radius * 2, radius * 2, radius * 0.45, 5), mat);
    }
    body.castShadow = body.receiveShadow = true;
    grp.add(body);

    if (opts.band !== false) {
      const band = new THREE.Mesh(
        precisionRingGeo(radius * 0.98, radius * 1.07, 0.11, 64),
        Materials.clay(opts.bandColor ?? 0xe4ebf3, { roughness: 0.18, clearcoat: 0.9 })
      );
      band.rotation.z = Math.PI / 2;
      band.castShadow = true;
      grp.add(band);
    }
    return grp;
  }

  // [立体卡通] 3D 双螺旋科学链条（《科学美国人》封面风）
  function createHelixChain(turns = 1.6, radius = 0.85, height = 3.2, colA = 0x2fa35c, colB = 0x569bd0) {
    const grp = new THREE.Group();
    const ptsA = [], ptsB = [];
    const N = 48;
    for (let i = 0; i <= N; i++) {
      const u = i / N, a = u * turns * TAU, y = (u - 0.5) * height;
      ptsA.push(new THREE.Vector3(Math.cos(a) * radius, y, Math.sin(a) * radius));
      ptsB.push(new THREE.Vector3(Math.cos(a + Math.PI) * radius, y, Math.sin(a + Math.PI) * radius));
    }
    const cA = new THREE.CatmullRomCurve3(ptsA);
    const cB = new THREE.CatmullRomCurve3(ptsB);
    const sA = new THREE.Mesh(new THREE.TubeGeometry(cA, 64, 0.095, 16, false), Materials.clay(colA, { clearcoat: 0.85 }));
    const sB = new THREE.Mesh(new THREE.TubeGeometry(cB, 64, 0.095, 16, false), Materials.clay(colB, { clearcoat: 0.85 }));
    sA.castShadow = sB.castShadow = true;
    grp.add(sA, sB);

    const rungMat = Materials.clay(0xd8e4f0, { roughness: 0.22 });
    const nRungs = 10;
    for (let k = 0; k < nRungs; k++) {
      const u = (k + 0.5) / nRungs;
      const p1 = cA.getPoint(u), p2 = cB.getPoint(u);
      const mid = p1.clone().add(p2).multiplyScalar(0.5);
      const dist = p1.distanceTo(p2);
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, dist, 12), rungMat);
      rung.position.copy(mid);
      rung.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p2.clone().sub(p1).normalize());
      rung.castShadow = true;
      grp.add(rung);
    }
    return grp;
  }

  // [手绘笔记] 达芬奇钢笔蓝图立体构件（米白/浅橙纸质遮挡面 + 墨蓝 #15192d 结构棱线）
  function createBlueprintPart(geo, opts = {}) {
    const grp = new THREE.Group();
    const fillHex = opts.accent === 'orange' ? 0xf8711c : opts.accent === 'ink' ? 0x1e2542 : opts.accent === 'tint' ? 0xfde6d2 : 0xfcfcf6;
    const lineHex = opts.accent === 'ink' ? 0xfcfcf6 : 0x15192d;
    const mat = new THREE.MeshStandardMaterial({
      color: fillHex,
      roughness: 0.86,
      metalness: 0.02,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = mesh.receiveShadow = true;
    grp.add(mesh);

    const edgeGeo = new THREE.EdgesGeometry(geo, opts.thresholdAngle ?? 18);
    const lines = new THREE.LineSegments(
      edgeGeo,
      new THREE.LineBasicMaterial({ color: lineHex, transparent: true, opacity: opts.lineOpacity ?? 0.92 })
    );
    grp.add(lines);

    // 轻微错位第二遍细钢笔复描线，还原手绘钢笔手稿韵味
    const sketchLines = new THREE.LineSegments(
      edgeGeo,
      new THREE.LineBasicMaterial({ color: lineHex, transparent: true, opacity: 0.32 })
    );
    sketchLines.scale.setScalar(1.014);
    sketchLines.rotation.set(0.012, -0.015, 0.008);
    grp.add(sketchLines);
    grp.userData = { mesh, lines };
    return grp;
  }

  // [复古报刊] 深海科考黄铜与藏蓝珐琅精密仪
  function createNauticalCore(radius = 1.15, opts = {}) {
    const grp = new THREE.Group();
    const dial = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius * 1.04, 0.22, 64),
      Materials.clay(0xfdfdfb, { roughness: 0.38, clearcoat: 0.3 })
    );
    dial.rotation.x = Math.PI * 0.5;
    dial.castShadow = dial.receiveShadow = true;
    grp.add(dial);

    const bezel = new THREE.Mesh(
      precisionRingGeo(radius * 0.92, radius * 1.08, 0.28, 72),
      Materials.clay(0x1d3d8a, { roughness: 0.26, clearcoat: 0.65 })
    );
    bezel.rotation.x = Math.PI * 0.5;
    bezel.castShadow = true;
    grp.add(bezel);

    const needle = new THREE.Mesh(
      roundedBoxGeo(radius * 1.35, 0.14, 0.12, 0.03, 3),
      Materials.clay(opts.red ? 0xbb3633 : 0xd3ab7d, { roughness: 0.25 })
    );
    needle.position.z = 0.16;
    needle.castShadow = true;
    grp.add(needle);

    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 24), Materials.clay(0x1d3d8a));
    cap.position.z = 0.22;
    grp.add(cap);
    grp.userData = { bezel, needle };
    return grp;
  }

  // [复古剪纸] 带折线裁切白边与真实卡纸厚度的立体纸雕板（Paper Cutout Diorama）
  function createPaperCut3D(w = 1.6, h = 0.95, hexColor = 0xdacdb3, opts = {}) {
    const grp = new THREE.Group();
    const depth = opts.depth ?? 0.09;
    // 外圈手工剪纸白衬边
    if (opts.whiteBorder !== false) {
      const back = new THREE.Mesh(
        roundedBoxGeo(w + 0.14, h + 0.14, depth * 0.75, 0.03, 2),
        new THREE.MeshStandardMaterial({ color: 0xf3f2ee, roughness: 0.88, metalness: 0.0 })
      );
      back.position.z = -depth * 0.35;
      back.castShadow = back.receiveShadow = true;
      grp.add(back);
    }
    const card = new THREE.Mesh(
      roundedBoxGeo(w, h, depth, 0.025, 2),
      new THREE.MeshStandardMaterial({ color: hexColor, roughness: 0.82, metalness: 0.02 })
    );
    card.castShadow = card.receiveShadow = true;
    grp.add(card);
    return grp;
  }

  // [超现实拼贴] 底边为旋转轴的真实三维多米诺骨牌（调 rotation.z 或 rotation.x 即可真实倾倒！）
  function createDomino3D(hexColor = 0xa02503, pipColor = 0xfbf6e9, topPips = 3, botPips = 2) {
    const pivot = new THREE.Group(); // 原点在骨牌底部中心，方便直接倾倒旋转
    const Wd = 0.76, Hd = 1.52, Dd = 0.22;
    const body = new THREE.Mesh(
      roundedBoxGeo(Wd, Hd, Dd, 0.045, 4),
      Materials.clay(hexColor, { roughness: 0.32, clearcoat: 0.45 })
    );
    body.position.y = Hd / 2;
    body.castShadow = body.receiveShadow = true;
    pivot.add(body);

    // 中腰分隔横线与点数圆珠
    const bar = new THREE.Mesh(
      roundedBoxGeo(Wd * 0.78, 0.035, 0.03, 0.008, 2),
      new THREE.MeshStandardMaterial({ color: pipColor, roughness: 0.35 })
    );
    bar.position.set(0, Hd / 2, Dd * 0.51);
    pivot.add(bar);

    const pipGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.03, 16);
    pipGeo.rotateX(Math.PI / 2);
    const pipMat = new THREE.MeshStandardMaterial({ color: pipColor, roughness: 0.3 });
    const layouts = {
      1: [[0, 0]],
      2: [[-0.17, 0.16], [0.17, -0.16]],
      3: [[-0.18, 0.18], [0, 0], [0.18, -0.18]],
      4: [[-0.17, 0.17], [0.17, 0.17], [-0.17, -0.17], [0.17, -0.17]],
      5: [[-0.18, 0.18], [0.18, 0.18], [0, 0], [-0.18, -0.18], [0.18, -0.18]],
      6: [[-0.18, 0.2], [0.18, 0.2], [-0.18, 0], [0.18, 0], [-0.18, -0.2], [0.18, -0.2]],
    };
    const addHalf = (n, cy) => {
      for (const [px, py] of (layouts[n] || layouts[2])) {
        const p = new THREE.Mesh(pipGeo, pipMat);
        p.position.set(px, cy + py, Dd * 0.51);
        pivot.add(p);
      }
    };
    addHalf(topPips, Hd * 0.74);
    addHalf(botPips, Hd * 0.26);
    return pivot;
  }

  // [霓虹赛博] 全息发光灯管线框舱体（高透暗紫全息力场舱 + 双交错发光霓虹环 + 璀璨多面体能量核）
  function createNeonHoloBox(w = 1.2, h = 1.2, d = 1.2, neonHex = 0x27e1ff, coreHex = 0xff2ea6) {
    const grp = new THREE.Group();
    const geo = roundedBoxGeo(w, h, d, 0.07, 3);
    const hull = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({
      color: 0x160a30,
      emissive: neonHex,
      emissiveIntensity: 0.22,
      metalness: 0.15,
      roughness: 0.1,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    }));
    grp.add(hull);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo, 18),
      new THREE.LineBasicMaterial({ color: neonHex, transparent: true, opacity: 0.95 })
    );
    grp.add(edges);

    // 实体发光霓虹护环，确保 1080p 下灯管粗亮夺目
    const r = Math.min(w, d) * 0.56;
    const neonBand = new THREE.Mesh(
      precisionRingGeo(r * 0.88, r, 0.045, 64),
      Materials.champagneGlow({ color: 0xffffff, emissive: neonHex, emissiveIntensity: 2.8 })
    );
    grp.add(neonBand);

    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(Math.min(w, h, d) * 0.34, 0),
      Materials.champagneGlow({ color: 0xffffff, emissive: coreHex, emissiveIntensity: 3.2 })
    );
    grp.add(core);
    grp.userData = { hull, edges, neonBand, core };
    return grp;
  }

  // ==================== 8. 工业级 GLSL 脉冲流体管道与三平面动态剖面切割舱（借鉴 whaleyxbt/claude-motion） ====================

  const _STREAM_VERT = [
    'varying vec3 vN;',
    'varying vec3 vV;',
    'varying vec2 vUv;',
    'void main() {',
    '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    '  vV = -mv.xyz;',
    '  vN = normalize(normalMatrix * normal);',
    '  vUv = uv;',
    '  gl_Position = projectionMatrix * mv;',
    '}',
  ].join('\n');

  const _STREAM_FRAG = [
    'uniform vec3 uCol;',
    'uniform vec3 uHot;',
    'uniform float uT;',
    'uniform float uSpeed;',
    'uniform float uPulses;',
    'uniform float uReveal;',
    'uniform float uIntensity;',
    'uniform float uPhase;',
    'varying vec3 vN;',
    'varying vec3 vV;',
    'varying vec2 vUv;',
    'void main() {',
    '  if (vUv.x > uReveal) discard;',
    '  float p = fract(vUv.x * uPulses - uT * uSpeed - uPhase);',
    '  float pulse = smoothstep(0.0, 0.14, p) * smoothstep(1.0, 0.30, p);',
    '  float ndv = max(0.0001, abs(dot(normalize(vN), normalize(vV))));',
    '  float face = pow(ndv, 0.68);',
    '  vec3 col = mix(uCol, uHot, pulse * 0.68 * face);',
    '  float lum = (0.30 + 1.45 * pulse) * (0.36 + 0.64 * face) * uIntensity;',
    '  float tip = smoothstep(0.08, 0.0, abs(vUv.x - uReveal)) * step(0.02, uReveal) * step(uReveal, 0.99);',
    '  vec3 outC = col * lum + uHot * tip * 1.5;',
    '  gl_FragColor = vec4(outC, clamp(0.86 + 0.14 * pulse + tip, 0.0, 1.0));',
    '}',
  ].join('\n');

  /**
   * GLSL 菲涅尔发光脉冲流体管道（points: [[x,y,z], ...]）
   */
  function createShaderStream(points, opts = {}) {
    const vecs = points.map((p) => (p.isVector3 ? p.clone() : new THREE.Vector3(p[0], p[1], p[2])));
    const curve = new THREE.CatmullRomCurve3(vecs, !!opts.closed, 'centripetal');
    const r = opts.radius ?? 0.044;
    const col = new THREE.Color(opts.color ?? 0xf5d792);
    const hot = new THREE.Color(opts.hotColor ?? 0xfffdf2);
    const segs = opts.tubularSegments ?? 72;

    const grp = new THREE.Group();
    const shaderMat = new THREE.ShaderMaterial({
      vertexShader: _STREAM_VERT,
      fragmentShader: _STREAM_FRAG,
      uniforms: {
        uCol: { value: col },
        uHot: { value: hot },
        uT: { value: 0 },
        uSpeed: { value: opts.speed ?? 1.35 },
        uPulses: { value: opts.pulses ?? 3.5 },
        uReveal: { value: 1.0 },
        uIntensity: { value: opts.intensity ?? 1.25 },
        uPhase: { value: opts.phase ?? 0.0 },
      },
      transparent: true,
      depthWrite: false,
      blending: opts.additive !== false ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const coreTube = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, r * 0.68, 14, !!opts.closed), shaderMat);
    grp.add(coreTube);

    const sheathMat = new THREE.MeshPhysicalMaterial({
      color: col,
      emissive: col,
      emissiveIntensity: 0.28,
      roughness: 0.14,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    });
    const sheath = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, r * 1.28, 14, !!opts.closed), sheathMat);
    grp.add(sheath);

    grp.userData = {
      curve,
      shaderMat,
      sheathMat,
      update(t, reveal = 1, intensity = opts.intensity ?? 1.25) {
        const rev = clamp(reveal, 0, 1);
        grp.visible = rev > 0.005;
        if (!grp.visible) return;
        shaderMat.uniforms.uT.value = t;
        shaderMat.uniforms.uReveal.value = rev;
        shaderMat.uniforms.uIntensity.value = intensity;
        sheathMat.opacity = 0.24 * rev;
      },
    };
    return grp;
  }

  /**
   * 三平面动态楔形剖面切割重甲舱（随 openProgress 0→1 平滑剖开装甲外壁，显露内部双螺旋 GLSL 脉冲流光管道与张量晶核）
   */
  function createCutawayChamber(opts = {}) {
    const R = opts.radius ?? 1.26;
    const Hc = opts.height ?? 2.24;
    const grp = new THREE.Group();

    const worldPlanes = [new THREE.Plane(), new THREE.Plane(), new THREE.Plane()];
    const localPlanes = [new THREE.Plane(), new THREE.Plane(), new THREE.Plane()];
    const clippedMats = [];

    function makeClippedMat(params) {
      const m = new THREE.MeshPhysicalMaterial({
        ...params,
        side: THREE.DoubleSide,
        clippingPlanes: worldPlanes,
        clipIntersection: true,
      });
      clippedMats.push(m);
      return m;
    }

    // 1) 重型阳极氧化黑曜石外甲圆筒 + 古铜导热内衬筒 + 纵向装甲肋片（受动态楔形剖面裁剪）
    const outerMat = makeClippedMat({
      color: opts.shellColor ?? 0x131822,
      metalness: 0.52,
      roughness: 0.24,
      clearcoat: 0.85,
      clearcoatRoughness: 0.14,
      envMapIntensity: 1.55,
    });
    const outerShell = new THREE.Mesh(new THREE.CylinderGeometry(R, R, Hc * 0.86, 88, 1, true), outerMat);
    outerShell.castShadow = outerShell.receiveShadow = true;
    grp.add(outerShell);

    const linerMat = makeClippedMat({
      color: opts.linerColor ?? 0x9c5a25,
      metalness: 0.78,
      roughness: 0.28,
      emissive: 0x3b1c06,
      emissiveIntensity: 0.35,
      envMapIntensity: 1.4,
    });
    const innerLiner = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.90, R * 0.90, Hc * 0.84, 88, 1, true), linerMat);
    grp.add(innerLiner);

    const waistMat = makeClippedMat({
      color: opts.trimColor ?? 0xe8cf96,
      metalness: 0.88,
      roughness: 0.20,
      clearcoat: 0.55,
      envMapIntensity: 1.85,
    });
    for (const wy of [-Hc * 0.18, Hc * 0.18]) {
      const band = new THREE.Mesh(precisionRingGeo(R * 0.98, R * 1.055, 0.065, 88), waistMat);
      band.position.y = wy;
      band.castShadow = true;
      grp.add(band);
    }

    const ribGeo = roundedBoxGeo(0.065, Hc * 0.82, 0.09, 0.015, 2);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.PI * 0.125;
      const rib = new THREE.Mesh(ribGeo, i % 2 === 0 ? waistMat : outerMat);
      rib.position.set(Math.sin(a) * (R * 1.01), 0, Math.cos(a) * (R * 1.01));
      rib.rotation.y = a;
      rib.castShadow = true;
      grp.add(rib);
    }

    // 2) 上下不裁剪精密黄铜封端法兰环（保证工程剖视图两端有完整结构收口）
    for (const sgn of [-1, 1]) {
      const capRing = new THREE.Mesh(precisionRingGeo(R * 0.58, R * 1.07, 0.11, 96), Materials.brushedGold());
      capRing.position.y = sgn * (Hc * 0.44);
      capRing.castShadow = capRing.receiveShadow = true;
      grp.add(capRing);
    }

    // 3) 舱体内部：悬浮黄金张量晶核 + 双螺旋 GLSL 脉冲流体导管 + 环形微存储金砖阵列
    const core = createGyroCore(R * 0.58, { accentRed: true });
    grp.add(core);

    const ptsKey = [], ptsVal = [];
    const N = 44;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const ang = u * TAU * 1.65;
      const y = (u - 0.5) * (Hc * 0.76);
      const rk = R * 0.68;
      ptsKey.push([Math.cos(ang) * rk, y, Math.sin(ang) * rk]);
      ptsVal.push([Math.cos(ang + Math.PI) * rk, y, Math.sin(ang + Math.PI) * rk]);
    }
    const streamKey = createShaderStream(ptsKey, {
      color: opts.streamColorA ?? 0xffcf75,
      hotColor: 0xfffef5,
      radius: 0.046,
      pulses: 4.0,
      speed: 1.55,
      intensity: 1.35,
    });
    const streamVal = createShaderStream(ptsVal, {
      color: opts.streamColorB ?? 0xe85243,
      hotColor: 0xffe6de,
      radius: 0.044,
      pulses: 4.0,
      speed: 1.55,
      phase: 0.5,
      intensity: 1.35,
    });
    grp.add(streamKey, streamVal);

    const innerCells = [];
    const cellGeo = roundedBoxGeo(0.22, 0.11, 0.14, 0.02, 2);
    for (let row = 0; row < 3; row++) {
      const ry = (row - 1) * 0.52;
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU + row * 0.35;
        const m = new THREE.Mesh(cellGeo, k % 2 === 0 ? Materials.brushedGold() : Materials.cinnabar());
        m.position.set(Math.sin(a) * (R * 0.80), ry, Math.cos(a) * (R * 0.80));
        m.rotation.y = a;
        grp.add(m);
        innerCells.push({ m, row, k });
      }
    }

    function updateCutPlanes(openProgress) {
      const op = clamp(openProgress, 0, 1);
      if (op <= 0.002) {
        for (const m of clippedMats) m.clippingPlanes = null;
        return;
      }
      for (const m of clippedMats) m.clippingPlanes = worldPlanes;
      // 朝向局部 +Z 正前方切开一道半角为 halfAng 的宽景楔形天窗
      const halfAng = 0.03 + op * 1.12; // 最大张开约 130°
      const yTop = Hc * 0.46;
      localPlanes[0].set(new THREE.Vector3(-Math.cos(halfAng), 0, -Math.sin(halfAng)), 0);
      localPlanes[1].set(new THREE.Vector3(Math.cos(halfAng), 0, -Math.sin(halfAng)), 0);
      localPlanes[2].set(new THREE.Vector3(0, 1, 0), -yTop);
      grp.updateMatrixWorld(true);
      for (let i = 0; i < 3; i++) {
        worldPlanes[i].copy(localPlanes[i]).applyMatrix4(grp.matrixWorld);
      }
    }

    updateCutPlanes(0);

    grp.userData = {
      core,
      streamKey,
      streamVal,
      innerCells,
      update(t, openProgress = 0, power = 1) {
        updateCutPlanes(openProgress);
        core.userData.spin(t, 0.9 + 0.5 * power);
        const vis = clamp(0.15 + openProgress * 1.15, 0, 1);
        streamKey.userData.update(t, vis, 1.05 + 0.45 * power);
        streamVal.userData.update(t, vis, 1.05 + 0.45 * power);
        for (const ic of innerCells) {
          const pulse = 0.88 + 0.16 * Math.sin(t * 3.2 + ic.row * 1.3 + ic.k);
          ic.m.scale.setScalar(pulse);
        }
      },
    };
    return grp;
  }

  global.Craft3D = {
    buildStudioEnv,
    createStage,
    setStageCrop,
    roundedBoxGeo,
    precisionRingGeo,
    hexPrismGeo,
    Materials,
    enableShadow,
    addFineRim,
    createStarPedestal,
    createGyroCore,
    createChipTile,
    createEnergyStream,
    createShaderStream,
    createCutawayChamber,
    compositeBloom,
    projectToHUD,
    drawLeaderCallout,
    drawLeaderCalloutBatch,
    createCapsulePill,
    createHelixChain,
    createBlueprintPart,
    createNauticalCore,
    createPaperCut3D,
    createDomino3D,
    createNeonHoloBox,
  };
})(window);
