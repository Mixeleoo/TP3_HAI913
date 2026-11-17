/**
 * Démarre le service dorsal AU PREMIER PLAN, pour la démonstration en séance.
 *
 *     node scripts/start-backend.mjs                sans agent
 *     node scripts/start-backend.mjs --agent        avec l'agent, vers le Collector
 *     node scripts/start-backend.mjs --agent --console   spans sur la console
 *     node scripts/start-backend.mjs --agent --json      journal structuré (ECS)
 *
 * <p>Le JAR est le MÊME dans les quatre cas : pas une ligne de code ne
 * change. Ctrl-C pour arrêter.</p>
 */
import { spawn } from 'node:child_process';

import { argumentsJvm } from './lib.mjs';

const a = process.argv.slice(2);
const options = {
  agent: a.includes('--agent'),
  console_: a.includes('--console'),
  json: a.includes('--json'),
};

let jvm;
try {
  jvm = await argumentsJvm(options);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

const quoi = [
  options.agent ? 'avec agent' : 'sans agent',
  options.console_ ? 'spans sur la console' : null,
  options.json ? 'journal structuré ECS' : null,
].filter(Boolean).join(', ');
console.log(`démarrage du dorsal (${quoi}) — Ctrl-C pour arrêter`);

//  `stdio: 'inherit'` : le journal du service apparaît directement dans le
//  terminal, et Ctrl-C l'atteint. C'est ce qu'on veut en séance.
const p = spawn('java', jvm.argv, { env: jvm.env, stdio: 'inherit' });
p.on('error', (e) => {
  console.error(`java introuvable : ${e.message}`);
  process.exit(1);
});
p.on('exit', (code, signal) => process.exit(signal ? 0 : code ?? 0));
