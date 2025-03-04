import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { monitor } from "@colyseus/monitor";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { BattleRoyaleRoom } from "./rooms/BattleRoyaleRoom";

const port = Number(process.env.PORT || 2567);
const app = express();

app.use(cors());
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
gameServer.define("battle_royale", BattleRoyaleRoom);

// Démarrage du serveur
gameServer.listen(port).then(() => {
  console.log(`🎮 Serveur de jeu démarré sur http://localhost:${port}`);
}).catch(err => {
  console.error(err);
}); 