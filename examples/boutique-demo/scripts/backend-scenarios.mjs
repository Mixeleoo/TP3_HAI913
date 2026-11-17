/**
 * Joue toujours la MÊME séquence de six requêtes sur le service dorsal.
 *
 * <p>Sert au contraste « sans agent / avec agent » : les sorties doivent
 * être comparables ligne à ligne. Le parcours NAVIGATEUR, lui, se déclenche
 * à la main depuis l'interface web — c'est le propos de la
 * démonstration.</p>
 *
 *     node scripts/backend-scenarios.mjs --out captures/01-sans-agent.txt
 *     node scripts/backend-scenarios.mjs --agent --console --out captures/02-avec-agent.txt
 *     node scripts/backend-scenarios.mjs --agent --console --json --out captures/03-journal-structure.txt
 *     node scripts/backend-scenarios.mjs --agent --out captures/04-vers-collector.txt
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  ADRESSE, DORSAL, RACINE, SECRET,
  argumentsJvm, arreterDorsal, captureTemporaire, demarrerDorsal,
  dormir, reunirSorties,
} from './lib.mjs';

const a = process.argv.slice(2);
const i = a.indexOf('--out');
const sortie = i !== -1 ? a[i + 1] : 'capture.txt';
const options = {
  agent: a.includes('--agent'),
  console_: a.includes('--console'),
  json: a.includes('--json'),
};

/** Les 404 et 503 sont ATTENDUS : ils font partie du scénario. */
async function appel(methode, chemin, corps) {
  try {
    await fetch(`${DORSAL}${chemin}`, {
      method: methode,
      headers: corps ? { 'Content-Type': 'application/json' } : undefined,
      body: corps ? JSON.stringify(corps) : undefined,
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    /* une panne provoquée reste une réponse */
  }
}

const brut = captureTemporaire();
let proc;
try {
  proc = await demarrerDorsal(await argumentsJvm(options), brut);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

//  Six requêtes, six faits à observer dans la capture.
await appel('GET', '/produits');                       // 1. cas nominal
await appel('GET', '/produits/P-1002');                // 2. lecture d'un produit
await appel('GET', '/produits/P-9999');                // 3. 404, WARN du dépôt
await appel('GET', '/produits/P-1003/stock');          // 4. opération lente, WARN
await appel('POST', '/commandes', {                    // 5. jalon métier + secret
  reference: 'P-1003',
  quantite: 2,
  courriel: ADRESSE,
  motDePasse: SECRET,
});
await appel('GET', '/panne');                          // 6. échec contrôlé

await dormir(2000);
await arreterDorsal(proc);

const texte = await reunirSorties(brut);
await fs.rm(brut, { force: true });
await fs.rm(`${brut}.err`, { force: true });

const chemin = path.isAbsolute(sortie) ? sortie : path.join(RACINE, sortie);
await fs.mkdir(path.dirname(chemin), { recursive: true });
await fs.writeFile(chemin, texte, 'utf8');

const { size } = await fs.stat(chemin);
console.log(`capture -> ${sortie} (${size} octets)`);
