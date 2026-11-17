/**
 * Télécharge l'agent Java OpenTelemetry.
 *
 * <p>L'agent n'est PAS livré avec la démonstration : c'est un binaire de
 * 26 Mo, et la politique de distribution est de le récupérer depuis Maven
 * Central. Une seule fois.</p>
 *
 *     node scripts/download-agent.mjs
 *     node scripts/download-agent.mjs --version 2.32.0
 */
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

import { AGENT, existe } from './lib.mjs';

/** Version épinglée : celle qui a été vérifiée avec ce cours. */
const VERSION_PAR_DEFAUT = '2.32.0';

const i = process.argv.indexOf('--version');
const version = i !== -1 ? process.argv[i + 1] : VERSION_PAR_DEFAUT;

const mo = (o) => (o / 1024 / 1024).toFixed(1);

if (await existe(AGENT)) {
  const { size } = await fs.stat(AGENT);
  //  Idempotent : relancer le script ne retélécharge rien.
  console.log(`agent déjà présent (${mo(size)} Mo) : ${AGENT}`);
  process.exit(0);
}

const url =
  'https://repo1.maven.org/maven2/io/opentelemetry/javaagent/' +
  `opentelemetry-javaagent/${version}/opentelemetry-javaagent-${version}.jar`;

console.log(`téléchargement de l'agent ${version} ...`);
console.log(`  depuis ${url}`);

const r = await fetch(url);
if (!r.ok) {
  console.error(`ÉCHEC : Maven Central a répondu ${r.status} ${r.statusText}`);
  console.error("  vérifiez la version demandée et l'accès réseau.");
  process.exit(1);
}

const attendu = Number(r.headers.get('content-length') ?? 0);
const partiel = `${AGENT}.partiel`;

//  On écrit d'abord dans un fichier temporaire, puis on renomme. Un
//  téléchargement interrompu ne laisse donc jamais un agent tronqué que le
//  test d'existence prendrait pour valide.
await pipeline(Readable.fromWeb(r.body), createWriteStream(partiel));

const { size } = await fs.stat(partiel);
if (attendu && size !== attendu) {
  await fs.rm(partiel, { force: true });
  console.error(`ÉCHEC : ${size} octets reçus, ${attendu} annoncés.`);
  process.exit(1);
}

await fs.rename(partiel, AGENT);
console.log(`agent ${version} téléchargé (${mo(size)} Mo) : ${AGENT}`);
