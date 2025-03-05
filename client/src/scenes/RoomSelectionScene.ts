import Phaser from 'phaser';
import { roomService } from '../services/RoomService';

interface Room {
  id: string;
  name: string;
  clients: number;
  maxClients: number;
}

export class RoomSelectionScene extends Phaser.Scene {
  private rooms: Room[] = [];
  private roomButtons: Phaser.GameObjects.Container[] = [];
  private gradientBg: Phaser.GameObjects.Graphics | null = null;
  private refreshButton: Phaser.GameObjects.Container | null = null;
  private backButton: Phaser.GameObjects.Container | null = null;
  private createRoomBtn: Phaser.GameObjects.Container | null = null;
  private loadingText: Phaser.GameObjects.Text | null = null;
  
  constructor() {
    super({ key: 'RoomSelectionScene' });
  }
  
  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    // Création du fond avec dégradé moderne
    this.createBackground(width, height);
    
    // Panneau principal
    const panelWidth = Math.min(width * 0.85, 800);
    const panelHeight = Math.min(height * 0.85, 700);
    const panelX = width/2 - panelWidth/2;
    const panelY = height/2 - panelHeight/2;
    
    // Panneau principal avec effet glassmorphism
    const panel = this.add.graphics();
    panel.fillStyle(0x091114, 0.7);
    panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 24);
    panel.lineStyle(2, 0xffffff, 0.1);
    panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 24);
    
    // Titre
    const titleSize = Math.min(48, width * 0.08);
    this.add.text(width/2, panelY + 40, 'SÉLECTION DE SALLE', {
      fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
      fontSize: `${titleSize}px`,
      color: '#ffffff',
      fontStyle: 'bold',
      shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 3, fill: true }
    }).setOrigin(0.5);
    
    // Bouton Rafraîchir
    this.createRefreshButton(width, panelX + panelWidth - 60, panelY + 40);
    
    // Bouton Retour
    this.createBackButton(panelX + 60, panelY + 40);
    
    // Bouton Créer une salle
    this.createRoomButton(width/2, panelY + panelHeight - 60);
    
    // Texte de chargement
    this.loadingText = this.add.text(width/2, height/2, 'Chargement des salles...', {
      fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    // Chargement des salles
    this.loadRooms();
  }
  
  private createBackground(width: number, height: number) {
    // Supprimer le fond précédent s'il existe
    if (this.gradientBg) {
      this.gradientBg.destroy();
    }
    
    // Création d'un fond avec dégradé moderne
    this.gradientBg = this.add.graphics();
    const gradientTop = 0x1a2c39;
    const gradientBottom = 0x091114;
    
    // Remplir l'écran avec un dégradé vertical
    const gradientHeight = height;
    for (let y = 0; y < gradientHeight; y++) {
      const ratio = y / gradientHeight;
      const r = Phaser.Math.Linear((gradientTop >> 16) & 0xff, (gradientBottom >> 16) & 0xff, ratio);
      const g = Phaser.Math.Linear((gradientTop >> 8) & 0xff, (gradientBottom >> 8) & 0xff, ratio);
      const b = Phaser.Math.Linear(gradientTop & 0xff, gradientBottom & 0xff, ratio);
      
      const color = (r << 16) | (g << 8) | b;
      
      this.gradientBg.fillStyle(color);
      this.gradientBg.fillRect(0, y, width, 1);
    }
    
    // Ajout d'un effet subtil de particules lumineuses
    this.addParticleEffect(width, height);
  }
  
  private addParticleEffect(width: number, height: number) {
    const particles = this.add.particles(0, 0, 'flare', {
      x: { min: 0, max: width },
      y: { min: 0, max: height },
      scale: { start: 0.1, end: 0 },
      alpha: { start: 0.4, end: 0 },
      speed: 20,
      angle: { min: 0, max: 360 },
      blendMode: 'ADD',
      lifespan: 3000,
      frequency: 500
    });
    
    particles.setDepth(-1);
  }
  
  private createRefreshButton(width: number, x: number, y: number) {
    // Création du conteneur pour le bouton
    this.refreshButton = this.add.container(x, y);
    
    // Cercle de fond avec effet glassmorphism
    const circle = this.add.graphics();
    circle.fillStyle(0x13674c, 0.8);
    circle.fillCircle(0, 0, 20);
    circle.lineStyle(1.5, 0x5effc3, 0.3);
    circle.strokeCircle(0, 0, 20);
    
    // Icône de rafraîchissement (dessin simplifié)
    const icon = this.add.graphics();
    icon.lineStyle(2, 0xffffff, 0.9);
    icon.beginPath();
    icon.arc(0, 0, 10, Phaser.Math.DegToRad(30), Phaser.Math.DegToRad(330), false);
    icon.stroke();
    
    // Flèche de l'icône
    icon.beginPath();
    icon.moveTo(8, -10);
    icon.lineTo(12, -5);
    icon.lineTo(4, -5);
    icon.closePath();
    icon.fillStyle(0xffffff, 0.9);
    icon.fill();
    
    // Ajout au conteneur
    this.refreshButton.add([circle, icon]);
    
    // Zone interactive
    const hitArea = new Phaser.Geom.Circle(0, 0, 25);
    this.refreshButton.setInteractive(hitArea, Phaser.Geom.Circle.Contains);
    
    // Effet hover
    this.refreshButton.on('pointerover', () => {
      circle.clear();
      circle.fillStyle(0x1d936c, 0.9);
      circle.fillCircle(0, 0, 20);
      circle.lineStyle(2, 0x7dffd8, 0.5);
      circle.strokeCircle(0, 0, 20);
      if (this.refreshButton) {
        this.refreshButton.setScale(1.1);
      }
    });
    
    this.refreshButton.on('pointerout', () => {
      circle.clear();
      circle.fillStyle(0x13674c, 0.8);
      circle.fillCircle(0, 0, 20);
      circle.lineStyle(1.5, 0x5effc3, 0.3);
      circle.strokeCircle(0, 0, 20);
      if (this.refreshButton) {
        this.refreshButton.setScale(1);
      }
    });
    
    // Effet clic
    this.refreshButton.on('pointerdown', () => {
      if (this.refreshButton) {
        this.refreshButton.setScale(0.9);
      }
      this.loadRooms();
    });
    
    this.refreshButton.on('pointerup', () => {
      if (this.refreshButton) {
        this.refreshButton.setScale(1);
      }
    });
  }
  
  private createBackButton(x: number, y: number) {
    // Création du conteneur pour le bouton
    this.backButton = this.add.container(x, y);
    
    // Cercle de fond avec effet glassmorphism
    const circle = this.add.graphics();
    circle.fillStyle(0x13674c, 0.8);
    circle.fillCircle(0, 0, 20);
    circle.lineStyle(1.5, 0x5effc3, 0.3);
    circle.strokeCircle(0, 0, 20);
    
    // Icône de retour (flèche)
    const icon = this.add.graphics();
    icon.lineStyle(2, 0xffffff, 0.9);
    icon.beginPath();
    icon.moveTo(5, 0);
    icon.lineTo(-5, 0);
    icon.moveTo(-5, 0);
    icon.lineTo(0, -5);
    icon.moveTo(-5, 0);
    icon.lineTo(0, 5);
    icon.stroke();
    
    // Ajout au conteneur
    this.backButton.add([circle, icon]);
    
    // Zone interactive
    const hitArea = new Phaser.Geom.Circle(0, 0, 25);
    this.backButton.setInteractive(hitArea, Phaser.Geom.Circle.Contains);
    
    // Effet hover
    this.backButton.on('pointerover', () => {
      circle.clear();
      circle.fillStyle(0x1d936c, 0.9);
      circle.fillCircle(0, 0, 20);
      circle.lineStyle(2, 0x7dffd8, 0.5);
      circle.strokeCircle(0, 0, 20);
      if (this.backButton) {
        this.backButton.setScale(1.1);
      }
    });
    
    this.backButton.on('pointerout', () => {
      circle.clear();
      circle.fillStyle(0x13674c, 0.8);
      circle.fillCircle(0, 0, 20);
      circle.lineStyle(1.5, 0x5effc3, 0.3);
      circle.strokeCircle(0, 0, 20);
      if (this.backButton) {
        this.backButton.setScale(1);
      }
    });
    
    // Effet clic
    this.backButton.on('pointerdown', () => {
      if (this.backButton) {
        this.backButton.setScale(0.9);
      }
    });
    
    this.backButton.on('pointerup', () => {
      if (this.backButton) {
        this.backButton.setScale(1);
      }
      this.scene.start('MenuScene');
    });
  }
  
  private createRoomButton(x: number, y: number) {
    // Création du conteneur pour le bouton
    this.createRoomBtn = this.add.container(x, y);
    
    // Dimensions du bouton
    const buttonWidth = 200;
    const buttonHeight = 50;
    
    // Fond du bouton avec effet glassmorphism
    const background = this.add.graphics();
    background.fillStyle(0x13674c, 0.8);
    background.fillRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 12);
    background.lineStyle(1.5, 0x5effc3, 0.3);
    background.strokeRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 12);
    
    // Texte du bouton
    const text = this.add.text(0, 0, 'CRÉER UNE SALLE', {
      fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    // Ajout au conteneur
    this.createRoomBtn.add([background, text]);
    
    // Zone interactive
    const hitArea = new Phaser.Geom.Rectangle(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight);
    this.createRoomBtn.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
    
    // Effet hover
    this.createRoomBtn.on('pointerover', () => {
      background.clear();
      background.fillStyle(0x1d936c, 0.9);
      background.fillRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 12);
      background.lineStyle(2, 0x7dffd8, 0.5);
      background.strokeRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 12);
      text.setScale(1.05);
    });
    
    this.createRoomBtn.on('pointerout', () => {
      background.clear();
      background.fillStyle(0x13674c, 0.8);
      background.fillRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 12);
      background.lineStyle(1.5, 0x5effc3, 0.3);
      background.strokeRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 12);
      text.setScale(1);
    });
    
    // Effet clic
    this.createRoomBtn.on('pointerdown', () => {
      text.setY(2);
      background.clear();
      background.fillStyle(0x0f4e3a, 1);
      background.fillRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 12);
      background.lineStyle(1, 0x5effc3, 0.2);
      background.strokeRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 12);
    });
    
    this.createRoomBtn.on('pointerup', async () => {
      text.setY(0);
      background.clear();
      background.fillStyle(0x13674c, 0.8);
      background.fillRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 12);
      background.lineStyle(1.5, 0x5effc3, 0.3);
      background.strokeRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 12);
      
      // Création d'une salle
      try {
        const room = await roomService.createRoom();
        // Une fois la salle créée, démarrer la scène de jeu
        this.scene.start('GameScene', { room });
      } catch (error) {
        console.error("Erreur lors de la création de la salle:", error);
      }
    });
  }
  
  private async loadRooms() {
    if (this.loadingText) {
      this.loadingText.setVisible(true);
    }
    
    // Supprimer les boutons de salle existants
    this.roomButtons.forEach(button => button.destroy());
    this.roomButtons = [];
    
    try {
      // Charger les salles disponibles
      this.rooms = await roomService.getAvailableRooms();
      
      // Masquer le texte de chargement
      if (this.loadingText) {
        this.loadingText.setVisible(false);
      }
      
      // Afficher les salles ou un message s'il n'y en a pas
      if (this.rooms.length === 0) {
        const width = this.cameras.main.width;
        this.add.text(width/2, this.cameras.main.height/2, 'Aucune salle disponible.\nCréez-en une nouvelle !', {
          fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
          fontSize: '24px',
          color: '#ffffff',
          align: 'center'
        }).setOrigin(0.5);
      } else {
        this.displayRooms();
      }
    } catch (error) {
      console.error("Erreur lors du chargement des salles:", error);
      
      // Masquer le texte de chargement et afficher un message d'erreur
      if (this.loadingText) {
        this.loadingText.setVisible(false);
      }
      
      const width = this.cameras.main.width;
      this.add.text(width/2, this.cameras.main.height/2, 'Erreur lors de la connexion au serveur.\nVeuillez réessayer.', {
        fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
        fontSize: '24px',
        color: '#ff5555',
        align: 'center'
      }).setOrigin(0.5);
    }
  }
  
  private displayRooms() {
    const width = this.cameras.main.width;
    const panelWidth = Math.min(width * 0.85, 800);
    const panelX = width/2 - panelWidth/2;
    const panelY = this.cameras.main.height/2 - Math.min(this.cameras.main.height * 0.85, 700)/2;
    
    // Conteneur pour les salles avec scroll
    const roomListY = panelY + 120;
    const roomListHeight = Math.min(this.cameras.main.height * 0.85, 700) - 200;
    
    // Afficher chaque salle
    this.rooms.forEach((room, index) => {
      const roomY = roomListY + (index * 70);
      
      this.createRoomListItem(room, panelX + 40, roomY, panelWidth - 80);
    });
  }
  
  private createRoomListItem(room: Room, x: number, y: number, width: number) {
    // Création du conteneur pour le bouton de salle
    const roomButton = this.add.container(x, y);
    
    // Fond du bouton avec effet glassmorphism
    const buttonHeight = 60;
    const background = this.add.graphics();
    background.fillStyle(0x091836, 0.5);
    background.fillRoundedRect(0, 0, width, buttonHeight, 12);
    background.lineStyle(1, 0x3498db, 0.2);
    background.strokeRoundedRect(0, 0, width, buttonHeight, 12);
    
    // Nom de la salle
    const text = this.add.text(20, buttonHeight/2, room.name, {
      fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0, 0.5);
    
    // Nombre de joueurs
    const playersText = this.add.text(width - 20, buttonHeight/2, `${room.clients}/${room.maxClients} joueurs`, {
      fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
      fontSize: '14px',
      color: '#aaaaaa'
    }).setOrigin(1, 0.5);
    
    // Ajout au conteneur
    roomButton.add([background, text, playersText]);
    
    // Zone interactive
    const hitArea = new Phaser.Geom.Rectangle(0, 0, width, buttonHeight);
    roomButton.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
    
    // Effet hover
    roomButton.on('pointerover', () => {
      background.clear();
      background.fillStyle(0x1a3772, 0.7);
      background.fillRoundedRect(0, 0, width, buttonHeight, 12);
      background.lineStyle(1.5, 0x3498db, 0.4);
      background.strokeRoundedRect(0, 0, width, buttonHeight, 12);
    });
    
    roomButton.on('pointerout', () => {
      background.clear();
      background.fillStyle(0x091836, 0.5);
      background.fillRoundedRect(0, 0, width, buttonHeight, 12);
      background.lineStyle(1, 0x3498db, 0.2);
      background.strokeRoundedRect(0, 0, width, buttonHeight, 12);
    });
    
    // Effet clic
    roomButton.on('pointerdown', () => {
      text.setY(buttonHeight/2 + 2);
      playersText.setY(buttonHeight/2 + 2);
    });
    
    roomButton.on('pointerup', async () => {
      text.setY(buttonHeight/2);
      playersText.setY(buttonHeight/2);
      
      // Rejoindre cette salle
      try {
        const joinedRoom = await roomService.joinRoom(room.id);
        this.scene.start('GameScene', { room: joinedRoom });
      } catch (error) {
        console.error(`Erreur lors de la connexion à la salle ${room.id}:`, error);
      }
    });
    
    // Ajouter à la liste des boutons de salle
    this.roomButtons.push(roomButton);
  }
} 