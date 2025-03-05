import Phaser from 'phaser';

export class GameOverScene extends Phaser.Scene {
  private win: boolean = false;

  constructor() {
    super({ key: 'GameOverScene' });
  }

  init(data: { win: boolean }) {
    this.win = data.win;
  }

  create() {
    // Récupérer les dimensions de l'écran
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    // Fond noir simple
    this.add.rectangle(0, 0, width, height, 0x000000).setOrigin(0, 0);
    
    // Panneau semi-transparent avec bordure
    const panel = this.add.graphics();
    panel.fillStyle(0x000000, 0.8);
    panel.fillRect(width * 0.2, height * 0.2, width * 0.6, height * 0.6);
    panel.lineStyle(4, 0xffffff, 1);
    panel.strokeRect(width * 0.2, height * 0.2, width * 0.6, height * 0.6);
    
    // Titre différent selon victoire ou défaite
    if (this.win) {
      // Titre pour la victoire
      const titleSize = Math.min(72, width * 0.1);
      const victoryText = this.add.text(width/2, height * 0.3, 'VICTOIRE', {
        fontFamily: 'Arial Black',
        fontSize: `${titleSize}px`,
        color: '#ffff00',
        stroke: '#000000',
        strokeThickness: 6
      }).setOrigin(0.5);
      
      // Animation du titre
      this.tweens.add({
        targets: victoryText,
        scale: { from: 0.5, to: 1.2 },
        duration: 1000,
        ease: 'Bounce.Out'
      });
      
      // Particules pour la victoire
      try {
        const particles = this.add.particles(0, 0, 'particle', {
          x: width / 2,
          y: height / 2,
          lifespan: 2000,
          speed: { min: 100, max: 200 },
          scale: { start: 0.5, end: 0 },
          quantity: 2,
          blendMode: 'ADD',
          emitting: true
        });
      } catch (e) {
        console.error("Erreur lors de la création des particules:", e);
      }
      
      const subtitleSize = Math.min(32, width * 0.05);
      this.add.text(width/2, height * 0.4, 'Vous êtes le dernier survivant !', {
        fontFamily: 'Arial',
        fontSize: `${subtitleSize}px`,
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3
      }).setOrigin(0.5);
    } else {
      // Titre pour la défaite
      const titleSize = Math.min(72, width * 0.1);
      const defeatText = this.add.text(width/2, height * 0.3, 'DÉFAITE', {
        fontFamily: 'Arial Black',
        fontSize: `${titleSize}px`,
        color: '#ff0000',
        stroke: '#000000',
        strokeThickness: 6
      }).setOrigin(0.5);
      
      // Animation du titre
      this.tweens.add({
        targets: defeatText,
        alpha: { from: 0.5, to: 1 },
        duration: 1000,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1
      });
      
      const subtitleSize = Math.min(32, width * 0.05);
      this.add.text(width/2, height * 0.4, 'Vous avez été éliminé...', {
        fontFamily: 'Arial',
        fontSize: `${subtitleSize}px`,
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3
      }).setOrigin(0.5);
    }
    
    // Bouton pour rejouer
    const buttonScale = Math.min(1.5, width * 0.003);
    const buttonWidth = 200;
    const buttonHeight = 60;
    
    // Créer un bouton personnalisé
    const replayButton = this.add.graphics();
    replayButton.fillStyle(0x4444aa, 1);
    replayButton.fillRoundedRect(width/2 - buttonWidth/2, height * 0.75 - buttonHeight/2, buttonWidth, buttonHeight, 10);
    replayButton.lineStyle(3, 0xffffff, 1);
    replayButton.strokeRoundedRect(width/2 - buttonWidth/2, height * 0.75 - buttonHeight/2, buttonWidth, buttonHeight, 10);
    
    // Zone interactive pour le bouton
    const hitArea = new Phaser.Geom.Rectangle(width/2 - buttonWidth/2, height * 0.75 - buttonHeight/2, buttonWidth, buttonHeight);
    const hitAreaCallback = Phaser.Geom.Rectangle.Contains;
    const buttonZone = this.add.zone(0, 0, width, height).setInteractive(hitArea, hitAreaCallback);
    
    // Texte du bouton
    const buttonText = this.add.text(width/2, height * 0.75, 'REJOUER', {
      fontFamily: 'Arial Black',
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    // Effet de survol
    buttonZone.on('pointerover', () => {
      replayButton.clear();
      replayButton.fillStyle(0x6666cc, 1);
      replayButton.fillRoundedRect(width/2 - buttonWidth/2, height * 0.75 - buttonHeight/2, buttonWidth, buttonHeight, 10);
      replayButton.lineStyle(3, 0xffffff, 1);
      replayButton.strokeRoundedRect(width/2 - buttonWidth/2, height * 0.75 - buttonHeight/2, buttonWidth, buttonHeight, 10);
    });
    
    // Effet de sortie du survol
    buttonZone.on('pointerout', () => {
      replayButton.clear();
      replayButton.fillStyle(0x4444aa, 1);
      replayButton.fillRoundedRect(width/2 - buttonWidth/2, height * 0.75 - buttonHeight/2, buttonWidth, buttonHeight, 10);
      replayButton.lineStyle(3, 0xffffff, 1);
      replayButton.strokeRoundedRect(width/2 - buttonWidth/2, height * 0.75 - buttonHeight/2, buttonWidth, buttonHeight, 10);
    });
    
    // Action du bouton
    buttonZone.on('pointerdown', () => {
      // Redirection vers la page d'accueil du site web en forçant le rafraîchissement
      window.location.reload();
    });
    
    // Texte de retour automatique
    const autoReturnText = this.add.text(width/2, height * 0.85, 'Retour automatique dans 5 secondes...', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#aaaaaa'
    }).setOrigin(0.5);
    
    // Compte à rebours pour le retour automatique
    let timeLeft = 5;
    const countdownTimer = this.time.addEvent({
      delay: 1000,
      callback: () => {
        timeLeft--;
        autoReturnText.setText(`Retour automatique dans ${timeLeft} secondes...`);
        if (timeLeft <= 0) {
          // Redirection vers la page d'accueil du site web en forçant le rafraîchissement
          window.location.reload();
        }
      },
      callbackScope: this,
      loop: true
    });
  }
  
  resize(gameSize: { width: number; height: number }) {
    // Récupération des nouvelles dimensions
    const width = gameSize.width;
    const height = gameSize.height;
    
    // Mise à jour de la caméra
    this.cameras.main.setSize(width, height);
    
    // Recréer la scène pour adapter tous les éléments
    this.scene.restart({ win: this.win });
  }

  shutdown() {
    // Supprimer l'écouteur d'événement de redimensionnement
    this.scale.off('resize', this.resize, this);
    
    // Arrêter toutes les animations en cours
    this.tweens.killAll();
    
    // Nettoyer les graphiques
    this.children.getAll().forEach(child => {
      if (child.type === 'Graphics') {
        (child as Phaser.GameObjects.Graphics).clear();
      }
    });
  }
} 