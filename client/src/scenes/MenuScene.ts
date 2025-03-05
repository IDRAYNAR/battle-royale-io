import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
  private gradientBg: Phaser.GameObjects.Graphics | null = null;
  private glowEffect: Phaser.GameObjects.Graphics | null = null;
  private glowTween: Phaser.Tweens.Tween | null = null;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    // Récupération des dimensions de l'écran
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    // Création d'un fond avec dégradé moderne inspiré de NextJS
    this.createModernBackground(width, height);
    
    // Panneau principal avec bordure moderne
    const panelWidth = Math.min(width * 0.85, 800);
    const panelHeight = Math.min(height * 0.85, 700);
    const panelX = width/2 - panelWidth/2;
    const panelY = height/2 - panelHeight/2;
    
    // Panneau principal avec effet glassmorphism
    const menuPanel = this.add.graphics();
    // Fond semi-transparent
    menuPanel.fillStyle(0x091114, 0.7);
    menuPanel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 24);
    
    // Bordure subtile
    menuPanel.lineStyle(2, 0xffffff, 0.1);
    menuPanel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 24);
    
    // Titre avec typographie moderne
    const titleSize = Math.min(64, width * 0.09);
    const title = this.add.text(width/2, panelY + panelHeight * 0.2, 'BATTLE ROYALE 2D', {
      fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
      fontSize: `${titleSize}px`,
      color: '#ffffff',
      fontStyle: 'bold',
      shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 3, fill: true }
    }).setOrigin(0.5);
    
    // Animation subtile du titre
    this.tweens.add({
      targets: title,
      alpha: { from: 0.9, to: 1 },
      duration: 2000,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });
    
    // Sous-titre élégant
    const subtitleSize = Math.min(24, width * 0.035);
    this.add.text(width/2, panelY + panelHeight * 0.32, 'Le dernier survivant remporte la partie !', {
      fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
      fontSize: `${subtitleSize}px`,
      color: '#ffffff',
      fontStyle: 'normal'
    }).setOrigin(0.5).setAlpha(0.8);
    
    // Bouton de démarrage moderne avec effet de surbrillance
    const buttonY = panelY + panelHeight * 0.48;
    const buttonWidth = Math.min(250, panelWidth * 0.4);
    const buttonHeight = Math.min(70, panelHeight * 0.09);
    
    // Fond du bouton avec effet glassmorphism
    const playButton = this.add.graphics();
    playButton.fillStyle(0x13674c, 0.8);
    playButton.fillRoundedRect(width/2 - buttonWidth/2, buttonY, buttonWidth, buttonHeight, 12);
    
    // Bordure du bouton
    playButton.lineStyle(1.5, 0x5effc3, 0.3);
    playButton.strokeRoundedRect(width/2 - buttonWidth/2, buttonY, buttonWidth, buttonHeight, 12);
    
    // Zone interactive pour le bouton
    const buttonZone = this.add.zone(width/2, buttonY + buttonHeight/2, buttonWidth, buttonHeight).setInteractive();
    
    // Texte du bouton
    const buttonTextSize = Math.min(28, width * 0.04);
    const playText = this.add.text(width/2, buttonY + buttonHeight/2, 'JOUER', {
      fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
      fontSize: `${buttonTextSize}px`,
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    // Effet de hover
    buttonZone.on('pointerover', () => {
      playButton.clear();
      // Couleur du bouton en survol
      playButton.fillStyle(0x1d936c, 0.9);
      playButton.fillRoundedRect(width/2 - buttonWidth/2, buttonY, buttonWidth, buttonHeight, 12);
      playButton.lineStyle(2, 0x7dffd8, 0.5);
      playButton.strokeRoundedRect(width/2 - buttonWidth/2, buttonY, buttonWidth, buttonHeight, 12);
      
      playText.setScale(1.03);
    });
    
    buttonZone.on('pointerout', () => {
      playButton.clear();
      // Retour à la couleur normale
      playButton.fillStyle(0x13674c, 0.8);
      playButton.fillRoundedRect(width/2 - buttonWidth/2, buttonY, buttonWidth, buttonHeight, 12);
      playButton.lineStyle(1.5, 0x5effc3, 0.3);
      playButton.strokeRoundedRect(width/2 - buttonWidth/2, buttonY, buttonWidth, buttonHeight, 12);
      
      playText.setScale(1);
    });
    
    // Effet de clic
    buttonZone.on('pointerdown', () => {
      // Animation de pression
      playButton.clear();
      playButton.fillStyle(0x0f4e3a, 1);
      playButton.fillRoundedRect(width/2 - buttonWidth/2, buttonY, buttonWidth, buttonHeight, 12);
      playButton.lineStyle(1, 0x5effc3, 0.2);
      playButton.strokeRoundedRect(width/2 - buttonWidth/2, buttonY, buttonWidth, buttonHeight, 12);
      
      playText.setY(buttonY + buttonHeight/2 + 2);
      
      // Effet de flash
      this.cameras.main.flash(300, 255, 255, 255, true);
      
      // Son de clic (si disponible)
      if (this.sound.get('click')) {
        this.sound.play('click');
      }
      
      // Transition vers la scène de jeu après un court délai
      this.time.delayedCall(500, () => {
        this.scene.start('GameScene');
      });
    });
    
    // Panneau d'instructions avec design moderne
    const instructionsY = panelY + panelHeight * 0.65;
    const instrHeight = panelHeight * 0.28;
    const instrWidth = panelWidth * 0.85;
    const instrX = width/2 - instrWidth/2;
    
    // Création d'un conteneur pour les instructions avec effet glassmorphism
    const instructionsPanel = this.add.graphics();
    instructionsPanel.fillStyle(0xffffff, 0.05);
    instructionsPanel.fillRoundedRect(instrX, instructionsY, instrWidth, instrHeight, 16);
    instructionsPanel.lineStyle(1, 0xffffff, 0.1);
    instructionsPanel.strokeRoundedRect(instrX, instructionsY, instrWidth, instrHeight, 16);
    
    // Titre des instructions
    const instrTitleSize = Math.min(22, width * 0.032);
    this.add.text(width/2, instructionsY + 20, 'Comment jouer :', {
      fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
      fontSize: `${instrTitleSize}px`,
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setAlpha(0.9);
    
    // Instructions avec icônes modernes
    const instructions = [
      { text: 'Utilisez les touches ZQSD pour vous déplacer', icon: '⌨️' },
      { text: 'Cliquez pour tirer', icon: '🖱️' },
      { text: 'Ramassez des armes pour augmenter votre puissance', icon: '🔫' },
      { text: 'Restez dans la zone sûre pour survivre', icon: '🛡️' }
    ];
    
    const instrTextSize = Math.min(16, width * 0.024);
    const iconSize = Math.min(20, width * 0.03);
    const lineHeight = instrHeight / 6;
    
    instructions.forEach((instruction, index) => {
      const y = instructionsY + 60 + (index * lineHeight);
      
      // Icône
      this.add.text(instrX + 25, y, instruction.icon, {
        fontSize: `${iconSize}px`
      }).setOrigin(0.5);
      
      // Texte
      this.add.text(instrX + 50, y, instruction.text, {
        fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
        fontSize: `${instrTextSize}px`,
        color: '#ffffff'
      }).setOrigin(0, 0.5).setAlpha(0.85);
    });
    
    // Ajout d'un écouteur pour le redimensionnement
    this.scale.on('resize', this.resize, this);
  }
  
  // Création d'un fond avec dégradé moderne inspiré de NextJS
  private createModernBackground(width: number, height: number) {
    // Nettoyer les graphiques existants
    if (this.gradientBg) {
      this.gradientBg.destroy();
    }
    
    if (this.glowEffect) {
      this.glowEffect.destroy();
    }
    
    // Fond de base
    this.gradientBg = this.add.graphics();
    this.gradientBg.fillStyle(0x0a1b1a, 1);
    this.gradientBg.fillRect(0, 0, width, height);
    
    // Effet de lueur 1 - cercle rose/violet
    const glow1 = this.add.graphics();
    glow1.fillStyle(0xd946ef, 0.2); // Rose/violet
    glow1.fillCircle(width * 0.8, height * 0.2, Math.min(width, height) * 0.4);
    glow1.fillStyle(0x6366f1, 0.15); // Indigo
    glow1.fillCircle(width * 0.2, height * 0.7, Math.min(width, height) * 0.3);
    
    // Simuler un effet de flou avec une opacité réduite
    glow1.alpha = 0.5;
    
    // Effet de lueur animée (forme qui bouge lentement)
    this.glowEffect = this.add.graphics();
    this.glowEffect.fillStyle(0x10b981, 0.1); // Vert menthe
    this.glowEffect.fillCircle(width * 0.5, height * 0.5, 200);
    
    // Animation subtile de l'effet de lueur
    this.glowTween = this.tweens.add({
      targets: this.glowEffect,
      x: { from: -100, to: 100 },
      y: { from: -50, to: 50 },
      duration: 15000,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });
  }
  
  update() {
    // Aucune animation spécifique requise dans cette version épurée
  }
  
  resize(gameSize: { width: number; height: number }) {
    // Récupération des nouvelles dimensions
    const width = gameSize.width;
    const height = gameSize.height;
    
    // Mise à jour de la caméra
    this.cameras.main.setSize(width, height);
    
    // Recréer le fond pour s'adapter à la nouvelle taille
    this.createModernBackground(width, height);
    
    // Recréer la scène pour adapter tous les éléments
    this.scene.restart();
  }
}