// trois.js : Gestion du format Universal Hex
//
// Un .hex « universel » contient côte à côte l'image V1 et l'image V2, chacune
// étiquetée par un identifiant de carte. C'est le format que le lecteur MICROBIT
// accepte quelle que soit la version branchée.
//
// Attention à la forme attendue par createUniversalHex : un tableau d'objets
// { hex, boardId }, surtout pas des chaînes brutes.
import {
  createUniversalHex,
  isUniversalHex,
  separateUniversalHex,
  microbitBoardId,
} from 'https://esm.sh/@microbit/microbit-universal-hex';

/**
 * Emballe au format universel le hex produit par le système de fichiers.
 *
 * `microbit-fs` part déjà du firmware pour y écrire `main.py` : le hex qu'il
 * renvoie contient donc MicroPython **et** le programme. Il ne s'agit pas de
 * recoller deux morceaux, mais d'étiqueter le résultat avec les identifiants de
 * carte présents dans le firmware d'origine.
 *
 * @param {string} firmwareDeBase        contenu de `firmware.hex`
 * @param {string} systemeDeFichiersHex  hex produit par `deux.js`
 * @returns {string} le hex final, prêt à être copié sur la carte
 */
export function fusionnerHex(firmwareDeBase, systemeDeFichiersHex) {
  // Déjà universel (firmware universel traité par microbit-fs) : rien à faire.
  if (isUniversalHex(systemeDeFichiersHex)) {
    return systemeDeFichiersHex;
  }

  // Sinon c'est un hex Intel simple. On reprend l'identifiant de carte du
  // firmware d'origine s'il était universel, faute de quoi on suppose une V2.
  let idCarte = microbitBoardId.V2;
  if (isUniversalHex(firmwareDeBase)) {
    const sections = separateUniversalHex(firmwareDeBase);
    if (sections.length) idCarte = sections[0].boardId;
  }

  return createUniversalHex([{ hex: systemeDeFichiersHex, boardId: idCarte }]);
}

// Réexportés : `deux.js` en a besoin pour découper un firmware universel avant
// de le confier au système de fichiers.
export { isUniversalHex, separateUniversalHex, microbitBoardId };
