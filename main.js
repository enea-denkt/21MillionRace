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
const CHART_WIDTH = 240;
const CHART_HEIGHT = 80;
const BG_SCALE = 0.7;
const JUMP_FORCE = -460;
const DOUBLE_JUMP_FORCE = -620;
const COIN_Y_LIFT = -40;
const WORLD_END_X = 13600;

class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
    this.worldWidth = WORLD_END_X;
    this.worldHeight = 720;
  }

  preload() {
    this.load.image("saylor", "assets/Saylor.png");
    this.load.image("bg_manhattan", "assets/background-digital-manhattan.png");
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

    this.platforms = this.physics.add.staticGroup();
    this.movingPlatforms = this.physics.add.group({
      allowGravity: false,
      immovable: true,
    });

    this.createLevel();
    this.createCollectibles();
    this.createEnemies();
    this.createPlayer();
    this.createCheckpoint();
    this.createPortal();
    this.createHUD();
    this.createTutorial();
    this.setupInput();
    this.setupColliders();
    this.portalCelebrating = false;
    this.startIntro();

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
    this.bgImage = this.add.tileSprite(0, 0, WIDTH, HEIGHT, "bg_manhattan")
      .setOrigin(0, 0)
      .setScrollFactor(0, 0)
      .setDisplaySize(WIDTH, HEIGHT)
      .setTileScale(BG_SCALE, BG_SCALE);
    this.bgTint = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x0b0b14, 0.18)
      .setOrigin(0, 0)
      .setScrollFactor(0, 0);
    this.scanlineOverlay = this.add.tileSprite(0, 0, WIDTH, HEIGHT, "scanlines")
      .setOrigin(0, 0)
      .setScrollFactor(0, 0)
      .setAlpha(0.18)
      .setDepth(1000);
  }

  createLevel() {
    const groundY = 520;

    const addGround = (x, width) => {
      const platform = this.platforms.create(x, groundY, "platform");
      platform.setDisplaySize(width, 36);
      platform.refreshBody();
    };

    const addPlatform = (x, y, width, texture = "platform") => {
      const platform = this.platforms.create(x, y, texture);
      platform.setDisplaySize(width, texture === "cable" ? 10 : 24);
      platform.refreshBody();
      return platform;
    };

    const grounds = [
      [250, 500], [900, 450], [1500, 420], [2300, 420], [3200, 420], [3900, 420],
      [4550, 400], [5200, 380],
      [6000, 420], [6800, 420], [7600, 420], [8200, 420], [9000, 420],
      [9800, 420], [10400, 420], [11200, 420], [12000, 420], [12600, 400], [13200, 380],
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
      [7000, 410, 150], [7200, 380, 150],
      [7800, 400, 150],
      [8400, 380, 150],
      [9100, 360, 150],
      // Act III
      [10000, 400, 150], [10180, 360, 150],
      [10600, 380, 150], [10850, 360, 150],
      [11400, 380, 150],
      [12150, 360, 150],
      [12800, 340, 150],
      [13350, 320, 140],
    ];
    platforms.forEach(([x, y, w, t]) => addPlatform(x, y, w, t));

    const movers = [
      { x: 2700, y: 380, w: 140, h: 20, data: { startX: 2580, endX: 2820, speed: 0.0012, axis: "x" } },
      { x: 3400, y: 360, w: 140, h: 20, data: { startX: 3280, endX: 3520, speed: 0.0014, axis: "x" } },
      { x: 4760, y: 340, w: 130, h: 20, data: { startY: 320, endY: 420, speed: 0.0011, axis: "y" } },
      { x: 5400, y: 340, w: 130, h: 20, data: { startX: 5280, endX: 5520, speed: 0.0015, axis: "x" } },
      { x: 7600, y: 400, w: 140, h: 20, data: { startX: 7480, endX: 7720, speed: 0.0014, axis: "x" } },
      { x: 8200, y: 360, w: 140, h: 20, data: { startY: 340, endY: 440, speed: 0.0012, axis: "y" } },
      { x: 8800, y: 360, w: 150, h: 20, data: { startX: 8680, endX: 8920, speed: 0.0015, axis: "x" } },
      { x: 10250, y: 360, w: 140, h: 20, data: { startY: 340, endY: 430, speed: 0.0013, axis: "y" } },
      { x: 11000, y: 340, w: 140, h: 20, data: { startX: 10860, endX: 11140, speed: 0.0016, axis: "x" } },
      { x: 11800, y: 340, w: 140, h: 20, data: { startY: 320, endY: 420, speed: 0.0013, axis: "y" } },
      { x: 12500, y: 340, w: 140, h: 20, data: { startX: 12360, endX: 12640, speed: 0.0016, axis: "x" } },
      { x: 13150, y: 320, w: 130, h: 20, data: { startX: 13050, endX: 13250, speed: 0.0018, axis: "x" } },
    ];
    movers.forEach((m) => {
      const p = this.movingPlatforms.create(m.x, m.y, "platform");
      p.setDisplaySize(m.w, m.h);
      p.setData(m.data);
    });
  }

  createCollectibles() {
    this.coins = this.physics.add.group({
      allowGravity: false,
      immovable: true,
    });

    this.coinTextMap = new Map();

    const randomCoinValue = (isBig) => {
      const pool = isBig ? COIN_VALUES.filter((v) => v >= 500) : COIN_VALUES.filter((v) => v < 500);
      return Phaser.Utils.Array.GetRandom(pool.length ? pool : COIN_VALUES);
    };

    const makeCoin = (x, y, isBig) => {
      const value = randomCoinValue(isBig);
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

      const valueText = this.add.text(x, y + 18 * SCALE, String(value), {
        fontFamily: "Trebuchet MS",
        fontSize: `${10 * SCALE}px`,
        color: "#fffbdd",
        align: "center",
      }).setOrigin(0.5);

      this.coinTextMap.set(coin, { symbolText, valueText });
      return coin;
    };

    // Onboarding rewards
    makeCoin(200, 480, false);
    makeCoin(500, 430, false);
    makeCoin(720, 420, false);

    // First enemy section
    makeCoin(980, 470, false);
    makeCoin(1220, 420, false);

    // Rhythm steps
    makeCoin(1500, 400, false);
    makeCoin(1700, 360, false);
    makeCoin(1880, 320, false);
    makeCoin(2060, 300, true);

    // Moving platforms mid
    makeCoin(2500, 360, false);
    makeCoin(2700, 340, true);
    makeCoin(2900, 330, false);

    // Moving + gaps
    makeCoin(3200, 390, false);
    makeCoin(3400, 330, false);
    makeCoin(3600, 300, true);

    // Pre-checkpoint
    makeCoin(3900, 390, false);
    makeCoin(4100, 350, false);
    makeCoin(4320, 350, false);

    // Post-checkpoint pressure
    makeCoin(4550, 370, false);
    makeCoin(4760, 310, true);
    makeCoin(4950, 300, false);

    // Final push
    makeCoin(5200, 350, false);
    makeCoin(5400, 320, true);
    makeCoin(5600, 300, false);
    makeCoin(5800, 280, true);
  }

  createEnemies() {
    this.enemies = this.physics.add.group();
    this.enemyTextMap = new Map();

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
      enemy.setData("speed", 40);
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

    spawnEnemy(760, 520, 640, 860);
    spawnEnemy(1500, 420, 1400, 1620);
    spawnEnemy(1860, 420, 1760, 1940);
    spawnEnemy(2300, 420, 2200, 2420);
    spawnEnemy(3200, 420, 3120, 3320);
    spawnEnemy(3400, 420, 3280, 3520);
    spawnEnemy(4550, 400, 4460, 4660);
    spawnEnemy(4760, 400, 4680, 4840);
    spawnEnemy(5200, 380, 5120, 5320);
  }

  createPlayer() {
    const textureKey = this.textures.exists("saylor_clean") ? "saylor_clean" : "saylor";
    this.player = this.physics.add.sprite(120, PLAYER_Y_BASE + PLAYER_Y_OFFSET, textureKey).setOrigin(0.5, 0.5);
    this.player.setDisplaySize(PLAYER_BASE_W * SCALE, PLAYER_BASE_H * SCALE);
    this.player.body.setSize(this.player.displayWidth * 0.6, this.player.displayHeight * 0.8);
    this.player.body.setOffset(
      (this.player.displayWidth - this.player.body.width) / 2,
      this.player.displayHeight - this.player.body.height
    );
    this.player.body.updateFromGameObject();
    this.player.body.setCollideWorldBounds(true);
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

  createPortal() {
    this.portal = this.physics.add.staticImage(5820, 420, "portal");
    this.portal.setDisplaySize(44 * SCALE, 70 * SCALE);
    this.add.text(5820, 370, "HODL", {
      fontFamily: "Trebuchet MS",
      fontSize: "18px",
      color: "#fa660f",
      stroke: "#0b0b14",
      strokeThickness: 3,
    }).setOrigin(0.5);
  }

  createHUD() {
    this.hudBtc = this.add.text(16, 12, "BTC: 0", {
      fontFamily: "Trebuchet MS",
      fontSize: "18px",
      color: "#fa660f",
    }).setScrollFactor(0);

    this.hudLives = this.add.text(WIDTH - 16, 12, "♥♥♥  1-1", {
      fontFamily: "Trebuchet MS",
      fontSize: "18px",
      color: "#fa660f",
      align: "right",
    }).setOrigin(1, 0).setScrollFactor(0);

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
    this.physics.add.collider(this.enemies, this.platforms);
    this.physics.add.collider(this.enemies, this.movingPlatforms);
    this.physics.world.on("worldbounds", (body, up, down) => {
      if (body.gameObject === this.player && down) {
        this.playerHit(undefined, true);
      }
    });

    this.physics.add.overlap(this.player, this.coins, (player, coin) => {
      const value = coin.getData("value") || 1;
      this.stats.btc += value;
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

    this.physics.add.overlap(this.player, this.portal, () => {
      if (!this.portalCelebrating) {
        this.completeLevel();
      }
    });

  }

  update(time) {
    if (this.levelComplete) {
      return;
    }

    this.updatePlayer(time);
    this.updateEnemies(time);
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

      const leftBound = enemy.getData("leftBound");
      const rightBound = enemy.getData("rightBound");
      const speed = enemy.getData("speed");
      const chaseRange = enemy.getData("chaseRange");
      const chaseEnabled = enemy.getData("chaseEnabled");
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

      if (enemy.body.velocity.x !== 0) {
        enemy.scaleX = Math.sign(enemy.body.velocity.x);
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
        texts.valueText.setPosition(coin.x, coin.y + 18 * SCALE);
      }
    });
  }

  checkFall(time) {
    if (this.player.y > this.worldHeight + 80) {
      this.playerHit(time, true);
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
    this.player.setPosition(this.checkpointPos.x, this.checkpointPos.y);
  }

  defeatEnemy(enemy) {
    if (!enemy.active) {
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
    this.tweens.add({
      targets: enemy,
      scaleY: 0.2,
      alpha: 0,
      duration: 220,
      onComplete: () => enemy.destroy(),
    });
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
      this.defeatEnemy(target);
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
    this.hudLives.setText(`${hearts}  1-1`);
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

  completeLevel() {
    if (this.portalCelebrating) return;
    this.portalCelebrating = true;
    this.player.body.setVelocity(0, 0);

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
    const label = this.add.text(WIDTH / 2, HEIGHT / 2, "Level 1 Complete!", {
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
      },
    });
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

    const overlay = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x05070d, 0.85)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(2000);

    this.add.text(WIDTH / 2, HEIGHT / 2 - 20, "Out of Lives!\nPress R to Retry", {
      fontFamily: "Trebuchet MS",
      fontSize: "22px",
      color: "#ffe0e0",
      align: "center",
      lineSpacing: 8,
    }).setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2001);

    this.input.keyboard.once("keydown-R", () => {
      this.scene.restart();
    });
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
