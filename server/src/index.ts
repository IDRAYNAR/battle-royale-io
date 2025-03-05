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
// Au lieu d'enregistrer une salle fixe, on définit le modèle de salle
// Les noms de salles seront créés dynamiquement par le client
gameServer.define("battle_royale", BattleRoyaleRoom);

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