// Déclarations de types pour les modules qui posent problème
declare module 'express' {
  import express = require('express-serve-static-core');
  
  // Ajouter les fonctions et propriétés manquantes
  const e: express.Express & {
    json: () => express.RequestHandler;
    urlencoded: (options?: { extended?: boolean }) => express.RequestHandler;
    static: (root: string, options?: any) => express.RequestHandler;
  };
  
  export default e;
}

declare module 'cors' {
  import * as cors from 'cors';
  export = cors;
} 