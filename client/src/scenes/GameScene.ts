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
  private maxMagazineCount: number = 2; // 2 chargeurs par arme
  private currentWeapon: string = '';
  
  constructor() {
    super({ key: 'GameScene' });
  }

  init() {
    // Initialisation du client Colyseus
    this.client = new Colyseus.Client('https://battle-royale-io-backend.onrender.com');
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
    
    // Création du fond avec des tuiles
    const backgroundTile = this.textures.get('background');
    const tileWidth = backgroundTile.getSourceImage().width;
    const tileHeight = backgroundTile.getSourceImage().height;
    
    for (let x = 0; x < 2000; x += tileWidth) {
      for (let y = 0; y < 2000; y += tileHeight) {
        this.add.image(x, y, 'background').setOrigin(0, 0);
      }
    }
    
    // Création des animations pour les personnages
    this.createAnimations();
    
    // Configuration de la caméra principale
    this.cameras.main.setBounds(0, 0, 2000, 2000);
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
    this.updateSafeZone(1000, 1000, 1000);
    
    // Création de la zone sûre pour la minimap
    this.minimapSafeZone = this.add.graphics();
    
    // Configuration de l'interface utilisateur
    this.createUI();
    
    // Création de la minimap (après l'UI pour pouvoir ignorer les éléments d'UI)
    const minimapSize = Math.min(this.cameras.main.width, this.cameras.main.height) * 0.22; // Augmentation de la taille
    const minimapPadding = 15;
    
    // Créer le contour de la minimap
    this.minimapBorder = this.add.graphics();
    this.minimapBorder.lineStyle(3, 0xFFFFFF, 1);
    this.minimapBorder.strokeRect(minimapPadding, minimapPadding, minimapSize, minimapSize);
    this.minimapBorder.setScrollFactor(0);
    this.minimapBorder.setDepth(101); // Au-dessus de la minimap
    
    // Créer la minimap elle-même
    this.minimap = this.cameras.add(minimapPadding, minimapPadding, minimapSize, minimapSize);
    this.minimap.setZoom(0.15);
    this.minimap.setBounds(0, 0, 2000, 2000);
    this.minimap.setBackgroundColor(0x002244);
    this.minimap.setName('minimap');
    this.minimap.setRoundPixels(true);
    
    // Ignorer les éléments d'UI dans la minimap
    this.minimap.ignore(this.healthBar);
    this.minimap.ignore(this.healthText);
    this.minimap.ignore(this.playersAliveText);
    this.minimap.ignore(this.weaponText);
    this.minimap.ignore(this.zoneTimerText);
    this.minimap.ignore(this.minimapBorder);
    
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
    
    // Configuration des contrôles
    if (this.input && this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
      this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
      this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
      this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
      this.keyR = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    }
    
    // Configuration des événements de la souris
    this.input?.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.currentPlayer && this.room) {
        // Calcul de l'angle de tir
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
        
        // Gérer le tir avec notre nouvelle méthode
        this.handleShooting();
      }
    });
  }

  update() {
    if (!this.currentPlayer || !this.room || !this.input || !this.input.keyboard) return;
    
    // Gestion des déplacements
    let vx = 0;
    let vy = 0;
    const speed = 5;
    
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
    
    // Gestion de la touche R pour recharger
    if (this.keyR && Phaser.Input.Keyboard.JustDown(this.keyR)) {
      this.reloadWeapon();
    }
    
    if (vx !== 0 || vy !== 0) {
      // Calcul de la nouvelle position
      let newX = this.currentPlayer.x + vx;
      let newY = this.currentPlayer.y + vy;
      
      // Vérification des limites de la carte (2000x2000)
      newX = Phaser.Math.Clamp(newX, 0, 2000);
      newY = Phaser.Math.Clamp(newY, 0, 2000);
      
      // Mise à jour de la position du joueur
      this.currentPlayer.setPosition(newX, newY);
      
      // Envoi des données de mouvement au serveur
      this.room.send('move', { x: newX, y: newY });
    }
    
    // Gestion de la rotation
    const pointer = this.input.activePointer;
    
    if (pointer) {
      const angle = Phaser.Math.Angle.Between(
        this.currentPlayer.x,
        this.currentPlayer.y,
        pointer.worldX,
        pointer.worldY
      );
      
      this.currentPlayer.setRotation(angle);
      
      // Envoi des données de rotation au serveur
      this.room.send('rotate', { rotation: angle });
    }
    
    // Vérification des armes à proximité
    this.weapons.forEach((weapon, weaponId) => {
      if (this.currentPlayer && this.room) {
        // Distance entre le joueur et l'arme
        const distance = Phaser.Math.Distance.Between(
          this.currentPlayer.x,
          this.currentPlayer.y,
          weapon.x,
          weapon.y
        );
        
        // Si le joueur est assez proche de l'arme
        if (distance < 50) {
          this.room.send('pickupWeapon', { weaponId });
        }
      }
    });
    
    // Mise à jour de la minimap pour qu'elle suive le joueur
    if (this.minimap && this.currentPlayer) {
      // Mettre à jour la position de la minimap pour qu'elle reste dans le coin
      this.minimap.centerOn(this.currentPlayer.x, this.currentPlayer.y);
      
      // Mettre à jour la position de l'indicateur du joueur sur la minimap uniquement
      if (this.playerIndicator) {
        this.playerIndicator.clear();
        this.playerIndicator.fillStyle(0xff0000, 1);
        this.playerIndicator.fillCircle(this.currentPlayer.x, this.currentPlayer.y, 5);
      }
      
      // Mettre à jour les positions des autres joueurs sur la minimap
      if (this.minimapPlayers) {
        this.minimapPlayers.clear();
        this.minimapPlayers.fillStyle(0xffff00, 1);
        
        this.players.forEach((sprite, sessionId) => {
          // Ne pas afficher le joueur actuel (déjà affiché avec playerIndicator)
          if (sessionId !== this.room?.sessionId) {
            this.minimapPlayers.fillCircle(sprite.x, sprite.y, 5);
          }
        });
      }
    }
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
    
    // Gestion de l'état des joueurs
    this.room.state.players.onAdd((player: Player, sessionId: string) => {
      console.log(`Joueur ${sessionId} ajouté`);
      
      // Création du sprite du joueur
      let sprite;
      
      // Utiliser un sprite différent pour le joueur actuel et les autres joueurs
      if (sessionId === this.room?.sessionId) {
        // Commencer sans arme
        sprite = this.physics.add.sprite(player.x, player.y, 'player_hold');
      } else {
        sprite = this.physics.add.sprite(player.x, player.y, 'enemy');
      }
      
      sprite.setRotation(player.rotation);
      
      // Ajout du joueur à la liste des joueurs
      this.players.set(sessionId, sprite);
      
      // Si c'est le joueur actuel
      if (sessionId === this.room?.sessionId) {
        this.currentPlayer = sprite;
        this.cameras.main.startFollow(this.currentPlayer);
        if (this.minimap) {
          this.minimap.startFollow(this.currentPlayer);
        }
        
        // Initialiser les munitions (pas d'arme au début)
        this.initializeAmmo('');
        
        // Ne plus utiliser les animations qui causent le problème
        // sprite.anims.play('player_idle', true);
      }
      
      // Mise à jour de la position du joueur lorsqu'elle change
      player.onChange(() => {
        // Pour les autres joueurs, mettre à jour directement la position
        if (sessionId !== this.room?.sessionId) {
          sprite.setPosition(player.x, player.y);
          sprite.setRotation(player.rotation);
          
          // Ne plus utiliser les animations qui causent le problème
          // const isMoving = sprite.x !== player.x || sprite.y !== player.y;
          // if (isMoving && sprite.anims) {
          //   sprite.anims.play('player_walk', true);
          // } else if (sprite.anims) {
          //   sprite.anims.play('player_idle', true);
          // }
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
          // Ne plus utiliser les animations qui causent le problème
          // sprite.anims.stop();
        }
      });
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
      console.log(`Arme ${weaponId} ajoutée`);
      
      // Création du sprite de l'arme
      const sprite = this.physics.add.sprite(weapon.x, weapon.y, weapon.type);
      
      // Ajout d'un effet de flottement
      this.tweens.add({
        targets: sprite,
        y: sprite.y - 10,
        duration: 1000,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1
      });
      
      // Ajout de l'arme à la liste des armes
      this.weapons.set(weaponId, sprite);
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
      console.log(`Balle ${bulletId} ajoutée`);
      
      // Création du sprite de la balle
      const sprite = this.physics.add.sprite(bullet.x, bullet.y, 'bullet');
      sprite.setRotation(bullet.rotation);
      
      // Ajout d'un effet de particules
      this.addBulletTrail(sprite);
      
      // Ajout de la balle à la liste des balles
      this.bullets.set(bulletId, sprite);
      
      // Mise à jour de la position de la balle lorsqu'elle change
      bullet.onChange(() => {
        sprite.setPosition(bullet.x, bullet.y);
        sprite.setRotation(bullet.rotation);
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
        const eliminationText = this.add.text(this.cameras.main.width/2, this.cameras.main.height/2, messageText, {
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
          const finPartieText = this.add.text(this.cameras.main.width/2, this.cameras.main.height/2, 'FIN DE LA PARTIE', {
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
        const victoryText = this.add.text(this.cameras.main.width/2, this.cameras.main.height/2, 'VICTOIRE', {
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
    
    this.room.onMessage("zoneTimer", (message: { nextShrinkTime: number }) => {
      console.log(`Message zoneTimer reçu:`, message);
      
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
    
    // Gestion des messages du serveur
    this.room.onMessage("ammoUpdate", (message: { playerId: string, ammo: number }) => {
      if (message.playerId === this.room?.sessionId) {
        this.updateAmmoDisplay(message.ammo);
      }
    });
    
    this.room.onMessage("reloadStart", (message: { playerId: string, reloadTime: number }) => {
      if (message.playerId === this.room?.sessionId) {
        this.showReloadingMessage(message.reloadTime);
      }
    });
    
    this.room.onMessage("reloadEnd", (message: { playerId: string }) => {
      if (message.playerId === this.room?.sessionId) {
        this.hideReloadingMessage();
      }
    });
    
    // Mise à jour initiale du nombre de joueurs en vie
    this.updatePlayersAlive();
  }

  private createUI() {
    // Calculer les dimensions en fonction de la taille de l'écran
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    // Dimensions des boîtes d'information (plus petite)
    const infoBoxWidth = Math.min(200, width * 0.2);
    const infoBoxHeight = Math.min(100, height * 0.15);
    const infoBoxX = 10;
    const infoBoxY = height - infoBoxHeight - 60; // Remonter davantage
    
    // Dimensions de la boîte de timer
    const timerBoxWidth = Math.min(200, width * 0.2);
    const timerBoxHeight = Math.min(50, height * 0.07);
    const timerBoxX = width - timerBoxWidth - 10;
    const timerBoxY = 10;
    
    // Taille de la police
    const fontSize = Math.max(12, Math.min(16, width * 0.015));
    const timerFontSize = Math.max(20, Math.min(32, width * 0.025));
    
    // Espacement
    const padding = 10;
    
    // Création de la boîte d'information
    const infoBox = this.add.graphics();
    infoBox.fillStyle(0x000000, 0.7);
    infoBox.lineStyle(2, 0xffffff, 1);
    infoBox.fillRoundedRect(infoBoxX, infoBoxY, infoBoxWidth, infoBoxHeight, 10);
    infoBox.strokeRoundedRect(infoBoxX, infoBoxY, infoBoxWidth, infoBoxHeight, 10);
    infoBox.setScrollFactor(0);
    infoBox.setDepth(100);
    
    // Création de la boîte de timer
    const timerBox = this.add.graphics();
    timerBox.fillStyle(0x000000, 0.7);
    timerBox.lineStyle(2, 0xffffff, 1);
    timerBox.fillRoundedRect(timerBoxX, timerBoxY, timerBoxWidth, timerBoxHeight, 10);
    timerBox.strokeRoundedRect(timerBoxX, timerBoxY, timerBoxWidth, timerBoxHeight, 10);
    timerBox.setScrollFactor(0);
    timerBox.setDepth(100);
    
    // Création de la barre de vie
    this.healthBar = this.add.graphics();
    this.healthBar.setScrollFactor(0);
    this.healthBar.setDepth(100);
    
    // Texte pour la vie
    this.healthText = this.add.text(infoBoxX + padding, infoBoxY + padding, 'Vie: 100', {
      fontFamily: 'Arial',
      fontSize: `${fontSize}px`,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4
    });
    this.healthText.setScrollFactor(0);
    this.healthText.setDepth(100);
    
    // Texte pour le nombre de joueurs restants
    this.playersAliveText = this.add.text(infoBoxX + padding, infoBoxY + padding + fontSize + 5, 'Joueurs: 0', {
      fontFamily: 'Arial',
      fontSize: `${fontSize}px`,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4
    });
    this.playersAliveText.setScrollFactor(0);
    this.playersAliveText.setDepth(100);
    
    // Texte pour l'arme équipée
    this.weaponText = this.add.text(infoBoxX + padding, infoBoxY + padding + (fontSize * 2) + 10, 'Arme: Aucune', {
      fontFamily: 'Arial',
      fontSize: `${fontSize}px`,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4
    });
    this.weaponText.setScrollFactor(0);
    this.weaponText.setDepth(100);
    
    // Texte pour le timer de la zone
    this.zoneTimerText = this.add.text(timerBoxX + timerBoxWidth - padding, timerBoxY + timerBoxHeight/2, 'Zone: 30s', {
      fontFamily: 'Arial',
      fontSize: `${timerFontSize}px`,
      color: '#ffff00',
      stroke: '#000000',
      strokeThickness: 4
    });
    this.zoneTimerText.setOrigin(1, 0.5);
    this.zoneTimerText.setScrollFactor(0);
    this.zoneTimerText.setDepth(100);
    
    // Création du fond pour les munitions
    this.ammoBackground = this.add.graphics();
    this.ammoBackground.fillStyle(0x000000, 0.7);
    this.ammoBackground.lineStyle(2, 0xffffff, 1);
    this.ammoBackground.fillRoundedRect(width - 200, height - 70, 190, 40, 10);
    this.ammoBackground.strokeRoundedRect(width - 200, height - 70, 190, 40, 10);
    this.ammoBackground.setScrollFactor(0);
    this.ammoBackground.setDepth(100);
    
    // Création du texte pour les munitions
    this.ammoText = this.add.text(width - 105, height - 50, "Pas d'arme", {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4
    });
    this.ammoText.setOrigin(0.5);
    this.ammoText.setScrollFactor(0);
    this.ammoText.setDepth(100);
    
    // Création du texte pour le rechargement
    this.reloadingText = this.add.text(width / 2, height - 100, 'RECHARGEMENT...', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#ffff00',
      stroke: '#000000',
      strokeThickness: 4
    });
    this.reloadingText.setOrigin(0.5);
    this.reloadingText.setScrollFactor(0);
    this.reloadingText.setDepth(100);
    this.reloadingText.setVisible(false);
    
    // Mise à jour de la barre de vie
    this.updateHealthBar(100);
    
    // Mise à jour initiale du nombre de joueurs
    this.updatePlayersAlive();
    
    // Ajout d'un événement de redimensionnement pour adapter l'UI
    this.scale.on('resize', this.resizeUI, this);
  }
  
  private resizeUI() {
    // Nettoyer les graphiques existants
    this.healthBar.clear();
    
    // Récupérer les nouvelles dimensions
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    // Recalculer les dimensions des boîtes d'information
    const infoBoxWidth = Math.min(200, width * 0.2);
    const infoBoxHeight = Math.min(100, height * 0.15);
    const infoBoxX = 10;
    const infoBoxY = height - infoBoxHeight - 60;
    
    // Recalculer les dimensions de la boîte de timer
    const timerBoxWidth = Math.min(200, width * 0.2);
    const timerBoxHeight = Math.min(50, height * 0.07);
    const timerBoxX = width - timerBoxWidth - 10;
    const timerBoxY = 10;
    
    // Recalculer la taille de la police
    const fontSize = Math.max(12, Math.min(16, width * 0.015));
    const timerFontSize = Math.max(20, Math.min(32, width * 0.025));
    
    // Espacement
    const padding = 10;
    
    // Mise à jour de la position et de la taille des textes
    if (this.healthText) {
      this.healthText.setPosition(infoBoxX + padding, infoBoxY + padding);
      this.healthText.setFontSize(fontSize);
    }
    
    if (this.playersAliveText) {
      this.playersAliveText.setPosition(infoBoxX + padding, infoBoxY + padding + fontSize + 5);
      this.playersAliveText.setFontSize(fontSize);
    }
    
    if (this.weaponText) {
      this.weaponText.setPosition(infoBoxX + padding, infoBoxY + padding + (fontSize * 2) + 10);
      this.weaponText.setFontSize(fontSize);
    }
    
    if (this.zoneTimerText) {
      this.zoneTimerText.setPosition(timerBoxX + timerBoxWidth - padding, timerBoxY + timerBoxHeight/2);
      this.zoneTimerText.setFontSize(timerFontSize);
      this.zoneTimerText.setOrigin(1, 0.5);
    }
    
    // Mise à jour de la position du texte des munitions et de son fond
    if (this.ammoText && this.ammoBackground) {
      this.ammoBackground.clear();
      this.ammoBackground.fillStyle(0x000000, 0.7);
      this.ammoBackground.lineStyle(2, 0xffffff, 1);
      this.ammoBackground.fillRoundedRect(width - 200, height - 70, 190, 40, 10);
      this.ammoBackground.strokeRoundedRect(width - 200, height - 70, 190, 40, 10);
      this.ammoText.setPosition(width - 105, height - 50);
    }
    
    // Mise à jour de la position du texte de rechargement
    if (this.reloadingText) {
      this.reloadingText.setPosition(width / 2, height - 100);
    }
    
    // Redessiner la barre de vie
    if (this.healthBar && this.healthText) {
      this.updateHealthBar(parseInt(this.healthText.text.split(': ')[1]));
    }
    
    // Redimensionner et repositionner la minimap
    if (this.minimap) {
      const minimapSize = Math.min(width, height) * 0.22;
      const minimapPadding = 15;
      
      // Mettre à jour la minimap
      this.minimap.setSize(minimapSize, minimapSize);
      this.minimap.setPosition(minimapPadding, minimapPadding);
      
      // Mettre à jour le contour de la minimap
      if (this.minimapBorder) {
        this.minimapBorder.clear();
        this.minimapBorder.lineStyle(3, 0xFFFFFF, 1);
        this.minimapBorder.strokeRect(minimapPadding, minimapPadding, minimapSize, minimapSize);
      }
      
      // S'assurer que les éléments sont ignorés par la minimap
      this.minimap.ignore(this.minimapBorder);
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
    if (!this.safeZone) return;
    
    this.safeZone.clear();
    
    // Dessiner un cercle rempli semi-transparent pour la zone sûre
    this.safeZone.fillStyle(0x00ffff, 0.1);
    this.safeZone.fillCircle(x, y, radius);
    
    // Dessiner le contour de la zone sûre
    this.safeZone.lineStyle(3, 0x00ffff, 1);
    this.safeZone.strokeCircle(x, y, radius);
  }

  // Dessiner la zone sûre sur la minimap
  private drawMinimapSafeZone(x: number, y: number, radius: number) {
    if (!this.minimapSafeZone) return;
    
    this.minimapSafeZone.clear();
    
    // Dessiner le contour de la zone sûre sur la minimap
    this.minimapSafeZone.lineStyle(2, 0x00ffff, 1);
    this.minimapSafeZone.strokeCircle(x, y, radius);
  }

  // Création des animations pour les personnages
  private createAnimations() {
    // Au lieu d'utiliser des animations basées sur des spritesheets,
    // nous allons simplement définir des textures statiques
    
    // Nous n'utiliserons pas ces animations pour le moment
    // car elles causent le problème de changement de skin
    /*
    this.anims.create({
      key: 'player_walk',
      frames: this.anims.generateFrameNumbers('characters', { start: 0, end: 3 }),
      frameRate: 8,
      repeat: -1
    });
    
    this.anims.create({
      key: 'player_idle',
      frames: this.anims.generateFrameNumbers('characters', { start: 0, end: 0 }),
      frameRate: 1,
      repeat: -1
    });
    */
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
    if (!this.zoneTimerText) return;
    
    // Vérifier que nextShrinkTime est un nombre valide
    if (isNaN(this.nextShrinkTime) || this.nextShrinkTime === undefined) {
      console.error("nextShrinkTime n'est pas un nombre valide:", this.nextShrinkTime);
      this.nextShrinkTime = 30; // Valeur par défaut
    }
    
    // Formater le temps restant
    const minutes = Math.floor(this.nextShrinkTime / 60);
    const seconds = Math.floor(this.nextShrinkTime % 60);
    const timeString = `${minutes > 0 ? minutes + 'm ' : ''}${seconds}s`;
    
    // Changer la couleur en fonction du temps restant
    let color = '#00ffff';
    if (this.nextShrinkTime <= 10) {
      color = '#ff0000';
      
      // Effet de pulsation pour les 10 dernières secondes
      if (!this.tweens.isTweening(this.zoneTimerText)) {
        this.tweens.add({
          targets: this.zoneTimerText,
          scale: { from: 1, to: 1.2 },
          duration: 500,
          ease: 'Sine.easeInOut',
          yoyo: true,
          repeat: -1
        });
      }
    } else if (this.nextShrinkTime <= 20) {
      color = '#ffff00';
      
      // Arrêter l'effet de pulsation si on n'est plus dans les 10 dernières secondes
      if (this.tweens.isTweening(this.zoneTimerText)) {
        this.tweens.killTweensOf(this.zoneTimerText);
        this.zoneTimerText.setScale(1);
      }
    } else {
      // Arrêter l'effet de pulsation si on n'est plus dans les 10 dernières secondes
      if (this.tweens.isTweening(this.zoneTimerText)) {
        this.tweens.killTweensOf(this.zoneTimerText);
        this.zoneTimerText.setScale(1);
      }
    }
    
    // Mise à jour du texte
    this.zoneTimerText.setText(`Zone: ${timeString}`);
    this.zoneTimerText.setColor(color);
  }

  // Méthode mise à jour pour afficher les munitions et les chargeurs
  private updateAmmoDisplay(ammo: number) {
    if (this.ammoText) {
      if (this.maxAmmo > 0) {
        // Format: "Munitions: 9/9 (1)" où le dernier chiffre est le nombre de chargeurs restants
        this.ammoText.setText(`Munitions: ${ammo}/${this.maxAmmo} (${this.magazineCount})`);
        
        // Changer la couleur en fonction du nombre de munitions
        if (ammo === 0) {
          this.ammoText.setColor('#ff0000'); // Rouge si plus de munitions
        } else if (ammo <= Math.ceil(this.maxAmmo / 3)) {
          this.ammoText.setColor('#ffff00'); // Jaune si peu de munitions
        } else {
          this.ammoText.setColor('#ffffff'); // Blanc par défaut
        }
      } else {
        this.ammoText.setText("Pas d'arme");
        this.ammoText.setColor('#ffffff');
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
    // Définir les munitions en fonction du type d'arme
    if (weaponType === 'pistol') {
      this.maxAmmo = 9;
      this.currentAmmo = this.maxAmmo;
      this.magazineCount = this.maxMagazineCount - 1; // Un chargeur déjà utilisé
    } else if (weaponType === 'rifle') {
      this.maxAmmo = 30;
      this.currentAmmo = this.maxAmmo;
      this.magazineCount = this.maxMagazineCount - 1; // Un chargeur déjà utilisé
    } else if (weaponType === 'shotgun') {
      this.maxAmmo = 6;
      this.currentAmmo = this.maxAmmo;
      this.magazineCount = this.maxMagazineCount - 1; // Un chargeur déjà utilisé
    } else {
      // Pas d'arme
      this.maxAmmo = 0;
      this.currentAmmo = 0;
      this.magazineCount = 0;
    }
    
    // Mettre à jour l'affichage des munitions
    this.updateAmmoDisplay(this.currentAmmo);
  }
  
  // Méthode pour gérer le tir et la consommation de munitions
  private handleShooting() {
    if (this.currentAmmo > 0) {
      // Consommer une munition
      this.currentAmmo--;
      
      // Mettre à jour l'affichage
      this.updateAmmoDisplay(this.currentAmmo);
      
      // Envoyer le message de tir au serveur avec la rotation actuelle
      if (this.room) {
        const angle = this.currentPlayer.rotation;
        this.room.send('shoot', { rotation: angle });
      }
    } else if (this.magazineCount > 0) {
      // Recharger automatiquement si on a encore des chargeurs
      this.reloadWeapon();
    } else {
      // Plus de munitions, changer l'apparence du joueur
      if (this.currentPlayer) {
        this.currentPlayer.setTexture('player_hold');
      }
      
      // Afficher un message "Plus de munitions"
      if (this.ammoText) {
        this.ammoText.setText("Plus de munitions");
      }
    }
  }
  
  // Méthode pour recharger l'arme
  private reloadWeapon() {
    if (this.magazineCount > 0 && this.currentAmmo < this.maxAmmo) {
      // Afficher le message de rechargement
      this.showReloadingMessage(1000); // 1 seconde pour recharger
      
      // Simuler le temps de rechargement
      this.time.delayedCall(1000, () => {
        // Consommer un chargeur
        this.magazineCount--;
        
        // Remplir les munitions
        this.currentAmmo = this.maxAmmo;
        
        // Mettre à jour l'affichage
        this.updateAmmoDisplay(this.currentAmmo);
        
        // Cacher le message de rechargement
        this.hideReloadingMessage();
      });
    }
  }
} 