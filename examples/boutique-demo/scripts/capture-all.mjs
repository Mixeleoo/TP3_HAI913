/**
 * Produit les quatre captures du service dorsal, dans l'ordre, et VÉRIFIE
 * chacune.
 *
 * <p>La vérification n'est pas un luxe : lors de la mise au point, une JVM
 * d'un essai précédent restée vivante a produit une capture où chaque ligne
 * apparaissait deux fois, avec des identifiants de trace différents. Rien
 * ne le signalait. Un contrôle du nombre d'occurrences attendues l'aurait
 * vu tout de suite — il est donc ici.</p>
 *
 *     node scripts/capture-all.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CAPTURES, compter, existe } from './lib.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));

/** Six requêtes, six faits attendus — une fois chacun. */
const ATTENDU = {
  'lecture du catalogue': 1,
  'produit absent du depot': 1,
  'stock bas reference=P-1003': 1,
  '[ServiceBoutique] boutique.commande_validee': 1,
  "echec de l'operation, depot indispo": 1,
};

const ESSAIS = [
  { nom: '01-sans-agent.txt', agent: false, args: [] },
  { nom: '02-avec-agent.txt', agent: true, args: ['--agent', '--console'] },
  { nom: '03-journal-structure.txt', agent: true, args: ['--agent', '--console', '--json'] },
  { nom: '04-vers-collector.txt', agent: true, args: ['--agent'] },
];

function verifier(texte, avecAgent) {
  const pb = [];
  //  Le jalon métier porte le MÊME nom que le span qui l'entoure. Avec
  //  l'exportateur console, le nom apparaît donc deux fois : une fois comme
  //  ligne de journal, une fois comme span. On ancre donc la recherche sur
  //  ce qui identifie une LIGNE DE JOURNAL, et sa forme dépend du format.
  const json = texte.includes('"@timestamp"');
  for (const [motif, attendu] of Object.entries(ATTENDU)) {
    const cherche = json
      ? motif.replace(/^\[ServiceBoutique\] (.+)$/, '"message":"$1"')
      : motif;
    const n = compter(texte, cherche);
    if (n !== attendu) {
      pb.push(`  ${motif.padEnd(44)} attendu ${attendu}, trouvé ${n}`);
    }
  }

  const m = texte.match(/lecture du catalogue nombre=(\d+)/);
  if (m && Number(m[1]) !== 3) {
    pb.push(`  catalogue : 3 produits attendus, ${m[1]} trouvés`);
  }

  //  Avec agent, les identifiants de corrélation doivent être remplis ;
  //  sans agent, ils doivent être vides. C'est TOUT le propos.
  const pleins =
    (texte.match(/trace_id=[0-9a-f]{32}/g) ?? []).length +
    (texte.match(/"trace_id":"[0-9a-f]{32}"/g) ?? []).length;
  if (avecAgent && pleins < 4) {
    pb.push(`  avec agent : seulement ${pleins} lignes corrélées`);
  }
  if (!avecAgent && pleins > 0) {
    pb.push(`  sans agent : ${pleins} lignes corrélées, il ne devrait y en avoir aucune`);
  }
  return pb;
}

/** Lance un scénario dans un processus Node séparé, et attend sa fin. */
function scenario(args) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath,
      [path.join(ICI, 'backend-scenarios.mjs'), ...args],
      { stdio: ['ignore', 'ignore', 'inherit'] });
    p.on('exit', (code) => resolve(code ?? 1));
  });
}

await fs.mkdir(CAPTURES, { recursive: true });

let echecs = 0;
for (const e of ESSAIS) {
  console.log(`--- ${e.nom}`);
  const code = await scenario([
    ...e.args, '--out', path.join('captures', e.nom),
  ]);
  const chemin = path.join(CAPTURES, e.nom);
  if (code !== 0 || !(await existe(chemin))) {
    console.log('    ÉCHEC : capture absente');
    echecs += 1;
    continue;
  }
  const pb = verifier(await fs.readFile(chemin, 'utf8'), e.agent);
  if (pb.length) {
    console.log('    ÉCHEC :');
    pb.forEach((l) => console.log(l));
    echecs += 1;
  } else {
    const { size } = await fs.stat(chemin);
    console.log(`    OK  (${size} octets)`);
  }
}

console.log('');
if (echecs > 0) {
  console.log(`${echecs} capture(s) invalide(s).`);
  process.exit(1);
}
console.log('les quatre captures sont conformes.');
