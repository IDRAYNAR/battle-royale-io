import * as Colyseus from 'colyseus.js';

// Configuration de l'URL du serveur en fonction de l'environnement
const serverUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? `ws://${window.location.hostname}:2567` // URL locale pour le développement
  : "wss://battle-royale-io-backend.onrender.com"; // URL de production sur Render

// Création du client Colyseus avec l'URL appropriée
const client = new Colyseus.Client(serverUrl);

interface Room {
  id: string;
  name: string;
  clients: number;
  maxClients: number;
}

class RoomService {
  private rooms: Room[] = [];
  private roomCounter: number = Math.floor(Math.random() * 900) + 100; // nombre à 3 chiffres
  private clientId: string = `user-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  constructor() {
    console.log(`Service de salles initialisé avec le clientId: ${this.clientId}`);
  }

  // Récupérer la liste des salles disponibles
  async getAvailableRooms(): Promise<Room[]> {
    try {
      // Forcer l'actualisation en ajoutant un timestamp pour éviter les problèmes de cache
      const timestamp = Date.now();
      
      // Afficher l'état avant la récupération
      console.log("Tentative de récupération des salles disponibles...");
      
      // IMPORTANT: Utiliser cette syntaxe exacte avec le nom de type de salle
      const availableRooms = await client.getAvailableRooms("battle_royale");
      console.log("Réponse brute du serveur:", availableRooms);
      
      // Mapper les données des salles pour notre interface
      this.rooms = availableRooms.map(room => {
        // Récupérer le nom depuis les métadonnées ou générer un nom par défaut
        const roomName = room.metadata?.name || `Salle ${room.clients}/${room.maxClients}`;
        
        // Ajouter les heures de création à l'affichage si non présentes dans le nom
        let displayName = roomName;
        if (!roomName.includes(':')) {
          const creationDate = room.metadata?.createdAt ? new Date(room.metadata.createdAt) : new Date();
          const timeString = creationDate.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'});
          displayName = `${roomName} - ${timeString}`;
        }
        
        return {
          id: room.roomId,
          name: displayName,
          clients: room.clients,
          maxClients: room.maxClients
        };
      });
      
      console.log("Salles formatées pour l'affichage:", this.rooms);
      return this.rooms;
    } catch (error) {
      console.error("Erreur lors de la récupération des salles:", error);
      return [];
    }
  }

  // Créer une nouvelle salle avec un nom généré automatiquement
  async createRoom(): Promise<Colyseus.Room> {
    this.roomCounter++;
    
    // Générer un nom unique avec date et heure
    const timestamp = new Date();
    const timeString = timestamp.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'});
    const roomName = `Salle ${this.roomCounter} - ${timeString}`;
    
    try {
      console.log(`Tentative de création de salle: ${roomName}`);
      
      // Attendre un court instant pour s'assurer que les salles précédentes sont bien enregistrées
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Options de création de salle avec plus de métadonnées
      const room = await client.create("battle_royale", {
        // IMPORTANT: Ces options sont envoyées au constructeur de la salle côté serveur
        name: roomName,
        // Utiliser des métadonnées simples et explicites
        metadata: {
          name: roomName,
          createdAt: timestamp.toISOString(),
          uniqueId: `${Date.now()}-${Math.floor(Math.random() * 10000)}`
        }
      });
      
      console.log(`Salle créée avec succès: ${room.id}`);
      // Utiliser room["metadata"] pour éviter l'erreur de linter
      console.log("Métadonnées de la salle:", (room as any).metadata || "Non disponibles");
      
      // Attendre un peu plus longtemps pour s'assurer que la salle est bien enregistrée
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Rafraîchir la liste des salles pour voir la nôtre
      await this.getAvailableRooms();
      
      return room;
    } catch (error) {
      console.error("Erreur lors de la création de la salle:", error);
      throw error;
    }
  }

  // Rejoindre une salle existante par son ID
  async joinRoom(roomId: string): Promise<Colyseus.Room> {
    try {
      const room = await client.joinById(roomId);
      console.log(`Salle rejointe: ${roomId}`);
      return room;
    } catch (error) {
      console.error(`Erreur lors de la connexion à la salle ${roomId}:`, error);
      throw error;
    }
  }
}

export const roomService = new RoomService(); 