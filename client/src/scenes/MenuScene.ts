import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
  private gradientBg: Phaser.GameObjects.Graphics | null = null;
  private glowEffect: Phaser.GameObjects.Graphics | null = null;
  private glowTween: Phaser.Tweens.Tween | null = null;
  private keyboardLayout: string = 'auto'; // Valeur par défaut: détection automatique
  private instructionTexts: Phaser.GameObjects.Text[] = []; // Pour stocker les références aux textes d'instructions

  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    // Récupération de la disposition du clavier sauvegardée
    const savedLayout = localStorage.getItem('keyboardLayout');
    if (savedLayout) {
      this.keyboardLayout = savedLayout;
    }
    
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
    
    // Titre avec typographie moderne et effet 3D
    const titleSize = Math.min(64, width * 0.09);
    const titleY = panelY + panelHeight * 0.2;
    const title = this.add.text(width/2, titleY, 'BATTLE ROYALE 2D', {
      fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
      fontSize: `${titleSize}px`,
      color: '#ffffff',
      fontStyle: 'bold',
      shadow: { offsetX: 3, offsetY: 3, color: '#000', blur: 5, fill: true }
    }).setOrigin(0.5);
    
    // Effet 3D pour le titre avec des couches
    const shadowDepth = 5;
    const shadowColor = 0x3498db; // Couleur bleue pour l'effet 3D
    
    // Créer un conteneur pour le titre et ses ombres
    const titleContainer = this.add.container(width/2, titleY);
    
    // Ajouter des couches d'ombre derrière le texte pour l'effet 3D
    const shadowTexts = [];
    for (let i = 1; i <= shadowDepth; i++) {
      const shadowText = this.add.text(
        i, 
        i, 
        'BATTLE ROYALE 2D', 
        {
          fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
          fontSize: `${titleSize}px`,
          color: `#${(shadowColor - (i * 0x0e0e0e)).toString(16)}`,
          fontStyle: 'bold'
        }
      ).setOrigin(0.5).setDepth(-i);
      
      shadowTexts.push(shadowText);
      titleContainer.add(shadowText);
    }
    
    // Ajouter le texte principal au conteneur
    titleContainer.add(title);
    title.setPosition(0, 0); // Réinitialiser la position car maintenant dans le conteneur
    
    // Animation de rebond pour le titre (effet 3D)
    this.tweens.add({
      targets: titleContainer,
      y: { from: titleY - 5, to: titleY + 5 },
      duration: 1500,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });
    
    // Effet de pulsation pour renforcer l'effet 3D
    this.tweens.add({
      targets: titleContainer,
      scale: { from: 1, to: 1.05 },
      duration: 1200,
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
    const buttonY = panelY + panelHeight * 0.45; // Légèrement remonté
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
    
    // Ajout d'un bouton pour choisir la disposition du clavier
    const keyboardButtonY = buttonY + buttonHeight + 20; // Réduit l'espace entre les boutons
    const keyboardButtonHeight = buttonHeight * 0.7; // Légèrement plus petit
    const keyboardButtonWidth = buttonWidth * 1.25; // Élargi pour contenir le texte QWERTY
    
    // Création du bouton pour la disposition du clavier
    const keyboardButton = this.add.graphics();
    keyboardButton.fillStyle(0x13674c, 0.8);
    keyboardButton.fillRoundedRect(width/2 - keyboardButtonWidth/2, keyboardButtonY, keyboardButtonWidth, keyboardButtonHeight, 12);
    
    // Ajout d'un effet de lueur subtil au bouton clavier
    const keyboardGlow = this.add.graphics();
    keyboardGlow.fillStyle(0x5effc3, 0.2);
    keyboardGlow.fillRoundedRect(
      width/2 - keyboardButtonWidth/2 - 3, 
      keyboardButtonY - 3, 
      keyboardButtonWidth + 6, 
      keyboardButtonHeight + 6, 
      14
    );
    keyboardGlow.setAlpha(0);
    
    // Animation de pulsation pour la lueur du bouton
    this.tweens.add({
      targets: keyboardGlow,
      alpha: { from: 0, to: 0.7 },
      duration: 1500,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });
    
    keyboardButton.lineStyle(1.5, 0x5effc3, 0.3);
    keyboardButton.strokeRoundedRect(width/2 - keyboardButtonWidth/2, keyboardButtonY, keyboardButtonWidth, keyboardButtonHeight, 12);
    
    const keyboardButtonZone = this.add.zone(width/2, keyboardButtonY + keyboardButtonHeight/2, keyboardButtonWidth, keyboardButtonHeight).setInteractive();
    
    // Texte du bouton qui change en fonction de la disposition actuelle
    const keyboardButtonTextSize = Math.min(20, width * 0.03);
    const keyboardText = this.add.text(width/2, keyboardButtonY + keyboardButtonHeight/2, this.getKeyboardLayoutText(), {
      fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
      fontSize: `${keyboardButtonTextSize}px`,
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    // Effet de hover
    keyboardButtonZone.on('pointerover', () => {
      keyboardButton.clear();
      // Couleur du bouton en survol
      keyboardButton.fillStyle(0x1d936c, 0.9);
      keyboardButton.fillRoundedRect(width/2 - keyboardButtonWidth/2, keyboardButtonY, keyboardButtonWidth, keyboardButtonHeight, 12);
      keyboardButton.lineStyle(2, 0x7dffd8, 0.5);
      keyboardButton.strokeRoundedRect(width/2 - keyboardButtonWidth/2, keyboardButtonY, keyboardButtonWidth, keyboardButtonHeight, 12);
      
      keyboardText.setScale(1.03);
      keyboardGlow.setAlpha(0.8);
    });
    
    keyboardButtonZone.on('pointerout', () => {
      keyboardButton.clear();
      // Retour à la couleur normale
      keyboardButton.fillStyle(0x13674c, 0.8);
      keyboardButton.fillRoundedRect(width/2 - keyboardButtonWidth/2, keyboardButtonY, keyboardButtonWidth, keyboardButtonHeight, 12);
      keyboardButton.lineStyle(1.5, 0x5effc3, 0.3);
      keyboardButton.strokeRoundedRect(width/2 - keyboardButtonWidth/2, keyboardButtonY, keyboardButtonWidth, keyboardButtonHeight, 12);
      
      keyboardText.setScale(1);
    });
    
    // Effet de clic pour changer la disposition du clavier
    keyboardButtonZone.on('pointerdown', () => {
      // Animation de pression
      keyboardButton.clear();
      keyboardButton.fillStyle(0x0f4e3a, 1);
      keyboardButton.fillRoundedRect(width/2 - keyboardButtonWidth/2, keyboardButtonY, keyboardButtonWidth, keyboardButtonHeight, 12);
      keyboardButton.lineStyle(1, 0x5effc3, 0.2);
      keyboardButton.strokeRoundedRect(width/2 - keyboardButtonWidth/2, keyboardButtonY, keyboardButtonWidth, keyboardButtonHeight, 12);
      
      keyboardText.setY(keyboardButtonY + keyboardButtonHeight/2 + 2);
      
      // Changer cycliquement la disposition du clavier
      this.cycleKeyboardLayout();
      
      // Mettre à jour le texte du bouton
      keyboardText.setText(this.getKeyboardLayoutText());
      
      // Son de clic (si disponible)
      if (this.sound.get('click')) {
        this.sound.play('click');
      }
      
      // Effet visuel pour confirmer le changement
      this.time.delayedCall(200, () => {
        keyboardButton.clear();
        keyboardButton.fillStyle(0x13674c, 0.8);
        keyboardButton.fillRoundedRect(width/2 - keyboardButtonWidth/2, keyboardButtonY, keyboardButtonWidth, keyboardButtonHeight, 12);
        keyboardButton.lineStyle(1.5, 0x5effc3, 0.3);
        keyboardButton.strokeRoundedRect(width/2 - keyboardButtonWidth/2, keyboardButtonY, keyboardButtonWidth, keyboardButtonHeight, 12);
        
        keyboardText.setY(keyboardButtonY + keyboardButtonHeight/2);
      });
    });
    
    // Panneau d'instructions avec design moderne
    const instructionsY = keyboardButtonY + keyboardButtonHeight + 20; // Ajusté en fonction du bouton clavier
    const instrHeight = panelHeight * 0.29; // Ajusté pour s'adapter à l'espace restant
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
      { 
        id: 'movement',
        text: this.isFrenchKeyboard() ? 
          'Utilisez les touches ZQSD pour vous déplacer' : 
          'Utilisez les touches WASD pour vous déplacer', 
        icon: '⌨️' 
      },
      { text: 'Cliquez pour tirer', icon: '🖱️' },
      { text: 'Ramassez des armes pour augmenter votre puissance', icon: '🔫' },
      { text: 'Restez dans la zone sûre pour survivre', icon: '🛡️' }
    ];
    
    const instrTextSize = Math.min(16, width * 0.024);
    const iconSize = Math.min(20, width * 0.03);
    const lineHeight = instrHeight / 6;
    
    // Effacer les références précédentes si elles existent
    this.instructionTexts = [];
    
    instructions.forEach((instruction, index) => {
      const y = instructionsY + 60 + (index * lineHeight);
      
      // Icône avec effet de pulsation 
      const icon = this.add.text(instrX + 25, y, instruction.icon, {
        fontSize: `${iconSize}px`
      }).setOrigin(0.5);
      
      // Petite animation pour les icônes
      this.tweens.add({
        targets: icon,
        scale: { from: 1, to: 1.15 },
        duration: 800 + (index * 200),
        ease: 'Cubic.easeInOut',
        yoyo: true,
        repeat: -1
      });
      
      // Texte
      const textObj = this.add.text(instrX + 50, y, instruction.text, {
        fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
        fontSize: `${instrTextSize}px`,
        color: '#ffffff'
      }).setOrigin(0, 0.5).setAlpha(0.85);
      
      // Stocker le texte avec son ID pour pouvoir le mettre à jour plus tard
      if ('id' in instruction) {
        this.instructionTexts.push(textObj);
      }
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
  
  // Fonction pour obtenir le texte à afficher sur le bouton de disposition du clavier
  private getKeyboardLayoutText(): string {
    switch(this.keyboardLayout) {
      case 'qwerty':
        return 'Clavier: QWERTY (WASD)';
      case 'azerty':
        return 'Clavier: AZERTY (ZQSD)';
      default:
        return 'Clavier: Auto-détection';
    }
  }
  
  // Fonction pour changer cycliquement la disposition du clavier
  private cycleKeyboardLayout(): void {
    if (this.keyboardLayout === 'auto') {
      this.keyboardLayout = 'qwerty';
    } else if (this.keyboardLayout === 'qwerty') {
      this.keyboardLayout = 'azerty';
    } else {
      this.keyboardLayout = 'auto';
    }
    
    // Sauvegarder la préférence dans le localStorage
    localStorage.setItem('keyboardLayout', this.keyboardLayout);
    
    // Mettre à jour le texte des instructions de mouvement
    this.updateMovementInstructions();
  }
  
  // Mettre à jour le texte des instructions de mouvement
  private updateMovementInstructions(): void {
    if (this.instructionTexts.length > 0) {
      // Le premier élément est l'instruction de mouvement
      const movementText = this.instructionTexts[0];
      
      // Mettre à jour le texte en fonction de la disposition du clavier
      if (this.isFrenchKeyboard()) {
        movementText.setText('Utilisez les touches ZQSD pour vous déplacer');
      } else {
        movementText.setText('Utilisez les touches WASD pour vous déplacer');
      }
    }
  }
  
  // Fonction auxiliaire pour vérifier si on utilise le clavier AZERTY
  private isFrenchKeyboard(): boolean {
    // Si l'utilisateur a explicitement choisi une disposition
    if (this.keyboardLayout === 'azerty') {
      return true;
    } else if (this.keyboardLayout === 'qwerty') {
      return false;
    }
    
    // Sinon, utiliser la détection automatique basée sur la langue du navigateur
    const userLanguage = navigator.language || (navigator as any).userLanguage || '';
    return userLanguage.toLowerCase().startsWith('fr');
  }
}