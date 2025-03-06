import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { monitor } from "@colyseus/monitor";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { BattleRoyaleRoom } from "./rooms/BattleRoyaleRoom";

const port = Number(process.env.PORT || 2567);
const app = express();

// Configuration CORS améliorée pour accepter les origines locales et de production
app.use(cors({
  origin: [
    'http://localhost:8080',
    'http://localhost:3000',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:3000',
    'https://battle-royale-io.vercel.app' // Remplacez par votre domaine Vercel réel
  ],
  credentials: true
}));

app.use(express.json());

// Moniteur Colyseus pour le débogage
app.use("/colyseus", monitor());

const server = createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({
    server,
  }),
});

// Enregistrement de notre salle de jeu
// Utilisation d'une définition dynamique pour permettre la création de salles multiples
const battleRoyaleRoom = gameServer.define("battle_royale", BattleRoyaleRoom, {
  // Options de salle pour améliorer le comportement en local
  // Ces options font en sorte que les salles ne soient pas nettoyées trop rapidement
  presence: true,
  // Pas de limite de taille pour le lobby (affiche toutes les salles)
  maxClients: 16,
  // Ne pas nettoyer les salles vides immédiatement
  emptyRoomTimeout: 300, // 5 minutes avant de nettoyer une salle vide
  // Conserver les métadonnées pour le listing
  metadata: {
    gameType: "battle_royale"
  }
});

// Activation du listing en temps réel
battleRoyaleRoom.enableRealtimeListing();

// Démarrage du serveur
gameServer.listen(port).then(() => {
  const isProduction = process.env.NODE_ENV === 'production';
  const serverUrl = isProduction 
    ? 'https://battle-royale-io-backend.onrender.com'
    : `http://localhost:${port}`;
  
  console.log(`🎮 Serveur de jeu démarré sur ${serverUrl}`);
  console.log(`🔧 Environnement: ${isProduction ? 'Production' : 'Développement'}`);
  console.log(`📊 Moniteur disponible sur ${serverUrl}/colyseus`);
}).catch(err => {
  console.error(err);
}); 