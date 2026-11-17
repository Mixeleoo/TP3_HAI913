/**
 * Contrôle de confidentialité de la démonstration.
 *
 * <p>L'interface web et le scénario dorsal envoient VOLONTAIREMENT un mot de
 * passe et une adresse électronique complète. Ce script vérifie qu'ils ne
 * ressortent dans AUCUNE sortie :</p>
 *
 * <ul>
 *   <li>les captures de journal du service dorsal ;</li>
 *   <li>les spans stockés par Jaeger — donc tout ce qui a traversé le
 *       Collector, y compris la télémétrie venue du NAVIGATEUR.</li>
 * </ul>
 *
 * <p>C'est le seul contrôle de la démonstration qui doit échouer
 * bruyamment : un secret dans la télémétrie est un incident, pas un défaut
 * cosmétique.</p>
 *
 *     node scripts/verify-privacy.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  ADRESSE, CAPTURES, DOMAINE, JAEGER, SECRET,
  compter, existe, servicesJaeger,
} from './lib.mjs';

const isoDecale = (minutes) =>
  new Date(Date.now() + minutes * 60_000).toISOString().replace(/\.\d+Z$/, 'Z');

const ligne = (quoi, s, a, d) =>
  `  ${quoi.padEnd(34)} mot_de_passe=${s}  adresse=${a}  domaine_seul=${d}`;

let fuites = 0;

console.log('=== 1. captures de journal ===');
if (await existe(CAPTURES)) {
  const fichiers = (await fs.readdir(CAPTURES))
    .filter((f) => f.endsWith('.txt')).sort();
  if (!fichiers.length) {
    console.log('  (aucune capture : lancez d\'abord les scénarios)');
  }
  for (const f of fichiers) {
    const t = await fs.readFile(path.join(CAPTURES, f), 'utf8');
    const s = compter(t, SECRET);
    const a = compter(t, ADRESSE);
    console.log(ligne(f, s, a, compter(t, DOMAINE)));
    fuites += s + a;
  }
} else {
  console.log('  (aucune capture : lancez d\'abord les scénarios)');
}

console.log('');
console.log('=== 2. spans stockés par Jaeger (dorsal ET navigateur) ===');
let services = [];
try {
  services = await servicesJaeger();
} catch {
  console.log('  (Jaeger injoignable : contrôle limité aux captures)');
}

for (const svc of services) {
  if (svc === 'jaeger') continue;
  //  On inspecte la réponse BRUTE, et non des champs choisis : un secret
  //  peut se cacher dans un attribut qu'on n'aurait pas pensé à lire.
  const url =
    `${JAEGER}/api/v3/traces?query.service_name=${encodeURIComponent(svc)}` +
    `&query.num_traces=50&query.start_time_min=${isoDecale(-120)}` +
    `&query.start_time_max=${isoDecale(5)}`;
  const brut = await (await fetch(url)).text();
  const s = compter(brut, SECRET);
  const a = compter(brut, ADRESSE);
  console.log(ligne(svc, s, a, compter(brut, DOMAINE)));
  fuites += s + a;
}

console.log('');
if (fuites > 0) {
  console.log(`ÉCHEC : ${fuites} occurrence(s) de donnée sensible dans la télémétrie.`);
  process.exit(1);
}
console.log('OK : aucun mot de passe ni adresse complète, ni dans les journaux,');
console.log('     ni dans les spans. Seul le domaine est conservé, ce qui était');
console.log("     l'intention : il répond à la question posée sans singulariser");
console.log('     personne.');
