// Déclarations de types pour les modules qui posent problème
declare module 'express' {
  import * as e from 'express-serve-static-core';
  export = e;
}

declare module 'cors' {
  import * as cors from 'cors';
  export = cors;
} 