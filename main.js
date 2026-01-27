/* global Phaser */

const WIDTH = 960;
const HEIGHT = 540;
const PRIMARY = 0xfa660f;
const SCALE = 1.4;
const PLAYER_BASE_W = 44;
const PLAYER_BASE_H = 40;
const ENEMY_BASE = 40;
const ENEMY_FOOT_SHIFT = 0;
const PLAYER_Y_BASE = 430;
const PLAYER_Y_OFFSET = (PLAYER_BASE_H * (SCALE - 1)) / 2;
const COIN_VALUES = [20, 50, 100, 150, 200, 250, 300, 500, 1000, 1500, 2000, 5000, 10000, 15000, 20000];
const BTC_CAP = 21000000;
const CHART_WIDTH = 240;
const CHART_HEIGHT = 80;
const BG_SCALE = 0.7;
const JUMP_FORCE = -460;
const DOUBLE_JUMP_FORCE = -620;
const COIN_Y_LIFT = -40;
const WORLD_END_X = 18000;
const TEST_SPAWN_NEAR_END = false; // set to true when testing near the end

class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
    this.worldWidth = WORLD_END_X;
    this.worldHeight = 720;
    this.isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (window.innerWidth < 900);
    this.forceMobileFullscreen = false;
  }

  tryEnterFullscreen() {
    // Button removed; no-op
  }

  updateFullscreenIcon() {
    // Button removed; no-op
  }

  applyViewportScale() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const targetW = WIDTH;
    const targetH = HEIGHT;
    const portrait = vh > vw;
    const container = document.getElementById("game");
    const canvas = this.game.canvas;
    if (!container || !canvas) return;

    // Desktop: unchanged.
    if (!this.isMobile) {
      const scale = Math.min(vw / targetW, vh / targetH, 1);
      this.cameras.main.setZoom(scale);
      this.scale.resize(targetW, targetH);
      this.cameras.main.setBounds(0, 0, this.worldWidth, HEIGHT);

      container.style.position = "relative";
      container.style.width = `${targetW}px`;
      container.style.height = `${targetH}px`;
      container.style.overflow = "hidden";

      canvas.style.position = "absolute";
      canvas.style.left = "0";
      canvas.style.top = "0";
      canvas.style.transform = "none";
      canvas.style.transformOrigin = "center center";
      return;
    }

    // Mobile portrait: scale to nearly full width, keep desktop proportions, no rotation.
    if (portrait) {
      const marginFactor = 0.98;
      const scale = Math.min((vw * marginFactor) / targetW, vh / targetH);
      this.cameras.main.setZoom(scale);
      this.scale.resize(targetW, targetH);
      this.cameras.main.setBounds(0, 0, this.worldWidth, HEIGHT);

      container.style.position = "relative";
      container.style.width = `${vw}px`;
      container.style.height = `${vh}px`;
      container.style.overflow = "hidden";

      canvas.style.position = "absolute";
      canvas.style.width = `${targetW}px`;
      canvas.style.height = `${targetH}px`;
      canvas.style.left = "50%";
      canvas.style.top = "50%";
      canvas.style.transformOrigin = "center center";
      canvas.style.transform = `translate(-50%, -50%) scale(${scale})`;
      return;
    }

    // Mobile landscape: same zoom as desktop, request fullscreen, no rotation.
    const scale = Math.min(vw / targetW, vh / targetH);
    this.cameras.main.setZoom(scale);
    this.scale.resize(targetW, targetH);
    this.cameras.main.setBounds(0, 0, this.worldWidth, HEIGHT);

    container.style.position = "relative";
    container.style.width = `${vw}px`;
    container.style.height = `${vh}px`;
    container.style.overflow = "hidden";

    canvas.style.position = "absolute";
    canvas.style.width = `${targetW}px`;
    canvas.style.height = `${targetH}px`;
    canvas.style.left = "50%";
    canvas.style.top = "50%";
    canvas.style.transformOrigin = "center center";
    canvas.style.transform = `translate(-50%, -50%) scale(${scale})`;

    if (!document.fullscreenElement && this.forceMobileFullscreen) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  }

  preload() {
    this.load.image("saylor", "assets/Saylor.png");
    this.load.image("bg_manhattan", "assets/background-digital-manhattan.png");
    this.load.image("shortjim", "assets/ShortJim.png");
    this.load.image("qr_cta", "assets/QR code.jpg");
    this.load.audio("bgm", "assets/We call them poor.mp3");
    this.load.image("speaker_icon", "assets/speaker.svg");
    this.createArrowTexture = () => {
      if (this.textures.exists("shortjim_arrow")) return;
      const g = this.add.graphics();
      g.lineStyle(2, 0xff2f2f, 1);
      g.fillStyle(0xff6b6b, 1);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(14, -6);
      g.lineTo(28, 0);
      g.lineTo(14, 6);
      g.closePath();
      g.fillPath();
      g.strokePath();
      g.generateTexture("shortjim_arrow", 30, 14);
      g.destroy();
    };
    this.load.image("jim_arrow", "assets/JimArrow.png");
    this.monsterTypes = [
      { key: "monster_doge", label: "", file: "doge.png" },
      { key: "monster_eth", label: "", file: "eth.png" },
      { key: "monster_sol", label: "", file: "sol.png" },
      { key: "monster_xrp", label: "", file: "xrp.png" },
    ];
    this.monsterTypes.forEach((m) => {
      this.load.image(m.key, `assets/monsters/${m.file}`);
    });
  }

  create() {
    this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight, true, true, true, false);
    this.createTextures();
    this.processSaylorTexture();
    this.createBackground();
    this.levelNumber = 1;

    this.platforms = this.physics.add.staticGroup();
    this.movingPlatforms = this.physics.add.group({
      allowGravity: false,
      immovable: true,
    });
    this.fragilePlatforms = this.physics.add.staticGroup();
    this.bouncePlatforms = this.physics.add.staticGroup();
    this.enemyTextMap = new Map();

    this.createLevel();
    this.createCollectibles();
    this.createEnemies();
    this.enemyProjectiles = this.physics.add.group({ allowGravity: false, immovable: false });
    this.createPlayer();
    this.createCheckpoint();
    this.createPortals();
    this.createHUD();
    this.createTutorial();
    this.setupInput();
    this.setupColliders();
    this.portalCelebrating = false;
    // Start looping soundtrack using HTMLAudio (muted autoplay, then unmute with retries)
    this.musicOn = true;
    this.bgmAudio = new Audio("assets/We%20call%20them%20poor.mp3");
    this.bgmAudio.loop = true;
    this.bgmAudio.load();
    this.bgmAudio.volume = 0;
    this.bgmAudio.muted = true;
    const unmuteLater = () => {
      if (!this.musicOn) return;
      this.bgmAudio.muted = false;
      this.bgmAudio.volume = 0.4;
    };
    const tryPlay = () => {
      if (!this.musicOn) return;
      this.bgmAudio.play().then(() => {
        setTimeout(unmuteLater, 200);
      }).catch(() => {
        // ignore; will retry
      });
    };
    // Try immediately
    tryPlay();
    // Retry a few times to beat autoplay blocking
    let retryCount = 0;
    const retryTimer = setInterval(() => {
      if (this.bgmAudio && !this.bgmAudio.paused && !this.bgmAudio.muted && this.bgmAudio.volume > 0) {
        clearInterval(retryTimer);
        return;
      }
      if (retryCount++ > 10) {
        clearInterval(retryTimer);
        return;
      }
      tryPlay();
    }, 500);
    // Fallback: on first interaction
    const unlock = () => {
      tryPlay();
      this.input.off("pointerdown", unlock);
      this.input.keyboard?.off("keydown", unlock);
    };
    this.input.once("pointerdown", unlock);
    this.input.keyboard?.once("keydown", unlock);
    this.startIntro();
    this.shortJimSpawned = false;
    this.shortJimWaveSpawned = false;
    this.applyViewportScale();
    window.addEventListener("resize", () => this.applyViewportScale());
    window.addEventListener("orientationchange", () => {
      // On rotate, try fullscreen if now landscape.
      if (window.innerWidth > window.innerHeight) {
        this.forceMobileFullscreen = true;
        document.documentElement.requestFullscreen?.().catch(() => {});
      }
      setTimeout(() => this.applyViewportScale(), 200);
    });

    const mobileFsBtn = document.getElementById("mobile-fs-btn");
    if (this.isMobile && mobileFsBtn) {
      mobileFsBtn.addEventListener("click", () => {
        this.forceMobileFullscreen = true;
        document.documentElement.requestFullscreen?.().catch(() => {});
        this.applyViewportScale();
      });
    }
    document.addEventListener("fullscreenchange", () => {
      this.applyViewportScale();
      this.updateFullscreenIcon();
    });

    // Enable footer music toggle (footer speaker icon)
    const footerIcons = document.querySelectorAll(".music-toggle");
    footerIcons.forEach((icon) => {
      const setState = () => {
        icon.style.opacity = this.musicOn ? "1" : "0.6";
        icon.style.filter = this.musicOn
          ? "invert(57%) sepia(91%) saturate(3489%) hue-rotate(352deg) brightness(100%) contrast(95%) drop-shadow(0 0 2px rgba(250, 102, 15, 0.45))"
          : "invert(29%) sepia(10%) saturate(400%) hue-rotate(10deg) brightness(70%) contrast(90%)";
      };
      setState();
      icon.onclick = () => {
        this.musicOn = !this.musicOn;
        if (this.bgmAudio) {
          if (this.musicOn) {
            this.bgmAudio.muted = false;
            this.bgmAudio.volume = 0.4;
            if (this.bgmAudio.paused) this.bgmAudio.play().catch(() => {});
          } else {
            this.bgmAudio.pause();
          }
        }
        setState();
      };
    });

    this.cameras.main.setBounds(0, 0, this.worldWidth, HEIGHT);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setDeadzone(120, 80);
    this.cameras.main.setFollowOffset(0, 40);

    this.stats = {
      btc: 0,
      kills: 0,
      startTime: this.time.now,
    };
    this.btcHistory = [0];

    this.lastOnGround = 0;
    this.lastJumpPress = -1000;
    this.lastShot = -1000;
    this.maxJumps = 2;
    this.jumpsUsed = 0;
    this.facing = 1;
    this.invulnerableUntil = 0;
    this.lives = 3;
    this.levelComplete = false;
    this.doubleTapWindow = 250;
  }

  createTextures() {
    const makeTexture = (key, w, h, draw) => {
      const g = this.add.graphics();
      draw(g);
      g.generateTexture(key, w, h);
      g.destroy();
    };

    makeTexture("platform", 200, 24, (g) => {
      g.fillStyle(PRIMARY, 1);
      g.fillRoundedRect(0, 0, 200, 24, 6);
      g.lineStyle(2, 0x1a0c03, 0.6);
      g.strokeRoundedRect(2, 2, 196, 20, 6);
    });
    makeTexture("platform_fragile", 200, 12, (g) => {
      g.fillStyle(0xffd27a, 1);
      g.fillRoundedRect(0, 0, 200, 12, 4);
      g.lineStyle(1, 0xffa200, 0.8);
      g.strokeRoundedRect(1, 1, 198, 10, 4);
    });
    makeTexture("platform_bounce", 120, 18, (g) => {
      g.fillStyle(0x0d2638, 1);
      g.fillRoundedRect(0, 0, 120, 18, 6);
      g.fillStyle(0x6bf2ff, 1);
      g.fillRoundedRect(6, 2, 108, 8, 4);
      g.lineStyle(2, 0x2cf7d0, 0.9);
      g.strokeRoundedRect(0, 0, 120, 18, 6);
    });

    makeTexture("cable", 200, 10, (g) => {
      g.fillStyle(0x0f1724, 1);
      g.fillRoundedRect(0, 0, 200, 10, 4);
      g.lineStyle(1, PRIMARY, 0.95);
      g.strokeRoundedRect(2, 2, 196, 6, 4);
    });

    makeTexture("coin_small", 24, 24, (g) => {
      g.fillStyle(0xffd24a, 1);
      g.fillCircle(12, 12, 11);
      g.lineStyle(2, 0xfff2a8, 1);
      g.strokeCircle(12, 12, 9);
    });

    makeTexture("coin_big", 36, 36, (g) => {
      g.fillStyle(0xffb83b, 1);
      g.fillCircle(18, 18, 16);
      g.lineStyle(2, 0xfff2a8, 1);
      g.strokeCircle(18, 18, 13);
    });

    makeTexture("enemy", 34, 30, (g) => {
      g.fillStyle(0x2f2a5a, 1);
      g.beginPath();
      g.moveTo(17, 15);
      g.arc(17, 15, 14, Phaser.Math.DegToRad(30), Phaser.Math.DegToRad(330), false);
      g.lineTo(17, 15);
      g.closePath();
      g.fillPath();
      g.lineStyle(2, PRIMARY, 0.9);
      g.strokeCircle(17, 15, 14);
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(22, 10, 3);
      g.fillStyle(0x2f2a5a, 1);
      g.fillCircle(23, 10, 1.4);
    });

    makeTexture("flag", 20, 50, (g) => {
      g.fillStyle(0x0c1424, 1);
      g.fillRect(0, 0, 4, 50);
      g.fillStyle(PRIMARY, 1);
      g.fillRoundedRect(4, 6, 16, 12, 4);
    });

    // Simple circular blast particle for ShortJim explosions
    makeTexture("shortjim_blast", 12, 12, (g) => {
      g.fillStyle(0xffc040, 1);
      g.fillCircle(6, 6, 5);
      g.fillStyle(0xfff6a0, 0.8);
      g.fillCircle(6, 6, 3);
    });

    // Small fire puff for explosions
    makeTexture("shortjim_fire", 10, 14, (g) => {
      g.fillStyle(0xff7a1f, 1);
      g.fillEllipse(5, 9, 6, 10);
      g.fillStyle(0xffc85a, 0.9);
      g.fillEllipse(5, 7, 4, 6);
      g.fillStyle(0xffffff, 0.6);
      g.fillEllipse(5, 5, 2, 3);
    });


    makeTexture("portal", 44, 70, (g) => {
      g.fillStyle(PRIMARY, 0.12);
      g.fillEllipse(22, 35, 40, 64);
      g.lineStyle(2, PRIMARY, 0.9);
      g.strokeEllipse(22, 35, 40, 64);
      g.lineStyle(2, 0xfff2a8, 0.8);
      g.strokeEllipse(22, 35, 26, 44);
    });

    makeTexture("player_body", 34, 44, (g) => {
      g.fillStyle(0x2d3c52, 1);
      g.fillRoundedRect(0, 6, 34, 34, 8);
      g.fillStyle(0x1dd9f8, 1);
      g.fillRect(6, 14, 22, 8);
      g.fillStyle(0x1a2233, 1);
      g.fillRect(8, 38, 6, 6);
      g.fillRect(20, 38, 6, 6);
    });
    makeTexture("player_shadow", 64, 24, (g) => {
      g.fillStyle(0x000000, 0.3);
      g.fillEllipse(32, 12, 52, 14);
    });

    this.createSkyGradient();
    this.createScanlines();
  }

  createSkyGradient() {
    const tex = this.textures.createCanvas("sky_gradient", 4, 256);
    const ctx = tex.getContext();
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, "#1e2242");
    grad.addColorStop(0.6, "#0d0f20");
    grad.addColorStop(1, "#070a14");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 4, 256);
    tex.refresh();
  }

  createScanlines() {
    const tex = this.textures.createCanvas("scanlines", 4, 4);
    const ctx = tex.getContext();
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(0, 0, 4, 1);
    ctx.fillRect(0, 2, 4, 1);
    tex.refresh();
  }

  processSaylorTexture() {
    if (!this.textures.exists("saylor") || this.textures.exists("saylor_clean")) {
      return;
    }
    const src = this.textures.get("saylor").getSourceImage();
    const canvas = this.textures.createCanvas("saylor_clean", src.width, src.height);
    const ctx = canvas.getContext();
    ctx.drawImage(src, 0, 0);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = img.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r > 245 && g > 245 && b > 245) {
        data[i + 3] = 0;
      }
    }
    ctx.putImageData(img, 0, 0);
    canvas.refresh();
  }

  createSkylineTexture(key, baseColor, highlightColor, step, variance) {
    const w = 800;
    const h = 240;
    const g = this.add.graphics();
    g.fillStyle(baseColor, 1);
    g.fillRect(0, 0, w, h);
    g.fillStyle(highlightColor, 1);

    for (let x = 0; x < w; x += step) {
      const height = Phaser.Math.Between(60, 200) + variance;
      g.fillRect(x, h - height, step - 4, height);
      if (Phaser.Math.Between(0, 10) > 7) {
        g.fillStyle(0x2cf7d0, 0.7);
        g.fillRect(x + 6, h - height + 10, 6, 6);
        g.fillStyle(highlightColor, 1);
      }
    }

    g.generateTexture(key, w, h);
    g.destroy();
  }

  createBackground() {
    this.bgImage = this.add.image(0, 0, "bg_manhattan").setOrigin(0, 0).setScrollFactor(0, 0);
    const texW = this.bgImage.width || 1;
    const texH = this.bgImage.height || 1;
    // Cover the visible viewport without over-zooming (works on all devices).
    const scale = Math.max(WIDTH / texW, HEIGHT / texH);
    this.bgImage
      .setDisplaySize(texW * scale, texH * scale)
      .setScrollFactor(0) // stick to the camera so no gaps appear when moving
      .setDepth(-10);

    this.bgTint = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x0b0b14, 0.18)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-9);
    this.scanlineOverlay = this.add.tileSprite(0, 0, WIDTH, HEIGHT, "scanlines")
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setAlpha(0.18)
      .setDepth(1000);
  }

  createLevel() {
    const groundY = 520;
    const spans = [];
    const overlapsSpan = (x, width) => spans.some(([l, r]) => x - width / 2 < r && x + width / 2 > l);
    const pushSpan = (x, width) => spans.push([x - width / 2, x + width / 2]);

    const addGround = (x, width) => {
      // Ground spans are not tracked for overlap so elevated platforms are never skipped because of them.
      const platform = this.platforms.create(x, groundY, "platform");
      const h = 36;
      platform.setDisplaySize(width, h);
      platform.refreshBody();
      if (platform.body) {
        platform.body.setSize(width, h);
        platform.body.updateFromGameObject();
      }
      return platform;
    };

    const addPlatform = (x, y, width, texture = "platform") => {
      if (overlapsSpan(x, width)) return null;
      const platform = this.platforms.create(x, y, texture);
      const h = texture === "cable" ? 10 : 24;
      platform.setDisplaySize(width, h);
      platform.refreshBody();
      if (platform.body) {
        platform.body.setSize(width, h);
        platform.body.updateFromGameObject();
      }
      pushSpan(x, width);
      return platform;
    };

    const addFragile = (x, y, width = 120) => {
      if (overlapsSpan(x, width)) return null;
      const p = this.fragilePlatforms.create(x, y, "platform_fragile");
      const h = 12;
      p.setDisplaySize(width, h);
      p.refreshBody();
      if (p.body) {
        p.body.setSize(width, h);
        p.body.updateFromGameObject();
      }
      p.setData("breaking", false);
      pushSpan(x, width);
      return p;
    };

    const addBounce = (x, y, width = 120) => {
      if (overlapsSpan(x, width)) return null;
      const p = this.bouncePlatforms.create(x, y, "platform_bounce");
      p.setDisplaySize(width, 18);
      p.refreshBody();
      pushSpan(x, width);
      return p;
    };

    const grounds = [
      [250, 500], [900, 450], [1500, 420], [2300, 420], [3200, 420], [3900, 420],
      [4550, 400], [5200, 380],
      [6000, 420], [6800, 420], [7600, 420], [8200, 420], [9000, 420],
      [9800, 420], [10400, 420], [11200, 420], [12000, 420], [12600, 400], [13200, 380],
      [14000, 360], [14800, 360], [15600, 340], [16400, 340], [17200, 320], [17800, 320],
    ];
    grounds.forEach(([x, w]) => addGround(x, w));

    const platforms = [
      [520, 450, 140], [720, 440, 140], [1180, 430, 140],
      [1700, 400, 140], [1880, 360, 140], [2060, 320, 140],
      [2500, 390, 150], [2900, 360, 150],
      [3600, 330, 150],
      [4100, 380, 140, "cable"], [4320, 380, 140, "cable"],
      [4950, 320, 150],
      [5600, 320, 150], [5800, 300, 140],
      // Act II
      [6200, 440, 140], [6400, 420, 140],
      [7200, 380, 150],
      [7800, 400, 150],
      [8400, 380, 150],
      [9100, 360, 150],
      // Act III
      [9550, 400, 150], [10180, 360, 150],
      [10600, 380, 150], [10850, 360, 150],
      [11400, 380, 150],
      [12150, 360, 150],
      [12800, 340, 150],
      [13350, 320, 140],
      [14050, 320, 140],
      [14500, 300, 140],
      [15050, 300, 140],
      [15650, 280, 140],
      [16200, 280, 140],
      [16800, 260, 140],
      [17400, 260, 140],
      // Gap reducers
      [6900, 390, 120],
      [8600, 360, 120],
      [11200, 360, 120],
      [13600, 340, 120],
      [16000, 300, 120],
      [17450, 280, 120],
    ];
    platforms.forEach(([x, y, w, t]) => addPlatform(x, y, w, t));

    // Moving platforms removed per request

    // Insert fragile platforms only to bridge big gaps (>200) between static platforms
    const ordered = platforms.slice().sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < ordered.length - 1; i += 1) {
      const [x1, y1, w1] = ordered[i];
      const [x2, y2, w2] = ordered[i + 1];
      const gap = (x2 - w2 / 2) - (x1 + w1 / 2);
      if (gap > 200) {
        const midX = (x1 + x2) / 2;
        const midY = Math.min(y1, y2) - 30;
        addFragile(midX, midY, 140);
      }
    }

    addBounce(8400, 360, 120);
    addBounce(11800, 320, 120);
    addBounce(15000, 280, 120);
    addBounce(17600, 240, 120);
  }

  createCollectibles() {
    this.coins = this.physics.add.group({
      allowGravity: false,
      immovable: true,
    });

    this.coinTextMap = new Map();
    this.btcCapRemaining = BTC_CAP;

    const randomCoinValue = (forcedValue, maxCap, remainingCap) => {
      const capRemaining = remainingCap !== undefined ? remainingCap : BTC_CAP;
      if (capRemaining <= 0) return 0;
      if (forcedValue !== undefined) {
        return Math.min(forcedValue, capRemaining);
      }
      const capFilter = (arr) => (maxCap ? arr.filter((v) => v < maxCap) : arr);
      const low = capFilter(COIN_VALUES.filter((v) => v > 20 && v < 500));
      const mid = capFilter(COIN_VALUES.filter((v) => v >= 500 && v < 3000));
      const midHigh = capFilter(COIN_VALUES.filter((v) => v >= 3000 && v <= 5000));
      const high = capFilter(COIN_VALUES.filter((v) => v > 5000));
      const r = Math.random();
      let pool = capFilter(COIN_VALUES);
      if (r < 0.75 && low.length) {
        pool = low;
      } else if (r < 0.85 && mid.length) {
        pool = mid;
      } else if (r < 0.95 && midHigh.length) {
        pool = midHigh;
      } else if (high.length) {
        pool = high;
      }
      if (!pool.length) {
        pool = COIN_VALUES;
      }
      let pick = Phaser.Utils.Array.GetRandom(pool);
      pick = Math.min(pick, capRemaining);
      return pick;
    };

    let coinCount = 0;
    const makeCoin = (x, y, forcedValue) => {
      if (this.btcCapRemaining <= 0) return null;
      const cap = coinCount < 10 ? 1000 : undefined;
      const value = randomCoinValue(forcedValue, cap, this.btcCapRemaining);
      if (value <= 0) return null;
      this.btcCapRemaining -= value;
      coinCount += 1;
      const isBig = value >= 1000;
      const key = isBig ? "coin_big" : "coin_small";
      const coin = this.coins.create(x, y + COIN_Y_LIFT, key);
      coin.setDisplaySize((isBig ? 36 : 24) * SCALE, (isBig ? 36 : 24) * SCALE);
      coin.setData("value", value);
      coin.setData("isBig", isBig);
      coin.setCircle((isBig ? 16 : 10) * SCALE);

      const symbolText = this.add.text(x, y, "₿", {
        fontFamily: "Trebuchet MS",
        fontSize: isBig ? `${18 * SCALE}px` : `${14 * SCALE}px`,
        color: "#1a1200",
        align: "center",
      }).setOrigin(0.5);

      const valueText = this.add.text(x, y + (isBig ? 26 : 20) * SCALE, String(value), {
        fontFamily: "Trebuchet MS",
        fontSize: `${10 * SCALE}px`,
        color: "#fffbdd",
        align: "center",
      }).setOrigin(0.5);

      this.coinTextMap.set(coin, { symbolText, valueText });
      return coin;
    };

    // Onboarding rewards (first two fixed)
    makeCoin(200, 480, 50);
    makeCoin(500, 430, 150);
    makeCoin(720, 420);

    // First enemy section
    makeCoin(980, 470);
    makeCoin(1220, 420);

    // Rhythm steps
    makeCoin(1500, 400);
    makeCoin(1700, 360);
    makeCoin(1880, 320);
    makeCoin(2060, 300);

    // Moving platforms mid
    makeCoin(2500, 360);
    makeCoin(2700, 340);
    makeCoin(2900, 330);

    // Moving + gaps
    makeCoin(3200, 390);
    makeCoin(3400, 330);
    makeCoin(3600, 300);

    // Pre-checkpoint
    makeCoin(3900, 390);
    makeCoin(4100, 350);
    makeCoin(4320, 350);

    // Post-checkpoint pressure
    makeCoin(4550, 370);
    makeCoin(4760, 310);
    makeCoin(4950, 300);

    // Final push
    makeCoin(5200, 350);
    makeCoin(5400, 320);
    makeCoin(5600, 300);
    makeCoin(5800, 280);
    // Act II / III extension
    makeCoin(6000, 400);
    makeCoin(6200, 420);
    makeCoin(6400, 400);
    makeCoin(6600, 380);
    makeCoin(6800, 370);
    makeCoin(7000, 360);
    makeCoin(7200, 340);
    makeCoin(7400, 330);
    makeCoin(7600, 320);
    makeCoin(7800, 310);
    makeCoin(8000, 300);
    makeCoin(8200, 290);
    makeCoin(8400, 280);
    makeCoin(8600, 280);
    makeCoin(8800, 280);
    makeCoin(9000, 280);
    makeCoin(9200, 270);
    makeCoin(9400, 270);
    makeCoin(9600, 260);
    makeCoin(9800, 260);
    makeCoin(10000, 260);
    makeCoin(10200, 250);
    makeCoin(10400, 250);
    makeCoin(10600, 240);
    makeCoin(10800, 240);
    makeCoin(11000, 240);
    makeCoin(11200, 230);
    makeCoin(11400, 230);
    makeCoin(11600, 220);
    makeCoin(11800, 220);
    makeCoin(12000, 220);
    makeCoin(12200, 210);
    makeCoin(12400, 210);
    makeCoin(12600, 200);
    makeCoin(12800, 200);
    makeCoin(13000, 190);
    makeCoin(13200, 190);
    makeCoin(13400, 180);
    makeCoin(13600, 180);
    makeCoin(13800, 170);
    makeCoin(14000, 170);
    makeCoin(14200, 160);
    makeCoin(14400, 160);
    makeCoin(14600, 150);
    makeCoin(14800, 150);
    makeCoin(15000, 140);
    makeCoin(15200, 140);
    makeCoin(15400, 130);
    makeCoin(15600, 130);
    makeCoin(15800, 120);
    makeCoin(16000, 120);
    makeCoin(16200, 120);
    makeCoin(16400, 110);
    makeCoin(16600, 110);
    makeCoin(16800, 100);
    makeCoin(17000, 100);
    makeCoin(17200, 100);
    makeCoin(17400, 90);
    makeCoin(17600, 90);
    makeCoin(17800, 90);
  }

  createEnemies() {
    this.enemies = this.physics.add.group({ allowGravity: true, bounceX: 0.1 });
    this.physics.add.collider(this.enemies, this.platforms);
    this.enemyTextMap = new Map();
    this.shortJimWaveScheduled = false;

    let baseSpawns = [
      [180, 520, 120, 240],
      [380, 520, 320, 440],
      [700, 520, 620, 780],
      [1050, 520, 970, 1130],
      [1300, 520, 1220, 1380],
      [1700, 520, 1620, 1780],
      [1500, 420, 1400, 1620],
      [1680, 420, 1600, 1760],
      [1860, 420, 1760, 1940],
      [2060, 420, 1980, 2140],
      [2300, 420, 2200, 2420],
      [2600, 420, 2500, 2720],
      [3200, 420, 3120, 3320],
      [3400, 420, 3280, 3520],
      [3800, 400, 3700, 3920],
      [4300, 400, 4200, 4420],
      [4550, 400, 4460, 4660],
      [4760, 400, 4680, 4840],
      [5200, 380, 5120, 5320],
      [5600, 360, 5500, 5720],
      [6000, 420, 5900, 6100],
      [6200, 420, 6120, 6320],
      [6400, 400, 6300, 6500],
      [6600, 400, 6500, 6700],
      [6800, 380, 6680, 6920],
      [7000, 380, 6900, 7100],
      [7200, 360, 7100, 7300],
      [7600, 340, 7480, 7720],
      [7800, 340, 7700, 7900],
      [8000, 330, 7900, 8100],
      [8200, 360, 8080, 8320],
      [8600, 340, 8480, 8720],
      [8800, 340, 8700, 8900],
      [9000, 320, 8880, 9120],
      [9400, 320, 9300, 9500],
      [9800, 320, 9680, 9920],
      [10100, 320, 10000, 10200],
      [10500, 300, 10400, 10600],
      [10400, 300, 10300, 10500],
      [11000, 300, 10900, 11100],
      [11200, 300, 11100, 11300],
      [11600, 300, 11500, 11700],
      [11800, 300, 11700, 11900],
      [12200, 280, 12100, 12300],
      [12400, 280, 12300, 12500],
      [12800, 280, 12700, 12900],
      [13000, 280, 12900, 13100],
      [13400, 260, 13300, 13500],
      [13600, 260, 13500, 13700],
      [14000, 260, 13900, 14100],
      [14200, 260, 14100, 14300],
      [14600, 240, 14500, 14700],
      [14800, 240, 14700, 14900],
      [15200, 240, 15100, 15300],
      [15400, 240, 15300, 15500],
      [15800, 220, 15700, 15900],
      [16000, 220, 15900, 16100],
      [16400, 220, 16300, 16500],
      [16600, 220, 16500, 16700],
      [17000, 200, 16900, 17100],
      [17200, 200, 17100, 17300],
      [17450, 200, 17350, 17550],
      [17650, 200, 17550, 17750],
    ];
    // Double density by adding a second pass slightly offset
    const extraSpawns = baseSpawns.map(([x, y, l, r]) => [x + 30, y, l + 30, r + 30]);
    baseSpawns = baseSpawns.concat(extraSpawns);
    this.baseEnemySpawns = baseSpawns;
    const spawnEnemy = (x, y, leftBound, rightBound) => {
      const type = Phaser.Utils.Array.GetRandom(this.monsterTypes);
      const enemy = this.enemies.create(x, y, type.key).setOrigin(0.5, 1);
      enemy.setDisplaySize(ENEMY_BASE * SCALE, ENEMY_BASE * SCALE);
      enemy.y += ENEMY_FOOT_SHIFT;
      enemy.body.setSize(enemy.displayWidth * 0.6, enemy.displayHeight * 0.8);
      enemy.body.setOffset(
        (enemy.displayWidth - enemy.body.width) / 2,
        enemy.displayHeight - enemy.body.height - 10
      );
      enemy.body.updateFromGameObject();
      enemy.setCollideWorldBounds(true);
      enemy.setData("label", type.label);
      enemy.setData("leftBound", leftBound);
      enemy.setData("rightBound", rightBound);
      enemy.setData("speed", 70);
      enemy.setData("chaseRange", 220);
      enemy.setData("chaseEnabled", Phaser.Math.Between(0, 1) === 1);
      enemy.setData("dir", Phaser.Math.Between(0, 1) === 1 ? 1 : -1);

      const text = this.add.text(x, y - 2, type.label, {
        fontFamily: "Trebuchet MS",
        fontSize: "12px",
        color: "#fa660f",
      }).setOrigin(0.5);
      this.enemyTextMap.set(enemy, text);
      return enemy;
    };
    this.spawnEnemyHelper = spawnEnemy;
    this.enemySpawnFlags = { after750: false, level2Extras: false, level3Jims1: false, level3Jims2: false };
    this.resetEnemies = () => {
      // clear existing
      this.enemies.clear(true, true);
      this.enemyTextMap.forEach((t) => t.destroy());
      this.enemyTextMap.clear();
      this.shortJimSpawned = false;
      this.shortJimWaveSpawned = false;
      this.enemySpawnFlags = { after750: false, level2Extras: false, level3Jims1: false, level3Jims2: false };
      // respawn base enemies
      if (this.baseEnemySpawns) {
        this.baseEnemySpawns.forEach(([x, y, l, r]) => this.spawnEnemyHelper(x, y, l, r));
      }
      // clear leftover projectiles
      this.enemyProjectiles.clear(true, true);
      // re-add platform enemies
      if (this.addSmallPlatformEnemies) {
        this.addSmallPlatformEnemies();
      }
    };

    this.spawnShortJim = (x, y, opts = {}) => {
      const enemy = this.enemies.create(x, y, "shortjim").setOrigin(0.5, 1);
      // Use native sprite size (no rescale) and custom body
      enemy.body.setSize(enemy.width * 0.6, enemy.height * 0.9);
      enemy.body.setOffset(
        (enemy.displayWidth - enemy.body.width) / 2,
        enemy.displayHeight - enemy.body.height
      );
      enemy.body.allowGravity = false; // don't fall into gaps
      enemy.setData("leftBound", 0);
      enemy.setData("rightBound", this.worldWidth);
      enemy.setData("speed", opts.speed || 100);
      enemy.setData("chaseRange", 1200);
      enemy.setData("dir", 1);
      enemy.setData("type", "shortjim");
      enemy.setData("shieldHP", 3);
      enemy.setData("lastShot", 0);
      const text = this.add.text(x, y - 2, "ShortJim", {
        fontFamily: "Trebuchet MS",
        fontSize: "12px",
        color: "#fa660f",
      }).setOrigin(0.5);
      this.enemyTextMap.set(enemy, text);
      return enemy;
    };

    this.addSmallPlatformEnemies = () => {
      this.platforms.getChildren().forEach((p) => {
        // Skip large ground slabs
        if (p.displayWidth && p.displayWidth <= 180) {
          const x = p.x + Phaser.Math.Between(-10, 10);
          const y = p.y;
          this.spawnEnemyHelper(x, y, x - 60, x + 60);
        }
      });
    };

    // Special ShortJims in Act I
    this.spawnShortJim(2500, 360, { speed: 44 }); // ~10% faster than base monsters (40*1.1)
    this.spawnShortJim(2700, 360);
    this.spawnShortJim(4000, 360);
    this.spawnShortJim(4500, 360);

    // Act I/early enemies
    spawnEnemy(180, 520, 120, 240);
    spawnEnemy(380, 520, 320, 440);
    spawnEnemy(700, 520, 620, 780);
    spawnEnemy(1050, 520, 970, 1130);
    spawnEnemy(1100, 520, 1220, 1380);
    spawnEnemy(1101, 520, 1220, 1380);
    spawnEnemy(1301, 520, 1220, 1380);
    spawnEnemy(1300, 520, 1220, 1380);
    spawnEnemy(1700, 520, 1620, 1780);
    spawnEnemy(1500, 420, 1400, 1620);
    spawnEnemy(1680, 420, 1600, 1760);
    spawnEnemy(1860, 420, 1760, 1940);
    spawnEnemy(2060, 420, 1980, 2140);
    spawnEnemy(2300, 420, 2200, 2420);
    spawnEnemy(2600, 420, 2500, 2720);
    spawnEnemy(3200, 420, 3120, 3320);
    spawnEnemy(3400, 420, 3280, 3520);
    spawnEnemy(3800, 400, 3700, 3920);
    spawnEnemy(4300, 400, 4200, 4420);
    spawnEnemy(4550, 400, 4460, 4660);
    spawnEnemy(4760, 400, 4680, 4840);
    spawnEnemy(5200, 380, 5120, 5320);
    spawnEnemy(5600, 360, 5500, 5720);
    // Act II/III denser enemies
    spawnEnemy(6000, 420, 5900, 6100);
    spawnEnemy(6200, 420, 6120, 6320);
    spawnEnemy(6400, 400, 6300, 6500);
    spawnEnemy(6600, 400, 6500, 6700);
    spawnEnemy(6800, 380, 6680, 6920);
    spawnEnemy(7000, 380, 6900, 7100);
    spawnEnemy(7200, 360, 7100, 7300);
    spawnEnemy(7600, 340, 7480, 7720);
    spawnEnemy(7800, 340, 7700, 7900);
    spawnEnemy(8000, 330, 7900, 8100);
    spawnEnemy(8200, 360, 8080, 8320);
    spawnEnemy(8600, 340, 8480, 8720);
    spawnEnemy(8800, 340, 8700, 8900);
    spawnEnemy(9000, 320, 8880, 9120);
    spawnEnemy(9400, 320, 9300, 9500);
    spawnEnemy(9800, 320, 9680, 9920);
    spawnEnemy(10100, 320, 10000, 10200);
    spawnEnemy(10500, 300, 10400, 10600);
    spawnEnemy(10400, 300, 10300, 10500);
    spawnEnemy(11000, 300, 10900, 11100);
    spawnEnemy(11200, 300, 11100, 11300);
    spawnEnemy(11600, 300, 11500, 11700);
    spawnEnemy(11800, 300, 11700, 11900);
    spawnEnemy(12200, 280, 12100, 12300);
    spawnEnemy(12400, 280, 12300, 12500);
    spawnEnemy(12800, 280, 12700, 12900);
    spawnEnemy(13000, 280, 12900, 13100);
    spawnEnemy(13400, 260, 13300, 13500);
    spawnEnemy(13600, 260, 13500, 13700);
    spawnEnemy(14000, 260, 13900, 14100);
    spawnEnemy(14200, 260, 14100, 14300);
    spawnEnemy(14600, 240, 14500, 14700);
    spawnEnemy(14800, 240, 14700, 14900);
    spawnEnemy(15200, 240, 15100, 15300);
    spawnEnemy(15400, 240, 15300, 15500);
    spawnEnemy(15800, 220, 15700, 15900);
    spawnEnemy(16000, 220, 15900, 16100);
    spawnEnemy(16400, 220, 16300, 16500);
    spawnEnemy(16600, 220, 16500, 16700);
    spawnEnemy(17000, 200, 16900, 17100);
    spawnEnemy(17200, 200, 17100, 17300);
    spawnEnemy(17450, 200, 17350, 17550);
    spawnEnemy(17650, 200, 17550, 17750);
    // add extra enemies on small platforms
    this.addSmallPlatformEnemies();
  }

  createPlayer() {
    const textureKey = this.textures.exists("saylor_clean") ? "saylor_clean" : "saylor";
    this.player = this.physics.add.sprite(120, PLAYER_Y_BASE + PLAYER_Y_OFFSET, textureKey).setOrigin(0.5, 0.5);
    //this.player.setDisplaySize(PLAYER_BASE_W * SCALE, PLAYER_BASE_H * SCALE);
    this.player.body.setSize(this.player.displayWidth * 0.6, this.player.displayHeight);
    this.player.body.setOffset(
      (this.player.displayWidth - this.player.body.width) / 2,
      this.player.displayHeight - this.player.body.height
    );
    this.player.body.updateFromGameObject();
    this.player.body.syncBounds = true;
    this.player.body.setCollideWorldBounds(true);

    // TEMP for testing: spawn near the end for testing. Toggle TEST_SPAWN_NEAR_END.
    // if (TEST_SPAWN_NEAR_END) {
    //   const testX = 17500;
    //   const testY = 260; // adjust if needed
    //   this.player.setPosition(testX, testY);
    //   this.checkpointPos = { x: testX, y: testY };
    // }
    this.player.body.onWorldBounds = true;

    this.playerShadow = this.add.image(this.player.x, this.player.y, "player_shadow")
      .setDepth(this.player.depth - 1)
      .setOrigin(0.5, 0.5)
      .setDisplaySize(110 * SCALE, 34 * SCALE);
  }

  createCheckpoint() {
    this.checkpoint = this.physics.add.staticImage(3920, 470, "flag");
    this.checkpoint.setDisplaySize(20 * SCALE, 50 * SCALE);
    this.checkpointActivated = false;
    this.checkpointPos = { x: 120, y: PLAYER_Y_BASE + PLAYER_Y_OFFSET };
  }

  createPortals() {
    // pick nearest existing platforms to roughly 1/3 and 2/3 of the world, plus end
    const targets = [WORLD_END_X / 3, (2 * WORLD_END_X) / 3, WORLD_END_X - 120];
    const platformBodies = this.platforms.getChildren().map((p) => ({
      x: p.x,
      y: p.y,
      width: p.displayWidth || 160,
      height: p.displayHeight || 24,
    }));
    const portalPositions = targets.map((tx) => {
      let best = platformBodies[0];
      let bestDist = Math.abs(platformBodies[0].x - tx);
      platformBodies.forEach((pb) => {
        const d = Math.abs(pb.x - tx);
        if (d < bestDist) {
          best = pb;
          bestDist = d;
        }
      });
      return { x: best.x, y: best.y - (best.height ? best.height : 24) - 4 };
    });

    this.portals = this.physics.add.staticGroup();
    portalPositions.forEach((pos, idx) => {
      const x = pos.x;
      const portalY = pos.y !== undefined ? pos.y : 320;
      const portal = this.portals.create(x, portalY, "portal").setOrigin(0.5, 1);
      portal.setDisplaySize(44 * SCALE, 70 * SCALE);
      portal.setData("levelIndex", idx + 1);
      this.add.text(x, portalY - 50, "HODL", {
        fontFamily: "Trebuchet MS",
        fontSize: "18px",
        color: "#fa660f",
        stroke: "#0b0b14",
        strokeThickness: 3,
      }).setOrigin(0.5);
    });
  }

  createHUD() {
    this.hudBtc = this.add.text(16, 12, "BTC: 0", {
      fontFamily: "Trebuchet MS",
      fontSize: "18px",
      color: "#fa660f",
    }).setScrollFactor(0);

    this.hudLives = this.add.text(WIDTH - 16, 12, "♥♥♥", {
      fontFamily: "Trebuchet MS",
      fontSize: "18px",
      color: "#fa660f",
      align: "right",
    }).setOrigin(1, 0).setScrollFactor(0);

    // Music toggle handled in credits footer (not in HUD)
    this.fullscreenBtn = null;

    this.btcChartFill = this.add.graphics().setScrollFactor(0).setDepth(1001);
    this.btcChartLine = this.add.graphics().setScrollFactor(0).setDepth(1002);
    this.updateBtcChart();
  }

  createTutorial() {
    this.tutorialText = this.add.text(WIDTH / 2, HEIGHT + 24, "Move: A/D or ←/→   Jump: W/Space/↑   Laser Eyes: E", {
      fontFamily: "Trebuchet MS",
      fontSize: "16px",
      color: "#fa660f",
      backgroundColor: "rgba(8,12,20,0.5)",
      padding: { x: 10, y: 6 },
      align: "center",
    }).setOrigin(0.5, 0.5)
      .setScrollFactor(0);
  }

  setupInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyE = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
  }

  setupColliders() {
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.player, this.movingPlatforms);
    this.physics.add.collider(this.player, this.fragilePlatforms, (player, plat) => {
      this.breakFragilePlatform(plat);
    });
    this.physics.add.collider(this.player, this.bouncePlatforms, (player) => {
      this.bouncePlayer();
    });
    this.physics.add.collider(this.enemies, this.platforms);
    this.physics.add.collider(this.enemies, this.movingPlatforms);
    this.physics.world.on("worldbounds", (body, up, down) => {
      if (body.gameObject === this.player && down) {
        this.playerHit(undefined, true);
      }
    });

    this.physics.add.overlap(this.player, this.coins, (player, coin) => {
      const value = coin.getData("value") || 1;
      const canGain = Math.min(value, BTC_CAP - this.stats.btc);
      this.stats.btc += canGain;
      this.addBtcHistory(this.stats.btc);
      this.updateHud();

      const texts = this.coinTextMap.get(coin);
      if (texts) {
        texts.symbolText.destroy();
        if (texts.valueText) {
          texts.valueText.destroy();
        }
        this.coinTextMap.delete(coin);
      }

      coin.destroy();
      this.playTone(800, 0.08);
      if (value > 1) {
        this.spawnFloatingText(player.x, player.y - 30, `+${value} BTC`);
      }
    });

    this.physics.add.overlap(this.player, this.enemyProjectiles, () => {
      this.playerHit();
    });

    this.physics.add.collider(this.player, this.enemies, (player, enemy) => {
      if (!enemy.active || this.levelComplete) {
        return;
      }

      const verticalSpeed = player.body.velocity.y;
      const overlapFromAbove = player.body.bottom - enemy.body.top;
      const lowEnough =
        player.body.bottom <= enemy.body.top + 22 ||
        player.body.bottom <= enemy.body.center.y;
      const stomping =
        verticalSpeed >= -20 &&
        overlapFromAbove >= -6 &&
        overlapFromAbove <= 22 &&
        lowEnough;
      if (stomping) {
        this.defeatEnemy(enemy);
        player.body.setVelocityY(-360);
        this.playTone(320, 0.1);
      } else {
        this.playerHit();
      }
    });

    this.physics.add.overlap(this.player, this.checkpoint, () => {
      if (!this.checkpointActivated) {
        this.checkpointActivated = true;
        this.checkpointPos = { x: this.checkpoint.x, y: this.checkpoint.y - 40 };
        this.spawnFloatingText(this.checkpoint.x, this.checkpoint.y - 60, "Checkpoint!");
        this.playTone(520, 0.12);
      }
    });

    this.physics.add.overlap(this.player, this.portals, (_player, portal) => {
      if (this.portalCelebrating) return;
      if (portal.getData("claimed")) return;
      portal.setData("claimed", true);
      const idx = portal.getData("levelIndex") || 1;
      // Make this portal a checkpoint
      this.checkpointActivated = true;
      this.checkpointPos = { x: portal.x, y: portal.y - 60 };
      this.completeLevel(idx);
    });

  }

  update(time) {
    if (this.levelComplete) {
      return;
    }

    this.updatePlayer(time);
    this.updateEnemies(time);
    this.updateEnemyProjectiles();
    this.updateMovingPlatforms(time);
    this.updateBackground();
    this.updateCoinTexts();
    this.updateCameraLookahead();
    this.checkFall(time);
  }

  updatePlayer(time) {
    const left = this.cursors.left.isDown || this.keyA.isDown;
    const right = this.cursors.right.isDown || this.keyD.isDown;

    if (left) {
      this.player.body.setVelocityX(-200);
      this.facing = -1;
      this.player.scaleX = -1;
    } else if (right) {
      this.player.body.setVelocityX(200);
      this.facing = 1;
      this.player.scaleX = 1;
    } else {
      this.player.body.setVelocityX(0);
    }

    const jumpPressed =
      Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
      Phaser.Input.Keyboard.JustDown(this.keyW) ||
      Phaser.Input.Keyboard.JustDown(this.cursors.space);

    if (jumpPressed) {
      const grounded = this.player.body.blocked.down || time - this.lastOnGround <= 120;
      if (grounded && this.jumpsUsed < this.maxJumps) {
        this.jumpsUsed = 1;
        this.player.body.setVelocityY(JUMP_FORCE);
        this.playTone(600, 0.08);
      } else if (!grounded && this.jumpsUsed < this.maxJumps) {
        this.jumpsUsed += 1;
        this.player.body.setVelocityY(DOUBLE_JUMP_FORCE);
        this.playTone(680, 0.08);
      }
      this.lastJumpPress = time;
      this.fadeTutorial();
    }

    if (this.player.body.blocked.down) {
      this.lastOnGround = time;
      this.jumpsUsed = 0;
    }

    const shootPressed = Phaser.Input.Keyboard.JustDown(this.keyE);

    if (shootPressed && time - this.lastShot > 280) {
      this.lastShot = time;
      this.fireLaser();
      this.fadeTutorial();
    }

    if (left || right) {
      this.fadeTutorial();
    }

    if (time < this.invulnerableUntil) {
      this.player.alpha = 0.6 + Math.sin(time * 0.02) * 0.2;
    } else {
      this.player.alpha = 1;
    }

    if (this.playerShadow) {
      const squish = Phaser.Math.Clamp(1 + this.player.body.velocity.y * 0.0012, 0.7, 1.15);
      this.playerShadow.x = this.player.x + 4;
      this.playerShadow.y = this.player.y + this.player.displayHeight * 0.35;
      this.playerShadow.scaleX = squish;
      this.playerShadow.scaleY = 0.9 / squish;
      this.playerShadow.alpha = 0.35;
    }
  }

  updateEnemies(time) {
    this.enemies.children.each((enemy) => {
      if (!enemy.active) {
        return;
      }
      const label = this.enemyTextMap.get(enemy);
      if (label) {
        label.setPosition(enemy.x, enemy.y - 2);
      }

      const isShortJim = enemy.getData("type") === "shortjim";
      const leftBound = enemy.getData("leftBound");
      const rightBound = enemy.getData("rightBound");
      const speed = enemy.getData("speed");
      const chaseRange = enemy.getData("chaseRange");
      const chaseEnabled = isShortJim ? true : enemy.getData("chaseEnabled");
      let dir = enemy.getData("dir");
      const nearPlayer =
        Math.abs(enemy.x - this.player.x) < chaseRange &&
        Math.abs(enemy.y - this.player.y) < 50;

      if (chaseEnabled && nearPlayer) {
        const dir = Math.sign(this.player.x - enemy.x) || 1;
        enemy.body.setVelocityX(dir * (speed + 20));
      } else {
        if (enemy.x <= leftBound) {
          dir = 1;
        } else if (enemy.x >= rightBound) {
          dir = -1;
        }
        enemy.setData("dir", dir);
        enemy.body.setVelocityX(dir * speed);
      }

      if (isShortJim) {
        enemy.body.setVelocityY(Phaser.Math.Clamp(this.player.y - enemy.y, -80, 80));
        if (time - (enemy.getData("lastShot") || 0) > 1200) {
          this.fireShortJimProjectile(enemy);
          enemy.setData("lastShot", time);
        }
      }

      if (enemy.body.velocity.x !== 0) {
        enemy.scaleX = Math.sign(enemy.body.velocity.x);
      }
    });

    // Trigger ShortJim spawns for a tougher "level 3" feel
    if (!this.shortJimSpawned && this.player.x > 4000) {
      this.shortJimSpawned = true;
      this.spawnShortJim(this.player.x - 300, this.player.y - 40);
    }
    if (!this.shortJimWaveSpawned && this.player.x > 12000) {
      this.shortJimWaveSpawned = true;
      this.spawnShortJim(this.player.x - 400, this.player.y - 40);
      this.spawnShortJim(this.player.x - 200, this.player.y - 60);
    }

    // Dynamic extra spawns after early section
    if (!this.enemySpawnFlags.after750 && this.player.x > 750) {
      this.enemySpawnFlags.after750 = true;
      const add = (x, y) => this.spawnEnemyHelper(x, y, x - 80, x + 80);
      add(900, 520);
      add(1250, 500);
      add(1550, 480);
      add(1850, 460);
      add(2150, 440);
    }

    // Level 2 extra density
    if (!this.enemySpawnFlags.level2Extras && (this.levelNumber || 1) >= 2) {
      this.enemySpawnFlags.level2Extras = true;
      const add = (x, y) => this.spawnEnemyHelper(x, y, x - 90, x + 90);
      [6200, 6600, 7000, 7400, 7800, 8200, 8600, 9000].forEach((x, idx) => {
        const y = 420 - idx * 8;
        add(x, y);
      });
    }

    // Level 3: more Short Jims
    if (!this.enemySpawnFlags.level3Jims1 && (this.levelNumber || 1) >= 3 && this.player.x > 6000) {
      this.enemySpawnFlags.level3Jims1 = true;
      this.spawnShortJim(this.player.x - 320, this.player.y - 40);
      this.spawnShortJim(this.player.x - 160, this.player.y - 60);
    }
    if (!this.enemySpawnFlags.level3Jims2 && (this.levelNumber || 1) >= 3 && this.player.x > 13000) {
      this.enemySpawnFlags.level3Jims2 = true;
      this.spawnShortJim(this.player.x - 480, this.player.y - 20);
      this.spawnShortJim(this.player.x - 320, this.player.y - 40);
      this.spawnShortJim(this.player.x - 160, this.player.y - 60);
    }
  }

  fireShortJimProjectile(enemy) {
    if (!this.player || !enemy.active) return;
    const arrow = this.enemyProjectiles.create(enemy.x, enemy.y - 20, "jim_arrow").setOrigin(0.5, 0.5);
    const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
    const speed = 180;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    arrow.body.setVelocity(vx, vy);
    arrow.setData("baseVy", vy);
    arrow.setData("osc", { phase: Math.random() * Math.PI * 2, amp: 60 });
    arrow.setDepth(850);
  }

  updateEnemyProjectiles() {
    const time = this.time.now;
    this.enemyProjectiles.children.each((proj) => {
      if (!proj.active || !proj.body) return;
      const data = proj.getData("osc");
      if (data) {
        const baseVy = proj.getData("baseVy") || proj.body.velocity.y;
        proj.body.setVelocityY(baseVy + Math.sin(time * 0.02 + data.phase) * data.amp);
      }
      if (
        proj.x < this.cameras.main.scrollX - 200 ||
        proj.x > this.cameras.main.scrollX + WIDTH + 200 ||
        proj.x > this.worldWidth + 100 ||
        proj.y > this.worldHeight + 200 ||
        proj.y < -200
      ) {
        proj.destroy();
      }
    });
  }

  updateMovingPlatforms(time) {
    this.movingPlatforms.children.each((platform) => {
      const data = platform.getData();
      if (!data || !data.speed) {
        return;
      }

      if (data.axis === "x") {
        const mid = (data.startX + data.endX) / 2;
        const amp = Math.abs(data.endX - data.startX) / 2;
        platform.x = mid + Math.sin(time * data.speed) * amp;
      } else {
        const mid = (data.startY + data.endY) / 2;
        const amp = Math.abs(data.endY - data.startY) / 2;
        platform.y = mid + Math.sin(time * data.speed) * amp;
      }

      platform.body.updateFromGameObject();
    });
  }

  updateBackground() {
    const camX = this.cameras.main.scrollX;
    if (this.bgImage) {
      this.bgImage.tilePositionX = camX * 0.1;
    }
  }

  addBtcHistory(amount) {
    this.btcHistory.push(amount);
    const maxPoints = 60;
    if (this.btcHistory.length > maxPoints) {
      this.btcHistory.shift();
    }
  }

  updateBtcChart() {
    if (!this.btcChartFill || !this.btcChartLine || !this.btcHistory) {
      return;
    }
    const originX = 16;
    const originY = 36;
    const baseY = originY + CHART_HEIGHT;
    const data = this.btcHistory;
    const maxVal = Math.max(...data, 1);
    const dx = data.length > 1 ? CHART_WIDTH / (data.length - 1) : CHART_WIDTH;
    const scaleY = maxVal > 0 ? CHART_HEIGHT / maxVal : 1;

    this.btcChartFill.clear();
    this.btcChartLine.clear();

    if (data.length < 2) {
      return;
    }

    this.btcChartFill.fillStyle(PRIMARY, 0.25);
    this.btcChartFill.beginPath();
    this.btcChartFill.moveTo(originX, baseY);
    data.forEach((val, idx) => {
      const x = originX + idx * dx;
      const y = baseY - val * scaleY;
      this.btcChartFill.lineTo(x, y);
    });
    this.btcChartFill.lineTo(originX + (data.length - 1) * dx, baseY);
    this.btcChartFill.closePath();
    this.btcChartFill.fillPath();

    this.btcChartLine.lineStyle(2, PRIMARY, 1);
    this.btcChartLine.beginPath();
    data.forEach((val, idx) => {
      const x = originX + idx * dx;
      const y = baseY - val * scaleY;
      if (idx === 0) {
        this.btcChartLine.moveTo(x, y);
      } else {
        this.btcChartLine.lineTo(x, y);
      }
    });
    this.btcChartLine.strokePath();
  }

  updateCameraLookahead() {
    const look = Phaser.Math.Clamp(this.player.body.velocity.x * 0.12, -80, 80);
    this.cameras.main.setFollowOffset(look, 40);
  }

  updateCoinTexts() {
    this.coinTextMap.forEach((texts, coin) => {
      if (!coin.active) {
        return;
      }
      texts.symbolText.setPosition(coin.x, coin.y);
      if (texts.valueText) {
        const isBig = coin.getData("isBig");
        const labelOffset = (isBig ? 26 : 20) * SCALE;
        texts.valueText.setPosition(coin.x, coin.y + labelOffset);
      }
    });
  }

  checkFall(time) {
    if (this.player.y > this.worldHeight + 80) {
      this.playerHit(time, true);
    }
  }

  breakFragilePlatform(plat) {
    if (plat.getData("breaking")) return;
    plat.setData("breaking", true);
    this.tweens.add({
      targets: plat,
      alpha: 0.2,
      duration: 120,
      yoyo: true,
      repeat: 0,
      onComplete: () => plat.destroy(),
    });
  }

  bouncePlayer() {
    // Bounce only when coming from above
    if (this.player.body.velocity.y >= 0) {
      const horizBoost = this.facing ? this.facing * 320 : 0;
      this.player.body.setVelocity(horizBoost, DOUBLE_JUMP_FORCE * 3);
      this.playTone(720, 0.06);
    }
  }

  playerHit(time = this.time.now, forced = false) {
    if (time < this.invulnerableUntil && !forced) {
      return;
    }

    this.lives -= 1;
    this.updateHud();
    this.playTone(180, 0.14);

    if (this.lives <= 0) {
      this.gameOver();
      return;
    }

    this.invulnerableUntil = time + 1500;
    this.player.body.setVelocity(0, 0);
    this.resetEnemies();
    this.player.setPosition(this.checkpointPos.x, this.checkpointPos.y);
  }

  defeatEnemy(enemy) {
    if (!enemy.active) {
      return;
    }

    const isShortJim = enemy.getData("type") === "shortjim";
    const shield = enemy.getData("shieldHP");
    if (shield && shield > 0) {
      enemy.setData("shieldHP", shield - 1);
      const flash = this.tweens.add({
        targets: enemy,
        alpha: 0.4,
        yoyo: true,
        repeat: 2,
        duration: 60,
        onComplete: () => enemy.setAlpha(1),
      });
      return;
    }

    this.stats.kills += 1;
    const label = this.enemyTextMap.get(enemy);
    if (label) {
      label.destroy();
      this.enemyTextMap.delete(enemy);
    }

    enemy.body.enable = false;
    enemy.setVelocity(0, 0);
    if (isShortJim) {
      const emitter = this.add.particles(enemy.x, enemy.y, "shortjim_blast", {
        speed: { min: 120, max: 200 },
        lifespan: 420,
        scale: { start: 0.7, end: 0 },
        gravityY: 140,
        quantity: 12,
        angle: { min: 0, max: 360 },
        blendMode: "ADD",
      });
      const fire = this.add.particles(enemy.x, enemy.y, "shortjim_fire", {
        speed: { min: 80, max: 140 },
        lifespan: 360,
        scale: { start: 0.6, end: 0 },
        gravityY: 200,
        quantity: 14,
        angle: { min: 0, max: 360 },
        blendMode: "ADD",
      });
      this.time.delayedCall(500, () => {
        emitter.destroy();
        fire.destroy();
      });
      enemy.destroy();
    } else {
      this.tweens.add({
        targets: enemy,
        scaleY: 0.2,
        alpha: 0,
        duration: 220,
        onComplete: () => enemy.destroy(),
      });
    }
    this.playTone(280, 0.08);
  }

  fireLaser() {
    const target = this.getClosestEnemy();
    const eyePositions = this.getEyePositions();
    let targetPoint = null;
    const cam = this.cameras.main;
    const margin = 24;
    const minX = cam.scrollX + margin;
    const maxX = cam.scrollX + cam.width - margin;

    if (target) {
      targetPoint = { x: target.x, y: target.y };
      const shield = target.getData("shieldHP");
      if (shield && shield > 0) {
        this.defeatEnemy(target); // will only chip shield
      } else {
        this.defeatEnemy(target);
      }
    } else {
      targetPoint = {
        x: this.player.x + this.facing * 700,
        y: this.player.y - 10,
      };
    }
    targetPoint.x = Phaser.Math.Clamp(targetPoint.x, minX, maxX);

    const beam = this.add.graphics().setDepth(900);
    beam.lineStyle(2, 0xfff3a0, 0.9);
    eyePositions.forEach((eye, index) => {
      const offsetY = index === 0 ? -2 : 2;
      beam.beginPath();
      beam.moveTo(eye.x, eye.y + offsetY);
      beam.lineTo(targetPoint.x, targetPoint.y + offsetY);
      beam.strokePath();
    });
    beam.fillStyle(0xffc77a, 0.9);
    beam.fillCircle(targetPoint.x, targetPoint.y, 4);

    this.tweens.add({
      targets: beam,
      alpha: 0,
      duration: 140,
      onComplete: () => beam.destroy(),
    });
    this.playTone(720, 0.06);
  }

  getClosestEnemy() {
    let closest = null;
    let closestDist = Infinity;

    this.enemies.children.each((enemy) => {
      if (!enemy.active) {
        return;
      }
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (dist < closestDist) {
        closestDist = dist;
        closest = enemy;
      }
    });

    if (closestDist > 900) {
      return null;
    }
    return closest;
  }

  getEyePositions() {
    const baseX = this.player.x;
    const baseY = this.player.y - this.player.displayHeight * 0.18;
    const offsets = [-6, 6];
    return offsets.map((offset) => ({
      x: baseX + offset * this.facing,
      y: baseY,
    }));
  }

  updateHud() {
    this.hudBtc.setText(`BTC: ${this.stats.btc}`);
    const hearts = "♥".repeat(Math.max(this.lives, 0));
    this.hudLives.setText(`${hearts}`);
    this.updateBtcChart();
  }

  fadeTutorial() {
    if (!this.tutorialText || this.tutorialFaded) {
      return;
    }
    this.tutorialFaded = true;
    this.tweens.add({
      targets: this.tutorialText,
      alpha: 0,
      duration: 900,
      delay: 400,
      onComplete: () => {
        this.tutorialText.destroy();
      },
    });
  }

  spawnFloatingText(x, y, text) {
    const label = this.add.text(x, y, text, {
      fontFamily: "Trebuchet MS",
      fontSize: "14px",
      color: "#fef8d8",
      stroke: "#0b0b14",
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.tweens.add({
      targets: label,
      y: y - 30,
      alpha: 0,
      duration: 900,
      ease: "Sine.easeOut",
      onComplete: () => label.destroy(),
    });
  }

  completeLevel(portalIdxParam) {
    if (this.portalCelebrating) return;
    this.portalCelebrating = true;
    this.player.body.setVelocity(0, 0);
    const portalIdx = portalIdxParam || this.currentPortalIndex || this.levelNumber || 1;

    // Lightning flashes across the world (top-to-bottom zigzag)
    const flashCount = 14;
    for (let i = 0; i < flashCount; i += 1) {
      this.time.delayedCall(i * 60, () => {
        const g = this.add.graphics().setDepth(1900);
        g.lineStyle(Phaser.Math.Between(3, 6), 0xfff17a, 1);
        const startX = Phaser.Math.Between(this.cameras.main.scrollX - 100, this.cameras.main.scrollX + WIDTH + 100);
        const segments = Phaser.Math.Between(5, 8);
        const stepY = HEIGHT / segments;
        const points = [];
        let cx = startX;
        let cy = 0;
        points.push({ x: cx, y: cy });
        for (let s = 0; s < segments; s += 1) {
          cx += Phaser.Math.Between(-120, 120);
          cy += stepY;
          points.push({ x: cx, y: cy });
        }
        points.push({ x: cx + Phaser.Math.Between(-80, 80), y: HEIGHT + 40 });

        g.beginPath();
        g.moveTo(points[0].x, points[0].y);
        for (let p = 1; p < points.length; p += 1) {
          g.lineTo(points[p].x, points[p].y);
        }
        g.strokePath();
        this.tweens.add({
          targets: g,
          alpha: 0,
          duration: 180,
          onComplete: () => g.destroy(),
        });
      });
    }

    // Big orange text
    const label = this.add.text(WIDTH / 2, HEIGHT / 2, `Level ${portalIdx} Complete!`, {
      fontFamily: "Trebuchet MS",
      fontSize: "36px",
      color: "#fa660f",
      stroke: "#0b0b14",
      strokeThickness: 6,
    }).setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1950);

    this.tweens.add({
      targets: label,
      scale: 1.1,
      yoyo: true,
      duration: 320,
      repeat: 1,
    });

    this.tweens.add({
      targets: label,
      alpha: 0,
      delay: 900,
      duration: 400,
      onComplete: () => {
        label.destroy();
        this.portalCelebrating = false;
        if (portalIdx >= 3) {
          if (this.bgmAudio) {
            this.bgmAudio.pause();
          }
          this.showSupportOverlay();
        } else {
          this.levelNumber = portalIdx + 1;
        }
      },
    });
  }

  showSupportOverlay() {
    this.levelComplete = true;
    this.physics.pause();
    const overlay = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x05070d, 0.9)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(2100);
    if (this.bgm && this.bgm.stop) {
      this.bgm.stop();
    }

    this.add.text(WIDTH / 2, HEIGHT / 2 - 60, "Support the Game", {
      fontFamily: "Trebuchet MS",
      fontSize: "28px",
      color: "#fa660f",
      stroke: "#0b0b14",
      strokeThickness: 5,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2101);

    this.add.text(WIDTH / 2, HEIGHT / 2 - 24, "Scan to support more worlds", {
      fontFamily: "Trebuchet MS",
      fontSize: "16px",
      color: "#e8f6ff",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2101);

    // Rounded backdrop for QR
    const qrY = HEIGHT / 2 + 70;
    const qrSize = 120;
    const qrPad = 10;
    const g = this.add.graphics({ x: WIDTH / 2 - qrSize / 2 - qrPad, y: qrY - qrSize / 2 - qrPad }).setDepth(2101);
    g.fillStyle(0x0f1424, 1);
    g.lineStyle(2, 0xfa660f, 0.35);
    g.fillRoundedRect(0, 0, qrSize + qrPad * 2, qrSize + qrPad * 2, 14);
    g.strokeRoundedRect(0, 0, qrSize + qrPad * 2, qrSize + qrPad * 2, 14);

    this.add.image(WIDTH / 2, qrY, "qr_cta")
      .setScrollFactor(0)
      .setDepth(2102)
      .setDisplaySize(qrSize, qrSize);

    this.add.text(WIDTH / 2, qrY + qrSize / 2 + 18, "Bitcoin address", {
      fontFamily: "Trebuchet MS",
      fontSize: "14px",
      color: "#e8f6ff",
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2102);

    // Replace tip text with replay prompt
    if (this.tipText && this.tipText.destroy) {
      this.tipText.destroy();
    }
    this.tipText = this.add.text(WIDTH / 2, 18, "Press Enter to replay", {
      fontFamily: "Trebuchet MS",
      fontSize: "16px",
      color: "#fa660f",
      backgroundColor: "rgba(8,12,20,0.65)",
      padding: { x: 10, y: 4 },
    }).setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(2103);

    const restart = () => window.location.reload();
    this.input.keyboard.once("keydown-ENTER", restart);
    overlay.setInteractive().once("pointerdown", restart);
  }

  startIntro() {
    // Lightning flashes on start
    const flashCount = 10;
    for (let i = 0; i < flashCount; i += 1) {
      this.time.delayedCall(i * 70, () => {
        const g = this.add.graphics().setDepth(1900);
        g.lineStyle(Phaser.Math.Between(3, 6), 0xfff17a, 1);
        const startX = Phaser.Math.Between(-100, WIDTH + 100);
        const segments = Phaser.Math.Between(5, 8);
        const stepY = HEIGHT / segments;
        const points = [];
        let cx = startX;
        let cy = 0;
        points.push({ x: cx, y: cy });
        for (let s = 0; s < segments; s += 1) {
          cx += Phaser.Math.Between(-120, 120);
          cy += stepY;
          points.push({ x: cx, y: cy });
        }
        points.push({ x: cx + Phaser.Math.Between(-80, 80), y: HEIGHT + 40 });
        g.beginPath();
        g.moveTo(points[0].x, points[0].y);
        for (let p = 1; p < points.length; p += 1) {
          g.lineTo(points[p].x, points[p].y);
        }
        g.strokePath();
        this.tweens.add({
          targets: g,
          alpha: 0,
          duration: 180,
          onComplete: () => g.destroy(),
        });
      });
    }

    // Intro text
    const intro = this.add.text(WIDTH / 2, HEIGHT / 2, "21MillionRace!", {
      fontFamily: "Trebuchet MS",
      fontSize: "36px",
      color: "#fa660f",
      stroke: "#0b0b14",
      strokeThickness: 6,
    }).setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1950);

    this.tweens.add({
      targets: intro,
      alpha: 0,
      delay: 1000,
      duration: 600,
      onComplete: () => intro.destroy(),
    });
  }

  gameOver() {
    this.levelComplete = true;
    this.player.body.setVelocity(0, 0);
    this.physics.pause();
    this.restarting = false;

    const overlay = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x05070d, 0.85)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(2000)
      .setInteractive({ useHandCursor: true });

    this.add.text(WIDTH / 2, HEIGHT / 2 - 20, "GAME OVER", {
      fontFamily: "Trebuchet MS",
      fontSize: "36px",
      color: "#fa660f",
      align: "center",
      lineSpacing: 8,
    }).setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2001);

    // Auto-restart and allow input to trigger restart
    const doRestart = () => {
      if (this.restarting) return;
      this.restarting = true;
      // Hard reload to guarantee a fresh state
      window.location.reload();
    };
    this.time.addEvent({ delay: 1200, callback: doRestart, callbackScope: this, loop: false, paused: false });
    this.input.keyboard.once("keydown", doRestart);
    overlay.once("pointerdown", doRestart);
    // Fallback tap/click anywhere
    this.input.once("pointerdown", doRestart);
  }

  checkDesktopOnly() {
    // No-op: mobile is allowed; scaling handled separately.
  }

  playTone(freq, duration) {
    if (!window.AudioContext && !window.webkitAudioContext) {
      return;
    }

    const context = this.audioContext || new (window.AudioContext || window.webkitAudioContext)();
    this.audioContext = context;

    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.frequency.value = freq;
    osc.type = "square";

    gain.gain.value = 0.12;
    osc.connect(gain);
    gain.connect(context.destination);

    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    osc.stop(context.currentTime + duration);
  }
}

const config = {
  type: Phaser.AUTO,
  width: WIDTH,
  height: HEIGHT,
  parent: "game",
  scale: {
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 1200 },
      debug: false,
    },
  },
  scene: [GameScene],
};

new Phaser.Game(config);
      // Ensure we still have travel distance
      if (adjusted.axis === "x" && Math.abs(adjusted.endX - adjusted.startX) < 10) {
        adjusted.startX = m.x - 60;
        adjusted.endX = m.x + 60;
      }
      if (adjusted.axis === "y" && Math.abs(adjusted.endY - adjusted.startY) < 10) {
        adjusted.startY = (m.data?.startY ?? m.y) - 60;
        adjusted.endY = (m.data?.endY ?? m.y) + 60;
      }
