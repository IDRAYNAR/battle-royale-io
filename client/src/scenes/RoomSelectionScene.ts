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
    
    // Mettre en place un rafraîchissement automatique des salles toutes les 5 secondes
    this.time.addEvent({
      delay: 5000,
      callback: this.loadRooms,
      callbackScope: this,
      loop: true
    });
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
      
      // Ajouter un feedback visuel de rafraîchissement
      const refreshingText = this.add.text(width/2, 100, 'Actualisation...', {
        fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
        fontSize: '16px',
        color: '#ffffff'
      }).setOrigin(0.5);
      
      // Désactiver temporairement le bouton pour éviter les clics multiples
      this.refreshButton?.disableInteractive();
      
      // Forcer un refresh complet avec plusieurs tentatives
      setTimeout(async () => {
        await this.loadRooms();
        refreshingText.destroy();
        
        // Réactiver le bouton après le rafraîchissement
        this.refreshButton?.setInteractive();
      }, 500);
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
        // Désactiver le bouton pendant la création pour éviter les clics multiples
        this.createRoomBtn?.disableInteractive();
        
        // Ajouter un texte temporaire pour indiquer que la création est en cours
        const loadingRoom = this.add.text(this.cameras.main.width/2, this.cameras.main.height/2 - 100, 
          'Création de la salle en cours...', {
          fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
          fontSize: '20px',
          color: '#ffffff'
        }).setOrigin(0.5);
        
        console.log("Création d'une nouvelle salle avec ID unique...");
        const room = await roomService.createRoom();
        console.log(`Salle créée avec succès, ID: ${room.id}`);
        
        // Supprimer le texte de chargement
        loadingRoom.destroy();
        
        // Une fois la salle créée, démarrer la scène de jeu
        this.scene.start('GameScene', { room });
      } catch (error) {
        console.error("Erreur lors de la création de la salle:", error);
        // Réactiver le bouton en cas d'erreur
        this.createRoomBtn?.setInteractive();
        
        // Afficher un message d'erreur
        this.add.text(this.cameras.main.width/2, this.cameras.main.height/2 - 100, 
          'Erreur lors de la création de la salle.\nVeuillez réessayer.', {
          fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
          fontSize: '20px',
          color: '#ff5555',
          align: 'center'
        }).setOrigin(0.5);
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
    
    // Supprimer TOUS les messages précédents pour un nettoyage plus complet
    this.children.each(child => {
      if (child instanceof Phaser.GameObjects.Text && 
          child !== this.loadingText &&
          (child.text.includes('Aucune salle') || 
           child.text.includes('salle(s) disponible') ||
           child.text.includes('Erreur'))) {
        child.destroy();
      }
    });
    
    try {
      console.log("Chargement des salles disponibles...");
      
      // Forcer l'effacement de la liste précédente
      this.rooms = [];
      
      // Première tentative de récupération des salles
      this.rooms = await roomService.getAvailableRooms();
      console.log(`Première tentative: ${this.rooms.length} salles trouvées`);
      
      // Si aucune salle n'est trouvée, attendre un peu et réessayer
      if (this.rooms.length === 0) {
        console.log("Aucune salle trouvée, nouvelle tentative dans 1 seconde...");
        await new Promise(resolve => setTimeout(resolve, 1000));
        this.rooms = await roomService.getAvailableRooms();
        console.log(`Deuxième tentative: ${this.rooms.length} salles trouvées`);
      }
      
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
        console.log("Affichage des salles disponibles:", this.rooms);
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
    
    // Vérification supplémentaire
    if (!this.rooms || this.rooms.length === 0) {
      console.warn("Pas de salles à afficher dans displayRooms");
      this.add.text(width/2, this.cameras.main.height/2, 'Aucune salle disponible.\nCréez-en une nouvelle !', {
        fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
        fontSize: '24px',
        color: '#ffffff',
        align: 'center'
      }).setOrigin(0.5);
      return;
    }
    
    // Ajouter un texte d'en-tête
    this.add.text(width/2, roomListY - 50, `${this.rooms.length} salle(s) disponible(s)`, {
      fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    // Afficher chaque salle
    this.rooms.forEach((room, index) => {
      const roomY = roomListY + (index * 70);
      console.log(`Création de l'élément pour la salle: ${room.id} en position ${roomY}`);
      this.createRoomListItem(room, panelX + 40, roomY, panelWidth - 80);
    });
  }
  
  private createRoomListItem(room: Room, x: number, y: number, width: number) {
    // Conteneur pour l'élément de salle
    const container = this.add.container(x, y);
    
    // Fond du bouton avec effet glassmorphism
    const buttonHeight = 60;
    const roomButton = this.add.graphics();
    roomButton.fillStyle(0x0d1b2a, 0.7); // Couleur de fond plus sombre
    roomButton.fillRoundedRect(0, 0, width, buttonHeight, 12);
    roomButton.lineStyle(1.5, 0x3282b8, 0.3); // Bordure bleue
    roomButton.strokeRoundedRect(0, 0, width, buttonHeight, 12);
    
    // Ajouter un effet subtil pour identifier les salles
    // Petite étiquette d'ID unique
    const idTag = this.add.graphics();
    idTag.fillStyle(0x13674c, 0.8);
    idTag.fillRoundedRect(width - 80, 5, 70, 20, 8);
    
    // Identifiant court de la salle
    const shortId = room.id.substring(room.id.lastIndexOf('_') + 1, room.id.length).substring(0, 6);
    const idText = this.add.text(width - 45, 15, `#${shortId}`, {
      fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
      fontSize: '10px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    // Nom de la salle en plus grand
    const text = this.add.text(20, buttonHeight/2, room.name, {
      fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0, 0.5);
    
    // Nombre de joueurs
    const playersText = this.add.text(width - 100, buttonHeight/2, `${room.clients}/${room.maxClients} joueurs`, {
      fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
      fontSize: '14px',
      color: '#5effc3',
      fontStyle: 'bold'
    }).setOrigin(1, 0.5);
    
    // Ajout au conteneur
    container.add([roomButton, text, playersText, idTag, idText]);
    
    // Zone interactive
    const hitArea = new Phaser.Geom.Rectangle(0, 0, width, buttonHeight);
    container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
    
    // Effet hover
    container.on('pointerover', () => {
      roomButton.clear();
      roomButton.fillStyle(0x1a3772, 0.7);
      roomButton.fillRoundedRect(0, 0, width, buttonHeight, 12);
      roomButton.lineStyle(1.5, 0x3498db, 0.4);
      roomButton.strokeRoundedRect(0, 0, width, buttonHeight, 12);
    });
    
    container.on('pointerout', () => {
      roomButton.clear();
      roomButton.fillStyle(0x091836, 0.5);
      roomButton.fillRoundedRect(0, 0, width, buttonHeight, 12);
      roomButton.lineStyle(1, 0x3498db, 0.2);
      roomButton.strokeRoundedRect(0, 0, width, buttonHeight, 12);
    });
    
    // Gestion du clic sur une salle
    container.on('pointerup', async () => {
      try {
        console.log(`Tentative de connexion à la salle ID: ${room.id}`);
        
        // Désactiver l'interaction pendant la connexion
        container.disableInteractive();
        
        // Texte de chargement
        const loadingText = this.add.text(this.cameras.main.width/2, this.cameras.main.height/2, 
          'Connexion à la salle...', {
          fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
          fontSize: '24px',
          color: '#ffffff'
        }).setOrigin(0.5);
        
        // Rejoindre la salle spécifique en utilisant son ID
        const joinedRoom = await roomService.joinRoom(room.id);
        console.log(`Connecté à la salle ID: ${joinedRoom.id}`);
        
        // Supprimer le texte de chargement
        loadingText.destroy();
        
        // Démarrer la scène de jeu avec la salle rejointe
        this.scene.start('GameScene', { room: joinedRoom });
      } catch (error) {
        console.error(`Erreur lors de la connexion à la salle ${room.id}:`, error);
        
        // Réactiver l'interaction en cas d'erreur
        container.setInteractive();
        
        // Afficher un message d'erreur
        this.add.text(this.cameras.main.width/2, this.cameras.main.height/2, 
          'Erreur de connexion à la salle.\nLa salle pourrait ne plus être disponible.', {
          fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
          fontSize: '24px',
          color: '#ff5555',
          align: 'center'
        }).setOrigin(0.5);
        
        // Rafraîchir la liste des salles après un court délai
        setTimeout(() => this.loadRooms(), 2000);
      }
    });
    
    // Ajouter à la liste des boutons de salle
    this.roomButtons.push(container);
  }
} 