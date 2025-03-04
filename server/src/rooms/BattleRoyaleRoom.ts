import { Room, Client } from "colyseus";
import { Schema, type, MapSchema } from "@colyseus/schema";

// Définition de la classe Player pour stocker les données des joueurs
class Player extends Schema {
  @type("number") x: number = Math.floor(Math.random() * 800);
  @type("number") y: number = Math.floor(Math.random() * 600);
  @type("number") rotation: number = 0;
  @type("number") health: number = 100;
  @type("string") weapon: string = ""; // Commencer sans arme
  @type("boolean") isAlive: boolean = true;
  @type("number") ammo: number = 0; // Pas de munitions au début
  @type("number") lastShotTime: number = 0; // Temps du dernier tir
  @type("number") reloadEndTime: number = 0; // Temps de fin du rechargement
  @type("boolean") isReloading: boolean = false; // Indique si le joueur est en train de recharger
}

// Définition de la classe Bullet pour stocker les données des balles
class Bullet extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") rotation: number = 0;
  @type("string") ownerId: string = "";
  @type("number") damage: number = 10;
  @type("number") speed: number = 500;
}

// Définition de la classe Weapon pour stocker les données des armes
class Weapon extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("string") type: string = "pistol";
  @type("number") damage: number = 10;
  @type("number") fireRate: number = 1;
  @type("number") ammoCapacity: number = 9; // Capacité maximale de munitions
  @type("number") reloadTime: number = 2000; // Temps de rechargement en millisecondes
  @type("number") shotDelay: number = 1000; // Délai entre chaque tir en millisecondes
  @type("number") bulletsPerShot: number = 1; // Nombre de balles tirées par tir
}

// Définition de l'état de la salle
class BattleRoyaleState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: Bullet }) bullets = new MapSchema<Bullet>();
  @type({ map: Weapon }) weapons = new MapSchema<Weapon>();
  @type("number") mapWidth: number = 2000;
  @type("number") mapHeight: number = 2000;
  @type("number") shrinkTimer: number = 30; // Réduit de 60 à 30 secondes
  @type("number") safeZoneRadius: number = 1000; // Rayon de la zone sûre
  @type("number") safeZoneX: number = 1000; // Position X du centre de la zone sûre
  @type("number") safeZoneY: number = 1000; // Position Y du centre de la zone sûre
  @type("number") nextShrinkTime: number = 30; // Temps restant avant le prochain rétrécissement
}

export class BattleRoyaleRoom extends Room<BattleRoyaleState> {
  // Intervalle pour la mise à jour du jeu
  private gameInterval!: NodeJS.Timeout;
  // Intervalle pour le rétrécissement de la zone
  private shrinkInterval!: NodeJS.Timeout;
  // Vitesse de rétrécissement de la zone
  private shrinkSpeed: number = 10; // Augmenté de 5 à 10
  // Flag pour indiquer si la zone est active
  private zoneActive: boolean = false;

  onCreate(options: any) {
    this.setState(new BattleRoyaleState());

    // Gestion des messages du client
    this.onMessage("move", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (player && player.isAlive) {
        // Mise à jour directe des coordonnées
        player.x = data.x;
        player.y = data.y;
        player.rotation = data.rotation;
      }
    });

    this.onMessage("rotate", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (player && player.isAlive) {
        // Mise à jour de la rotation
        player.rotation = data.rotation;
      }
    });

    this.onMessage("shoot", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.isAlive) return;
      
      // Vérifier si le joueur est en train de recharger
      const currentTime = Date.now();
      if (player.isReloading && currentTime < player.reloadEndTime) {
        return; // Le joueur est en train de recharger, ne peut pas tirer
      }
      
      // Vérifier le délai entre les tirs
      let shotDelay = 1000; // Délai par défaut
      if (player.weapon === "pistol") {
        shotDelay = 1000;
      } else if (player.weapon === "rifle") {
        shotDelay = 3000;
      } else if (player.weapon === "shotgun") {
        shotDelay = 2000;
      }
      
      if (currentTime - player.lastShotTime < shotDelay) {
        return; // Le joueur a tiré trop récemment
      }
      
      // Vérifier si le joueur a des munitions
      if (player.ammo <= 0) {
        // Démarrer le rechargement automatique
        this.startReloading(player, client.sessionId);
        return;
      }
      
      // Mettre à jour le temps du dernier tir
      player.lastShotTime = currentTime;
      
      // Déterminer le nombre de balles à tirer et les propriétés en fonction de l'arme
      let bulletsPerShot = 1;
      let damage = 10;
      let speed = 500;
      let spreadAngle = 0;
      
      if (player.weapon === "pistol") {
        bulletsPerShot = 1;
        damage = 10;
        speed = 500;
      } else if (player.weapon === "rifle") {
        bulletsPerShot = 5;
        damage = 20;
        speed = 700;
        // Pour la mitraillette, on tire 5 balles à la suite avec un léger délai
        this.fireRifleBurst(player, data.rotation, damage, speed, client.sessionId);
        return;
      } else if (player.weapon === "shotgun") {
        bulletsPerShot = 3;
        damage = 30;
        speed = 400;
        spreadAngle = 0.3; // Angle d'éventail pour le shotgun (en radians)
      }
      
      // Consommer les munitions
      player.ammo -= bulletsPerShot;
      if (player.ammo < 0) player.ammo = 0;
      
      // Informer le client de la mise à jour des munitions
      this.broadcast("ammoUpdate", { playerId: client.sessionId, ammo: player.ammo });
      
      // Tirer les balles
      if (player.weapon === "shotgun") {
        // Pour le shotgun, on tire 3 balles en éventail
        this.fireShotgunSpread(player, data.rotation, damage, speed, spreadAngle, client.sessionId);
      } else {
        // Pour le pistolet, on tire une seule balle
        const bullet = new Bullet();
        bullet.x = player.x;
        bullet.y = player.y;
        bullet.rotation = data.rotation;
        bullet.ownerId = client.sessionId;
        bullet.damage = damage;
        bullet.speed = speed;
        
        this.state.bullets.set(this.generateId(), bullet);
      }
      
      // Vérifier si le chargeur est vide et démarrer le rechargement automatique
      if (player.ammo <= 0) {
        this.startReloading(player, client.sessionId);
      }
    });

    this.onMessage("pickupWeapon", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      const weapon = this.state.weapons.get(data.weaponId);
      
      if (player && weapon && player.isAlive) {
        // Distance entre le joueur et l'arme
        const distance = Math.sqrt(
          Math.pow(player.x - weapon.x, 2) + 
          Math.pow(player.y - weapon.y, 2)
        );
        
        // Si le joueur est assez proche de l'arme
        if (distance < 50) {
          player.weapon = weapon.type;
          
          // Définir les munitions en fonction du type d'arme
          if (weapon.type === "pistol") {
            player.ammo = 9;
          } else if (weapon.type === "rifle") {
            player.ammo = 20;
          } else if (weapon.type === "shotgun") {
            player.ammo = 12;
          }
          
          // Réinitialiser l'état de rechargement
          player.isReloading = false;
          
          // Informer le client de la mise à jour des munitions
          this.broadcast("ammoUpdate", { playerId: client.sessionId, ammo: player.ammo });
          
          this.state.weapons.delete(data.weaponId);
        }
      }
    });

    // Génération des armes sur la carte
    this.generateWeapons(10);
    
    // Initialisation de la zone
    this.state.safeZoneRadius = 1000;
    this.state.safeZoneX = 1000;
    this.state.safeZoneY = 1000;
    this.state.shrinkTimer = 30;
    this.state.nextShrinkTime = 30;
    this.zoneActive = true;
    
    // Envoi de l'état initial de la zone à tous les clients
    this.broadcast("zoneShrink", {
      radius: this.state.safeZoneRadius,
      x: this.state.safeZoneX,
      y: this.state.safeZoneY,
      nextShrinkTime: this.state.nextShrinkTime
    });
    
    // Démarrage de la boucle de jeu
    this.gameInterval = setInterval(() => {
      this.gameLoop();
    }, 16);
    
    // Démarrage de la boucle de rétrécissement de la zone
    this.shrinkInterval = setInterval(() => {
      if (this.zoneActive) {
        this.shrinkZone();
      }
    }, 1000);
    
    console.log("Salle créée avec succès! Zone initialisée.");
  }

  onJoin(client: Client, options: any) {
    console.log(`Client ${client.sessionId} a rejoint la salle`);
    
    // Création d'un nouveau joueur
    const player = new Player();
    
    // Positionnement du joueur dans la zone sûre et loin des autres joueurs
    const position = this.findSafeSpawnPosition();
    player.x = position.x;
    player.y = position.y;
    
    // S'assurer que le joueur commence sans arme et sans munitions
    player.weapon = "";
    player.ammo = 0;
    player.isReloading = false;
    player.lastShotTime = 0;
    
    // Ajout du joueur à la liste des joueurs
    this.state.players.set(client.sessionId, player);
    
    // Envoi de l'état de la zone au client qui vient de se connecter
    client.send("zoneShrink", {
      radius: this.state.safeZoneRadius,
      x: this.state.safeZoneX,
      y: this.state.safeZoneY,
      nextShrinkTime: this.state.nextShrinkTime
    });
    
    // Envoi des informations sur les munitions au client
    client.send("ammoUpdate", { playerId: client.sessionId, ammo: player.ammo });
  }

  onLeave(client: Client, consented: boolean) {
    console.log(`${client.sessionId} a quitté la partie!`);
    
    // Suppression du joueur de l'état de la salle
    this.state.players.delete(client.sessionId);
    
    // Vérification de la condition de victoire
    this.checkWinCondition();
  }

  onDispose() {
    console.log("Salle détruite!");
    
    // Nettoyage des intervalles
    clearInterval(this.gameInterval);
    clearInterval(this.shrinkInterval);
  }

  // Boucle de jeu principale
  private gameLoop() {
    // Mise à jour des balles
    this.updateBullets();
    
    // Vérification des collisions
    this.checkCollisions();
    
    // Vérification de la condition de victoire
    this.checkWinCondition();
    
    // Vérification des joueurs hors de la zone sûre
    this.checkSafeZone();
  }

  // Mise à jour des balles
  private updateBullets() {
    this.state.bullets.forEach((bullet, bulletId) => {
      // Calcul de la nouvelle position de la balle
      const deltaX = Math.cos(bullet.rotation) * (bullet.speed / 60);
      const deltaY = Math.sin(bullet.rotation) * (bullet.speed / 60);
      
      bullet.x += deltaX;
      bullet.y += deltaY;
      
      // Suppression des balles qui sortent de la carte
      if (
        bullet.x < 0 || 
        bullet.x > this.state.mapWidth || 
        bullet.y < 0 || 
        bullet.y > this.state.mapHeight
      ) {
        this.state.bullets.delete(bulletId);
      }
    });
  }

  // Vérification des collisions
  private checkCollisions() {
    // Vérification des collisions entre les balles et les joueurs
    this.state.bullets.forEach((bullet, bulletId) => {
      this.state.players.forEach((player, playerId) => {
        // Ne pas vérifier les collisions avec le propriétaire de la balle
        if (playerId !== bullet.ownerId && player.isAlive) {
          // Distance entre la balle et le joueur
          const distance = Math.sqrt(
            Math.pow(player.x - bullet.x, 2) + 
            Math.pow(player.y - bullet.y, 2)
          );
          
          // Si la distance est inférieure à 20 (rayon du joueur), il y a collision
          if (distance < 20) {
            // Réduction de la santé du joueur
            player.health -= bullet.damage;
            
            // Si la santé du joueur est inférieure ou égale à 0, il est éliminé
            if (player.health <= 0) {
              player.isAlive = false;
              
              // Compter les joueurs encore en vie
              let playersLeft = 0;
              this.state.players.forEach((p) => {
                if (p.isAlive) playersLeft++;
              });
              
              this.broadcast("playerEliminated", { playerId, playersLeft });
            }
            
            // Suppression de la balle
            this.state.bullets.delete(bulletId);
          }
        }
      });
    });
  }

  // Vérification de la condition de victoire
  private checkWinCondition() {
    // Comptage des joueurs encore en vie
    let alivePlayers = 0;
    let lastAlivePlayerId = "";
    
    this.state.players.forEach((player, playerId) => {
      if (player.isAlive) {
        alivePlayers++;
        lastAlivePlayerId = playerId;
      }
    });
    
    // S'il ne reste qu'un seul joueur en vie, il a gagné
    if (alivePlayers === 1 && this.state.players.size > 1) {
      this.broadcast("gameOver", { winnerId: lastAlivePlayerId });
      
      // Fermer la salle après 5 secondes
      setTimeout(() => {
        // Envoyer un message à tous les clients pour forcer le rafraîchissement de la page
        this.broadcast("forceRefresh", {});
        
        // Attendre un court instant pour que le message soit reçu
        setTimeout(() => {
          // Déconnecter tous les clients
          this.clients.forEach(client => {
            client.leave(1000);
          });
          // Puis fermer la salle
          this.disconnect();
        }, 500);
      }, 5000);
    }
  }

  // Vérification des joueurs hors de la zone sûre
  private checkSafeZone() {
    this.state.players.forEach((player, playerId) => {
      if (player.isAlive) {
        // Distance entre le joueur et le centre de la zone sûre
        const distance = Math.sqrt(
          Math.pow(player.x - this.state.safeZoneX, 2) + 
          Math.pow(player.y - this.state.safeZoneY, 2)
        );
        
        // Si le joueur est en dehors de la zone sûre, il prend des dégâts
        if (distance > this.state.safeZoneRadius) {
          player.health -= 1;
          
          // Si la santé du joueur est inférieure ou égale à 0, il est éliminé
          if (player.health <= 0) {
            player.isAlive = false;
            
            // Compter les joueurs encore en vie
            let playersLeft = 0;
            this.state.players.forEach((p) => {
              if (p.isAlive) playersLeft++;
            });
            
            this.broadcast("playerEliminated", { playerId, playersLeft });
          }
        }
      }
    });
  }

  // Rétrécissement de la zone sûre
  private shrinkZone() {
    if (!this.zoneActive) return;
    
    // Réduction du temps avant le prochain rétrécissement
    this.state.shrinkTimer--;
    this.state.nextShrinkTime = this.state.shrinkTimer;
    
    // Si le temps est écoulé, rétrécir la zone
    if (this.state.shrinkTimer <= 0) {
      // Réinitialisation du timer
      this.state.shrinkTimer = 30;
      this.state.nextShrinkTime = 30;
      
      // Réduction du rayon de la zone sûre
      const newRadius = Math.max(100, this.state.safeZoneRadius - this.shrinkSpeed);
      this.state.safeZoneRadius = newRadius;
      
      console.log(`Zone rétrécie: ${this.state.safeZoneRadius}, position: ${this.state.safeZoneX},${this.state.safeZoneY}`);
      
      // Notification aux clients
      this.broadcast("zoneShrink", {
        radius: this.state.safeZoneRadius,
        x: this.state.safeZoneX,
        y: this.state.safeZoneY,
        nextShrinkTime: this.state.nextShrinkTime
      });
    } else {
      // Notification aux clients du temps restant
      this.broadcast("zoneTimer", {
        nextShrinkTime: this.state.nextShrinkTime
      });
    }
  }

  // Génération des armes sur la carte
  private generateWeapons(count: number) {
    const weaponTypes = ["pistol", "rifle", "shotgun"];
    
    for (let i = 0; i < count; i++) {
      const weapon = new Weapon();
      
      // Position aléatoire sur la carte
      weapon.x = Math.floor(Math.random() * this.state.mapWidth);
      weapon.y = Math.floor(Math.random() * this.state.mapHeight);
      
      // Type d'arme aléatoire
      weapon.type = weaponTypes[Math.floor(Math.random() * weaponTypes.length)];
      
      // Définition des propriétés de l'arme en fonction de son type
      if (weapon.type === "pistol") {
        weapon.damage = 10;
        weapon.fireRate = 1;
        weapon.ammoCapacity = 9;
        weapon.reloadTime = 2000; // 2 secondes
        weapon.shotDelay = 1000; // 1 seconde
        weapon.bulletsPerShot = 1;
      } else if (weapon.type === "rifle") {
        weapon.damage = 20;
        weapon.fireRate = 2;
        weapon.ammoCapacity = 20;
        weapon.reloadTime = 3000; // 3 secondes
        weapon.shotDelay = 3000; // 3 secondes
        weapon.bulletsPerShot = 5; // 5 balles à la suite
      } else if (weapon.type === "shotgun") {
        weapon.damage = 30;
        weapon.fireRate = 0.5;
        weapon.ammoCapacity = 12;
        weapon.reloadTime = 5000; // 5 secondes
        weapon.shotDelay = 2000; // 2 secondes
        weapon.bulletsPerShot = 3; // 3 balles en éventail
      }
      
      // Ajout de l'arme à l'état de la salle
      this.state.weapons.set(this.generateId(), weapon);
    }
  }

  // Génération d'un identifiant unique
  private generateId(): string {
    return Math.random().toString(36).substring(2, 9);
  }

  // Trouver une position sûre pour faire apparaître un joueur
  private findSafeSpawnPosition(): { x: number, y: number } {
    const minDistanceBetweenPlayers = 300; // Distance minimale entre les joueurs
    const maxAttempts = 50; // Nombre maximum de tentatives
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Générer une position aléatoire dans la zone sûre
      const angle = Math.random() * Math.PI * 2; // Angle aléatoire
      const distance = Math.random() * (this.state.safeZoneRadius * 0.8); // Distance du centre (80% du rayon max)
      
      const x = this.state.safeZoneX + Math.cos(angle) * distance;
      const y = this.state.safeZoneY + Math.sin(angle) * distance;
      
      // Vérifier si la position est suffisamment éloignée des autres joueurs
      let isFarEnough = true;
      
      this.state.players.forEach((otherPlayer) => {
        const distanceToPlayer = Math.sqrt(
          Math.pow(x - otherPlayer.x, 2) + 
          Math.pow(y - otherPlayer.y, 2)
        );
        
        if (distanceToPlayer < minDistanceBetweenPlayers) {
          isFarEnough = false;
        }
      });
      
      // Si la position est valide, la retourner
      if (isFarEnough) {
        console.log(`Position de spawn trouvée: (${x}, ${y})`);
        return { x, y };
      }
    }
    
    // Si aucune position n'a été trouvée après le nombre maximum de tentatives,
    // générer une position aléatoire dans la zone sûre sans tenir compte des autres joueurs
    console.log("Aucune position idéale trouvée, génération d'une position aléatoire dans la zone sûre");
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * (this.state.safeZoneRadius * 0.7);
    
    return {
      x: this.state.safeZoneX + Math.cos(angle) * distance,
      y: this.state.safeZoneY + Math.sin(angle) * distance
    };
  }

  // Méthode pour démarrer le rechargement
  private startReloading(player: Player, playerId: string) {
    if (player.isReloading) return;
    
    player.isReloading = true;
    
    // Déterminer le temps de rechargement en fonction de l'arme
    let reloadTime = 2000; // Temps par défaut
    if (player.weapon === "pistol") {
      reloadTime = 2000;
    } else if (player.weapon === "rifle") {
      reloadTime = 3000;
    } else if (player.weapon === "shotgun") {
      reloadTime = 5000;
    }
    
    // Définir le temps de fin du rechargement
    player.reloadEndTime = Date.now() + reloadTime;
    
    // Informer le client du début du rechargement
    this.broadcast("reloadStart", { playerId, reloadTime });
    
    // Programmer la fin du rechargement
    setTimeout(() => {
      if (player.isAlive) {
        // Recharger les munitions en fonction de l'arme
        if (player.weapon === "pistol") {
          player.ammo = 9;
        } else if (player.weapon === "rifle") {
          player.ammo = 20;
        } else if (player.weapon === "shotgun") {
          player.ammo = 12;
        }
        
        player.isReloading = false;
        
        // Informer le client de la fin du rechargement et de la mise à jour des munitions
        this.broadcast("reloadEnd", { playerId });
        this.broadcast("ammoUpdate", { playerId, ammo: player.ammo });
      }
    }, reloadTime);
  }

  // Méthode pour tirer une rafale de balles avec la mitraillette
  private fireRifleBurst(player: Player, rotation: number, damage: number, speed: number, playerId: string) {
    // Consommer les munitions
    const bulletsToFire = Math.min(5, player.ammo);
    player.ammo -= bulletsToFire;
    
    // Informer le client de la mise à jour des munitions
    this.broadcast("ammoUpdate", { playerId, ammo: player.ammo });
    
    // Tirer les balles avec un léger délai entre chaque
    for (let i = 0; i < bulletsToFire; i++) {
      setTimeout(() => {
        if (player.isAlive) {
          const bullet = new Bullet();
          bullet.x = player.x;
          bullet.y = player.y;
          bullet.rotation = rotation;
          bullet.ownerId = playerId;
          bullet.damage = damage;
          bullet.speed = speed;
          
          this.state.bullets.set(this.generateId(), bullet);
        }
      }, i * 100); // 100ms entre chaque balle
    }
    
    // Vérifier si le chargeur est vide et démarrer le rechargement automatique
    if (player.ammo <= 0) {
      setTimeout(() => {
        if (player.isAlive) {
          this.startReloading(player, playerId);
        }
      }, bulletsToFire * 100);
    }
  }

  // Méthode pour tirer des balles en éventail avec le shotgun
  private fireShotgunSpread(player: Player, rotation: number, damage: number, speed: number, spreadAngle: number, playerId: string) {
    // Tirer 3 balles en éventail
    for (let i = -1; i <= 1; i++) {
      const bullet = new Bullet();
      bullet.x = player.x;
      bullet.y = player.y;
      bullet.rotation = rotation + (i * spreadAngle);
      bullet.ownerId = playerId;
      bullet.damage = damage;
      bullet.speed = speed;
      
      this.state.bullets.set(this.generateId(), bullet);
    }
  }
} 