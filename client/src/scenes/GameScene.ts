import Phaser from 'phaser';
import * as Colyseus from 'colyseus.js';

interface Player {
  x: number;
  y: number;
  rotation: number;
  health: number;
  weapon: string;
  isAlive: boolean;
  onChange: (callback: () => void) => void;
}

interface Weapon {
  x: number;
  y: number;
  type: string;
  damage: number;
  fireRate: number;
}

interface Bullet {
  x: number;
  y: number;
  rotation: number;
  ownerId: string;
  damage: number;
  speed: number;
  onChange: (callback: () => void) => void;
}

export class GameScene extends Phaser.Scene {
  // Client Colyseus
  private client!: Colyseus.Client;
  private room!: Colyseus.Room;

  // Map et collisions
  private map!: Phaser.Tilemaps.Tilemap;
  private tileset!: Phaser.Tilemaps.Tileset;
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private collisionLayer!: Phaser.Tilemaps.TilemapLayer;

  // Joueurs
  private currentPlayer!: Phaser.Physics.Arcade.Sprite;
  private players: Map<string, Phaser.Physics.Arcade.Sprite> = new Map();

  // Armes
  private weapons: Map<string, Phaser.Physics.Arcade.Sprite> = new Map();

  // Balles
  private bullets: Map<string, Phaser.Physics.Arcade.Sprite> = new Map();

  // Zone sûre
  private safeZone!: Phaser.GameObjects.Graphics;

  // Zone sûre pour la minimap
  private minimapSafeZone!: Phaser.GameObjects.Graphics;

  // Contrôles
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyR!: Phaser.Input.Keyboard.Key;

  // Interface utilisateur
  private healthBar!: Phaser.GameObjects.Graphics;
  private healthText!: Phaser.GameObjects.Text;
  private playersAliveText!: Phaser.GameObjects.Text;
  private weaponText!: Phaser.GameObjects.Text;
  private ammoText!: Phaser.GameObjects.Text;
  private reloadingText!: Phaser.GameObjects.Text;
  private zoneTimerText!: Phaser.GameObjects.Text;
  private nextShrinkTime: number = 30;
  private zoneTimerEvent: Phaser.Time.TimerEvent | null = null;

  // Caméra
  private minimap!: Phaser.Cameras.Scene2D.Camera;

  // Ajout d'un indicateur pour le joueur sur la minimap
  private playerIndicator!: Phaser.GameObjects.Graphics;
  private minimapPlayers!: Phaser.GameObjects.Graphics;
  private minimapBorder!: Phaser.GameObjects.Graphics;

  // Ajout d'une propriété pour le fond des munitions
  private ammoBackground!: Phaser.GameObjects.Graphics;

  // Propriétés pour gérer les munitions
  private currentAmmo: number = 0;
  private maxAmmo: number = 0;
  private magazineCount: number = 0;
  private currentWeapon: string = '';

  // Ajout d'une propriété pour stocker la couche de détails
  private detailsLayer!: Phaser.Tilemaps.TilemapLayer;

  // Propriété pour suivre le temps écoulé depuis le dernier tir
  private lastFireTime: number = 0;

  // Variable pour suivre si un tir est en cours
  private isShooting: boolean = false;

  // Add new properties for display layers
  private gameLayer!: Phaser.GameObjects.Container;
  private uiLayer!: Phaser.GameObjects.Container;
  private notificationLayer!: Phaser.GameObjects.Container;

  // Propriétés pour la prise en charge des manettes
  private gamepad: Phaser.Input.Gamepad.Gamepad | null = null;
  private gamepadsEnabled: boolean = false;
  private lastRightTriggerValue: number = 0;
  private joystickDeadZone: number = 0.2;
  private gamepadInfoText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super({ key: 'GameScene' });
  }

  init() {
    // Configuration de l'URL du serveur en fonction de l'environnement
    const serverUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? `ws://${window.location.hostname}:2567` // URL locale pour le développement
      : "wss://battle-royale-io-backend.onrender.com"; // URL de production sur Render

    // Initialisation du client Colyseus
    this.client = new Colyseus.Client(serverUrl);
    console.log(`GameScene: Connexion au serveur: ${serverUrl}`);
  }

  async create() {
    // Connexion à la salle de jeu
    try {
      this.room = await this.client.joinOrCreate('battle_royale');
      this.setupRoom();
    } catch (error) {
      console.error('Erreur de connexion à la salle:', error);
      this.add.text(400, 300, 'Erreur de connexion au serveur', {
        fontFamily: 'Arial',
        fontSize: '24px',
        color: '#ffffff'
      }).setOrigin(0.5);
      return;
    }

    // Créer des couches pour organiser les objets du jeu et l'interface utilisateur
    // Nous utilisons ces conteneurs uniquement pour gérer ce qui est ignoré par la minimap
    // mais les sprites physiques restent dans la scène principale
    this.gameLayer = this.add.container(0, 0);
    this.uiLayer = this.add.container(0, 0);
    this.notificationLayer = this.add.container(0, 0);
    
    // Les conteneurs ne sont pas affectés par le défilement de la caméra par défaut, 
    // donc nous définissons scrollFactor seulement pour la couche UI
    this.uiLayer.setScrollFactor(0);
    this.notificationLayer.setScrollFactor(0);
    
    // Définir des profondeurs appropriées pour chaque couche
    this.gameLayer.setDepth(10); // Objets de jeu
    this.uiLayer.setDepth(100);  // Interface utilisateur
    this.notificationLayer.setDepth(200); // Notifications et messages temporaires

    // Initialisation de la zone sûre pour la minimap
    this.minimapSafeZone = this.add.graphics();
    
    // Chargement de la map depuis les fichiers Tiled
    this.map = this.make.tilemap({ key: 'map' });
    const tileset = this.map.addTilesetImage('tilesheet_complete', 'tilesheet');

    if (!tileset) {
      console.error('Failed to load tileset');
      // Fallback: utiliser l'image de la map directement
      this.add.image(0, 0, 'mapImage').setOrigin(0, 0);
      return;
    }

    this.tileset = tileset;

    // Création des couches de la map
    // Nous utilisons la première couche comme fond
    const groundLayer = this.map.createLayer('Ground', this.tileset, 0, 0);
    
    if (!groundLayer) {
      console.error('Failed to create ground layer');
      return;
    }
    
    this.groundLayer = groundLayer;
    this.groundLayer.setDepth(10); // Profondeur de base pour le sol
    
    // Création de la couche d'objets
    const objectsLayer = this.map.createLayer('Objects', this.tileset, 0, 0);
    if (objectsLayer) {
      objectsLayer.setDepth(20); // Au-dessus du sol
      this.collisionLayer = objectsLayer;
    }
    
    // Création de la couche de détails
    const detailsLayer = this.map.createLayer('Details', this.tileset, 0, 0);
    if (detailsLayer) {
      detailsLayer.setDepth(30); // Au-dessus des objets
      this.detailsLayer = detailsLayer;
    }
    
    // Configuration des collisions pour toutes les couches
    // Utiliser une approche plus ciblée pour les collisions
    // Activer les collisions uniquement pour les tuiles qui ont la propriété collides
    this.groundLayer.setCollisionByProperty({ collides: true });
    
    if (this.collisionLayer) {
      this.collisionLayer.setCollisionByProperty({ collides: true });
    }
    
    if (this.detailsLayer) {
      this.detailsLayer.setCollisionByProperty({ collides: true });
    }
    
    // Ajuster la profondeur des éléments
    // Le joueur doit être au-dessus des éléments du décor
    if (this.currentPlayer) {
      this.currentPlayer.setDepth(40); // Mettre le joueur au-dessus de tout
    }
    
    // Configurer les limites du monde physique en fonction de la taille de la carte
    this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);

    // Débogage des collisions - Afficher les zones de collision
    // Décommenter ces lignes pour voir les zones de collision
    /*
    const debugGraphics = this.add.graphics().setAlpha(0.7);
    this.groundLayer.renderDebug(debugGraphics, {
      tileColor: null, // Couleur des tuiles non-collidables
      collidingTileColor: new Phaser.Display.Color(243, 134, 48, 255), // Couleur des tuiles collidables (orange)
      faceColor: new Phaser.Display.Color(40, 39, 37, 255) // Couleur des faces de collision
    });
    if (this.collisionLayer) {
      this.collisionLayer.renderDebug(debugGraphics, {
        tileColor: null,
        collidingTileColor: new Phaser.Display.Color(243, 134, 48, 255),
        faceColor: new Phaser.Display.Color(40, 39, 37, 255)
      });
    }
    
    // Activer le débogage des corps physiques
    this.physics.world.createDebugGraphic();
    */

    // Vérifier les propriétés de collision des tuiles
    this.checkTileCollisionProperties();

    // Création des animations pour les personnages
    this.createAnimations();

    // Configuration de la caméra principale
    this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
    this.cameras.main.setZoom(1);

    // S'assurer que la caméra couvre tout l'écran
    const updateCameraSize = () => {
      // Utiliser toute la largeur et hauteur disponibles
      this.cameras.main.setSize(this.scale.width, this.scale.height);

      // Centrer la caméra sur la carte
      this.cameras.main.centerOn(1000, 1000);
    };

    // Appliquer immédiatement et à chaque redimensionnement
    updateCameraSize();
    this.scale.on('resize', updateCameraSize);

    // Création de la zone sûre
    this.safeZone = this.add.graphics();
    const mapCenterX = this.map.widthInPixels / 2;
    const mapCenterY = this.map.heightInPixels / 2;
    // Ne pas limiter la zone par la taille de la carte
    const initialRadius = 5000; // Rayon initial beaucoup plus grand que la carte
    this.updateSafeZone(mapCenterX, mapCenterY, initialRadius);

    // Configuration de l'interface utilisateur
    this.createUI();

    // Création de la minimap (après l'UI pour pouvoir ignorer les éléments d'UI)
    const minimapSize = Math.min(this.cameras.main.width, this.cameras.main.height) * 0.30; // Augmentation de la taille à 30%
    const minimapPadding = 16;
    const borderWidth = 5; // Bordure plus épaisse pour être bien visible

    // Créer d'abord un rectangle container pour la bordure (qui sera visible sous la minimap)
    // Ce rectangle agira comme un fond avec bordure pour la minimap
    const minimapContainer = this.add.graphics();
    minimapContainer.setScrollFactor(0);
    
    // Dessiner un fond noir semi-transparent pour tout le conteneur 
    minimapContainer.fillStyle(0x000000, 0.6);
    minimapContainer.fillRect(
        minimapPadding - borderWidth, 
        minimapPadding - borderWidth, 
        minimapSize + (borderWidth * 2), 
        minimapSize + (borderWidth * 2)
    );
    
    // Ajouter une bordure blanche brillante
    minimapContainer.lineStyle(2, 0xffffff, 0.8);
    minimapContainer.strokeRect(
        minimapPadding - borderWidth + 1, 
        minimapPadding - borderWidth + 1, 
        minimapSize + (borderWidth * 2) - 2, 
        minimapSize + (borderWidth * 2) - 2
    );
    
    // Cette bordure est visible dans l'interface mais ne fait pas partie de la minimap
    this.minimapBorder = minimapContainer;
    this.minimapBorder.setDepth(90); // Sous la minimap
    this.uiLayer.add(this.minimapBorder);
    
    // Créer ensuite la minimap elle-même
    this.minimap = this.cameras.add(minimapPadding, minimapPadding, minimapSize, minimapSize);
    this.minimap.setZoom(0.3);
    this.minimap.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
    this.minimap.setBackgroundColor(0x002244);
    this.minimap.setName('minimap');
    this.minimap.setRoundPixels(true);

    // Ignorer tous les éléments d'UI - maintenant on ignore les couches entières
    this.minimap.ignore(this.uiLayer);
    this.minimap.ignore(this.notificationLayer);

    // Ajout d'un indicateur pour le joueur sur la minimap
    this.playerIndicator = this.add.graphics();
    this.playerIndicator.fillStyle(0xff0000, 1);
    this.playerIndicator.fillCircle(0, 0, 5);

    // Ajout d'un graphique pour les autres joueurs sur la minimap
    this.minimapPlayers = this.add.graphics();

    // Initialisation du timer de la zone
    this.updateZoneTimer();

    // Création d'un événement pour mettre à jour le timer localement
    this.zoneTimerEvent = this.time.addEvent({
      delay: 1000,
      callback: this.updateLocalTimer,
      callbackScope: this,
      loop: true
    });

    // Configurer les contrôles
    if (this.input && this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
      this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
      this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
      this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
      this.keyR = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    }

    // Initialiser le support des manettes
    if (this.input && this.input.gamepad) {
      // Activer le système de manettes
      this.input.gamepad.on('connected', (pad: Phaser.Input.Gamepad.Gamepad) => {
        console.log('Manette connectée:', pad.id);
        this.gamepad = pad;
        this.gamepadsEnabled = true;
        
        // Afficher les informations sur les contrôles de la manette
        this.showGamepadInfo(pad.id);
      });
      
      this.input.gamepad.on('disconnected', (pad: Phaser.Input.Gamepad.Gamepad) => {
        console.log('Manette déconnectée:', pad.id);
        if (this.gamepad === pad) {
          this.gamepad = null;
        }
        
        // Vérifier si d'autres manettes sont connectées
        if (this.input?.gamepad?.gamepads.length === 0) {
          this.gamepadsEnabled = false;
          
          // Cacher les informations sur les contrôles de la manette
          this.hideGamepadInfo();
        }
      });
      
      // Vérifier si une manette est déjà connectée
      if (this.input.gamepad.gamepads.length > 0) {
        this.gamepad = this.input.gamepad.gamepads[0];
        this.gamepadsEnabled = true;
        console.log('Manette déjà connectée:', this.gamepad.id);
        
        // Afficher les informations sur les contrôles de la manette
        this.showGamepadInfo(this.gamepad.id);
      }
    }

    // Variable pour suivre si un tir est en cours
    this.isShooting = false;

    // Ajouter un gestionnaire de clic avec protection contre le spam
    if (this.input) {
      this.input.on('pointerdown', () => {
        // Mettre à jour la rotation du joueur même sans arme
        this.updatePlayerRotation();
        
        // Vérifier si un tir est déjà en cours ou si le délai entre les tirs n'est pas écoulé
        const currentTime = this.time.now;
        const fireRate = this.currentWeapon ? this.getFireRateForWeapon(this.currentWeapon) : 0;
        
        if (!this.isShooting && (currentTime - this.lastFireTime >= fireRate)) {
          this.isShooting = true;
          this.handleShootingOnClick();
          
          // Réinitialiser le flag après un délai plus long pour éviter les problèmes de spam
          this.time.delayedCall(100, () => {
            this.isShooting = false;
          });
        } else {
          console.log("Tir ignoré - déjà en train de tirer ou délai non écoulé");
        }
      });
    }

    // Ajouter un gestionnaire pour la touche R (rechargement)
    this.input?.keyboard?.on('keydown-R', () => {
      if (this.currentWeapon && this.currentWeapon !== '' && this.currentAmmo < this.maxAmmo) {
        this.reloadWeapon();
      }
    });
  }

  update() {
    // Vérifier si le joueur est connecté
    if (!this.currentPlayer || !this.room) return;

    // Gérer les contrôles du joueur
    this.handlePlayerControls();

    // Support de la gâchette droite (R2) pour tirer
    if (this.gamepadsEnabled && this.gamepad) {
      // Mettre à jour la rotation du joueur avec le joystick droit en temps réel
      this.updatePlayerRotation();

      // Vérifier la pression sur la gâchette droite (R2/RT)
      const rightTriggerValue = this.gamepad.buttons[7].value; // R2 sur PlayStation, RT sur Xbox

      // Vérifier si la gâchette est suffisamment pressée et n'était pas pressée avant
      if (rightTriggerValue > 0.5 && this.lastRightTriggerValue <= 0.5) {
        // Vérifier le délai entre les tirs
        const currentTime = this.time.now;
        const fireRate = this.currentWeapon ? this.getFireRateForWeapon(this.currentWeapon) : 0;
        
        if (!this.isShooting && (currentTime - this.lastFireTime >= fireRate)) {
          this.isShooting = true;
          this.handleShootingOnClick();
          
          // Réinitialiser le flag après un délai pour éviter les problèmes de spam
          this.time.delayedCall(100, () => {
            this.isShooting = false;
          });
        }
      }

      // Mettre à jour la valeur de la dernière pression
      this.lastRightTriggerValue = rightTriggerValue;
    }

    // Mettre à jour la position des joueurs sur la minimap
    this.drawPlayersOnMinimap();

    // Vérifier les collisions avec les murs invisibles
    this.checkForInvisibleWalls();

    // Vérifier les propriétés de collision des tuiles
    this.checkTileCollisionProperties();

    // Mettre à jour le timer local
    // this.updateLocalTimer();

    // Envoyer la position du joueur au serveur
    this.room.send('move', {
      x: this.currentPlayer.x,
      y: this.currentPlayer.y
    });

    // Mise à jour de la minimap pour qu'elle suive le joueur
    if (this.minimap) {
      this.minimap.centerOn(this.currentPlayer.x, this.currentPlayer.y);
    }

    // Mettre à jour la minimap avec la position du joueur
    if (this.playerIndicator && this.minimapPlayers) {
      // Effacer les graphiques précédents
      this.playerIndicator.clear();
      this.minimapPlayers.clear();

      // Dessiner le joueur actuel sur la minimap
      this.playerIndicator.fillStyle(0xff0000, 1);
      this.playerIndicator.fillCircle(this.currentPlayer.x, this.currentPlayer.y, 5);

      // Dessiner les autres joueurs sur la minimap
      this.minimapPlayers.fillStyle(0xffff00, 1);
      this.players.forEach((player, id) => {
        if (id !== this.room.sessionId && player.visible) {
          this.minimapPlayers.fillCircle(player.x, player.y, 5);
        }
      });
    }

    // Mettre à jour le zoom de la minimap en fonction de la taille de la zone sûre
    this.updateMinimapZoom();
  }

  shutdown() {
    // Arrêter le timer local lorsque la scène est fermée
    if (this.zoneTimerEvent) {
      this.zoneTimerEvent.remove();
      this.zoneTimerEvent = null;
    }

    // Supprimer les écouteurs d'événements
    this.scale.off('resize', this.resizeUI, this);

    // Nettoyer les graphiques
    if (this.healthBar) {
      this.healthBar.clear();
    }

    if (this.safeZone) {
      this.safeZone.clear();
    }

    if (this.minimapSafeZone) {
      this.minimapSafeZone.clear();
    }

    if (this.minimapBorder) {
      this.minimapBorder.clear();
    }

    if (this.minimapPlayers) {
      this.minimapPlayers.clear();
    }

    if (this.playerIndicator) {
      this.playerIndicator.clear();
    }

    // Vider les collections
    this.players.clear();
    this.weapons.clear();
    this.bullets.clear();

    // Déconnecter de la salle
    if (this.room) {
      this.room.removeAllListeners();
      this.room.leave();
    }
  }

  private setupRoom() {
    if (!this.room) return;

    // Gestion de l'ajout du joueur actuel
    this.room.state.players.onAdd((player: Player, sessionId: string) => {
      console.log(`Joueur ${sessionId} ajouté`);

      // Création du sprite du joueur
      let sprite; // Utiliser let au lieu de const pour permettre la réaffectation

      // Utiliser un sprite différent pour le joueur actuel et les autres joueurs
      if (sessionId === this.room?.sessionId) {
        // Commencer sans arme pour le joueur actuel
        sprite = this.physics.add.sprite(player.x, player.y, 'player_hold');
        this.currentPlayer = sprite;
        
        // Configurer la physique du joueur
        sprite.setCollideWorldBounds(true);
        sprite.setBounce(0); // Pas de rebond
        if (sprite.body) {
          sprite.body.setSize(sprite.width * 0.7, sprite.height * 0.7); // Réduire la hitbox
        }
      } else {
        sprite = this.physics.add.sprite(player.x, player.y, 'enemy');
      }

      // Configurer le sprite du joueur
      sprite.setData('health', player.health);
      sprite.setRotation(player.rotation);
      
      // Définir la profondeur pour qu'il soit au-dessus des éléments du décor
      sprite.setDepth(40);
      
      // Ne pas ajouter les sprites physiques au gameLayer pour éviter les problèmes
      // avec le moteur de physique
      
      // Ajout du joueur à la liste des joueurs
      this.players.set(sessionId, sprite);

      // Si c'est le joueur actuel
      if (sessionId === this.room?.sessionId) {
        this.currentPlayer = sprite;
        
        // Configurer la physique du joueur
        this.currentPlayer.setCollideWorldBounds(true);
        this.currentPlayer.setBounce(0); // Pas de rebond
        if (this.currentPlayer.body) {
          this.currentPlayer.body.setSize(sprite.width * 0.7, sprite.height * 0.7); // Réduire la hitbox
        }
        
        // Définir la profondeur du joueur pour qu'il soit au-dessus des éléments du décor
        this.currentPlayer.setDepth(40);
        
        // Ajout de la collision entre le joueur et la couche de collision
        this.physics.add.collider(this.currentPlayer, this.groundLayer);
        
        // Ajout de la collision avec la couche d'objets si elle existe
        if (this.collisionLayer) {
          this.physics.add.collider(this.currentPlayer, this.collisionLayer);
        }
        
        // Ajout de la collision avec la couche de détails si elle existe
        if (this.detailsLayer) {
          this.physics.add.collider(this.currentPlayer, this.detailsLayer);
        }

        // Ajouter des overlaps avec les armes existantes
        this.weapons.forEach((weaponSprite, weaponId) => {
          this.physics.add.overlap(this.currentPlayer, weaponSprite, () => {
            this.room.send('pickupWeapon', { weaponId });
          });
        });

        // Suivre le joueur avec la caméra
        this.cameras.main.startFollow(this.currentPlayer);
        if (this.minimap) {
          this.minimap.startFollow(this.currentPlayer);
        }

        // Initialiser les munitions (pas d'arme au début)
        this.initializeAmmo('');
      }

      // Mise à jour de la position du joueur lorsqu'elle change
      player.onChange(() => {
        // Pour les autres joueurs, mettre à jour directement la position
        if (sessionId !== this.room?.sessionId) {
          sprite.setPosition(player.x, player.y);
          sprite.setRotation(player.rotation);
        }

        // Mise à jour de la barre de vie si c'est le joueur actuel
        if (sessionId === this.room?.sessionId) {
          this.updateHealthBar(player.health);

          // Si l'arme a changé, mettre à jour l'affichage et initialiser les munitions
          if (player.weapon !== this.currentWeapon) {
            this.currentWeapon = player.weapon;
            this.updateWeaponDisplay(player.weapon);
            this.initializeAmmo(player.weapon);
          }
        }

        // Si le joueur est mort, changer sa teinte
        if (!player.isAlive) {
          sprite.setTint(0xff0000);
        }
      });
    });

    // Écouter les événements du serveur
    
    // Écouter les mises à jour d'ammo
    this.room.onMessage("ammoUpdate", (data) => {
      if (data.playerId === this.room.sessionId) {
        // Mettre à jour l'affichage des munitions pour le joueur actuel
        this.currentAmmo = data.ammo;
        this.updateAmmoDisplay(this.currentAmmo);
        console.log("Mise à jour des munitions depuis le serveur:", this.currentAmmo);
      }
    });
    
    // Écouter les mises à jour de chargeurs
    this.room.onMessage("magazineUpdate", (data) => {
      if (data.playerId === this.room.sessionId) {
        // Vérifier s'il s'agit d'une augmentation du nombre de chargeurs
        const previousMagazineCount = this.magazineCount;
        
        // Mettre à jour l'affichage des chargeurs pour le joueur actuel
        this.magazineCount = data.magazineCount;
        this.updateAmmoDisplay(this.currentAmmo);
        console.log("Mise à jour des chargeurs depuis le serveur:", this.magazineCount);
        
        // Si le joueur a récupéré un nouveau chargeur, afficher une notification
        if (this.magazineCount > previousMagazineCount) {
          this.showMagazinePickupNotification();
        }
      }
    });
    
    // Écouter les échecs de rechargement
    this.room.onMessage("reloadFail", (data) => {
      if (data.playerId === this.room.sessionId) {
        // Afficher un message d'échec de rechargement temporaire
        if (this.reloadingText) {
          this.reloadingText.setText("PAS DE CHARGEUR!");
          this.reloadingText.setColor('#ff0000');
          this.reloadingText.setVisible(true);
          
          // Animation de clignotement pour l'échec
          this.tweens.add({
            targets: this.reloadingText,
            alpha: { from: 1, to: 0.5 },
            duration: 300,
            yoyo: true,
            repeat: 3,
            onComplete: () => {
              this.hideReloadingMessage();
            }
          });
        }
      }
    });
    
    // Mise à jour de l'arme
    this.room.onMessage("weaponUpdate", (data) => {
      if (data.playerId === this.room?.sessionId) {
        // Mettre à jour l'arme localement
        this.currentWeapon = data.weapon;
        this.updateWeaponDisplay(this.currentWeapon);
        
        // Si le joueur n'a plus d'arme, changer son apparence
        if (!this.currentWeapon || this.currentWeapon === '') {
          if (this.currentPlayer) {
            this.currentPlayer.setTexture('player_hold');
          }
          
          // Réinitialiser les munitions
          this.maxAmmo = 0;
          this.currentAmmo = 0;
          this.magazineCount = 0;
          
          // Afficher un message "Pas d'arme"
          if (this.ammoText) {
            this.ammoText.setText("Pas d'arme");
          }
        } else {
          // Initialiser les munitions pour la nouvelle arme
          this.initializeAmmo(this.currentWeapon);
        }
      }
    });
    
    // Début du rechargement
    this.room.onMessage("reloadStart", (data) => {
      if (data.playerId === this.room?.sessionId) {
        // Afficher le message de rechargement
        this.showReloadingMessage(data.reloadTime);
      }
    });
    
    // Fin du rechargement
    this.room.onMessage("reloadEnd", (data) => {
      if (data.playerId === this.room?.sessionId) {
        // Cacher le message de rechargement
        this.hideReloadingMessage();
      }
    });

    // Gestion de la suppression des joueurs
    this.room.state.players.onRemove((player: Player, sessionId: string) => {
      console.log(`Joueur ${sessionId} supprimé`);

      const sprite = this.players.get(sessionId);
      if (sprite) {
        sprite.destroy();
        this.players.delete(sessionId);
      }

      // Mise à jour du nombre de joueurs en vie
      this.updatePlayersAlive();
    });

    // Gestion de l'état des armes
    this.room.state.weapons.onAdd((weapon: Weapon, weaponId: string) => {
      console.log(`Arme ${weaponId} ajoutée à la position ${weapon.x}, ${weapon.y}`);

      // Création du sprite de l'arme
      const weaponSprite = this.physics.add.sprite(weapon.x, weapon.y, weapon.type);
      
      // Ne pas ajouter les sprites physiques au gameLayer
      
      // Définir la profondeur de l'arme pour qu'elle soit au-dessus des éléments du décor
      weaponSprite.setDepth(35); // Entre les joueurs (40) et les détails (30)

      // Ajout d'un effet de flottement
      this.tweens.add({
        targets: weaponSprite,
        y: weaponSprite.y - 10,
        duration: 1000,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1
      });

      // Ajout de l'arme à la liste des armes
      this.weapons.set(weaponId, weaponSprite);
      
      // Ajouter un overlap pour permettre au joueur de ramasser l'arme
      if (this.currentPlayer) {
        this.physics.add.overlap(this.currentPlayer, weaponSprite, () => {
          // Envoyer un message au serveur pour ramasser l'arme
          this.room.send('pickupWeapon', { weaponId });
        });
      }
    });

    // Gestion de la suppression des armes
    this.room.state.weapons.onRemove((weapon: Weapon, weaponId: string) => {
      console.log(`Arme ${weaponId} supprimée`);

      const sprite = this.weapons.get(weaponId);
      if (sprite) {
        sprite.destroy();
        this.weapons.delete(weaponId);
      }
    });

    // Gestion de l'état des balles
    this.room.state.bullets.onAdd((bullet: Bullet, bulletId: string) => {
      // Création du sprite de la balle
      const bulletSprite = this.physics.add.sprite(bullet.x, bullet.y, 'bullet');
      
      // Ne pas ajouter les sprites physiques au gameLayer
      
      // Définir la profondeur de la balle pour qu'elle soit au-dessus des éléments du décor
      bulletSprite.setDepth(35); // Même profondeur que les armes

      // Ajout d'un effet de traînée à la balle
      this.addBulletTrail(bulletSprite);

      // Ajout de la balle à la liste des balles
      this.bullets.set(bulletId, bulletSprite);

      // Ajout de la collision entre la balle et la couche de collision
      this.physics.add.collider(bulletSprite, this.groundLayer, () => {
        // Supprimer la balle lorsqu'elle touche un mur
        this.room.send('removeBullet', { bulletId });
      });

      // Ajout de la collision entre la balle et la couche d'objets si elle existe
      if (this.collisionLayer) {
        this.physics.add.collider(bulletSprite, this.collisionLayer, () => {
          // Supprimer la balle lorsqu'elle touche un objet
          this.room.send('removeBullet', { bulletId });
        });
      }

      // Ajout de la collision entre la balle et la couche de détails si elle existe
      const detailsLayer = this.map.getLayer('Details');
      if (detailsLayer && detailsLayer.tilemapLayer) {
        this.physics.add.collider(bulletSprite, detailsLayer.tilemapLayer, () => {
          // Supprimer la balle lorsqu'elle touche un détail
          this.room.send('removeBullet', { bulletId });
        });
      }

      // Mise à jour de la position de la balle lorsqu'elle change
      bullet.onChange(() => {
        bulletSprite.setPosition(bullet.x, bullet.y);
        bulletSprite.setRotation(bullet.rotation);
      });
    });

    // Gestion de la suppression des balles
    this.room.state.bullets.onRemove((bullet: Bullet, bulletId: string) => {
      console.log(`Balle ${bulletId} supprimée`);

      const sprite = this.bullets.get(bulletId);
      if (sprite) {
        sprite.destroy();
        this.bullets.delete(bulletId);
      }
    });

    // Gestion des messages du serveur
    this.room.onMessage('playerEliminated', (message: { playerId: string, playersLeft: number }) => {
      console.log(`Joueur éliminé: ${message.playerId}, Joueurs restants: ${message.playersLeft}`);

      // Récupérer le sprite du joueur éliminé
      const playerSprite = this.players.get(message.playerId);
      if (playerSprite) {
        // Appliquer une teinte rouge au joueur éliminé
        playerSprite.setTint(0xff0000);
      }

      // Si c'est le joueur actuel qui est éliminé
      if (message.playerId === this.room.sessionId) {
        console.log("Vous avez été éliminé!");

        // Passer en mode spectateur
        this.currentPlayer.setAlpha(0.5); // Effet fantôme

        // Message différent selon le nombre de joueurs restants
        let messageText = 'VOUS ÊTES ÉLIMINÉ';

        // Si c'est l'avant-dernier joueur (donc 1 joueur restant après élimination)
        if (message.playersLeft === 1) {
          messageText = 'DÉFAITE';
        }

        // Afficher un message d'élimination temporaire
        const eliminationText = this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2, messageText, {
          fontFamily: 'Arial Black',
          fontSize: '64px',
          color: '#ff0000',
          stroke: '#000000',
          strokeThickness: 6
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);

        // Faire disparaître le message après 2 secondes
        this.tweens.add({
          targets: eliminationText,
          alpha: { from: 1, to: 0 },
          duration: 2000,
          onComplete: () => {
            eliminationText.destroy();
          }
        });
      } else {
        // Si le joueur est en mode spectateur et qu'il ne reste plus que 1 joueur (le gagnant)
        if (this.currentPlayer && this.currentPlayer.alpha < 1 && message.playersLeft === 1) {
          // Afficher un message de fin de partie pour les spectateurs
          const finPartieText = this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2, 'FIN DE LA PARTIE', {
            fontFamily: 'Arial Black',
            fontSize: '64px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6
          }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);

          // Faire disparaître le message après 2 secondes
          this.tweens.add({
            targets: finPartieText,
            alpha: { from: 1, to: 0 },
            duration: 2000,
            onComplete: () => {
              finPartieText.destroy();
            }
          });
        }
      }

      // Mise à jour du nombre de joueurs en vie
      this.updatePlayersAlive();
    });

    this.room.onMessage('gameOver', (message: { winnerId: string }) => {
      console.log(`Partie terminée, gagnant: ${message.winnerId}`);

      // Arrêter les mises à jour de la scène
      this.scene.pause();

      // Nettoyer les ressources avant de passer à la scène suivante
      if (this.zoneTimerEvent) {
        this.zoneTimerEvent.remove();
        this.zoneTimerEvent = null;
      }

      // Déterminer si le joueur actuel a gagné
      const isWinner = message.winnerId === this.room.sessionId;

      // Vérifier si le joueur est en mode spectateur (déjà éliminé)
      const isSpectator = this.currentPlayer && this.currentPlayer.alpha < 1;

      // Afficher un message uniquement pour le gagnant ou pour le dernier éliminé (TOP 2)
      // Les spectateurs ont déjà reçu leur message "FIN DE LA PARTIE" lors de l'élimination du TOP 2
      if (isWinner) {
        // Message pour le TOP 1
        const victoryText = this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2, 'VICTOIRE', {
          fontFamily: 'Arial Black',
          fontSize: '64px',
          color: '#ffff00',
          stroke: '#000000',
          strokeThickness: 6
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);

        // Animation du texte
        this.tweens.add({
          targets: victoryText,
          scale: { from: 0.5, to: 1.5 },
          duration: 1000,
          ease: 'Bounce.Out'
        });
      }

      // Transition vers l'écran de fin après un court délai
      this.time.delayedCall(2000, () => {
        this.scene.start('GameOverScene', { win: isWinner });
      });
    });

    this.room.onMessage("zoneShrink", (message: { x: number, y: number, radius: number, nextShrinkTime: number }) => {
      console.log(`Message zoneShrink reçu:`, message);

      // Mise à jour de la zone sûre
      this.updateSafeZone(message.x, message.y, message.radius);

      // Mise à jour du timer
      this.nextShrinkTime = message.nextShrinkTime || 30;
      this.updateZoneTimer();
    });

    // Ajouter un gestionnaire pour le message zoneUpdate
    this.room.onMessage("zoneUpdate", (message: { x: number, y: number, radius: number, nextShrinkTime: number }) => {
      console.log(`Message zoneUpdate reçu:`, message);

      // Mise à jour de la zone sûre
      this.updateSafeZone(message.x, message.y, message.radius);

      // Mise à jour du timer
      this.nextShrinkTime = message.nextShrinkTime || 5;
      this.updateZoneTimer();
    });

    this.room.onMessage("zoneTimer", (message: { nextShrinkTime: number }) => {
      // Mise à jour du timer
      this.nextShrinkTime = message.nextShrinkTime || 30;
      this.updateZoneTimer();
    });

    // Gestion du message de rafraîchissement forcé
    this.room.onMessage('forceRefresh', () => {
      console.log("Rafraîchissement forcé de la page");
      // Forcer le rafraîchissement de la page
      window.location.reload();
    });

    // Mise à jour initiale du nombre de joueurs en vie
    this.updatePlayersAlive();
  }

  private createUI() {
    // Calculer les dimensions en fonction de la taille de l'écran
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Dimensions des boîtes d'information
    const infoBoxWidth = Math.min(220, width * 0.22);
    const infoBoxHeight = Math.min(120, height * 0.16);
    const infoBoxX = 16;
    const infoBoxY = height - infoBoxHeight - 70;

    // Dimensions de la boîte de timer
    const timerBoxWidth = Math.min(200, width * 0.2);
    const timerBoxHeight = Math.min(60, height * 0.08);
    const timerBoxX = width - timerBoxWidth - 16;
    const timerBoxY = 16;

    // Taille de la police
    const fontSize = Math.max(13, Math.min(18, width * 0.016));
    const timerFontSize = Math.max(24, Math.min(36, width * 0.028));

    // Espacement
    const padding = 14;

    // Création de la boîte d'information avec effet glassmorphism
    const infoBox = this.add.graphics();
    infoBox.fillStyle(0x000000, 0.5); // Plus transparent
    infoBox.fillRoundedRect(infoBoxX, infoBoxY, infoBoxWidth, infoBoxHeight, 16);
    infoBox.lineStyle(2, 0xffffff, 0.2); // Bordure plus subtile
    infoBox.strokeRoundedRect(infoBoxX, infoBoxY, infoBoxWidth, infoBoxHeight, 16);
    // Ajout d'une bordure colorée plus vive sur le côté
    infoBox.lineStyle(4, 0x44ff88, 0.7);
    infoBox.strokeRoundedRect(infoBoxX, infoBoxY, 6, infoBoxHeight, { tl: 16, bl: 16, tr: 0, br: 0 });
    infoBox.setScrollFactor(0);
    infoBox.setDepth(100);

    // Création de la boîte de timer
    const timerBox = this.add.graphics();
    timerBox.fillStyle(0x000000, 0.5); // Plus transparent
    timerBox.fillRoundedRect(timerBoxX, timerBoxY, timerBoxWidth, timerBoxHeight, 16);
    timerBox.lineStyle(2, 0xffffff, 0.2); // Bordure plus subtile
    timerBox.strokeRoundedRect(timerBoxX, timerBoxY, timerBoxWidth, timerBoxHeight, 16);
    // Ajout d'une bordure colorée plus vive sur le côté
    timerBox.lineStyle(4, 0xff8844, 0.7);
    timerBox.strokeRoundedRect(timerBoxX + timerBoxWidth - 6, timerBoxY, 6, timerBoxHeight, { tl: 0, bl: 0, tr: 16, br: 16 });
    timerBox.setScrollFactor(0);
    timerBox.setDepth(100);

    // Création de la barre de vie
    this.healthBar = this.add.graphics();
    this.healthBar.setScrollFactor(0);
    this.healthBar.setDepth(150);

    // Texte pour la vie avec police moderne
    this.healthText = this.add.text(infoBoxX + padding + 6, infoBoxY + padding, 'Vie: 100', {
      fontFamily: '"Segoe UI", Arial, sans-serif',
      fontSize: `${fontSize}px`,
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    });
    this.healthText.setScrollFactor(0);
    this.healthText.setDepth(150);

    // Texte pour le nombre de joueurs restants
    this.playersAliveText = this.add.text(infoBoxX + padding + 6, infoBoxY + padding + fontSize + 10, 'Joueurs: 0', {
      fontFamily: '"Segoe UI", Arial, sans-serif',
      fontSize: `${fontSize}px`,
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    });
    this.playersAliveText.setScrollFactor(0);
    this.playersAliveText.setDepth(150);

    // Texte pour l'arme équipée
    this.weaponText = this.add.text(infoBoxX + padding + 6, infoBoxY + padding + (fontSize * 2) + 20, 'Arme: Aucune', {
      fontFamily: '"Segoe UI", Arial, sans-serif',
      fontSize: `${fontSize}px`,
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    });
    this.weaponText.setScrollFactor(0);
    this.weaponText.setDepth(150);

    // Texte pour le timer de la zone
    this.zoneTimerText = this.add.text(timerBoxX + timerBoxWidth - padding - 6, timerBoxY + timerBoxHeight / 2, 'Zone: 30s', {
      fontFamily: '"Segoe UI", Arial, sans-serif',
      fontSize: `${timerFontSize}px`,
      color: '#ffcc44',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    });
    this.zoneTimerText.setOrigin(1, 0.5);
    this.zoneTimerText.setScrollFactor(0);
    this.zoneTimerText.setDepth(150);

    // Création du fond pour les munitions
    this.ammoBackground = this.add.graphics();
    this.ammoBackground.fillStyle(0x000000, 0.5);
    this.ammoBackground.fillRoundedRect(width - 230, height - 86, 214, 56, 16);
    this.ammoBackground.lineStyle(2, 0xffffff, 0.2);
    this.ammoBackground.strokeRoundedRect(width - 230, height - 86, 214, 56, 16);
    // Ajout d'une bordure colorée plus vive pour les munitions
    this.ammoBackground.lineStyle(4, 0x44aaff, 0.7);
    this.ammoBackground.strokeRoundedRect(width - 230, height - 86, 214, 6, { tl: 16, tr: 16, bl: 0, br: 0 });
    this.ammoBackground.setScrollFactor(0);
    this.ammoBackground.setDepth(150);

    // Création du texte pour les munitions
    this.ammoText = this.add.text(width - 123, height - 58, "Pas d'arme", {
      fontFamily: '"Segoe UI", Arial, sans-serif',
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    });
    this.ammoText.setOrigin(0.5);
    this.ammoText.setScrollFactor(0);
    this.ammoText.setDepth(150);

    // Création du texte pour le rechargement
    this.reloadingText = this.add.text(width / 2, height - 100, 'RECHARGEMENT...', {
      fontFamily: '"Segoe UI", Arial, sans-serif',
      fontSize: '24px',
      color: '#ffcc44',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    });
    this.reloadingText.setOrigin(0.5);
    this.reloadingText.setScrollFactor(0);
    this.reloadingText.setDepth(150);
    this.reloadingText.setVisible(false);

    // Mise à jour de la barre de vie
    this.updateHealthBar(100);

    // Mise à jour initiale du nombre de joueurs
    this.updatePlayersAlive();

    // Ajout d'un événement de redimensionnement pour adapter l'UI
    this.scale.on('resize', this.resizeUI, this);

    // S'assurer que tous les éléments d'UI sont au-dessus de la zone
    this.healthBar.setDepth(150);
    this.healthText.setDepth(150);
    this.playersAliveText.setDepth(150);
    this.weaponText.setDepth(150);
    this.ammoText.setDepth(150);
    this.reloadingText.setDepth(150);
    this.zoneTimerText.setDepth(150);
    
    // S'assurer que le contour de la minimap est au-dessus de la minimap elle-même
    if (this.minimapBorder) {
      this.minimapBorder.setDepth(151);
    }

    // Ajouter tous les éléments UI au conteneur uiLayer
    this.uiLayer.add(infoBox);
    this.uiLayer.add(timerBox);
    this.uiLayer.add(this.healthBar);
    this.uiLayer.add(this.healthText);
    this.uiLayer.add(this.playersAliveText);
    this.uiLayer.add(this.weaponText);
    this.uiLayer.add(this.zoneTimerText);
    this.uiLayer.add(this.ammoBackground);
    this.uiLayer.add(this.ammoText);
    this.uiLayer.add(this.reloadingText);
  }

  private resizeUI() {
    // Nettoyer les graphiques existants
    this.healthBar.clear();
    this.ammoBackground.clear();

    // Récupérer les nouvelles dimensions
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Recalculer les dimensions des boîtes d'information
    const infoBoxWidth = Math.min(220, width * 0.22);
    const infoBoxHeight = Math.min(120, height * 0.16);
    const infoBoxX = 16;
    const infoBoxY = height - infoBoxHeight - 70;

    // Recalculer les dimensions de la boîte de timer
    const timerBoxWidth = Math.min(200, width * 0.2);
    const timerBoxHeight = Math.min(60, height * 0.08);
    const timerBoxX = width - timerBoxWidth - 16;
    const timerBoxY = 16;

    // Taille de la police
    const fontSize = Math.max(13, Math.min(18, width * 0.016));
    const timerFontSize = Math.max(24, Math.min(36, width * 0.028));

    // Espacement
    const padding = 14;

    // Redessiner la boîte d'information
    const infoBox = this.add.graphics();
    infoBox.fillStyle(0x000000, 0.5);
    infoBox.fillRoundedRect(infoBoxX, infoBoxY, infoBoxWidth, infoBoxHeight, 16);
    infoBox.lineStyle(2, 0xffffff, 0.2);
    infoBox.strokeRoundedRect(infoBoxX, infoBoxY, infoBoxWidth, infoBoxHeight, 16);
    // Ajout d'une bordure colorée plus vive sur le côté
    infoBox.lineStyle(4, 0x44ff88, 0.7);
    infoBox.strokeRoundedRect(infoBoxX, infoBoxY, 6, infoBoxHeight, { tl: 16, bl: 16, tr: 0, br: 0 });
    infoBox.setScrollFactor(0);
    infoBox.setDepth(100);

    // Redessiner la boîte de timer
    const timerBox = this.add.graphics();
    timerBox.fillStyle(0x000000, 0.5);
    timerBox.fillRoundedRect(timerBoxX, timerBoxY, timerBoxWidth, timerBoxHeight, 16);
    timerBox.lineStyle(2, 0xffffff, 0.2);
    timerBox.strokeRoundedRect(timerBoxX, timerBoxY, timerBoxWidth, timerBoxHeight, 16);
    // Ajout d'une bordure colorée plus vive sur le côté
    timerBox.lineStyle(4, 0xff8844, 0.7);
    timerBox.strokeRoundedRect(timerBoxX + timerBoxWidth - 6, timerBoxY, 6, timerBoxHeight, { tl: 0, bl: 0, tr: 16, br: 16 });
    timerBox.setScrollFactor(0);
    timerBox.setDepth(100);

    // Redessiner le fond pour les munitions
    this.ammoBackground.fillStyle(0x000000, 0.5);
    this.ammoBackground.fillRoundedRect(width - 230, height - 86, 214, 56, 16);
    this.ammoBackground.lineStyle(2, 0xffffff, 0.2);
    this.ammoBackground.strokeRoundedRect(width - 230, height - 86, 214, 56, 16);
    // Ajout d'une bordure colorée plus vive pour les munitions
    this.ammoBackground.lineStyle(4, 0x44aaff, 0.7);
    this.ammoBackground.strokeRoundedRect(width - 230, height - 86, 214, 6, { tl: 16, tr: 16, bl: 0, br: 0 });
    this.ammoBackground.setScrollFactor(0);
    this.ammoBackground.setDepth(150);

    // Repositionner les textes et mettre à jour les tailles de police
    this.healthText.setPosition(infoBoxX + padding + 6, infoBoxY + padding);
    this.healthText.setFontSize(fontSize);
    
    this.playersAliveText.setPosition(infoBoxX + padding + 6, infoBoxY + padding + fontSize + 10);
    this.playersAliveText.setFontSize(fontSize);
    
    this.weaponText.setPosition(infoBoxX + padding + 6, infoBoxY + padding + (fontSize * 2) + 20);
    this.weaponText.setFontSize(fontSize);
    
    this.zoneTimerText.setPosition(timerBoxX + timerBoxWidth - padding - 6, timerBoxY + timerBoxHeight / 2);
    this.zoneTimerText.setFontSize(timerFontSize);
    this.zoneTimerText.setOrigin(1, 0.5);
    
    this.ammoText.setPosition(width - 123, height - 58);
    this.reloadingText.setPosition(width / 2, height - 100);

    // Mettre à jour la barre de vie
    this.updateHealthBar(this.currentPlayer ? this.currentPlayer.getData('health') || 100 : 100);
    
    // Redimensionner et repositionner la minimap
    if (this.minimap) {
      // Augmenter la taille de la minimap pour une meilleure visibilité
      const minimapSize = Math.min(width, height) * 0.30; // Augmenté de 0.25 à 0.30
      const minimapPadding = 16;
      const borderWidth = 5; // Bordure plus épaisse

      // Mettre à jour la minimap
      this.minimap.setSize(minimapSize, minimapSize);
      this.minimap.setPosition(minimapPadding, minimapPadding);

      // Mettre à jour le conteneur/bordure de la minimap
      if (this.minimapBorder) {
        this.minimapBorder.clear();
        this.minimapBorder.setDepth(90); // S'assurer qu'il reste sous la minimap
        
        // Redessiner le fond du conteneur
        this.minimapBorder.fillStyle(0x000000, 0.6);
        this.minimapBorder.fillRect(
            minimapPadding - borderWidth, 
            minimapPadding - borderWidth, 
            minimapSize + (borderWidth * 2), 
            minimapSize + (borderWidth * 2)
        );
        
        // Redessiner la bordure blanche brillante
        this.minimapBorder.lineStyle(2, 0xffffff, 0.8);
        this.minimapBorder.strokeRect(
            minimapPadding - borderWidth + 1, 
            minimapPadding - borderWidth + 1, 
            minimapSize + (borderWidth * 2) - 2, 
            minimapSize + (borderWidth * 2) - 2
        );
      }

      // S'assurer que tous les éléments d'UI sont ignorés par la minimap
      this.minimap.ignore(this.uiLayer);
      this.minimap.ignore(this.notificationLayer);
    }
  }

  private updateHealthBar(health: number) {
    if (!this.healthBar) return;

    // Mise à jour du texte de vie
    if (this.healthText) {
      this.healthText.setText(`Vie: ${health}`);
    }

    // Effacement de la barre précédente
    this.healthBar.clear();

    // Calculer les dimensions en fonction de la taille de l'écran
    const padding = Math.max(10, Math.min(20, this.cameras.main.width * 0.02));

    // Récupérer les dimensions de la boîte d'info
    const infoBoxWidth = Math.min(200, this.cameras.main.width * 0.2);
    const infoBoxHeight = Math.min(100, this.cameras.main.height * 0.15);
    const infoBoxX = padding;
    const infoBoxY = this.cameras.main.height - infoBoxHeight - 60; // Ajusté pour correspondre à createUI

    // Calcul de la largeur de la barre de vie
    const barWidth = infoBoxWidth * 1.2; // Élargir la barre de 20%
    const barHeight = Math.min(35, infoBoxHeight * 0.3); // Augmenter significativement la hauteur
    const x = infoBoxX; // Supprimer l'espace vide à gauche
    const y = infoBoxY + infoBoxHeight + 5; // Rapprocher la barre de vie de la boîte d'info

    // Dessin du fond de la barre (rouge)
    this.healthBar.fillStyle(0xff0000);
    this.healthBar.fillRect(x, y, barWidth, barHeight);

    // Dessin de la barre de vie (vert)
    const healthWidth = Math.max(0, Math.min(health / 100, 1)) * barWidth;
    this.healthBar.fillStyle(0x00ff00);
    this.healthBar.fillRect(x, y, healthWidth, barHeight);

    // Dessin du contour de la barre avec une bordure plus épaisse
    this.healthBar.lineStyle(3, 0xffffff);
    this.healthBar.strokeRect(x, y, barWidth, barHeight);
  }

  private updatePlayersAlive() {
    // Compter les joueurs en vie
    let playersAlive = 0;

    if (this.room) {
      this.room.state.players.forEach((player: Player) => {
        if (player.isAlive) {
          playersAlive++;
        }
      });
    }

    // Mettre à jour le texte
    if (this.playersAliveText) {
      this.playersAliveText.setText(`Joueurs: ${playersAlive}`);
    }
  }

  private updateSafeZone(x: number, y: number, radius: number) {
    if (!this.safeZone) return;

    console.log(`Mise à jour de la zone: x=${x}, y=${y}, radius=${radius}`);

    // Vérifier que les valeurs sont valides
    if (isNaN(x) || isNaN(y) || isNaN(radius)) {
      console.error("Valeurs de zone invalides:", { x, y, radius });
      return;
    }

    // Créer une animation de transition pour le rétrécissement de la zone
    const currentRadius = this.safeZone.getData('radius') || radius;
    if (currentRadius !== radius) {
      // Stocker le nouveau rayon
      this.safeZone.setData('radius', radius);

      // Créer une animation de transition
      this.tweens.add({
        targets: { value: currentRadius },
        value: radius,
        duration: 2000,
        ease: 'Sine.easeInOut',
        onUpdate: (tween) => {
          const currentValue = tween.getValue();
          this.drawSafeZone(x, y, currentValue);
          this.drawMinimapSafeZone(x, y, currentValue);
        }
      });
    } else {
      // Pas de changement de rayon, dessiner directement
      this.drawSafeZone(x, y, radius);
      this.drawMinimapSafeZone(x, y, radius);
    }
  }

  // Dessiner la zone sûre
  private drawSafeZone(x: number, y: number, radius: number) {
    this.safeZone.clear();
    
    // Remplissage plus visible
    this.safeZone.fillStyle(0x00ffff, 0.2); // Bleu avec opacité plus forte
    this.safeZone.fillCircle(x, y, radius);
    
    // Effet de lueur externe
    this.safeZone.lineStyle(16, 0xff0000, 0.15); 
    this.safeZone.strokeCircle(x, y, radius);
    
    // Grande bordure principale - plus visible
    this.safeZone.lineStyle(12, 0xff0000, 0.4);
    this.safeZone.strokeCircle(x, y, radius);
    
    // Bordure interne brillante - visible même sur les fonds clairs
    this.safeZone.lineStyle(3, 0xffff00, 1.0); // Jaune vif à pleine opacité 
    this.safeZone.strokeCircle(x, y, radius);
    
    // Positionner la zone pour qu'elle soit bien visible
    this.safeZone.setDepth(60);
  }

  // Dessiner la zone sûre sur la minimap
  private drawMinimapSafeZone(x: number, y: number, radius: number) {
    this.minimapSafeZone.clear();
    
    // Remplissage visible sur la minimap
    this.minimapSafeZone.fillStyle(0xff0000, 0.15);
    this.minimapSafeZone.fillCircle(x, y, radius);
    
    // Bordure principale épaisse 
    this.minimapSafeZone.lineStyle(4, 0xff0000, 0.6);
    this.minimapSafeZone.strokeCircle(x, y, radius);
    
    // Bordure interne brillante pour contraste
    this.minimapSafeZone.lineStyle(2, 0xffff00, 1.0);
    this.minimapSafeZone.strokeCircle(x, y, radius);
    
    // Assurer que la zone de la minimap est bien visible
    this.minimapSafeZone.setDepth(101);
  }

  // Ajout d'un effet de traînée pour les balles
  private addBulletTrail(bullet: Phaser.Physics.Arcade.Sprite) {
    const particles = this.add.particles(0, 0, 'bullet', {
      speed: 100,
      scale: { start: 0.4, end: 0 },
      blendMode: 'ADD',
      lifespan: 200,
      follow: bullet
    });

    // Supprimer les particules lorsque la balle est détruite
    bullet.on('destroy', () => {
      particles.destroy();
    });
  }

  // Mise à jour locale du timer (indépendamment des messages du serveur)
  private updateLocalTimer() {
    if (this.nextShrinkTime > 0) {
      this.nextShrinkTime--;
      this.updateZoneTimer();
    }
  }

  // Mise à jour du timer de la zone
  private updateZoneTimer() {
    if (this.room) {
      this.room.onMessage("zoneTimer", (data: { nextShrinkTime: number }) => {
        this.nextShrinkTime = data.nextShrinkTime;
        
        // Mise à jour visuelle du texte du timer - version simplifiée
        if (this.zoneTimerText) {
          this.zoneTimerText.setText(`Zone: ${this.nextShrinkTime}s`);
          this.zoneTimerText.setColor('#ffffff');
          this.zoneTimerText.setFontSize(24);
        }
      });
    }
  }

  // Méthode mise à jour pour afficher les munitions et les chargeurs
  private updateAmmoDisplay(ammo: number) {
    // Mettre à jour l'affichage des munitions
    if (this.ammoText) {
      if (this.currentWeapon && this.currentWeapon !== '') {
        // Format amélioré : "20/20 • 0" où le premier est les munitions actuelles et après le point, le nombre de chargeurs
        this.ammoText.setText(`${ammo}/${this.maxAmmo} • ${this.magazineCount}`);

        // Changer la couleur en fonction du nombre de munitions
        if (ammo === 0) {
          this.ammoText.setColor('#ff0000'); // Rouge si plus de munitions
        } else if (ammo <= Math.ceil(this.maxAmmo / 3)) {
          this.ammoText.setColor('#ffff00'); // Jaune si peu de munitions
        } else {
          this.ammoText.setColor('#ffffff'); // Blanc par défaut
        }
        
        // Taille de texte plus grande
        this.ammoText.setFontSize('24px');
      } else {
        this.ammoText.setText("Pas d'arme");
        this.ammoText.setColor('#ffffff');
        this.ammoText.setFontSize('20px');
      }
    }
  }

  // Méthode pour afficher le message de rechargement
  private showReloadingMessage(reloadTime: number) {
    if (this.reloadingText) {
      this.reloadingText.setVisible(true);

      // Animation de clignotement
      this.tweens.add({
        targets: this.reloadingText,
        alpha: { from: 1, to: 0.5 },
        duration: 500,
        yoyo: true,
        repeat: Math.floor(reloadTime / 1000)
      });

      // Changer l'apparence du joueur pour l'animation de rechargement
      if (this.currentPlayer) {
        this.currentPlayer.setTexture('player_reload');
      }

      // Masquer le message après le temps de rechargement
      this.time.delayedCall(reloadTime, () => {
        this.hideReloadingMessage();
      });
    }
  }

  // Méthode pour masquer le message de rechargement
  private hideReloadingMessage() {
    if (this.reloadingText) {
      this.reloadingText.setVisible(false);
      this.tweens.killTweensOf(this.reloadingText);
      this.reloadingText.setAlpha(1);
      this.reloadingText.setText('RECHARGEMENT...');
      this.reloadingText.setColor('#ffcc44');
      
      // Restaurer l'apparence du joueur en fonction de l'arme équipée
      if (this.currentPlayer) {
        // Sélectionner la texture appropriée en fonction de l'arme
        let textureKey = 'player_hold'; // Texture par défaut (sans arme)
        
        if (this.currentWeapon === 'pistol') {
          textureKey = 'player_gun';
        } else if (this.currentWeapon === 'rifle') {
          textureKey = 'player_silencer';
        } else if (this.currentWeapon === 'shotgun') {
          textureKey = 'player_machine';
        }
        
        // Appliquer la texture
        this.currentPlayer.setTexture(textureKey);
      }
    }
  }

  // Méthode pour mettre à jour l'affichage de l'arme
  private updateWeaponDisplay(weapon: string) {
    if (this.weaponText) {
      let weaponName = '';

      // Traduire le nom de l'arme en français
      if (weapon === 'pistol') {
        weaponName = 'Pistolet';
      } else if (weapon === 'rifle') {
        weaponName = 'Mitraillette';
      } else if (weapon === 'shotgun') {
        weaponName = 'Fusil à pompe';
      } else {
        weaponName = 'Aucune';
      }

      this.weaponText.setText(`Arme: ${weaponName}`);

      // Changer l'apparence du joueur en fonction de l'arme équipée
      if (this.currentPlayer) {
        let textureKey = 'player_hold'; // Texture par défaut (sans arme)

        // Sélectionner la texture appropriée en fonction de l'arme
        if (weapon === 'pistol') {
          textureKey = 'player_gun';
        } else if (weapon === 'rifle') {
          textureKey = 'player_silencer';
        } else if (weapon === 'shotgun') {
          textureKey = 'player_machine';
        } else {
          textureKey = 'player_hold'; // Explicitement sans arme
        }

        // Appliquer la nouvelle texture
        this.currentPlayer.setTexture(textureKey);
      }
    }
  }

  // Méthode pour initialiser les munitions lors du ramassage d'une arme
  private initializeAmmo(weaponType: string) {
    // Sauvegarder le type d'arme actuel
    this.currentWeapon = weaponType;
    
    // Définir les munitions en fonction du type d'arme
    if (weaponType === 'pistol') {
      this.maxAmmo = 9;
      this.currentAmmo = this.maxAmmo;
      // Suppression des chargeurs en réserve
      this.magazineCount = 0;
    } else if (weaponType === 'rifle') {
      this.maxAmmo = 30;
      this.currentAmmo = this.maxAmmo;
      // Suppression des chargeurs en réserve
      this.magazineCount = 0;
    } else if (weaponType === 'shotgun') {
      // Pour le fusil à pompe: 4 tirs de 5 balles chacun = 20 balles
      this.maxAmmo = 20;
      this.currentAmmo = this.maxAmmo;
      // Suppression des chargeurs en réserve
      this.magazineCount = 0;
    } else {
      // Pas d'arme
      this.maxAmmo = 0;
      this.currentAmmo = 0;
      this.magazineCount = 0;
      this.currentWeapon = '';
    }

    // Mettre à jour l'affichage des munitions
    this.updateAmmoDisplay(this.currentAmmo);
    
    // Mettre à jour l'affichage de l'arme
    this.updateWeaponDisplay(weaponType);
    
    console.log(`Arme initialisée: ${weaponType}, Munitions: ${this.currentAmmo}/${this.maxAmmo}`);
  }

  // Méthode pour gérer le clic de la souris
  private handleShootingOnClick() {
    console.log("Traitement du tir");
    
    // Vérifier si le joueur a une arme
    if (this.currentPlayer && this.room && this.currentWeapon && this.currentWeapon !== '') {
      console.log("Le joueur a une arme:", this.currentWeapon);
      
      // Vérifier si le joueur est en train de recharger
      if (this.reloadingText && this.reloadingText.visible) {
        console.log("Impossible de tirer pendant le rechargement");
        return;
      }
      
      // Mettre à jour le temps du dernier tir
      this.lastFireTime = this.time.now;
      
      if (this.currentAmmo > 0) {
        console.log("Tir avec munitions:", this.currentAmmo);
        
        // Calculer le nombre de munitions à consommer en fonction de l'arme
        let ammoToConsume = 1;
        if (this.currentWeapon === 'rifle') {
          ammoToConsume = 5;
        } else if (this.currentWeapon === 'shotgun') {
          ammoToConsume = 5; // Synchronisé avec le serveur: 5 munitions par tir
        } else if (this.currentWeapon === 'pistol') {
          ammoToConsume = 1;
        }
        
        // Vérifier si le joueur a assez de munitions
        if (this.currentAmmo < ammoToConsume) {
          console.log("Pas assez de munitions pour tirer");
          
          // Essayer de recharger automatiquement
          if (this.magazineCount > 0) {
            this.reloadWeapon();
          }
          return;
        }
        
        // Consommer les munitions
        this.currentAmmo -= ammoToConsume;

        // Mettre à jour l'affichage
        this.updateAmmoDisplay(this.currentAmmo);

        // Obtenir l'angle actuel du joueur
        const angle = this.currentPlayer.rotation;
        
        // Envoyer le message de tir au serveur avec la rotation calculée
        this.room.send('shoot', { rotation: angle });
        console.log("Tir envoyé au serveur avec rotation:", angle, "Munitions restantes:", this.currentAmmo);
        
        // Si c'était la dernière munition, vérifier si le joueur a des chargeurs
        if (this.currentAmmo <= 0) {
          console.log("Plus de munitions après le tir");
          
          // Vérifier si le joueur a des chargeurs
          if (this.magazineCount > 0) {
            console.log("Rechargement automatique avec un chargeur disponible");
            // Recharger automatiquement
            this.reloadWeapon();
          } else {
            console.log("Plus de munitions et pas de chargeurs, l'arme est perdue");
            
            // Plus de munitions et pas de chargeurs, changer l'apparence du joueur et retirer l'arme
            if (this.currentPlayer) {
              this.currentPlayer.setTexture('player_hold');
            }
            
            // Informer le serveur que le joueur n'a plus d'arme
            this.room.send('dropWeapon', {});
            
            // Réinitialiser l'arme actuelle
            this.currentWeapon = '';
            
            // Réinitialiser les munitions
            this.maxAmmo = 0;
            this.currentAmmo = 0;
            this.magazineCount = 0;
            
            // Afficher un message "Plus de munitions"
            if (this.ammoText) {
              this.ammoText.setText("Pas d'arme");
            }
            
            // Mettre à jour l'affichage de l'arme
            this.updateWeaponDisplay("");
          }
        }
      } else {
        console.log("Tentative de tir sans munitions");
        
        // Vérifier si le joueur a des chargeurs
        if (this.magazineCount > 0) {
          console.log("Rechargement automatique avec un chargeur disponible");
          // Recharger automatiquement
          this.reloadWeapon();
        } else {
          console.log("Plus de munitions et pas de chargeurs, l'arme est perdue");
          
          // Plus de munitions et pas de chargeurs, changer l'apparence du joueur et retirer l'arme
          if (this.currentPlayer) {
            this.currentPlayer.setTexture('player_hold');
          }
          
          // Informer le serveur que le joueur n'a plus d'arme
          this.room.send('dropWeapon', {});
  
          // Réinitialiser l'arme actuelle
          this.currentWeapon = '';
          
          // Réinitialiser les munitions
          this.maxAmmo = 0;
          this.currentAmmo = 0;
          this.magazineCount = 0;
  
          // Afficher un message "Plus de munitions"
          if (this.ammoText) {
            this.ammoText.setText("Pas d'arme");
          }
          
          // Mettre à jour l'affichage de l'arme
          this.updateWeaponDisplay("");
        }
      }
    } else {
      console.log("Le joueur n'a pas d'arme");
    }
  }
  
  // Méthode pour obtenir la cadence de tir en fonction du type d'arme
  private getFireRateForWeapon(weaponType: string): number {
    switch (weaponType) {
      case 'pistol':
        return 500; // 500ms entre chaque tir
      case 'rifle':
        return 200; // 200ms entre chaque tir (tir rapide mais pas trop)
      case 'shotgun':
        return 1000; // 1000ms entre chaque tir (tir lent)
      default:
        return 500; // Valeur par défaut
    }
  }

  // Méthode pour recharger l'arme
  private reloadWeapon() {
    // Vérifier si le joueur a une arme
    if (!this.currentWeapon || this.currentWeapon === '') {
      console.log("Aucune arme à recharger");
      return;
    }
    
    // Vérifier si le joueur est déjà en train de recharger
    if (this.reloadingText && this.reloadingText.visible) {
      console.log("Déjà en train de recharger");
      return;
    }
    
    // Vérifier si le joueur a besoin de recharger
    if (this.currentAmmo === this.maxAmmo) {
      console.log("Munitions déjà pleines");
      return;
    }

    // Envoyer la demande de rechargement au serveur
    if (this.room) {
      this.room.send('reload', {});
      console.log("Demande de rechargement envoyée");
    }
  }

  // Méthode pour vérifier et corriger les blocages du joueur par des murs invisibles
  private checkForInvisibleWalls() {
    if (!this.currentPlayer || !this.map) {
      return;
    }
    
    // Obtenir les coordonnées du joueur
    const playerX = this.currentPlayer.x;
    const playerY = this.currentPlayer.y;
    
    // Vérifier si le joueur est en dehors des limites de la carte
    const mapWidth = this.map.widthInPixels;
    const mapHeight = this.map.heightInPixels;
    
    // Si le joueur est en dehors des limites, le replacer à l'intérieur
    if (playerX < 0 || playerX > mapWidth || playerY < 0 || playerY > mapHeight) {
      const newX = Phaser.Math.Clamp(playerX, 0, mapWidth);
      const newY = Phaser.Math.Clamp(playerY, 0, mapHeight);
      
      this.currentPlayer.setPosition(newX, newY);
      if (this.room) {
        this.room.send('move', { x: newX, y: newY });
      }
    }
    
    // Réduire la vélocité si le joueur est bloqué
    if (this.currentPlayer.body && this.currentPlayer.body.blocked.none === false) {
      // Si le joueur est bloqué dans une direction, réduire sa vélocité dans cette direction
      if (this.currentPlayer.body.blocked.up || this.currentPlayer.body.blocked.down) {
        this.currentPlayer.setVelocityY(0);
      }
      
      if (this.currentPlayer.body.blocked.left || this.currentPlayer.body.blocked.right) {
        this.currentPlayer.setVelocityX(0);
      }
    }
  }

  // Méthode pour gérer les contrôles du joueur
  private handlePlayerControls() {
    if (!this.currentPlayer || !this.room) return;

    // Vitesse de déplacement (augmentée)
    const speed = 200; // Augmentation significative de la vitesse
    let vx = 0;
    let vy = 0;

    // Gestion des touches ZQSD et des flèches
    if ((this.keyW && this.keyW.isDown) || (this.cursors && this.cursors.up.isDown)) {
      vy = -speed;
    }

    if ((this.keyS && this.keyS.isDown) || (this.cursors && this.cursors.down.isDown)) {
      vy = speed;
    }

    if ((this.keyA && this.keyA.isDown) || (this.cursors && this.cursors.left.isDown)) {
      vx = -speed;
    }

    if ((this.keyD && this.keyD.isDown) || (this.cursors && this.cursors.right.isDown)) {
      vx = speed;
    }

    // Support des manettes - Joystick gauche (L3)
    if (this.gamepadsEnabled && this.gamepad) {
      // Obtenir les valeurs du joystick gauche
      const leftStickX = this.gamepad.leftStick.x;
      const leftStickY = this.gamepad.leftStick.y;

      // Appliquer une zone morte pour éviter les mouvements indésirables
      if (Math.abs(leftStickX) > this.joystickDeadZone) {
        vx = leftStickX * speed;
      }

      if (Math.abs(leftStickY) > this.joystickDeadZone) {
        vy = leftStickY * speed;
      }

      // Support de la touche R2/RT pour recharger (bouton B sur Xbox, cercle sur PlayStation)
      if (this.gamepad.buttons[1].pressed) { // Bouton B (Xbox) ou Circle (PlayStation)
        this.reloadWeapon();
      }
    }

    // Gestion de la touche R pour recharger
    if (this.keyR && Phaser.Input.Keyboard.JustDown(this.keyR)) {
      this.reloadWeapon();
    }

    if (vx !== 0 || vy !== 0) {
      // Utiliser la vélocité au lieu de modifier directement la position
      this.currentPlayer.setVelocity(vx, vy);
      
      // S'assurer que le joueur reste dans les limites du monde
      this.currentPlayer.setCollideWorldBounds(true);
    } else {
      // Arrêter le mouvement si aucune touche n'est pressée
      this.currentPlayer.setVelocity(0, 0);
    }
    
    // Gestion de la rotation en fonction de la position de la souris
    // Seulement si aucune manette n'est utilisée
    if (!this.gamepadsEnabled || !this.gamepad) {
      const pointer = this.input.activePointer;
      if (pointer) {
        const angle = Phaser.Math.Angle.Between(
          this.currentPlayer.x,
          this.currentPlayer.y,
          pointer.worldX,
          pointer.worldY
        );
        
        // Rotation du joueur vers la cible
        this.currentPlayer.setRotation(angle);
        
        // Envoi de la rotation au serveur
        this.room.send('rotate', { rotation: angle });
      }
    }
  }

  // Méthode pour mettre à jour la rotation du joueur en fonction de la position de la souris
  private updatePlayerRotation() {
    if (!this.currentPlayer || !this.room) return;

    let angle: number | null = null;

    // Support des manettes - Joystick droit (R3)
    if (this.gamepadsEnabled && this.gamepad) {
      const rightStickX = this.gamepad.rightStick.x;
      const rightStickY = this.gamepad.rightStick.y;

      // Vérifier si le joystick droit est utilisé (en dehors de la zone morte)
      if (Math.abs(rightStickX) > this.joystickDeadZone || Math.abs(rightStickY) > this.joystickDeadZone) {
        // Calculer l'angle en fonction de la position du joystick droit
        angle = Math.atan2(rightStickY, rightStickX);
        
        // S'assurer que l'angle est un nombre valide
        if (!isNaN(angle) && isFinite(angle)) {
          // Mettre à jour la rotation du joueur
          this.currentPlayer.setRotation(angle);
          
          // Envoi de la rotation au serveur
          this.room.send('rotate', { rotation: angle });
        }
      }
      // Si une manette est connectée, on ne revient PAS à la souris quand le joystick est relâché
      return;
    }

    // Si aucune manette n'est connectée, utiliser la souris
    // Mettre à jour la rotation du joueur en fonction de la position de la souris
    const pointer = this.input.activePointer;
    angle = Phaser.Math.Angle.Between(
      this.currentPlayer.x,
      this.currentPlayer.y,
      pointer.worldX,
      pointer.worldY
    );
    
    // S'assurer que l'angle est un nombre valide
    if (!isNaN(angle) && isFinite(angle)) {
      // Mettre à jour la rotation du joueur
      this.currentPlayer.setRotation(angle);
      
      // Envoi de la rotation au serveur
      this.room.send('rotate', { rotation: angle });
    }
  }

  // Calculer dynamiquement le zoom de la minimap en fonction de la taille de la carte
  private calculateMinimapZoom() {
    if (!this.map) return 0.3;

    // Obtenir les dimensions de la carte
    const mapWidth = this.map.widthInPixels;
    const mapHeight = this.map.heightInPixels;

    // Calculer le zoom en fonction de la taille de la carte
    // Plus la carte est grande, plus le zoom sera petit
    const baseZoom = 0.3; // Zoom de base plus élevé

    // Ajuster le zoom en fonction de la taille de la carte
    // Pour une carte de 2000x2000 pixels, le zoom sera d'environ 0.3
    // Pour une carte plus grande, le zoom sera proportionnellement réduit
    const referenceSize = 2000; // Taille de référence en pixels
    const scaleFactor = referenceSize / Math.max(mapWidth, mapHeight);

    return baseZoom * scaleFactor;
  }

  // Mettre à jour le zoom de la minimap
  private updateMinimapZoom() {
    if (!this.minimap || !this.map) return;

    const zoom = this.calculateMinimapZoom();
    this.minimap.setZoom(zoom);
  }

  // Méthode pour vérifier les propriétés de collision des tuiles
  private checkTileCollisionProperties() {
    if (!this.map || !this.groundLayer) return;

    console.log("Vérification des propriétés de collision des tuiles...");

    // Parcourir toutes les tuiles de la couche de sol
    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        const tile = this.groundLayer.getTileAt(x, y);
        if (tile && tile.properties && tile.properties.collides) {
          console.log(`Tuile à (${x}, ${y}) a la propriété collides = ${tile.properties.collides}`);
        }
      }
    }

    // Vérifier également la couche d'objets si elle existe
    if (this.collisionLayer) {
      for (let y = 0; y < this.map.height; y++) {
        for (let x = 0; x < this.map.width; x++) {
          const tile = this.collisionLayer.getTileAt(x, y);
          if (tile && tile.properties && tile.properties.collides) {
            console.log(`Objet à (${x}, ${y}) a la propriété collides = ${tile.properties.collides}`);
          }
        }
      }
    }

    // Vérifier si le joueur se trouve sur une tuile avec des propriétés spéciales
    if (this.currentPlayer && this.collisionLayer && this.tileset) {
      // Obtenir la position des tuiles sous le joueur
      const tileX = Math.floor(this.currentPlayer.x / this.tileset.tileWidth);
      const tileY = Math.floor(this.currentPlayer.y / this.tileset.tileHeight);
      
      // Obtenir la tuile à cette position
      const tile = this.collisionLayer.getTileAt(tileX, tileY);
      
      // Vérifier si la tuile a des propriétés
      if (tile && tile.properties && tile.properties.isWater) {
        // Appliquer l'effet d'eau (ralentir le joueur)
        if (this.currentPlayer.body) {
          this.currentPlayer.setVelocity(this.currentPlayer.body.velocity.x * 0.9, this.currentPlayer.body.velocity.y * 0.9);
        }
      }
    }
  }

  // Méthode pour créer les animations du jeu
  private createAnimations() {
    // Créer les animations pour les joueurs
    this.anims.create({
      key: 'player_idle',
      frames: this.anims.generateFrameNumbers('player', { start: 0, end: 0 }),
      frameRate: 10,
      repeat: -1
    });

    this.anims.create({
      key: 'player_walk',
      frames: this.anims.generateFrameNumbers('player', { start: 1, end: 4 }),
      frameRate: 10,
      repeat: -1
    });

    // Animations pour les armes
    this.anims.create({
      key: 'pistol_idle',
      frames: this.anims.generateFrameNumbers('pistol', { start: 0, end: 0 }),
      frameRate: 10,
      repeat: -1
    });

    this.anims.create({
      key: 'rifle_idle',
      frames: this.anims.generateFrameNumbers('rifle', { start: 0, end: 0 }),
      frameRate: 10,
      repeat: -1
    });

    this.anims.create({
      key: 'shotgun_idle',
      frames: this.anims.generateFrameNumbers('shotgun', { start: 0, end: 0 }),
      frameRate: 10,
      repeat: -1
    });
  }

  // Afficher une notification de récupération de chargeur
  private showMagazinePickupNotification() {
    // Créer un texte temporaire
    const notification = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height * 0.7,
      "CHARGEUR RÉCUPÉRÉ!",
      {
        fontFamily: '"Segoe UI", Arial, sans-serif',
        fontSize: '24px',
        color: '#44ffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3
      }
    );
    
    notification.setOrigin(0.5);
    notification.setScrollFactor(0);
    notification.setDepth(200);
    
    // Ajouter la notification à la couche de notification
    this.notificationLayer.add(notification);
    
    // Animation de l'apparition et disparition
    this.tweens.add({
      targets: notification,
      alpha: { from: 0, to: 1 },
      y: { from: this.cameras.main.height * 0.75, to: this.cameras.main.height * 0.65 },
      duration: 500,
      ease: 'Power2',
      onComplete: () => {
        this.tweens.add({
          targets: notification,
          alpha: { from: 1, to: 0 },
          y: { from: this.cameras.main.height * 0.65, to: this.cameras.main.height * 0.6 },
          duration: 800,
          ease: 'Power2',
          delay: 1000,
          onComplete: () => {
            notification.destroy();
          }
        });
      }
    });
  }

  // Mettre à jour la méthode de dessin des joueurs sur la minimap
  private drawPlayersOnMinimap() {
    if (!this.minimapPlayers || !this.currentPlayer) return;

    // Effacer les dessins précédents
    this.minimapPlayers.clear();
    
    // Dessiner tous les autres joueurs en bleu
    this.players.forEach((playerSprite, sessionId) => {
      if (sessionId !== this.room.sessionId && playerSprite.active) {
        this.minimapPlayers.fillStyle(0x00ffff, 1); // Cyan pour les autres joueurs
        this.minimapPlayers.fillCircle(playerSprite.x, playerSprite.y, 5);
      }
    });
    
    // Dessiner le joueur actuel en rouge
    this.playerIndicator.clear();
    this.playerIndicator.fillStyle(0xff0000, 1); // Rouge pour le joueur actuel
    this.playerIndicator.fillCircle(this.currentPlayer.x, this.currentPlayer.y, 5);
  }

  // Afficher les informations sur les contrôles de la manette
  private showGamepadInfo(gamepadId: string) {
    // Supprimer l'ancien texte s'il existe
    this.hideGamepadInfo();
    
    // Déterminer le type de manette
    const isPlayStation = gamepadId.toLowerCase().includes('playstation') || gamepadId.toLowerCase().includes('ps');
    const controlsText = isPlayStation 
      ? 'Manette PlayStation détectée!\nDéplacement: L3\nOrientation: R3\nTir: R2\nRecharger: Cercle'
      : 'Manette Xbox détectée!\nDéplacement: L3\nOrientation: R3\nTir: RT\nRecharger: B';
    
    // Créer le texte d'information
    this.gamepadInfoText = this.add.text(10, 120, controlsText, {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 10, y: 5 }
    });
    this.gamepadInfoText.setDepth(1000);
    
    // Ajouter le texte à la couche UI
    if (this.uiLayer) {
      this.uiLayer.add(this.gamepadInfoText);
    }
    
    // Faire disparaître le texte après 10 secondes
    this.time.delayedCall(10000, () => {
      this.hideGamepadInfo();
    });
  }
  
  // Cacher les informations sur les contrôles de la manette
  private hideGamepadInfo() {
    if (this.gamepadInfoText) {
      this.gamepadInfoText.destroy();
      this.gamepadInfoText = null;
    }
  }
} 