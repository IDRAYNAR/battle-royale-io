# Battle Royale 2D

Un jeu battle royale en 2D où chaque joueur contrôle un cercle qui ramasse des armes et tire sur les autres. Le dernier joueur en vie remporte la partie.

## Technologies utilisées

- **Serveur** : [Colyseus](https://colyseus.io/) (pour la gestion du multijoueur en temps réel)
- **Client / Moteur de jeu** : [Phaser 3](https://phaser.io/) (pour le rendu 2D et la logique du jeu)
- **Front-end** : HTML5, CSS3, TypeScript
- **Bundler** : Webpack

## Fonctionnalités

- Jeu multijoueur en temps réel
- Système de combat avec différentes armes
- Zone de jeu qui rétrécit au fil du temps
- Système de santé et d'élimination
- Interface utilisateur avec barre de vie, minimap et compteur de joueurs

## Installation

### Prérequis

- [Node.js](https://nodejs.org/) (v14 ou supérieur)
- npm (inclus avec Node.js)

### Installation du serveur

```bash
cd server
npm install
```

### Installation du client

```bash
cd client
npm install
```

## Lancement du jeu

### Démarrer le serveur

```bash
cd server
npm start
```

Le serveur sera accessible à l'adresse `http://localhost:2567`.

### Démarrer le client

```bash
cd client
npm start
```

Le client sera accessible à l'adresse `http://localhost:8080`.

## Comment jouer

1. Ouvrez le jeu dans votre navigateur
2. Cliquez sur "JOUER" pour commencer
3. Utilisez les touches ZQSD ou les flèches pour vous déplacer
4. Cliquez pour tirer
5. Ramassez des armes pour augmenter votre puissance
6. Restez dans la zone sûre pour survivre
7. Éliminez tous les autres joueurs pour gagner

## Structure du projet

- `server/` : Code du serveur Colyseus
  - `src/` : Code source TypeScript
    - `rooms/` : Salles de jeu Colyseus
- `client/` : Code du client Phaser
  - `src/` : Code source TypeScript
    - `scenes/` : Scènes Phaser
  - `public/` : Fichiers HTML
  - `assets/` : Assets graphiques et sonores

## Licence

Ce projet est sous licence MIT. Voir le fichier LICENSE pour plus de détails. 