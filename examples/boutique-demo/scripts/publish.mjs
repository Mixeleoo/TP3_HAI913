/**
 * Fabrique le paquet distribuable aux étudiants, puis le VALIDE.
 *
 * <h2>Le défaut que ce script corrige</h2>
 *
 * <p>La version PowerShell calculait sa destination par défaut ainsi :</p>
 *
 * <pre>
 *   racine      = parent de scripts/        -> …/demo/boutique-demo
 *   destination = parent(racine)/"boutique-demo"
 *               = …/demo/boutique-demo      <-- LA MÊME CHOSE
 * </pre>
 *
 * <p>puis, immédiatement :</p>
 *
 * <pre>
 *   if (Test-Path $Destination) { Remove-Item $Destination -Recurse -Force }
 * </pre>
 *
 * <p>Autrement dit : <b>publier effaçait le projet source</b>. Le défaut ne
 * se voyait pas tant que le dossier de travail portait un autre nom.</p>
 *
 * <h2>Ce qui le remplace</h2>
 *
 * <p>Trois chemins canoniques — SOURCE, PRÉPARATION, ARCHIVE — et un garde
 * qui refuse de commencer si l'un chevauche l'autre. La préparation se fait
 * dans un dossier TEMPORAIRE UNIQUE, jamais dans l'arbre de travail. La
 * source n'est jamais ni nettoyée, ni déplacée, ni supprimée : elle est
 * seulement LUE.</p>
 *
 *     node scripts/publish.mjs
 *     node scripts/publish.mjs --archive /chemin/boutique-demo.zip
 *     node scripts/publish.mjs --verifier-garde-fou   (tests du garde, sans rien écrire)
 */
import { crc32 as crc32Natif, deflateRawSync } from 'node:zlib';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { RACINE, existe } from './lib.mjs';

// ===================================================== liste blanche
//  On énumère ce qui PART, jamais ce qui reste. Une liste noire oublie
//  toujours un cas — et le jour où elle en oublie un, c'est un secret ou
//  un binaire de 50 Mo qui part chez les étudiants.
const INCLURE = [
  '.gitignore',
  'README.md',
  'package.json',               // les commandes de la démonstration
  'backend/pom.xml',
  'backend/src',
  'frontend/package.json',
  'frontend/package-lock.json',
  'frontend/angular.json',
  'frontend/tsconfig.json',
  'frontend/tsconfig.app.json',
  'frontend/tsconfig.spec.json',
  'frontend/src',
  'frontend/public',
  'observability',
  'scripts',
  'captures',
];

// ===================================================== interdits
const ARTEFACTS_INTERDITS = [
  [/[\\/]node_modules[\\/]/, 'dépendances npm'],
  [/[\\/]target[\\/]/, 'sortie de compilation Maven'],
  [/[\\/]dist[\\/]/, 'sortie de compilation Angular'],
  [/[\\/]\.angular[\\/]/, 'cache Angular'],
  [/[\\/]out-tsc[\\/]/, 'sortie TypeScript des tests'],
  [/[\\/]coverage[\\/]/, 'rapport de couverture'],
  [/[\\/]\.vite[\\/]/, 'cache Vite'],
  [/[\\/]\.vitest[\\/]/, 'cache Vitest'],
  [/[\\/]\.m2[\\/]/, 'cache Maven'],
  [/[\\/]\.npm[\\/]/, 'cache npm'],
  [/\.class$/, 'classe compilée'],
  [/\.jar$/, 'archive Java'],
  [/[\\/]\.vscode[\\/]/, "métadonnées d'éditeur"],
  [/[\\/]\.idea[\\/]/, "métadonnées d'éditeur"],
  [/\.iml$/, "métadonnées d'éditeur"],
  [/(^|[\\/])\.DS_Store$/, 'métadonnée macOS'],
  [/(^|[\\/])Thumbs\.db$/, 'métadonnée Windows'],
  [/(^|[\\/])desktop\.ini$/, 'métadonnée Windows'],
  [/\.(bak|orig|tmp|swp|~)$/, 'fichier temporaire ou de sauvegarde'],
  [/(^|[\\/])_/, 'fichier temporaire'],
];

const CONTENU_INTERDIT = [
  [/C:\\Users\\[A-Za-z0-9._-]+\\/, 'chemin personnel absolu (Windows)'],
  [/\/Users\/[A-Za-z0-9._-]+\//, 'chemin personnel absolu (macOS)'],
  [/\/home\/[A-Za-z0-9._-]+\//, 'chemin personnel absolu (Linux)'],
  [/Tr0ub4dor/, 'mot de passe en clair'],
];

//  Le mot de passe FIGURE dans le code de la démonstration : c'est tout son
//  propos. On l'autorise là où il est le sujet, et nulle part ailleurs.
const EXCEPTIONS_SECRET = new Set([
  'frontend/src/app/boutique/boutique-api.ts',
  'scripts/lib.mjs',
  'scripts/publish.mjs',
  'README.md',
]);

const BINAIRES = /\.(jpg|jpeg|png|gif|ico|pdf|zip|woff2?)$/i;

// ===================================================== garde-fou
/**
 * Refuse de commencer si SOURCE, PRÉPARATION et ARCHIVE se chevauchent.
 *
 * <p>C'est la seule chose qui sépare « publier » de « détruire ». Elle est
 * donc vérifiée AVANT toute écriture et AVANT toute suppression.</p>
 */
export function verifierGardeFou(source, preparation, archive) {
  const abs = (p) => path.resolve(p);
  const [S, P, A] = [abs(source), abs(preparation), abs(archive)];
  const dedans = (parent, enfant) => {
    const rel = path.relative(parent, enfant);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  };
  const pb = [];
  if (S === P) pb.push('la préparation est la source elle-même');
  if (dedans(S, P)) pb.push('la préparation est À L\'INTÉRIEUR de la source');
  if (dedans(P, S)) pb.push('la source est à l\'intérieur de la préparation');
  if (dedans(S, A)) pb.push('l\'archive serait écrite DANS la source');
  if (S === path.dirname(A) && path.basename(A) === path.basename(S)) {
    pb.push("l'archive porterait le nom de la source");
  }
  return pb;
}

// ===================================================== écriture ZIP
//  Écrire un ZIP en Node sans dépendance : une centaine de lignes, et plus
//  aucun outil externe à exiger (ni Compress-Archive, ni zip, ni tar).
const crc32 = typeof crc32Natif === 'function'
  ? crc32Natif
  : (() => {
      const T = new Uint32Array(256);
      for (let n = 0; n < 256; n += 1) {
        let c = n;
        for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        T[n] = c >>> 0;
      }
      return (buf) => {
        let c = 0xffffffff;
        for (const o of buf) c = T[(c ^ o) & 0xff] ^ (c >>> 8);
        return (c ^ 0xffffffff) >>> 0;
      };
    })();

function dateDos(d) {
  const t = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() / 2)) & 0xffff;
  const j = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
  return { t, j };
}

async function ecrireZip(entrees, destination) {
  const locaux = [];
  const centraux = [];
  let decalage = 0;

  for (const e of entrees) {
    const nom = Buffer.from(e.nom, 'utf8');
    const brut = e.donnees;
    const comprime = deflateRawSync(brut, { level: 9 });
    //  On ne comprime que si cela sert : un JPEG grossit à la compression.
    const deflate = comprime.length < brut.length;
    const corps = deflate ? comprime : brut;
    const { t, j } = dateDos(e.date);
    const somme = crc32(brut);

    const entete = Buffer.alloc(30);
    entete.writeUInt32LE(0x04034b50, 0);
    entete.writeUInt16LE(20, 4);
    entete.writeUInt16LE(0x0800, 6);          // noms en UTF-8
    entete.writeUInt16LE(deflate ? 8 : 0, 8);
    entete.writeUInt16LE(t, 10);
    entete.writeUInt16LE(j, 12);
    entete.writeUInt32LE(somme, 14);
    entete.writeUInt32LE(corps.length, 18);
    entete.writeUInt32LE(brut.length, 22);
    entete.writeUInt16LE(nom.length, 26);
    locaux.push(entete, nom, corps);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(deflate ? 8 : 0, 10);
    central.writeUInt16LE(t, 12);
    central.writeUInt16LE(j, 14);
    central.writeUInt32LE(somme, 16);
    central.writeUInt32LE(corps.length, 20);
    central.writeUInt32LE(brut.length, 24);
    central.writeUInt16LE(nom.length, 28);
    central.writeUInt32LE(decalage, 42);
    centraux.push(central, nom);

    decalage += entete.length + nom.length + corps.length;
  }

  const corpsCentral = Buffer.concat(centraux);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(entrees.length, 8);
  fin.writeUInt16LE(entrees.length, 10);
  fin.writeUInt32LE(corpsCentral.length, 12);
  fin.writeUInt32LE(decalage, 16);

  await fs.writeFile(destination, Buffer.concat([...locaux, corpsCentral, fin]));
}

// ===================================================== copie
async function fichiersDe(racine, relatif) {
  const complet = path.join(racine, relatif);
  if (!(await existe(complet))) return [];
  const st = await fs.stat(complet);
  if (st.isFile()) return [relatif.split(path.sep).join('/')];
  const out = [];
  for (const e of await fs.readdir(complet, { withFileTypes: true })) {
    out.push(...await fichiersDe(racine, path.join(relatif, e.name)));
  }
  return out;
}

// ===================================================== principal
async function principal() {
  const args = process.argv.slice(2);

  const source = path.resolve(RACINE);
  const nomPaquet = path.basename(source);
  const iA = args.indexOf('--archive');
  const archive = path.resolve(
    iA !== -1 ? args[iA + 1] : path.join(path.dirname(source), `${nomPaquet}.zip`),
  );
  //  Préparation DANS LE DOSSIER TEMPORAIRE DU SYSTÈME, avec un suffixe
  //  unique. Jamais dans l'arbre de travail, jamais à un emplacement
  //  devinable qui pourrait déjà contenir autre chose.
  const preparation = await fs.mkdtemp(path.join(os.tmpdir(), 'boutique-release-'));
  const racinePaquet = path.join(preparation, nomPaquet);

  console.log('=== chemins ===');
  console.log(`  source      : ${source}`);
  console.log(`  préparation : ${racinePaquet}`);
  console.log(`  archive     : ${archive}`);

  const pb = verifierGardeFou(source, racinePaquet, archive);
  if (pb.length) {
    console.log('');
    console.log('REFUS — relation dangereuse entre les chemins :');
    pb.forEach((m) => console.log(`  · ${m}`));
    console.log('');
    console.log("Rien n'a été écrit ni supprimé.");
    await fs.rm(preparation, { recursive: true, force: true });
    return 2;
  }
  console.log('  garde-fou   : OK (aucun chevauchement)');

  // ---------------------------------------------------- copie
  let copies = 0;
  for (const item of INCLURE) {
    for (const rel of await fichiersDe(source, item.split('/').join(path.sep))) {
      const src = path.join(source, rel.split('/').join(path.sep));
      const dst = path.join(racinePaquet, rel.split('/').join(path.sep));
      await fs.mkdir(path.dirname(dst), { recursive: true });
      await fs.copyFile(src, dst);
      copies += 1;
    }
  }

  // ---------------------------------------------------- validation
  console.log('');
  console.log('=== validation du paquet ===');
  const problemes = [];
  const entrees = [];

  const parcourir = async (dir, base = '') => {
    for (const e of (await fs.readdir(dir, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name))) {
      const complet = path.join(dir, e.name);
      const rel = base ? `${base}/${e.name}` : e.name;
      if (e.isDirectory()) {
        const avant = entrees.length;
        await parcourir(complet, rel);
        if (entrees.length === avant) problemes.push(`  dossier vide : ${rel}`);
      } else {
        const donnees = await fs.readFile(complet);
        const st = await fs.stat(complet);
        entrees.push({ nom: `${nomPaquet}/${rel}`, donnees, date: st.mtime, rel });
      }
    }
  };
  await parcourir(racinePaquet);

  for (const e of entrees) {
    const sous = `/${e.rel}`;
    for (const [motif, quoi] of ARTEFACTS_INTERDITS) {
      if (motif.test(sous)) problemes.push(`  artefact interdit (${quoi}) : ${e.rel}`);
    }
    if (BINAIRES.test(e.rel)) continue;
    const texte = e.donnees.toString('utf8');
    for (const [motif, quoi] of CONTENU_INTERDIT) {
      if (!motif.test(texte)) continue;
      if (quoi === 'mot de passe en clair' && EXCEPTIONS_SECRET.has(e.rel)) continue;
      problemes.push(`  contenu interdit (${quoi}) : ${e.rel}`);
    }
  }

  const ko = (n) => (n / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 0 });
  const total = entrees.reduce((s, e) => s + e.donnees.length, 0);
  console.log(`  ${entrees.length} fichiers, ${ko(total)} Ko`);

  if (problemes.length) {
    console.log('');
    [...new Set(problemes)].sort().forEach((m) => console.log(m));
    console.log('');
    console.log(`REFUS : ${new Set(problemes).size} problème(s). Le paquet n'est pas distribuable.`);
    //  On supprime la PRÉPARATION, jamais la source.
    await fs.rm(preparation, { recursive: true, force: true });
    return 1;
  }
  console.log('  OK : aucun artefact engendré, aucun chemin personnel,');
  console.log('       aucun secret hors du code de démonstration.');

  // ---------------------------------------------------- archive
  await fs.mkdir(path.dirname(archive), { recursive: true });
  await ecrireZip(entrees, archive);
  const { size } = await fs.stat(archive);
  console.log(`  archive : ${entrees.length} fichiers, ${ko(size)} Ko`);

  await fs.rm(preparation, { recursive: true, force: true });

  console.log('');
  console.log(`archive : ${archive}`);
  console.log('la source n\'a été que LUE.');
  return 0;
}

// ===================================================== tests du garde-fou
function testsGardeFou() {
  const cas = [
    ['source == préparation', 'C:/demo/boutique-demo', 'C:/demo/boutique-demo', 'C:/demo/x.zip', true],
    ['préparation dans la source', 'C:/demo/boutique-demo', 'C:/demo/boutique-demo/staging', 'C:/demo/x.zip', true],
    ['source dans la préparation', 'C:/demo/boutique-demo', 'C:/demo', 'C:/x.zip', true],
    ['archive dans la source', 'C:/demo/boutique-demo', 'C:/tmp/s', 'C:/demo/boutique-demo/x.zip', true],
    ['le défaut historique', 'C:/demo/boutique-demo', 'C:/demo/boutique-demo', 'C:/demo/boutique-demo.zip', true],
    ['disposition saine', 'C:/demo/boutique-demo', 'C:/tmp/prep/boutique-demo', 'C:/demo/boutique-demo.zip', false],
  ];
  let echecs = 0;
  console.log('=== tests du garde-fou ===');
  for (const [nom, s, p, a, doitRefuser] of cas) {
    const pb = verifierGardeFou(s, p, a);
    const refuse = pb.length > 0;
    const ok = refuse === doitRefuser;
    if (!ok) echecs += 1;
    console.log(`  ${ok ? 'OK  ' : 'ÉCHEC'} ${nom.padEnd(30)} ${refuse ? 'refusé' : 'accepté'}`);
  }
  console.log('');
  console.log(echecs ? `${echecs} test(s) en échec.` : 'les 6 cas se comportent comme prévu.');
  return echecs ? 1 : 0;
}

process.exit(
  process.argv.includes('--verifier-garde-fou') ? testsGardeFou() : await principal(),
);
