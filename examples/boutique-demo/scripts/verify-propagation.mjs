/**
 * Vérifie la propagation du contexte de trace — W3C Trace Context.
 *
 * <p>DEUX PREUVES, et elles sont complémentaires.</p>
 *
 * <p><b>1. CÔTÉ SERVEUR, littérale.</b> On envoie une requête avec un
 * en-tête `traceparent` fabriqué à la main, puis on vérifie dans Jaeger que
 * le span serveur a bien pour PARENT le span identifié dans cet en-tête.
 * L'en-tête envoyé est affiché : on voit exactement ce qui est passé sur le
 * fil.</p>
 *
 * <p><b>2. CÔTÉ NAVIGATEUR, structurelle.</b> On vérifie qu'une même trace
 * contient des spans portant DEUX identités de service différentes. C'est
 * une preuve plus forte qu'un vidage d'en-tête : elle établit que l'en-tête
 * a été envoyé ET honoré. Aucun autre mécanisme ne peut produire ce
 * résultat.</p>
 *
 *     node scripts/verify-propagation.mjs
 */
import { randomBytes } from 'node:crypto';

import { DORSAL, dormir, spansDe } from './lib.mjs';

const hex = (n) => randomBytes(n).toString('hex');

console.log('==============================================================');
console.log(' 1. PREUVE CÔTÉ SERVEUR — en-tête traceparent fabriqué');
console.log('==============================================================');

//  version-traceid(32 hex)-spanid(16 hex)-flags, conformément à la
//  Recommandation W3C Trace Context.
const traceId = hex(16);
const parentId = hex(8);
const traceparent = `00-${traceId}-${parentId}-01`;

console.log('en-tête envoyé :');
console.log(`    traceparent: ${traceparent}`);

try {
  await fetch(`${DORSAL}/produits`, {
    headers: { traceparent },
    signal: AbortSignal.timeout(15000),
  });
} catch (e) {
  console.log('');
  console.log(`  ÉCHEC  le service dorsal est injoignable : ${e.message}`);
  process.exit(1);
}
await dormir(3000);

let spans;
try {
  spans = await spansDe('boutique-backend');
} catch (e) {
  console.log('');
  console.log(`  ÉCHEC  Jaeger est injoignable : ${e.message}`);
  process.exit(1);
}

const recu = spans.find((s) => s.trace === traceId && s.parent === parentId);
if (!recu) {
  console.log('');
  console.log('  ÉCHEC  aucun span serveur ne porte ce contexte.');
  process.exit(1);
}
console.log('');
console.log('  OK  le span serveur a repris le contexte fourni :');
console.log(`      trace  ${recu.trace}`);
console.log(`      span   ${recu.span}`);
console.log(`      parent ${recu.parent}   (celui de l'en-tête)`);
console.log(`      nom    ${recu.nom}`);

console.log('');
console.log('==============================================================');
console.log(' 2. PREUVE CÔTÉ NAVIGATEUR — une trace, deux services');
console.log('==============================================================');

const tous = await spansDe('boutique-frontend');
const parTrace = new Map();
for (const s of tous) {
  if (!parTrace.has(s.trace)) parTrace.set(s.trace, []);
  parTrace.get(s.trace).push(s);
}
const melangee = [...parTrace.entries()].find(
  ([, g]) => new Set(g.map((s) => s.service)).size >= 2,
);

if (!melangee) {
  console.log('  ÉCHEC  aucune trace ne contient à la fois le navigateur et le dorsal.');
  console.log('         Interface web lancée ? Une action a-t-elle été déclenchée ?');
  process.exit(1);
}

const [trace, groupe] = melangee;
const nbServices = new Set(groupe.map((s) => s.service)).size;
console.log(`  OK  trace ${trace} : ${groupe.length} spans, ${nbServices} services`);
console.log('');

//  Affichage en arbre. On parcourt réellement l'arbre, racine par racine :
//  trier sur la seule présence d'un parent ne suffit pas, l'ordre des
//  frères serait quelconque et l'indentation mentirait.
const connus = new Set(groupe.map((s) => s.span));
const enfants = new Map();
for (const s of groupe) {
  const cle = s.parent && connus.has(s.parent) ? s.parent : 'RACINE';
  if (!enfants.has(cle)) enfants.set(cle, []);
  enfants.get(cle).push(s);
}
const afficher = (cle, prof) => {
  for (const s of enfants.get(cle) ?? []) {
    console.log(`      ${'    '.repeat(prof)}${s.nom.padEnd(52)} [${s.service}]`);
    afficher(s.span, prof + 1);
  }
};
afficher('RACINE', 0);

console.log('');
console.log('  Les deux identités de service figurent dans UNE SEULE trace.');
console.log("  Seule la propagation de l'en-tête traceparent peut produire cela.");
