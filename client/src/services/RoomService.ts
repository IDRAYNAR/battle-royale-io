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
  private roomCounter: number = 0;

  // Récupérer la liste des salles disponibles
  async getAvailableRooms(): Promise<Room[]> {
    try {
      const availableRooms = await client.getAvailableRooms("battle_royale");
      this.rooms = availableRooms.map(room => ({
        id: room.roomId,
        name: room.metadata?.name || `Salle ${room.clients}`,
        clients: room.clients,
        maxClients: room.maxClients
      }));
      return this.rooms;
    } catch (error) {
      console.error("Erreur lors de la récupération des salles:", error);
      return [];
    }
  }

  // Créer une nouvelle salle avec un nom généré automatiquement
  async createRoom(): Promise<Colyseus.Room> {
    this.roomCounter++;
    const roomName = `Salle ${this.roomCounter}`;
    
    try {
      const room = await client.create("battle_royale", {
        name: roomName
      });
      console.log(`Salle créée: ${roomName} (ID: ${room.id})`);
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