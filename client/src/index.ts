import 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { GameOverScene } from './scenes/GameOverScene';
import * as Colyseus from 'colyseus.js';

// Configuration du jeu Phaser
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: window.innerWidth,
  height: window.innerHeight,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  input: {
    gamepad: true
  },
  scene: [BootScene, MenuScene, GameScene, GameOverScene]
};

// Création de l'instance du jeu
const game = new Phaser.Game(config);

// Gestion du redimensionnement de la fenêtre
window.addEventListener('resize', () => {
  game.scale.resize(window.innerWidth, window.innerHeight);
});

// Configuration de l'URL du serveur en fonction de l'environnement
const serverUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? `ws://${window.location.hostname}:2567` // URL locale pour le développement
  : "wss://battle-royale-io-backend.onrender.com"; // URL de production sur Render

// Création du client Colyseus avec l'URL appropriée
const client = new Colyseus.Client(serverUrl);
console.log(`Connexion au serveur: ${serverUrl}`);

// Exportation de l'instance du jeu pour y accéder depuis d'autres modules
export default game; 