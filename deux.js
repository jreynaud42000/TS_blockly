// deux.js : Écriture du programme dans le système de fichiers MicroPython.
//
// Un programme MicroPython n'est pas « compilé » : il est écrit tel quel dans le
// petit système de fichiers embarqué à la fin de l'image MicroPython, sous le
// nom `main.py`. C'est le travail de `@microbit/microbit-fs` — et de lui seul :
// sans cette étape, le .hex produit ne contient aucun programme.
//
// Import global (sans accolades) depuis Skypack ; on garde l'espace de noms en
// secours, ce CDN ne servant pas toujours d'export par défaut.
import microbitFsDefaut, * as microbitFsNommes from 'https://cdn.skypack.dev/@microbit/microbit-fs';

import { fusionnerHex, isUniversalHex, separateUniversalHex } from './trois.js';

const microbitFs = microbitFsDefaut || microbitFsNommes;

/** Retrouve la classe du système de fichiers quelle que soit la forme du module. */
function classeSystemeDeFichiers() {
  const classe =
    microbitFs?.MicropythonFsHex ||
    microbitFs?.micropythonFsHex ||
    microbitFsNommes?.MicropythonFsHex ||
    microbitFsDefaut?.default?.MicropythonFsHex;

  if (typeof classe !== 'function') {
    throw new Error(
      "Le module micro:bit FS n'a pas pu être chargé depuis le CDN " +
      '(vérifier la connexion réseau ou remplacer cdn.skypack.dev par esm.sh dans deux.js).'
    );
  }
  return classe;
}

/**
 * Refuse tout de suite un firmware incomplet.
 *
 * Une copie interrompue laisse un fichier sans enregistrement de fin, dont
 * l'analyse échoue bien plus loin avec un message incompréhensible.
 */
function verifierFirmwareComplet(hex) {
  if (!/^:00000001FF\s*$/m.test(hex)) {
    throw new Error(
      "firmware.hex est incomplet : l'enregistrement de fin (:00000001FF) manque. " +
      'Le fichier a probablement été copié à moitié — le recopier en entier.'
    );
  }
}

/**
 * Efface la zone du système de fichiers d'un firmware.
 *
 * Un `.hex` téléchargé depuis l'éditeur Python officiel contient déjà un
 * programme : `MicropythonFsHex` refuse une telle image (« There are files in
 * the MicropythonFsHex constructor hex file input »). Les bornes de la zone sont
 * lues dans les données UICR du firmware, jamais déduites de son contenu :
 * l'effacement ne change donc pas la taille de stockage disponible.
 *
 * Le tri se fait directement sur le texte Intel hex, ligne par ligne. Un
 * enregistrement fait au plus 32 octets et les bornes de la zone sont alignées
 * sur une page de flash : aucun enregistrement n'est donc à cheval, il suffit de
 * jeter ceux qui tombent dedans. Les enregistrements d'adresse (types 02 et 04)
 * et tout ce qui vit ailleurs — dont l'UICR — sont conservés tels quels.
 *
 * @param {string} hexIntel  un firmware au format Intel hex
 * @returns {string} le même firmware, système de fichiers vide
 */
function effacerFichiersDuFirmware(hexIntel) {
  const info = microbitFs.getIntelHexDeviceMemInfo(hexIntel);
  const debut = info.fsStartAddress;
  const fin = info.fsEndAddress;
  if (!(fin > debut)) return hexIntel;

  const gardees = [];
  let basePoidsFort = 0;

  for (const ligne of hexIntel.split(/\r?\n/)) {
    if (!ligne.startsWith(':')) {
      if (ligne.trim()) gardees.push(ligne);
      continue;
    }
    const type = parseInt(ligne.substr(7, 2), 16);

    if (type === 0x04) {
      // Extended Linear Address : fixe les 16 bits de poids fort.
      basePoidsFort = parseInt(ligne.substr(9, 4), 16) * 0x10000;
    } else if (type === 0x02) {
      // Extended Segment Address : décalage de 4 bits.
      basePoidsFort = parseInt(ligne.substr(9, 4), 16) * 0x10;
    } else if (type === 0x00) {
      const nbOctets = parseInt(ligne.substr(1, 2), 16);
      const adresse = basePoidsFort + parseInt(ligne.substr(3, 4), 16);
      // Enregistrement de données situé dans la zone : on le jette.
      if (adresse < fin && adresse + nbOctets > debut) continue;
    }
    gardees.push(ligne);
  }

  return gardees.join('\n') + '\n';
}

/**
 * Construit le système de fichiers, en réparant le firmware s'il n'est pas vierge.
 *
 * @param {string|Array<{hex: string, boardId: number}>} entree
 */
function construireSystemeDeFichiers(entree) {
  const MicropythonFsHex = classeSystemeDeFichiers();
  try {
    return new MicropythonFsHex(entree);
  } catch (erreur) {
    if (!/There are files/i.test(erreur.message)) {
      throw new Error(
        "firmware.hex n'est pas une image MicroPython valide pour micro:bit. " +
        `Détail : ${erreur.message}`
      );
    }
    const nettoyee = Array.isArray(entree)
      ? entree.map(({ hex, boardId }) => ({ hex: effacerFichiersDuFirmware(hex), boardId }))
      : effacerFichiersDuFirmware(entree);
    return new MicropythonFsHex(nettoyee);
  }
}

/**
 * Transforme le code MicroPython en fichier .hex téléchargeable.
 *
 * Le chemin `./firmware.hex` convient aussi bien au serveur local qu'à
 * l'exécutable PyInstaller : `app.py` sert dans les deux cas par HTTP depuis le
 * dossier où se trouve `index.html`, et le fichier est donc voisin de la page.
 *
 * @param {string} codePython  le code généré par Blockly
 * @returns {Promise<string>}  le contenu du .hex final
 */
export async function genererFichierHexFinal(codePython) {
  // 1. Le firmware MicroPython officiel, posé à côté des fichiers du projet.
  const reponse = await fetch('./firmware.hex');
  if (!reponse.ok) {
    throw new Error(
      `Impossible de lire firmware.hex (HTTP ${reponse.status}). ` +
      'Placer le firmware MicroPython officiel à côté de index.html.'
    );
  }
  const firmwareDeBase = await reponse.text();
  verifierFirmwareComplet(firmwareDeBase);

  // 2. Un firmware universel doit être redécoupé en ses images V1/V2 avant
  //    d'être confié au système de fichiers ; un firmware Intel passe tel quel.
  const entree = isUniversalHex(firmwareDeBase)
    ? separateUniversalHex(firmwareDeBase).map(({ hex, boardId }) => ({ hex, boardId }))
    : firmwareDeBase;

  const systemeDeFichiers = construireSystemeDeFichiers(entree);

  // 3. Le programme est écrit sous le nom `main.py` : c'est celui que la carte
  //    exécute au démarrage.
  systemeDeFichiers.write('main.py', codePython);

  const systemeDeFichiersHex = Array.isArray(entree)
    ? systemeDeFichiers.getUniversalHex()
    : systemeDeFichiers.getIntelHex();

  // 4. Fusion finale au format universel.
  return fusionnerHex(firmwareDeBase, systemeDeFichiersHex);
}
