import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Gestion des erreurs de chargement
    this.load.on('loaderror', (fileObj: any) => {
      console.warn('Erreur de chargement pour:', fileObj.key);
      this.createPlaceholderAsset(fileObj.key);
    });

    // Chargement des assets du pack Kenney
    this.load.image('background', 'assets/PNG/Tiles/tile_01.png'); // Utilisé comme tuile de fond
    
    // Personnages
    this.load.image('player', 'assets/PNG/Characters/ManBlue/manBlue_gun.png');
    this.load.image('player_gun', 'assets/PNG/Characters/ManBlue/manBlue_gun.png');
    this.load.image('player_machine', 'assets/PNG/Characters/ManBlue/manBlue_machine.png');
    this.load.image('player_silencer', 'assets/PNG/Characters/ManBlue/manBlue_silencer.png');
    this.load.image('player_hold', 'assets/PNG/Characters/ManBlue/manBlue_hold.png');
    this.load.image('enemy', 'assets/PNG/Characters/ManBrown/manBrown_gun.png');
    
    // Armes
    this.load.image('pistol', 'assets/PNG/weapon_gun.png');
    this.load.image('shotgun', 'assets/PNG/weapon_machine.png');
    this.load.image('rifle', 'assets/PNG/weapon_silencer.png');
    
    // Balle
    this.load.image('bullet', 'assets/PNG/Tiles/tile_187.png'); // Utiliser une tuile comme balle temporaire
    
    // Interface utilisateur
    this.load.image('button', 'assets/PNG/UI/button_rectangle_depth_flat.png');
    
    // Récupération des dimensions de l'écran
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    // Création d'un fond de chargement
    const loadingBg = this.add.graphics();
    loadingBg.fillStyle(0x000000, 0.5);
    loadingBg.fillRect(0, 0, width, height);
    
    // Création d'une barre de progression
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    
    // Dimensions et position de la barre de progression
    const barWidth = Math.min(width * 0.7, 600);
    const barHeight = Math.min(height * 0.05, 30);
    const barX = width / 2 - barWidth / 2;
    const barY = height / 2 - barHeight / 2;
    
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRoundedRect(barX, barY, barWidth, barHeight, 10);
    
    // Texte de chargement
    const fontSize = Math.min(24, width * 0.04);
    const loadingText = this.add.text(width / 2, barY - 30, 'Chargement...', {
      fontFamily: 'Arial',
      fontSize: `${fontSize}px`,
      color: '#ffffff'
    }).setOrigin(0.5);
    
    // Texte de pourcentage
    const percentText = this.add.text(width / 2, barY + barHeight + 20, '0%', {
      fontFamily: 'Arial',
      fontSize: `${fontSize}px`,
      color: '#ffffff'
    }).setOrigin(0.5);
    
    // Mise à jour de la barre de progression
    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0x00ff00, 1);
      progressBar.fillRoundedRect(barX + 10, barY + 5, (barWidth - 20) * value, barHeight - 10, 5);
      percentText.setText(`${Math.floor(value * 100)}%`);
    });
    
    // Nettoyage après le chargement
    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
      percentText.destroy();
    });
  }

  create() {
    // Création d'assets par défaut si nécessaire
    this.createDefaultAssetsIfNeeded();
    
    // Passage à la scène du menu
    this.scene.start('MenuScene');
    
    // Ajout d'un écouteur pour le redimensionnement
    this.scale.on('resize', this.resize, this);
  }
  
  resize(gameSize: { width: number; height: number }) {
    // Récupération des nouvelles dimensions
    const width = gameSize.width;
    const height = gameSize.height;
    
    // Mise à jour de la caméra
    this.cameras.main.setSize(width, height);
  }

  // Création d'un asset placeholder en cas d'erreur de chargement
  private createPlaceholderAsset(key: string) {
    console.log(`Création d'un asset placeholder pour: ${key}`);
    
    const graphics = this.make.graphics({ x: 0, y: 0 });
    
    // Différentes couleurs selon le type d'asset
    let color = 0xffffff;
    let size = { width: 64, height: 64 };
    
    if (key === 'background') {
      color = 0x00aa00; // Vert pour le fond
      size = { width: 64, height: 64 };
    } else if (key === 'player') {
      color = 0x0000ff; // Bleu pour le joueur
      size = { width: 40, height: 40 };
    } else if (key === 'enemy') {
      color = 0xaa0000; // Rouge pour l'ennemi
      size = { width: 40, height: 40 };
    } else if (key === 'bullet') {
      color = 0xffff00; // Jaune pour les balles
      size = { width: 10, height: 10 };
    } else if (key.includes('weapon') || key.includes('pistol') || key.includes('rifle') || key.includes('shotgun')) {
      color = 0xaaaaaa; // Gris pour les armes
      size = { width: 30, height: 20 };
    } else if (key === 'safeZone') {
      color = 0x00ffff; // Cyan pour la zone sûre
      size = { width: 100, height: 100 };
    } else if (key === 'button') {
      color = 0x555555; // Gris foncé pour les boutons
      size = { width: 200, height: 50 };
    } else if (key === 'healthBar') {
      color = 0x00ff00; // Vert pour la barre de vie
      size = { width: 200, height: 20 };
    }
    
    // Dessin du placeholder
    graphics.fillStyle(color, 1);
    
    if (key === 'safeZone') {
      // Zone sûre: cercle avec bordure
      graphics.lineStyle(2, 0xffffff, 1);
      graphics.strokeCircle(size.width / 2, size.height / 2, size.width / 2);
      graphics.fillCircle(size.width / 2, size.height / 2, size.width / 2);
    } else if (key === 'bullet') {
      // Balle: petit cercle
      graphics.fillCircle(size.width / 2, size.height / 2, size.width / 2);
    } else if (key === 'player' || key === 'enemy') {
      // Joueur/ennemi: cercle
      graphics.fillCircle(size.width / 2, size.height / 2, size.width / 2);
    } else if (key === 'button') {
      // Bouton: rectangle arrondi
      graphics.fillRoundedRect(0, 0, size.width, size.height, 10);
    } else if (key === 'healthBar') {
      // Barre de vie: rectangle
      graphics.fillRect(0, 0, size.width, size.height);
    } else {
      // Par défaut: rectangle
      graphics.fillRect(0, 0, size.width, size.height);
    }
    
    // Génération de la texture
    graphics.generateTexture(key, size.width, size.height);
    graphics.destroy();
  }

  // Vérification et création d'assets par défaut si nécessaire
  private createDefaultAssetsIfNeeded() {
    const requiredAssets = [
      'background', 'player', 'player_gun', 'player_machine', 'player_silencer', 'player_hold',
      'enemy', 'bullet', 'pistol', 'rifle', 'shotgun', 'safeZone',
      'button', 'healthBar'
      // 'characters', 'tiles' // Commenté car nous n'utilisons plus ces spritesheets
    ];
    
    requiredAssets.forEach(key => {
      if (!this.textures.exists(key)) {
        console.warn(`Asset manquant: ${key}, création d'un placeholder`);
        this.createPlaceholderAsset(key);
      }
    });
  }
} 