import 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { GameOverScene } from './scenes/GameOverScene';
import { RoomSelectionScene } from './scenes/RoomSelectionScene';

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
    gamepad: true  // Activer le support des manettes
  },
  scene: [BootScene, MenuScene, RoomSelectionScene, GameScene, GameOverScene]
};

// Création de l'instance du jeu
const game = new Phaser.Game(config);

// Gestion du redimensionnement de la fenêtre
window.addEventListener('resize', () => {
  game.scale.resize(window.innerWidth, window.innerHeight);
});

// Exportation de l'instance du jeu pour y accéder depuis d'autres modules
export default game; 