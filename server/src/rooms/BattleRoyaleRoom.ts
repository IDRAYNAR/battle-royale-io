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
  @type("number") magazineCount: number = 0; // Nombre de chargeurs en réserve
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
  @type("number") mapWidth: number = 3968; // 62 tiles * 64 pixels
  @type("number") mapHeight: number = 3968; // 62 tiles * 64 pixels
  @type("number") shrinkTimer: number = 5; // Réduit de 30 à 5 secondes
  @type("number") safeZoneRadius: number = 5000; // Rayon initial plus grand que la map pour commencer en dehors
  @type("number") safeZoneX: number = 1984; // Position X du centre de la zone sûre (moitié de la map)
  @type("number") safeZoneY: number = 1984; // Position Y du centre de la zone sûre (moitié de la map)
  @type("number") nextShrinkTime: number = 5; // Temps restant avant le prochain rétrécissement réduit à 5 secondes
}

export class BattleRoyaleRoom extends Room<BattleRoyaleState> {
  private gameInterval!: NodeJS.Timeout;
  private shrinkInterval!: NodeJS.Timeout;
  private shrinkSpeed: number = 250; // Augmenté de 50 à 150 pour un rétrécissement plus rapide
  private zoneActive: boolean = false;
  private minWeapons: number = 15;
  private colliderPositions: Array<{x: number, y: number, radius: number}> = [];

  onCreate(options: any) {
    console.log(`🎮 Création d'une nouvelle salle avec options:`, options);
    
    // Configuration de l'ID de salle personnalisé si fourni
    if (options.roomId) {
      this.roomId = options.roomId;
      console.log(`🔷 Utilisation d'un ID personnalisé: ${this.roomId}`);
    }
    
    // Initialisation de l'état du jeu
    this.setState(new BattleRoyaleState());
    
    // Utiliser les métadonnées envoyées par le client ou créer des métadonnées par défaut
    const metadata = {
      name: options.name || `Salle ${Math.floor(Math.random() * 1000)}`,
      createdAt: options.metadata?.createdAt || new Date().toISOString(),
      gameType: "battle_royale",
      uniqueId: options.metadata?.uniqueId || `${Date.now()}-${Math.floor(Math.random() * 10000)}`
    };
    
    // Définir les métadonnées pour que les clients puissent les voir
    this.setMetadata(metadata);
    
    console.log(`🔷 Salle créée avec ID: ${this.roomId}`);
    console.log(`🔷 Métadonnées de la salle: ${JSON.stringify(this.metadata)}`);
    
    // Nombre maximum de joueurs par salle
    this.maxClients = 10;

    // Configuration des dimensions de la carte
    this.state.mapWidth = 3968; // 62 tiles * 64 pixels
    this.state.mapHeight = 3968; // 62 tiles * 64 pixels
    
    // Tableau pour stocker les positions des obstacles avec collider
    // const colliderPositions: Array<{x: number, y: number, radius: number}> = [];

    // Gestion des messages du client
    this.onMessage("move", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (player && player.isAlive) {
        // Vérifier que les coordonnées sont des nombres valides
        if (data.x !== undefined && !isNaN(data.x) && isFinite(data.x) &&
            data.y !== undefined && !isNaN(data.y) && isFinite(data.y)) {
          // Mise à jour directe des coordonnées
          player.x = data.x;
          player.y = data.y;
        }
        
        // Vérifier que la rotation est un nombre valide
        if (data.rotation !== undefined && !isNaN(data.rotation) && isFinite(data.rotation)) {
          player.rotation = data.rotation;
        }
      }
    });

    this.onMessage("rotate", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (player && player.isAlive) {
        // Vérifier que la rotation est un nombre valide
        if (data.rotation !== undefined && !isNaN(data.rotation) && isFinite(data.rotation)) {
          // Mise à jour de la rotation
          player.rotation = data.rotation;
        }
      }
    });

    this.onMessage("shoot", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.isAlive) return;
      
      // Vérifier que la rotation est un nombre valide
      if (data.rotation === undefined || isNaN(data.rotation) || !isFinite(data.rotation)) {
        return; // Ne pas traiter le tir si la rotation n'est pas valide
      }
      
      // Vérifier si le joueur a une arme
      if (!player.weapon || player.weapon === "") {
        console.log(`Joueur ${client.sessionId} a essayé de tirer sans arme`);
        return;
      }
      
      // Vérifier si le joueur est en train de recharger
      const currentTime = Date.now();
      if (player.isReloading && currentTime < player.reloadEndTime) {
        return; // Le joueur est en train de recharger, ne peut pas tirer
      }
      
      // Vérifier le délai entre les tirs
      let shotDelay = 500; // Délai par défaut (500ms)
      if (player.weapon === "pistol") {
        shotDelay = 500; // 500ms entre chaque tir
      } else if (player.weapon === "rifle") {
        shotDelay = 200; // 200ms entre chaque tir
      } else if (player.weapon === "shotgun") {
        shotDelay = 1000; // 1000ms entre chaque tir
      }
      
      if (currentTime - player.lastShotTime < shotDelay) {
        console.log(`Joueur ${client.sessionId} a essayé de tirer trop rapidement`);
        return; // Le joueur a tiré trop récemment
      }
      
      // Déterminer le nombre de balles à tirer et les propriétés en fonction de l'arme
      let bulletsPerShot = 1;
      let damage = 10;
      let speed = 500;
      let spreadAngle = 0;
      let ammoToConsume = 1; // Munitions à consommer par tir
      
      if (player.weapon === "pistol") {
        bulletsPerShot = 1;
        damage = 10;
        speed = 500;
        ammoToConsume = 1;
      } else if (player.weapon === "rifle") {
        bulletsPerShot = 3; // Rafale de 3 balles
        damage = 15;
        speed = 600;
        ammoToConsume = 5; // Consomme 5 munitions par tir
      } else if (player.weapon === "shotgun") {
        bulletsPerShot = 5; // 5 projectiles en éventail
        damage = 8;
        speed = 400;
        spreadAngle = Math.PI / 8; // 22.5 degrés
        ammoToConsume = 5; // Consomme 5 munitions par tir pour le shotgun
      }
      
      // Vérifier si le joueur a assez de munitions
      if (player.ammo < ammoToConsume) {
        // Vérifier si le joueur a des chargeurs
        if (player.magazineCount > 0) {
          // Essayer d'auto-recharger l'arme, pas besoin d'action côté serveur
          // Le client va demander un rechargement
          console.log(`Joueur ${client.sessionId} doit recharger son arme`);
          return;
        } else {
          // Plus de munitions et pas de chargeurs, le joueur perd son arme
          player.weapon = "";
          player.ammo = 0;
          
          // Informer les clients que le joueur a perdu son arme
          this.broadcast("weaponUpdate", { playerId: client.sessionId, weapon: "" });
          this.broadcast("ammoUpdate", { playerId: client.sessionId, ammo: 0 });
          
          console.log(`Joueur ${client.sessionId} n'a plus de munitions et pas de chargeurs, il a perdu son arme`);
          return;
        }
      }
      
      // Mettre à jour le temps du dernier tir
      player.lastShotTime = currentTime;
      
      // Consommer les munitions
      player.ammo -= ammoToConsume;
      console.log(`Joueur ${client.sessionId} a tiré avec ${player.weapon}, munitions restantes: ${player.ammo}`);
      
      // Informer le client de la mise à jour des munitions
      this.broadcast("ammoUpdate", { playerId: client.sessionId, ammo: player.ammo });
      
      // Tirer en fonction du type d'arme
      if (player.weapon === "rifle") {
        this.fireRifleBurst(player, data.rotation, damage, speed, client.sessionId);
      } else if (player.weapon === "shotgun") {
        this.fireShotgunSpread(player, data.rotation, damage, speed, spreadAngle, client.sessionId);
      } else {
        // Pistolet ou autre arme à tir unique
        this.createBullet(player.x, player.y, data.rotation, damage, speed, client.sessionId);
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
        
        // Vérifier si le joueur est assez proche de l'arme
        if (distance <= 100) {
          // Si le joueur a déjà la même arme, ajouter un chargeur
          if (player.weapon === weapon.type) {
            player.magazineCount += 1;
            
            // Informer les clients que le joueur a récupéré un chargeur
            this.broadcast("magazineUpdate", { 
              playerId: client.sessionId, 
              magazineCount: player.magazineCount 
            });
            
            console.log(`Joueur ${client.sessionId} a récupéré un chargeur pour son ${weapon.type}, total: ${player.magazineCount}`);
          } else {
            // Attribuer l'arme au joueur
            player.weapon = weapon.type;
            
            // Définir les munitions en fonction du type d'arme
            if (weapon.type === "pistol") {
              player.ammo = 9;
            } else if (weapon.type === "rifle") {
              player.ammo = 30;
            } else if (weapon.type === "shotgun") {
              player.ammo = 20; // 4 tirs de 5 balles chacun
            }
            
            // Réinitialiser le nombre de chargeurs
            player.magazineCount = 0;
            
            // Informer les clients que le joueur a ramassé une arme
            this.broadcast("weaponUpdate", { playerId: client.sessionId, weapon: weapon.type });
            this.broadcast("ammoUpdate", { playerId: client.sessionId, ammo: player.ammo });
            this.broadcast("magazineUpdate", { playerId: client.sessionId, magazineCount: player.magazineCount });
            
            console.log(`Joueur ${client.sessionId} a ramassé une arme ${weapon.type} avec ${player.ammo} munitions`);
          }
          
          // Supprimer l'arme de la carte
          this.state.weapons.delete(data.weaponId);
        }
      }
    });

    this.onMessage("reload", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.isAlive || !player.weapon) return;
      
      // Vérifier si le joueur a au moins un chargeur
      if (player.magazineCount > 0) {
        // Définir le temps de rechargement en fonction de l'arme
        let reloadTime = 2000; // 2 secondes par défaut
        
        if (player.weapon === "pistol") {
          reloadTime = 1500; // 1.5 secondes pour le pistolet
        } else if (player.weapon === "rifle") {
          reloadTime = 2500; // 2.5 secondes pour le fusil d'assaut
        } else if (player.weapon === "shotgun") {
          reloadTime = 3000; // 3 secondes pour le fusil à pompe
        }
        
        // Marquer le joueur comme étant en train de recharger
        player.isReloading = true;
        
        // Définir la fin du rechargement
        player.reloadEndTime = Date.now() + reloadTime;
        
        // Informer les clients que le joueur commence à recharger
        this.broadcast("reloadStart", { 
          playerId: client.sessionId,
          reloadTime: reloadTime
        });
        
        // Programmer la fin du rechargement
        setTimeout(() => {
          if (player && player.isAlive && player.isReloading) {
            // Fin du rechargement, remplir les munitions
            if (player.weapon === "pistol") {
              player.ammo = 9;
            } else if (player.weapon === "rifle") {
              player.ammo = 30;
            } else if (player.weapon === "shotgun") {
              player.ammo = 20;
            }
            
            // Décrémenter le nombre de chargeurs
            player.magazineCount--;
            
            // Marquer le joueur comme n'étant plus en train de recharger
            player.isReloading = false;
            
            // Informer les clients de la fin du rechargement
            this.broadcast("reloadEnd", { playerId: client.sessionId });
            this.broadcast("ammoUpdate", { playerId: client.sessionId, ammo: player.ammo });
            this.broadcast("magazineUpdate", { playerId: client.sessionId, magazineCount: player.magazineCount });
            
            console.log(`Joueur ${client.sessionId} a rechargé son arme, total de munitions: ${player.ammo}, chargeurs restants: ${player.magazineCount}`);
          }
        }, reloadTime);
      } else {
        // Pas de chargeurs disponibles, envoyer un message
        this.broadcast("reloadFail", { 
          playerId: client.sessionId,
          message: "Aucun chargeur disponible"
        });
        
        console.log(`Joueur ${client.sessionId} n'a pas de chargeurs disponibles pour recharger`);
      }
    });
    
    this.onMessage("dropWeapon", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.isAlive) return;
      
      // Retirer l'arme du joueur
      player.weapon = "";
      player.ammo = 0;
      
      // Informer les clients que le joueur a lâché son arme
      this.broadcast("weaponUpdate", { playerId: client.sessionId, weapon: "" });
      this.broadcast("ammoUpdate", { playerId: client.sessionId, ammo: 0 });
      
      console.log(`Joueur ${client.sessionId} a lâché son arme`);
    });

    // Génération des armes sur la carte
    this.generateWeapons(Math.max(10, this.minWeapons));
    
    // Initialisation de la zone
    this.state.safeZoneRadius = 5000;
    this.state.safeZoneX = 1984;
    this.state.safeZoneY = 1984;
    this.state.shrinkTimer = 5;
    this.state.nextShrinkTime = 5;
    this.zoneActive = true;
    
    // Envoi de l'état initial de la zone à tous les clients
    this.broadcast("zoneShrink", {
      radius: this.state.safeZoneRadius,
      x: this.state.safeZoneX,
      y: this.state.safeZoneY,
      nextShrinkTime: this.state.nextShrinkTime
    });
    
    // Ajouter un gestionnaire pour recevoir les positions des obstacles avec collider
    this.onMessage("reportCollider", (client, data) => {
      // Vérifier si les données sont valides
      if (data && typeof data.x === 'number' && typeof data.y === 'number' && typeof data.radius === 'number') {
        // Ajouter la position de l'obstacle à la liste des positions à éviter
        this.colliderPositions.push({
          x: data.x,
          y: data.y,
          radius: data.radius
        });
        
        // Si c'est le premier client à signaler des colliders, vérifier les armes existantes
        if (this.colliderPositions.length === 1) {
          console.log("Premier collider rapporté, planification de la vérification des armes...");
          // Planifier une vérification des armes après avoir reçu plus de colliders
          setTimeout(() => {
            console.log("Vérification initiale des positions d'armes...");
            this.checkWeaponPositions();
          }, 2000); // Attendre 2 secondes pour recevoir plus de colliders
        }
      }
    });
    
    // Gestionnaire pour supprimer une balle lorsqu'elle touche un obstacle
    this.onMessage("removeBullet", (client, data) => {
      if (data && data.bulletId) {
        // Vérifier que la balle existe avant de la supprimer
        if (this.state.bullets.has(data.bulletId)) {
          console.log(`Suppression de la balle ${data.bulletId} suite à une collision avec un obstacle`);
          this.state.bullets.delete(data.bulletId);
        }
      }
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
    console.log(`🟢 Joueur ${client.sessionId} a rejoint la salle ${this.roomId}`);
    
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
    console.log(`🔴 Joueur ${client.sessionId} a quitté la salle ${this.roomId}`);
    
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
    this.updateBullets();
    this.checkCollisions();
    this.checkWinCondition();
    
    // Vérifier qu'il y a toujours le nombre minimum d'armes sur la carte
    this.ensureMinimumWeapons();
    
    if (this.zoneActive) {
      this.checkSafeZone();
    }
  }

  // Mise à jour des balles
  private updateBullets() {
    this.state.bullets.forEach((bullet, bulletId) => {
      // Calcul de la nouvelle position de la balle
      const deltaX = Math.cos(bullet.rotation) * (bullet.speed / 60);
      const deltaY = Math.sin(bullet.rotation) * (bullet.speed / 60);
      
      // Vérifier si la nouvelle position entrainerait une collision avec un collider
      const newX = bullet.x + deltaX;
      const newY = bullet.y + deltaY;
      
      // Vérifier les collisions avec les éléments du décor
      let hasCollision = false;
      
      // Distance maximale pour le test de collision = distance parcourue par la balle + marge de sécurité
      const maxDistance = Math.sqrt(Math.pow(deltaX, 2) + Math.pow(deltaY, 2)) + 50; // Réduire la marge de 100 à 50
      
      // Calcul du segment de la trajectoire de la balle
      const bulletPathStart = { x: bullet.x, y: bullet.y };
      const bulletPathEnd = { x: newX, y: newY };
      
      // Parcourir tous les colliders enregistrés
      for (const collider of this.colliderPositions) {
        // Calcul préliminaire de la distance entre la balle et le collider
        const approxDistance = Math.sqrt(
          Math.pow(bullet.x - collider.x, 2) + 
          Math.pow(bullet.y - collider.y, 2)
        );
        
        // Si le collider est trop loin, on l'ignore
        // Utiliser une valeur plus petite pour le rayon du collider (facteur 0.8)
        const adjustedRadius = collider.radius * 0.8;
        if (approxDistance > maxDistance + adjustedRadius) {
          continue;
        }
        
        // Vérifier si la balle touche réellement le collider
        // Calcul de la distance minimale entre le segment de trajectoire et le centre du collider
        const distanceToSegment = this.distancePointToSegment(
          collider.x, collider.y,
          bulletPathStart.x, bulletPathStart.y,
          bulletPathEnd.x, bulletPathEnd.y
        );
        
        // Si la distance minimale est inférieure au rayon ajusté du collider, il y a collision
        if (distanceToSegment < adjustedRadius) {
          // Collision détectée, supprimer la balle
          console.log(`Collision de balle avec un obstacle détectée sur le serveur: ${bulletId}`);
          this.state.bullets.delete(bulletId);
          hasCollision = true;
          break;
        }
      }
      
      // Si pas de collision, mettre à jour la position de la balle
      if (!hasCollision) {
        bullet.x = newX;
        bullet.y = newY;
        
        // Suppression des balles qui sortent de la carte
        if (
          bullet.x < 0 || 
          bullet.x > this.state.mapWidth || 
          bullet.y < 0 || 
          bullet.y > this.state.mapHeight
        ) {
          this.state.bullets.delete(bulletId);
        }
      }
    });
  }
  
  // Calcul de la distance minimale entre un point et un segment de ligne
  private distancePointToSegment(
    px: number, py: number,   // Point
    x1: number, y1: number,   // Début du segment
    x2: number, y2: number    // Fin du segment
  ): number {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) {
      param = dot / lenSq;
    }
    
    let xx, yy;
    
    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }
    
    const dx = px - xx;
    const dy = py - yy;
    
    return Math.sqrt(dx * dx + dy * dy);
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
    // Si la zone n'est pas encore active, l'activer
    if (!this.zoneActive) {
      this.zoneActive = true;
    }

    // Décrémenter le timer
    this.state.shrinkTimer--;
    this.state.nextShrinkTime = this.state.shrinkTimer;
    
    // Si le timer atteint zéro, rétrécir la zone
    if (this.state.shrinkTimer <= 0) {
      // Réinitialiser le timer
      this.state.shrinkTimer = 5;
      this.state.nextShrinkTime = 5;
      
      const currentRadius = this.state.safeZoneRadius;
      
      // Réduire le rayon de la zone
      const newRadius = Math.max(200, currentRadius - this.shrinkSpeed);
      this.state.safeZoneRadius = newRadius;
      
      console.log(`Zone rétrécie: ${this.state.safeZoneRadius}, position: ${this.state.safeZoneX},${this.state.safeZoneY}`);
      
      // Notification aux clients
      this.broadcast("zoneUpdate", {
        x: this.state.safeZoneX,
        y: this.state.safeZoneY,
        radius: this.state.safeZoneRadius,
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
      this.generateSingleWeapon();
    }
  }
  
  // Génération d'une seule arme
  private generateSingleWeapon() {
    const weapon = new Weapon();
    
    // Générer une position aléatoire sur la carte
    const position = this.findSafeSpawnPosition();
    weapon.x = position.x;
    weapon.y = position.y;
    
    // Déterminer le type d'arme aléatoirement
    const weaponTypes = ["pistol", "rifle", "shotgun"];
    const randomType = weaponTypes[Math.floor(Math.random() * weaponTypes.length)];
    weapon.type = randomType;
    
    // Définir les propriétés en fonction du type d'arme
    if (randomType === "pistol") {
      weapon.damage = 10;
      weapon.fireRate = 1;
      weapon.ammoCapacity = 9;
      weapon.reloadTime = 1500;
      weapon.shotDelay = 500;
      weapon.bulletsPerShot = 1;
    } else if (randomType === "rifle") {
      weapon.damage = 15;
      weapon.fireRate = 3;
      weapon.ammoCapacity = 30;
      weapon.reloadTime = 2500;
      weapon.shotDelay = 200;
      weapon.bulletsPerShot = 3;
    } else if (randomType === "shotgun") {
      weapon.damage = 8;
      weapon.fireRate = 0.5;
      weapon.ammoCapacity = 20; // 4 tirs de 5 balles chacun
      weapon.reloadTime = 3000;
      weapon.shotDelay = 1000;
      weapon.bulletsPerShot = 5;
    }
    
    // Générer un ID unique pour l'arme
    const weaponId = this.generateId();
    
    // Ajouter l'arme à l'état du jeu
    this.state.weapons.set(weaponId, weapon);
    
    return weaponId;
  }
  
  // Vérification du nombre d'armes sur la carte
  private ensureMinimumWeapons() {
    // Vérifier et corriger la position des armes existantes
    this.checkWeaponPositions();
    
    // Ajouter de nouvelles armes si nécessaire
    const currentWeaponCount = this.state.weapons.size;
    if (currentWeaponCount < this.minWeapons) {
      const weaponsToAdd = this.minWeapons - currentWeaponCount;
      this.generateWeapons(weaponsToAdd);
    }
  }
  
  // Vérification et correction des positions des armes existantes
  private checkWeaponPositions() {
    // Ne vérifier les positions que si nous avons des colliders
    if (this.colliderPositions.length === 0) {
      return;
    }
    
    // Parcourir toutes les armes
    this.state.weapons.forEach((weapon, weaponId) => {
      // Vérifier si l'arme est dans un collider
      let isInCollider = false;
      
      for (const collider of this.colliderPositions) {
        const distanceToCollider = Math.sqrt(
          Math.pow(weapon.x - collider.x, 2) + 
          Math.pow(weapon.y - collider.y, 2)
        );
        
        if (distanceToCollider < collider.radius) {
          isInCollider = true;
          break;
        }
      }
      
      // Si l'arme est dans un collider, la déplacer
      if (isInCollider) {
        console.log(`Arme ${weaponId} de type ${weapon.type} est dans un collider, déplacement...`);
        
        // Trouver une nouvelle position
        const newPosition = this.findSafeSpawnPosition();
        
        // Mettre à jour la position de l'arme
        weapon.x = newPosition.x;
        weapon.y = newPosition.y;
        
        console.log(`Arme ${weaponId} déplacée à la nouvelle position: (${weapon.x}, ${weapon.y})`);
      }
    });
  }

  // Génération d'un identifiant unique
  private generateId(): string {
    return Math.random().toString(36).substring(2, 9);
  }

  // Trouver une position sûre pour faire apparaître un joueur ou une arme
  private findSafeSpawnPosition(): { x: number, y: number } {
    const minDistanceBetweenPlayers = 300; // Distance minimale entre les joueurs
    const maxAttempts = 100; // Augmenter le nombre maximum de tentatives pour être sûr de trouver une position valide
    
    // Tentatives pour trouver une position idéale (loin des joueurs ET des colliders)
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
      
      // Vérifier si la position est éloignée des éléments avec des colliders
      const safeDistanceFromColliders = 50; // Distance minimale des éléments avec collider
      
      for (const collider of this.colliderPositions) {
        const distanceToCollider = Math.sqrt(
          Math.pow(x - collider.x, 2) + 
          Math.pow(y - collider.y, 2)
        );
        
        if (distanceToCollider < (collider.radius + safeDistanceFromColliders)) {
          isFarEnough = false;
          break;
        }
      }
      
      // Si la position est valide, la retourner
      if (isFarEnough) {
        console.log(`Position de spawn idéale trouvée: (${x}, ${y})`);
        return { x, y };
      }
    }
    
    console.log("Aucune position idéale trouvée, recherche d'une position sans collider");
    
    // Si on ne trouve pas de position idéale, rechercher une position qui évite au moins les colliders
    // (même si elle est proche d'autres joueurs)
    for (let attempt = 0; attempt < maxAttempts * 2; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * (this.state.safeZoneRadius * 0.9);
      const x = this.state.safeZoneX + Math.cos(angle) * distance;
      const y = this.state.safeZoneY + Math.sin(angle) * distance;
      
      // Vérifier uniquement si la position est loin des colliders
      let isValidPosition = true;
      
      // Réduire légèrement la marge pour accepter plus de positions
      const minDistanceFromColliders = 30;
      
      for (const collider of this.colliderPositions) {
        const distanceToCollider = Math.sqrt(
          Math.pow(x - collider.x, 2) + 
          Math.pow(y - collider.y, 2)
        );
        
        if (distanceToCollider < (collider.radius + minDistanceFromColliders)) {
          isValidPosition = false;
          break;
        }
      }
      
      if (isValidPosition) {
        console.log(`Position de spawn sans collider trouvée: (${x}, ${y})`);
        return { x, y };
      }
    }
    
    // Si même cela échoue, générer des positions aléatoires dans des zones prédéfinies "sûres"
    // Ces zones sont définies à des endroits connus pour être sans obstacles
    console.log("Utilisation des positions sûres prédéfinies");
    
    // Définir quelques positions sûres connues sur la map
    const safePositions = [
      { x: 400, y: 400 },    // Coin supérieur gauche
      { x: 3600, y: 400 },   // Coin supérieur droit
      { x: 400, y: 3600 },   // Coin inférieur gauche
      { x: 3600, y: 3600 },  // Coin inférieur droit
      { x: 2000, y: 2000 },  // Centre
      { x: 1000, y: 1000 },  // Quart supérieur gauche
      { x: 3000, y: 1000 },  // Quart supérieur droit
      { x: 1000, y: 3000 },  // Quart inférieur gauche
      { x: 3000, y: 3000 }   // Quart inférieur droit
    ];
    
    // Ajouter une légère variation aléatoire à ces positions pour éviter les superpositions
    const randomIndex = Math.floor(Math.random() * safePositions.length);
    const safePos = safePositions[randomIndex];
    
    // Ajouter une variation aléatoire de ±100 pixels
    const variation = 100;
    const finalX = safePos.x + (Math.random() * variation * 2 - variation);
    const finalY = safePos.y + (Math.random() * variation * 2 - variation);
    
    console.log(`Position de secours utilisée: (${finalX}, ${finalY})`);
    return { x: finalX, y: finalY };
  }

  // Méthode pour tirer une rafale de balles avec la mitraillette
  private fireRifleBurst(player: Player, rotation: number, damage: number, speed: number, playerId: string) {
    // Nombre de balles dans la rafale
    const burstCount = 3;
    
    // Intervalle entre les balles de la rafale (en millisecondes)
    const burstInterval = 100;
    
    // Tirer la première balle immédiatement
    this.createBullet(player.x, player.y, rotation, damage, speed, playerId);
    
    // Tirer les balles restantes avec un délai
    for (let i = 1; i < burstCount; i++) {
      setTimeout(() => {
        // Vérifier si le joueur est toujours vivant
        if (player.isAlive) {
          this.createBullet(player.x, player.y, rotation, damage, speed, playerId);
        }
      }, i * burstInterval);
    }
  }

  // Méthode pour tirer plusieurs balles en éventail avec le fusil à pompe
  private fireShotgunSpread(player: Player, rotation: number, damage: number, speed: number, spreadAngle: number, playerId: string) {
    // Nombre de balles à tirer
    const pelletCount = 5;
    
    // Calculer l'angle de départ (rotation - spreadAngle/2)
    const startAngle = rotation - (spreadAngle / 2);
    
    // Calculer l'incrément d'angle entre chaque balle
    const angleIncrement = spreadAngle / (pelletCount - 1);
    
    // Tirer les balles
    for (let i = 0; i < pelletCount; i++) {
      const angle = startAngle + (angleIncrement * i);
      this.createBullet(player.x, player.y, angle, damage, speed, playerId);
    }
  }

  // Méthode pour créer une balle
  private createBullet(x: number, y: number, rotation: number, damage: number, speed: number, ownerId: string) {
    const bullet = new Bullet();
    bullet.x = x;
    bullet.y = y;
    bullet.rotation = rotation;
    bullet.ownerId = ownerId;
    bullet.damage = damage;
    bullet.speed = speed;
    
    this.state.bullets.set(this.generateId(), bullet);
  }
} 