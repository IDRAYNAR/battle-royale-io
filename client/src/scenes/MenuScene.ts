import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    // Récupération des dimensions de l'écran
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    // Création d'un fond avec des tuiles
    const backgroundTile = this.textures.get('background');
    const tileWidth = backgroundTile.getSourceImage().width;
    const tileHeight = backgroundTile.getSourceImage().height;
    
    // Couvrir toute la zone visible avec des tuiles de fond
    for (let x = 0; x < 2000; x += tileWidth) {
      for (let y = 0; y < 2000; y += tileHeight) {
        this.add.image(x, y, 'background').setOrigin(0, 0);
      }
    }
    
    // Ajout d'un panneau semi-transparent pour le menu (centré et adapté à la taille de l'écran)
    const menuPanel = this.add.graphics();
    menuPanel.fillStyle(0x000000, 0.7);
    const panelWidth = Math.min(width * 0.8, 800);
    const panelHeight = Math.min(height * 0.8, 600);
    menuPanel.fillRoundedRect(width/2 - panelWidth/2, height/2 - panelHeight/2, panelWidth, panelHeight, 20);
    
    // Titre du jeu avec effet d'ombre
    const titleSize = Math.min(48, width * 0.08);
    const title = this.add.text(width/2, height * 0.15, 'BATTLE ROYALE 2D', {
      fontFamily: 'Arial Black',
      fontSize: `${titleSize}px`,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 6
    }).setOrigin(0.5);
    
    // Animation du titre
    this.tweens.add({
      targets: title,
      scale: { from: 0.9, to: 1.1 },
      duration: 1500,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });
    
    // Sous-titre
    const subtitleSize = Math.min(24, width * 0.04);
    this.add.text(width/2, height * 0.25, 'Le dernier survivant remporte la partie !', {
      fontFamily: 'Arial',
      fontSize: `${subtitleSize}px`,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);
    
    // Bouton de démarrage
    const buttonScale = Math.min(1.5, width * 0.003);
    const startButton = this.add.image(width/2, height * 0.4, 'button').setInteractive();
    startButton.setScale(buttonScale, buttonScale * 0.67);
    
    // Texte du bouton
    const buttonTextSize = Math.min(32, width * 0.05);
    const startText = this.add.text(width/2, height * 0.4, 'JOUER', {
      fontFamily: 'Arial Black',
      fontSize: `${buttonTextSize}px`,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);
    
    // Effet de survol
    startButton.on('pointerover', () => {
      startButton.setTint(0xffff00);
      startText.setScale(1.1);
    });
    
    startButton.on('pointerout', () => {
      startButton.clearTint();
      startText.setScale(1);
    });
    
    // Démarrage du jeu au clic
    startButton.on('pointerdown', () => {
      // Effet de flash
      this.cameras.main.flash(500, 255, 255, 255);
      
      // Son de clic (si disponible)
      if (this.sound.get('click')) {
        this.sound.play('click');
      }
      
      // Transition vers la scène de jeu après un court délai
      this.time.delayedCall(500, () => {
        this.scene.start('GameScene');
      });
    });
    
    // Ajout d'un cadre pour les instructions
    const instructionsPanel = this.add.graphics();
    instructionsPanel.fillStyle(0x333333, 0.8);
    const instrWidth = panelWidth * 0.8;
    const instrHeight = panelHeight * 0.35;
    const instrX = width/2 - instrWidth/2;
    const instrY = height * 0.55;
    instructionsPanel.fillRoundedRect(instrX, instrY, instrWidth, instrHeight, 10);
    instructionsPanel.lineStyle(2, 0xffffff, 1);
    instructionsPanel.strokeRoundedRect(instrX, instrY, instrWidth, instrHeight, 10);
    
    // Titre des instructions
    const instrTitleSize = Math.min(24, width * 0.04);
    this.add.text(width/2, instrY + 20, 'Comment jouer :', {
      fontFamily: 'Arial',
      fontSize: `${instrTitleSize}px`,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);
    
    // Instructions avec icônes
    const instrTextSize = Math.min(18, width * 0.03);
    const bulletSize = Math.min(4, width * 0.007);
    const lineHeight = instrHeight / 6;
    
    const instructions = [
      { text: 'Utilisez les touches ZQSD pour vous déplacer' },
      { text: 'Cliquez pour tirer' },
      { text: 'Ramassez des armes pour augmenter votre puissance' },
      { text: 'Restez dans la zone sûre pour survivre' }
    ];
    
    instructions.forEach((instruction, index) => {
      // Position Y de cette instruction
      const y = instrY + 50 + (index * lineHeight);
      
      // Ajout d'un petit cercle comme puce
      const bullet = this.add.graphics();
      bullet.fillStyle(0xffff00, 1);
      bullet.fillCircle(instrX + 20, y, bulletSize);
      
      // Texte de l'instruction
      this.add.text(instrX + 30, y, instruction.text, {
        fontFamily: 'Arial',
        fontSize: `${instrTextSize}px`,
        color: '#ffffff'
      }).setOrigin(0, 0.5);
    });
    
    // Ajout d'une prévisualisation des personnages
    const playerScale = Math.min(2, width * 0.004);
    const player = this.add.image(width * 0.8, height * 0.4, 'player');
    player.setScale(playerScale);
    
    // Animation de rotation du personnage
    this.tweens.add({
      targets: player,
      angle: 360,
      duration: 5000,
      repeat: -1
    });
    
    // Ajout d'un écouteur pour le redimensionnement
    this.scale.on('resize', this.resize, this);
  }
  
  resize(gameSize: { width: number; height: number }) {
    // Récupération des nouvelles dimensions
    const width = gameSize.width;
    const height = gameSize.height;
    
    // Mise à jour de la caméra
    this.cameras.main.setSize(width, height);
    
    // Recréer la scène pour adapter tous les éléments
    this.scene.restart();
  }
}