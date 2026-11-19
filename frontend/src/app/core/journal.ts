/**
 * Le journal du navigateur : un nom d'événement stable et des champs typés.
 *
 * Les champs sont choisis un à un par l'appelant ;
 * on n'y passe jamais un objet entier (une demande de location porte un mot de passe).</p>
 */
export type Niveau = 'info' | 'warn' | 'error';

export function journaliser(
  niveau: Niveau,
  evenement: string,
  champs: Record<string, unknown>,
): void {
  console[niveau](evenement, { evenement, niveau, horodatage: new Date().toISOString(), ...champs });
}
