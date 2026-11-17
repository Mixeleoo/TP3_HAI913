/**
 * Point d'entrée, et uniquement cela.
 *
 * <p>Le démarrage de la télémétrie se faisait ici, avant
 * `bootstrapApplication`. Il est passé dans `app.config.ts`, sous
 * `provideAppInitializer` : l'ordre y est garanti par le cadriciel plutôt
 * que par la position d'une ligne dans un fichier, et la configuration y
 * est injectable.</p>
 */
import { bootstrapApplication } from '@angular/platform-browser';

import { App } from './app/app';
import { appConfig } from './app/app.config';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
