/**
 * Ce que la boutique manipule, côté navigateur.
 *
 * <p>Des types TypeScript (pas des classes) : rien ici n'a de comportement.</p>
 *
 * <p>On distingue deux familles :
 * ce que l'application MANIPULE, et ce qu'elle ENVOIE sur le réseau.</p>
 */

export interface Produit {
  reference: string;
  libelle: string;
  prix: number;
}

export interface Stock {
  reference: string;
  restant: number;
}

export interface Commande {
  reference: string;
  quantite: number;
  montant: number;
}

/**
 * La charge utile envoyée pour passer commande.
 *
 * <p>Elle porte une adresse électronique complète et un mot de passe.
 * On ne vérifie pas qu'un secret ne fuite pas en s'abstenant de l'envoyer,
 * on le vérifie en l'envoyant pour de bon, puis en cherchant sa trace dans les journaux
 * et dans les spans. `scripts/verifier-confidentialite.ps1` le fait.</p>
 *
 * <p>Ce type n'est utilisé que par l'accès au service dorsal.
 * Ni l'état de la fonctionnalité ni l'interface ne le voient jamais.</p>
 */
export interface DemandeCommande {
  reference: string;
  quantite: number;
  courriel: string;
  motDePasse: string;
}