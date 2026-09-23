# État du projet — éditeur Blockly micro:bit V2

Dossier de travail : `C:\Users\jreyn\OneDrive\Bureau\blockly_ts`
Lancement : double-clic sur `lancer_projet.bat`, puis <http://localhost:8000>

Ce fichier dit **où on en est** : ce qui a été vérifié, ce qui ne peut l'être
sans matériel, et ce qui a été écarté. Les deux autres documents complètent :

- `readme.txt` — mode d'emploi et pièges d'usage
- `PROMPT_RECREATION.md` — tout reconstruire de zéro, avec les 46 pièges connus (nº 0 à nº 45)

---

## Vérifié dans le navigateur

La vérification se fait en pilotant l'application depuis la console, jamais en
se fiant à l'absence d'erreur.

| Domaine | Ce qui a été contrôlé |
| --- | --- |
| Génération du `.hex` | fichier relu avec une instance `MicropythonFsHex` indépendante : `main.py` identique au code source, hex universel V1+V2 |
| Firmware non vierge | la zone du système de fichiers est effacée puis réécrite ; testé avec un firmware contenant déjà un programme |
| Firmware tronqué ou en cache | refusé avec le nombre d'octets reçus ; lecture en `cache: no-store` |
| Imports MicroPython | **0 bloc sur 49** oublie `from microbit import *` (28 en défaut au départ) |
| Blocs « lorsque … » | indentation cohérente, scrutation injectée dans **toutes** les boucles, les 16 gestionnaires câblés |
| Blocs orphelins affichés désactivés | Demande explicite de l'utilisateur : « quand un bloc de programmation est déposé... et qu'il n'est pas accroché à un autre bloc, il [doit être] affiché comme désactivé ». Un bloc posé seul (ou détaché d'une pile) était auparavant rendu normalement (pleine couleur) alors qu'il ne faisait déjà rien la plupart du temps — et pire, un bloc d'instruction orphelin **était bien inclus** dans `Blockly.Python.workspaceToCode()` (chaque bloc de haut niveau génère son propre code, orphelin ou pas), donc s'exécutait une fois au tout début du programme, en dehors de toute structure visible, un comportement surprenant. Détection par la structure plutôt qu'une liste de noms : un bloc est un conteneur légitime (`au_demarrage`, tous les `lorsque_...`, `radio_quand_recu`) s'il n'a **ni** `previousConnection` **ni** `outputConnection` — ils ne peuvent structurellement pas être accrochés à autre chose. Seule exception, non déductible de la structure : `boucle_infinie` a les deux connecteurs (il peut en théorie être chaîné) mais reste fonctionnel seul, donc exclu à la main. `bloc.getRootBlock()` remonte jusqu'à l'ancêtre commun quel que soit le type d'emboîtement (pile, entrée d'instruction, entrée de valeur) : un seul passage sur `getAllBlocks()`, pas besoin de cas particulier pour un bloc qui devient correctement accroché (redevient actif tout seul au passage suivant). `setEnabled()` (API Blockly standard) fait à la fois le rendu grisé/hachuré et l'exclusion de la génération de code. Vérifié : bloc posé seul → désactivé et absent du code généré ; reconnecté sous « Au démarrage » → réactivé et son code réapparaît ; bloc de valeur (nombre) posé seul → désactivé aussi ; les deux blocs de démarrage par défaut (`au_demarrage`, `boucle_infinie`) jamais désactivés |
| « Au démarrage » emboîtable avec « Répéter indéfiniment » | Demande de l'utilisateur, avec une image de référence : une encoche du bas sur « Au démarrage », comme dans MakeCode, pour l'accrocher physiquement à « Répéter indéfiniment » plutôt que les laisser simplement juxtaposés. Ajouté `setNextStatement(true, null)` sur `au_demarrage` (toujours **pas** de `previousStatement` : il doit rester le bloc le plus haut, rien ne s'accroche au-dessus). Espace de travail par défaut mis à jour pour les emboîter d'office (`next: { block: { type: 'boucle_infinie' } }` dans le JSON de sérialisation Blockly, à la place de deux blocs juste positionnés l'un sous l'autre). Aucun changement de génération de code : l'ordre des blocs de premier niveau suivait déjà la position verticale, l'emboîtement le garantit physiquement mais ne le crée pas. Vérifié : les deux blocs par défaut sont bien parent/enfant (`getParent()`) dès le chargement, code généré identique avant/après, détachement puis rattachement testés (`unplug()`/`connect()`), le registre des blocs orphelins (entrée précédente) n'est pas perturbé par le nouveau connecteur (`au_demarrage` n'a toujours pas de `previousConnection`, donc reste détecté comme conteneur légitime) |
| Menu « Fichier » regroupant les téléchargements | Demande de l'utilisateur, avec une image de référence : les deux boutons « Télécharger le fichier .hex » et « Télécharger le script .py », auparavant toujours visibles côte à côte dans la barre d'outils, sont désormais dans un menu déroulant « 📁 Fichier ▾ ». Les deux boutons gardent leurs `id` (`download-btn`, `download-py-btn`) et leurs écouteurs existants inchangés — seul le balisage autour a changé, aucune modification des gestionnaires de clic eux-mêmes. Ouverture/fermeture au clic sur le bouton, fermeture automatique au clic ailleurs dans la page ou après avoir choisi un des deux téléchargements (comme un menu déroulant classique). Vérifié dans le navigateur : ouverture affiche les deux boutons, clic à l'extérieur referme, clic sur « .py » déclenche bien le téléchargement (`zoneEtat` confirme « Script .py téléchargé. ») et referme le menu au passage |
| Import d'un fichier .hex ou .py | Demande de l'utilisateur, dans le prolongement du menu « Fichier ». Un fichier importé bascule directement en **édition manuelle** (Blockly ne sait pas transformer du Python en blocs, voir la section dédiée) — même mécanisme que si l'utilisateur tapait le code lui-même, juste pré-rempli. Le cas `.py` est trivial (texte lu tel quel). Le cas `.hex` est plus subtil : un `.hex` n'est pas le programme, c'est un firmware complet encodé en Intel hex avec le programme écrit dans sa zone système de fichiers — `extraireCodeDepuisHex()` (nouvelle fonction dans `deux.js`, symétrique de `genererFichierHexFinal`) reconstruit la même base propre (notre `firmware.hex`, nettoyé si besoin) puis y importe le fichier fourni (`MicropythonFsHex.importFilesFromHex()`, la même bibliothèque `microbit-fs` que l'écriture) pour en relire `main.py`. Vérifié par un aller-retour complet en conditions réelles dans le navigateur : générer un `.hex` avec `genererFichierHexFinal()`, l'importer aussitôt via `<input type="file">` (simulé par `DataTransfer`, un vrai clic ne se scripte pas), et confirmer que le texte relu est identique à l'original — testé aussi bien en partant de blocs que d'un script `.py`. Erreur réutilisée avec un fichier invalide : le message d'origine (`verifierFirmwareComplet`) parlait à tort de « firmware.hex » et du cache serveur même pour un fichier importé par l'utilisateur — paramétré (`nomFichier`) pour donner le bon message selon le cas, bug trouvé en testant volontairement un fichier invalide, pas deviné à l'avance |
| Thème clair / sombre | Demande de l'utilisateur. Grandes surfaces (barre d'outils, panneaux latéraux, panneau de code, menu « Fichier », panneau administrateur, champs de saisie sur fond sombre) passées à des variables CSS (`--fond-chrome`, `--fond-saisie`, `--texte-chrome`, `--bordure-chrome`, `--fond-code`, `--texte-code`…), deux jeux de valeurs (`:root` = sombre, l'état d'origine du projet ; `:root[data-theme="light"]` = nouveau). Volontairement **pas** touché : les couleurs « d'appareil » (sprites de robots, carte micro:bit, DEL, bézel du joystick, étiquette de fanion départ/arrivée) qui représentent quelque chose de réel, et les couleurs d'accent des boutons/catégories — comme le reste de l'interface, ni l'un ni l'autre ne change avec le thème de l'appli. Blockly n'a pas de thème sombre livré (seuls `Classic` et `Zelos` existent, vérifié par `Object.keys(Blockly.Themes)`) : un thème personnalisé (`Blockly.Theme.defineTheme`, `componentStyles.workspaceBackgroundColour`/`toolboxBackgroundColour`/`flyoutBackgroundColour`…) couvre l'espace de travail, la boîte à outils et le tiroir, appliqué via `workspace.setTheme()`. Bouton 🌙/☀️ dans la barre d'outils, choix persisté (`localStorage.themeApp`), appliqué par un petit `<script>` en tête de `<head>` (avant le `<style>` principal) pour éviter un flash du thème par défaut au chargement. Vérifié dans le navigateur, thème clair : boîte à outils et tiroir clairs et lisibles, panneau de code blanc à texte sombre, panneau Maqueen Plus (sélecteur de piste, curseurs, télécommande IR) entièrement lisible, panneau administrateur (catégories, onglet Aide avec le contenu de `readme.txt`) entièrement lisible — et non-régression du thème sombre après bascule aller-retour, persistance confirmée après rechargement de page |
| Contraste normal / élevé | Demande de l'utilisateur, orthogonale au thème clair/sombre (les deux se combinent librement : 4 états possibles). Mêmes variables CSS poussées vers le noir/blanc pur plutôt que des teintes intermédiaires (`:root[data-contrast="high"]`, `:root[data-theme="light"][data-contrast="high"]`), avec des bordures épaissies (2px) ajoutées aux grandes surfaces pour qu'elles restent visibles une fois les nuances aplaties. Trois thèmes Blockly personnalisés au lieu d'un seul (`sombreMicrobitV2`, `sombreEleveMicrobitV2`, `clairEleveMicrobitV2` — « clair normal » reste `Blockly.Themes.Classic`, fourni tel quel), choisis en croisant les deux réglages. Bouton ◐ à côté du bouton de thème, même mécanisme de persistance (`localStorage.contrasteApp`) et d'application avant le premier rendu. Vérifié dans le navigateur les 4 combinaisons : sombre+élevé (fond noir pur, texte blanc, boîte à outils/tiroir noirs), clair+élevé (fond blanc pur, texte noir, boîte à outils/tiroir blancs), non-régression de sombre+normal et clair+normal déjà vérifiés, `workspace.getTheme().name` confirmé correspondre à chaque combinaison, persistance confirmée après rechargement (les deux réglages survivent indépendamment).

Passe suivante, avec une image de référence de l'utilisateur (« je veux que le contraste élevé ressemble à ça ») : les BLOCS eux-mêmes devaient aussi passer en noir avec un simple contour blanc, plutôt que remplis de la couleur de leur catégorie — les variables CSS et les thèmes Blockly ci-dessus ne touchent que le fond de l'espace de travail/de la boîte à outils, pas le remplissage des blocs (chaque bloc pose sa couleur via `setColour()` à l'initialisation, indépendamment du thème du workspace). Résolu en ciblant directement les éléments SVG que Blockly dessine pour chaque bloc (`.blocklyPath`, `.blocklyPathDark`, `.blocklyPathLight`, `.blocklyText`), avec `!important` : Blockly leur pose `fill`/`stroke` en **attributs de présentation SVG**, la source la plus basse priorité de la cascade CSS, qu'une règle de feuille de style l'emporte donc sans peine — vérifié que `!important` n'était même pas strictement nécessaire mais gardé pour la robustesse. Aucune modification du JS qui construit les blocs. Vérifié dans le navigateur : blocs simples (`au_demarrage`, `boucle_infinie`) et bloc à champ (`lorsque_bouton`, menu déroulant "A") comparés côte à côte avec la référence — fond noir, contour blanc, texte blanc, champ de saisie du bloc resté lisible sans y toucher (fond clair par défaut de Blockly, déjà suffisamment contrasté) |
| Simulateur | LED, texte défilant, son (rendu hors ligne : durée, énergie, hauteur des notes), parole, gestes consommés à la lecture |
| Icônes prédéfinies (`Image.HAPPY`/`SAD`/`GHOST`/`HEART`) | Bug réel trouvé (signalé par l'utilisateur, qui a comparé HAPPY et SAD affichés côte à côte) et corrigé : HAPPY, SAD et GHOST allumaient un motif de LED erroné, sans rapport avec le vrai micro:bit — seule HEART était juste. Les quatre re-vérifiées pixel par pixel contre la définition officielle (`microbit_constimage.c`, dépôt `microbit-foundation/micropython-microbit-v2`) |
| Grove | 11 modules, code généré conforme aux sources Seeed, affichage conditionnel des sections |
| Servos | bornes, intervalle, rotation continue, arrêt au neutre, animation des cadrans |
| Mise en page | canevas synchronisé avec Blockly dans 9 situations, corbeille et zoom toujours visibles |
| Simulateur : fidélité visuelle de la carte micro:bit | Voir le détail complet (8 passes) dans la section dédiée ci-dessous, « Historique — fidélité visuelle de la carte micro:bit ». État actuel : LED éteintes visibles (boîtier clair), connecteur de bord en **SVG** (réglette plate, dents fines denses, bord du bas **onduleux** — le vrai trait distinctif du V2, « bosselé » vs le bord plat du V1, mentionné sur microbit.org/fr), USB et indicateur micro ajoutés, étiquettes A/B en triangle bleu avec lettre imprimée, badge « V2 » déplacé en étiquette d'interface (il est en réalité sérigraphié au dos, jamais sur la face avant) |
| Envoi sur la carte | écriture simulée avec un faux lecteur : 1 877 004 octets, tous les cas d'erreur |
| Panneau administrateur | Ctrl+Alt+Maj+A active/désactive, bouton ⚙ rouge caché sinon. Réordonner/masquer/renommer/**recolorer** une catégorie (pastille `<input type="color">`, conversion teinte Blockly → hex vérifiée par calcul), idem pour les sous-menus natifs (Communication, Grove) et les sous-menus personnalisés, création d'un sous-menu personnalisé avec extraction des blocs choisis, renommage d'un libellé de bloc appliqué aux blocs déjà posés et aux nouveaux, onglet Aide qui charge `readme.txt` par `fetch()` (28 420 caractères reçus, testé aussi après un blocage transitoire du serveur mono-thread — voir « détail agaçant » plus bas). Persisté en localStorage (sauf l'onglet Aide, sans état), testé via `window.adminTest` (voir un.js) faute de pouvoir simuler un glisser-déposer ou un clic sur un `<input type="color">` |
| Édition manuelle du code | Bouton « ✎ Éditer » : bascule vers un `<textarea>`, gèle le canevas Blockly (voile visuel qui capte aussi les clics), la saisie remplace `window.currentPythonCode` en direct — vérifié que `.hex`/`.py`/simulateur le lisent bien à cet instant. « Revenir aux blocs » restaure le code généré et dégèle. Testé via `window.editionCodeTest` (voir un.js), non persisté (perdu au rechargement, comme l'espace de travail lui-même) |
| Exécution tour par tour | Réécrit pour que `sleep()` laisse vraiment un capteur voir l'effet du tour précédent (voir `PROMPT_RECREATION.md` §14). Non-régression vérifiée sur le test déjà documenté : `was_gesture` déclenche 1 fois sur 5 tours, `is_gesture` 5 fois, identique à avant. Vérifié aussi : événements « lorsque … » toujours scrutés à chaque tour, programme sans boucle infinie, et repli correct sur l'ancien comportement avec deux boucles infinies empilées (cas rare) |
| Maqueen Plus | Cinématique différentielle vérifiée par calcul (roues égales → ligne droite ; roues opposées → rotation pure, position inchangée ; le signe du virage corrigé après un premier test qui tournait du mauvais côté). Capteurs de ligne : `true` sur la piste blanche, `false` en dehors, et **confirmation du point central** — un programme qui avance et relit son capteur à chaque tour voit sa position *et* sa lecture de capteur changer tour après tour (`true,true,true,false,false` en s'éloignant de la ligne), preuve que le tour précédent a bien eu le temps de bouger le robot avant la lecture suivante. Panneau affiché/masqué selon les blocs posés, vérifié en appelant directement la fonction de rafraîchissement (`window.maqueenTest`, voir un.js) — un glisser-déposer de bloc ne se simule pas de façon fiable depuis la console, y compris pour le panneau Grove déjà existant, vérifié en le constatant sur les deux à la fois. Bug préexistant corrigé au passage : DHT11/DHT22 n'avaient pas de substitut dans le simulateur (`NameError` au clic sur « Lancer la simulation ») |
| Maqueen : placement et fluidité | Glisser-déposer du robot testé par de vrais `PointerEvent` (`pointerdown`/`pointermove`/`pointerup`), position confirmée en pourcentage exact du point relâché ; « Réinitialiser » confirmé revenir à la position déposée, pas à l'ancien point fixe. Déplacement animé par transition CSS calée sur la durée réelle de chaque `sleep()` (corrige un rendu saccadé signalé par l'utilisateur) ; vérifié que le cap n'est plus replié dans [0, 360[ pendant la conduite (sinon une transition CSS interprète un passage 350°→10° comme -340° au lieu de +20°, testé en le faisant dépasser -360° sans reprendre une valeur positive) |
| Maqueen : plusieurs pistes | Sélecteur (`<select>`) peuplé de 3 tracés (ovale, rectangulaire, en huit), chacun avec son propre point de départ. Changement de piste vérifié via le vrai `<select>` (`change` déclenché) et non seulement via le raccourci de test, avec le point de départ des trois tracés confirmé « sur la ligne » (`window.maqueenTest.surLaLigne('M')` renvoie `true` dans les trois cas) |
| Maqueen : éditeur de piste | Ajout/déplacement/suppression de points testés par de vrais événements (`click` sur le canevas, `PointerEvent` sur une poignée, `dblclick`), pas seulement via les raccourcis de test. Tracé vérifié pixel par pixel (segments et fermeture du dernier au premier point tous blancs). Persistance en `localStorage` confirmée après un vrai rechargement de page (la piste réapparaît dans le sélecteur). « Annuler » confirmé ne rien écrire en stockage ; validation (< 3 points) confirmée refuser sans planter. Un bug réel trouvé par le test synthétique et corrigé : `setPointerCapture` peut lever `NotFoundError`, encadré de `try/catch` (sur la poignée d'édition et sur le glisser du robot) |
| Maqueen : largeur de la piste réglable | Curseur (8 à 40 px, 26 par défaut) remplaçant l'épaisseur de trait jusque-là fixée en dur en deux endroits (`dessinerPisteMaqueen` et l'aperçu de l'éditeur de piste), désormais une seule variable `MQ_LARGEUR_LIGNE` relue par les deux. Vérifié que les trois tracés prédéfinis et la piste personnalisée en cours d'édition redessinent immédiatement au glissement du curseur, et que la détection des capteurs de ligne (`window.maqueenTest.surLaLigne`) continue de fonctionner à la largeur minimale comme maximale |
| Maqueen : échelle d'affichage du robot | Curseur ×1 à ×4 (`MQ_ECHELLE_ROBOT`), appliqué via `transform: scale()` en bout de la chaîne translate/rotate déjà utilisée pour la position et le cap — purement visuel, aucune incidence sur `MQ.x`/`MQ.y`/`MQ.cap` ni sur la position calculée des capteurs. Vérifié : rotation et repositionnement du robot toujours corrects à ×3 (capture à l'écran) ; le rognage du robot par `overflow:hidden` de la piste près des bords à forte échelle est un compromis assumé, documenté dans `readme.txt` |
| Maqueen : indicateurs de capteurs de ligne sur le robot | Mêmes points (vert/gris) que la ligne sous la piste, dupliqués directement sur le bord avant du sprite (ordre L2/L1/M/R1/R2 de haut en bas à cap=0, déduit de `positionCapteurMaqueen`), pour les lire sans quitter le robot des yeux. Même registre de visibilité (`capteursLigneUtilisesMaqueen`) et même mise à jour (`mettreAJourIndicateursLigneMaqueen`) que la ligne existante — pas un second mécanisme. Vérifié : rien de visible sans bloc posé, les 5 apparaissent avec les 5 blocs, et l'état vert/gris suit la position du robot en direct (`window.maqueenTest.etatIndicateursLigneSprite`) |
| Maqueen Lite : indicateurs de capteurs de ligne sur le robot | Manquait à Maqueen Lite (seule la ligne « Ligne : G/D » sous la piste existait) alors que Maqueen Plus l'a depuis l'entrée précédente — signalé par l'utilisateur (« l'état des capteurs sur la simulation ne fonctionne pas pour le maqueen lite »), pas un bug : la ligne sous la piste fonctionnait déjà correctement (génération de code, événement `lorsque le capteur de ligne...`, DEL, tout vérifié fonctionnel avant de conclure qu'il manquait seulement l'affichage sur le robot lui-même). Deux points (gauche en haut, droit en bas, bord avant du sprite) ajoutés sur le même principe que Maqueen Plus : même registre de visibilité (`capteursLigneUtilisesMaqueenLite`), même mise à jour (`mettreAJourIndicateursLigneMaqueenLite`, étendue plutôt que dupliquée). Vérifié : les deux points cachés sans bloc, « gauche » apparaît et suit vert/gris la position réelle du robot avec le bloc `maqueenlite_ligne`, `window.maqueenLiteTest.etatIndicateursLigneSprite()` ajouté pour ce test |
| Maqueen : indicateurs de capteurs de ligne | N'affiche que les capteurs réellement lus par un bloc du programme (vérifié : ajouter un bloc `capteur de ligne (M)` + un `valeur brute (R1)` fait apparaître exactement ces deux-là, masque L1/L2/R2 ; les retirer masque toute la ligne). État vert/gris confirmé suivre la position du robot en direct (déplacé hors piste → gris, replacé sur la piste → vert), y compris via glisser-déposer, pas seulement pendant une simulation. Avertissement navigateur (`willReadFrequently`) sur les lectures `getImageData` répétées, corrigé en le déclarant à la création du contexte du canevas |
| Maqueen : sprite du robot | Coque redessinée cinq fois à la demande de l'utilisateur, toujours sans photo intégrée. Après quatre passes en CSS (divs + `clip-path`), la carrosserie **statique** (coque, pile, liseré PCB, support moteur, vis, fil) est passée en **SVG tracé** — technique choisie explicitement par l'utilisateur (« essayons l'option 2 ») après avoir demandé « comment faire en sorte que les images soient fidèles aux originaux » : un chemin vectoriel suit le contour chanfreiné exact plutôt que l'approximer par `clip-path`, et les dégradés (`<linearGradient>`/`<radialGradient>`) rendent plus proprement que leurs équivalents CSS sur des formes aussi petites. Les éléments **dynamiques** (DEL, capteurs de ligne, marqueur avant) restent des `<div>` superposés, code JS inchangé. Vérifié : le SVG se comporte comme les anciens divs pour la rotation/l'échelle (`transform` sur le conteneur, inchangé), le glisser-déposer (le `pointerdown` sur une forme SVG remonte bien jusqu'à `#maqueen-robot`, `elementFromPoint` confirmé), et les DEL/capteurs restent positionnés correctement après avoir été sortis de `.mq-corps` (supprimée) vers des enfants directs du conteneur. Maqueen Lite converti à son tour en SVG (entrée suivante) ; Kitrobot v2 reste en CSS (aucune photo de référence fournie pour lui) |
| Maqueen Plus V3 + télécommande IR + LiDAR | Registres I2C vérifiés depuis les dépôts GitHub officiels DFRobot (`pxt-DFRobot_MaqueenPlus_v20` pour le suiveur de ligne/PID V3, `pxt-DFRobot_matrixLidarDistanceSensor` pour le LiDAR) — jamais sur du vrai matériel. Génération de code vérifiée pour les 14 nouveaux blocs V3, les 7 blocs LiDAR et les 5 blocs infrarouge (dont les deux blocs événementiels `lorsque la commande...`). Décodeur NEC réécrit en MicroPython (le pilote DFRobot d'origine est du C++ natif non portable), avec les tables de boutons des deux télécommandes reconnues (« noire » DFRobot, « grise Car mp3 » — vérifiée depuis une source indépendante). Bug réel trouvé et corrigé en testant : le dispatcher infrarouge appelé depuis le code compilé cherchait les gestionnaires `on_ir_...` via `globals()`, qui renvoie l'espace de noms du **module où la fonction est définie** (le script Brython du simulateur), pas celui où `exec()` a créé les fonctions du programme élève (`env`) — exactement le piège déjà documenté pour `_radio_traiter` mais pas appliqué à ce nouveau code du premier coup. Corrigé en définissant le dispatcher à l'intérieur de `lancer_simulation()`, fermeture sur `env` comme son homologue radio. Vérifié avec les deux télécommandes, en code à la main et via de vrais blocs compilés. Panneau LiDAR (trois curseurs gauche/avant/droite) et simulateur de télécommande (deux menus + bouton) affichés/masqués selon les blocs posés, comme les autres panneaux |
| Maqueen Lite | Registres I2C vérifiés depuis le dépôt GitHub officiel `DFRobot/pxt-maqueen` (namespace `maqueen`, socle commun — l'extension `Maqueen_V5` plus récente du même dépôt est hors périmètre) — jamais sur du vrai matériel. Module séparé du Maqueen Plus (catégorie et pilote `_ml_*` distincts). Depuis la fusion des pistes (entrée suivante), dispose d'un robot animé sur la piste partagée, remplaçant les deux cases à cocher d'origine. Génération de code vérifiée pour les 7 blocs (dont l'événement `lorsque le capteur de ligne...`) ; simulation testée sans erreur, et l'événement confirmé se déclencher exactement au changement d'état du capteur (position réelle sur la piste, vérifié via un effet observable sur un autre module) ; mouvement réel confirmé (`_ml_moteur` déplace vraiment `ML.x`/`ML.y` via le pipeline de blocs complet). Sprite initial (placeholder gris-violet) remplacé par un **SVG tracé** d'après deux photos officielles DFRobot du produit réel (`ROB0148-EN_Main_01.jpg` vue 3/4, `ROB0148-EN_Dim_02.jpg` vue de dessus de la carte « shield ») fournies par l'utilisateur via le lien produit : carte bleue en pointe vers l'avant, deux capteurs ultrasons chromés montés sur une petite sous-carte à la pointe, compartiment à piles noir avec contacts métal à l'arrière, grandes roues blanches/argentées à pneu noir — même technique hybride que Maqueen Plus (carrosserie **statique** en SVG, DEL/marqueur avant restés en `<div>` JS inchangés). Vérifié : les 18 formes du SVG (roues, coque, pile, sous-carte ultrasons, vis) ont toutes une `getBBox()` non nulle et cohérente avec le `viewBox` 22×28 ; les 6 dégradés référencés (`mlg-corps`, `mlg-batt`, `mlg-pneu`, `mlg-jante`, `mlg-us`, `mlg-vis`) existent tous dans `<defs>` (pas de référence cassée) ; `window.simu_mlDel('gauche', true)` confirmé toujours mettre à jour `#maqueenlite-sprite-del-g` (élément sorti de l'ancien `.mlite-corps` supprimé, code JS inchangé) |
| Piste partagée entre les trois robots | Demande explicite de l'utilisateur : « je veux que la partie simulation piste soit la même et disponible pour tous les robots ». Un seul panneau/canevas (`#piste-panneau`, 300×220) pour Maqueen Plus, Kitrobot v2 et Maqueen Lite — un seul robot affiché à la fois, déterminé par `robotActifDetecte()` (quels blocs sont posés). Le tracé « Ligne droite (départ/arrivée) », auparavant la piste dédiée et séparée de Kitrobot (choix explicite antérieur de NE PAS réutiliser celle de Maqueen), est désormais un 4ᵉ choix dans le même sélecteur que les tracés Maqueen, utilisable par n'importe quel robot. Les couleurs de la piste (vert/blanc ou blanc/noir) suivent le **robot actif**, pas le tracé choisi (`couleursPisteRobotActif()`) — Kitrobot lit un pixel sombre comme « sur la ligne », l'inverse des deux autres, donc la piste doit s'inverser avec lui quel que soit le tracé. Largeur de piste et échelle du robot (curseurs déjà existants pour Maqueen Plus) désormais partagés par les trois. Vérifié : changement de robot actif change le titre du panneau, montre le bon sprite, cache les deux autres, redessine la piste dans les bonnes couleurs ; capteurs de ligne testés sur la piste partagée pour les trois robots ; fanions Départ/Arrivée affichés uniquement sur ce tracé, quel que soit le robot ; curseur d'échelle confirmé agir sur le robot réellement affiché (bug trouvé et corrigé : ne mettait à jour que le sprite Maqueen Plus au premier essai). Glisser-déposer du robot (souris/tactile via Pointer Events) également manquant pour Kitrobot v2 et Maqueen Lite après la fusion — signalé par l'utilisateur, pas trouvé par les tests — corrigé en factorisant l'écouteur (`activerGlisserDeposerRobot`) et en l'attachant aux trois robots au lieu du seul `#maqueen-robot` d'origine ; vérifié par `PointerEvent` synthétiques sur les trois |
| Kitrobot v2 | Module séparé de Maqueen : broches **facultatives et configurables** par des blocs « définir » (pas de câblage réel vérifié pour ce kit), piste dédiée départ/arrivée (droite, noir sur blanc — inversée de Maqueen exprès pour les distinguer d'un coup d'œil). Génération de code vérifiée (tous les blocs, y compris ceux à l'intérieur du pilote retiré côté simulateur). Les 16 fonctions `_kb_*` du pilote — entièrement à l'intérieur du bloc `# >>> pilote kitrobot`, donc retirées avant exécution — ont chacune leur substitut dans le simulateur ; vérifié en exécutant un programme qui les appelle toutes (`_kb_avancer`, `_kb_pivoter`, `_kb_moteur`, `_kb_case`, `_kb_virage`, `_kb_buzzer`, `_kb_del_couleur`, `_kb_del_rgb`, `_kb_clignoter`, `_kb_arcenciel`…) sans aucune erreur. Cinématique et capteurs de ligne réutilisent le modèle de Maqueen (même formule différentielle), avec seulement deux capteurs (gauche/droit) et une détection **inversée** (ligne sombre sur fond clair). Panneau affiché/masqué selon les blocs posés, vérifié via `window.kitrobotTest` (même limite déjà connue : `workspace.clear()` synthétique ne déclenche pas l'écouteur de changement, la fonction de rafraîchissement appelée directement si). Non-régression sur Maqueen confirmée (les deux panneaux réagissent indépendamment) |

## Historique — fidélité visuelle de la carte micro:bit

Signalé par l'utilisateur (« le visuel de la carte micro:bit n'est pas conforme
à l'original »), avec `microbit.org/fr/get-started/features/overview/` comme
référence de départ. Huit passes successives, chacune déclenchée par un
nouveau retour de l'utilisateur :

1. **Premier passage** (diagrammes officiels V2 de la page microbit.org) :
   LED éteintes quasi invisibles (fond très sombre `#2a2a2a`) → recolorées en
   boîtier clair. Plots du connecteur en grand trou noir → refaits pleins or.
   Trois éléments manquants ajoutés en CSS pur : connecteur micro-USB,
   indicateur du microphone (nouveauté V2), deuxième triangle d'accent en coin.
2. **« le bord inférieur n'est pas plat, il y a des encoches »** : le grand
   rayon de coin bas (25px) grignotait les coins de la réglette dorée en un
   arrondi parasite — réduit à 6px. Conclusion **erronée** à ce stade (voir
   passe 8) : le diagramme alors utilisé ne montrait pas le bord « bosselé »
   propre au V2 (mentionné sur microbit.org), d'où l'hypothèse à tort qu'un
   bord plat était correct.
3. **Capture avant/dos envoyée, clarifiée « ce sont les 2 faces de la
   carte »** : le texte « V2 » est en réalité sérigraphié au **dos**, jamais
   sur la face avant simulée — déplacé de la carte vers une étiquette
   d'interface à côté du titre (`#mb-version-tag`).
4. **« pourquoi ne dessines-tu pas les encoches correctement »** : analyse
   pixel par pixel (Pillow) plutôt qu'une relecture à l'œil — le motif
   `repeating-linear-gradient` était trop dense/uniforme ; espacé pour
   imiter des dents individuelles.
5. **« c'est encore pire »** : l'espacement a révélé un défaut géométrique
   jusque-là masqué par la densité — les coins très arrondis (15px) de deux
   plots voisins se touchaient dans l'espace laissé par `space-around`,
   dessinant une pointe triangulaire parasite. Corrigé en séparant plots et
   dents en deux éléments distincts (`.mb-pin`, `.mb-dents`).
6. **« N'es-tu pas capable de le faire ? »** : téléchargement local du
   diagramme officiel + échantillonnage Pillow ciblé (bouton A, triangle
   d'accent) — a trouvé deux écarts réels invisibles sur petites captures :
   étiquettes A/B en triangle bleu avec lettre imprimée dedans (pas une
   lettre isolée), bouton à deux languettes au bord bas (pas 4 pastilles aux
   coins). Bleu d'accent corrigé à la valeur mesurée `rgb(1,145,220)`.
7. **« pourquoi refuses-tu de dessiner le connecteur ainsi ? » (capture
   jointe)** : cette capture montrait le style du **simulateur MakeCode
   officiel** (pxt-microbit), pas une photo du circuit imprimé — plots en
   dôme très arrondi, trou clair gris/blanc, dents confinées à une bande
   basse. Reconstruit en conséquence.
8. **« toujours pas », puis nouvelle capture confirmée comme référence** :
   cette capture montrait encore un **troisième style différent** — réglette
   plate (pas de dômes), dents fines denses sur toute la largeur, et surtout
   un **bord du bas onduleux** avec une encoche peu profonde sous chaque
   étiquette. Ce bord ondulé est exactement le « bord inférieur bosselé »
   propre au V2 mentionné dès le début sur microbit.org/fr (par opposition
   au bord plat du V1) — la conclusion de la passe 2 était donc fausse : ce
   diagramme-là ne montrait simplement pas ce détail, il n'était pas absent
   de la vraie carte. Après plusieurs échecs à obtenir cette forme en CSS
   (dégradés/`border-radius` qui ne collent jamais bien un bord ondulé),
   **le connecteur est passé en SVG** (`<path>` avec des arcs pour
   l'ondulation, motif de dents en `<pattern>` peint directement dans le
   tracé — donc jamais de débordement hors du contour, contrairement aux
   tentatives CSS précédentes). Les identifiants `#pin0`/`#pin1`/`#pin2`
   (écouteurs tactiles dans `un.js`) portés sur des `<rect>` transparentes
   superposées ; aucune modification JS nécessaire. Vérifié : `getElementById`
   fonctionne sur les éléments SVG comme sur des `<div>`, `mousedown`/`mouseup`
   synthétiques confirmés déclencher `window.simu_pin0_pressed`, rendu net à
   taille réelle comme en gros plan (vectoriel, pas de crénelage).
9. **« le problème d'encoches est résolu mais maintenant il y a un problème
   au niveau de l'affichage des broches »** : régression réelle introduite
   par le passage en SVG (passe 8), pas trouvée par les tests de la passe 8
   (qui vérifiaient seulement que le clic déclenchait bien
   `window.simu_pin0_pressed`, pas l'apparence). L'ancien `.mb-pin:active {
   filter: brightness(0.8) }` sur un `<div>` plein n'a pas d'équivalent
   direct sur un `<rect>` SVG à `fill="transparent"` : rien à assombrir. Au
   clic, plus aucun retour visuel sur la broche pressée, alors que la
   fonction marchait toujours (confirmé par `MouseEvent` synthétique avant
   de corriger : `pressed` passait bien à `true`, seul le rendu ne bougeait
   pas). Corrigé dans `lierCapteurTactile()` (`un.js`) en posant/retirant
   explicitement une classe (`mb-edge-zone-active`, remplie
   `rgba(0,0,0,0.28)`) sur `mousedown`/`mouseup`/`mouseleave`, plutôt que de
   compter sur `:active` seul — plus fiable, et surtout testable par les
   mêmes événements synthétiques qui avaient validé la fonction.
10. **« je veux ça » (capture jointe, sans ambiguïté cette fois)** : combine
    en réalité les deux styles précédents plutôt que d'en remplacer un par
    l'autre — le dôme rond à trou clair de la passe 6/7 **et** le bord bas
    onduleux « bosselé » de la passe 8. Le SVG existant (passe 8) a été
    étendu plutôt que reconstruit : la bande à dents onduleuse reste
    inchangée (fond, `y` décalé de +18 pour laisser la place aux dômes
    au-dessus), et cinq petits `<path>` en dôme (arc `A`) sont peints
    **par-dessus**, en or plein sans motif de dents, avec un léger
    chevauchement (10px) vers le bas pour ne laisser aucune couture visible
    avec la bande — même principe que la passe 5 (deux formes distinctes
    plutôt qu'un fond partagé retouché), mais cette fois en complément l'une
    de l'autre au lieu d'être des alternatives. Vérifié par capture d'écran
    à fort zoom, comparé côte à côte, et non-régression du retour visuel au
    clic (passe 9) et de la génération de code confirmées.
11. **« c'est mieux mais, c'est pas encore correct »** : cette fois une
    mesure de proportions plutôt qu'une nouvelle capture — échantillonnage
    de colonnes verticales (Pillow) pour trouver où le fond passe du noir
    (au-dessus) à l'or des dents (en dessous), entre deux dômes. Mesuré
    ≈ 21 % de hauteur noire chez la référence contre 31 % dans notre rendu
    (frontière dôme/bande à `y=18` sur un total de 58) : les dômes étaient
    trop hauts par rapport à la bande à dents. Confirmé par l'utilisateur
    avant de corriger (question à choix : zone noire/dents, taille des
    dômes, ou autre — réponse « oui, la zone noire/dents »). Frontière
    ramenée à `y=12`, arcs des dômes passés en ellipse (`rx=18 ry=12` au
    lieu d'un cercle `18,18`) pour rester aussi larges mais moins hauts,
    trou et étiquettes repositionnés en conséquence. Vérifié par capture
    d'écran à fort zoom et sur la réglette complète.
12. **Nombre exact de petites pistes précisé par l'utilisateur** : « une
    piste à gauche du connecteur 0 ; entre 0 et 1, 4 pistes ; entre 1 et 2,
    5 ; entre 2 et 3V, 5 ; entre 3V et GND, 4 ; une piste à droite de GND ».
    Le motif `<pattern>` répété (une dent tous les 6px, sans se soucier du
    compte final dans chaque espace) ne pouvait pas garantir ce genre de
    nombre exact — remplacé par des `<rect>` individuels, un par dent,
    positionnés par calcul (chaque groupe de N dents réparti à intervalles
    égaux dans son espace disponible). Vérifié en comptant par le DOM
    (`querySelectorAll` sur les dents, tri des `x`) plutôt qu'à l'œil :
    1/4/5/5/4/1, conforme à la demande.
13. **« il n'y a pas 4 pistes dorées entre 0 et 1 ni entre 3v et GND »** :
    confusion de vocabulaire trouvée après coup — « piste » désigne le
    segment **doré** (la trace du connecteur), pas le trait **sombre**
    séparateur compté à la passe 12. Pour N pistes visibles et bien
    détachées dans un espace, il faut N+1 traits séparateurs (un contre
    chaque dôme voisin, pas seulement entre les pistes internes) : avec
    seulement N-1 traits internes (passe 12), la piste tout contre chaque
    dôme se fondait dans sa couleur, sans frontière visible — d'où N-1
    pistes clairement détachées à l'écran au lieu de N (invisible pour les
    groupes à 5, plus flagrant pour les groupes à 4). Recalculé en
    conséquence (24 traits au lieu de 20) et corrigé aussi l'ordre de
    peinture : les dômes sont maintenant peints AVANT les traits (pas
    après), pour qu'un trait collé pile sur le bord d'un dôme ne soit plus
    partiellement recouvert par lui. Vérifié par capture d'écran ciblée sur
    chaque groupe (0-1 et 3V-GND en particulier) et par comptage DOM des 24
    traits.
14. **« je veux que les 20 pistes dorées aient toutes la même largeur »** :
    avec des positions de dômes fixes et un espace identique (20px) pour
    chaque groupe interne, un groupe à 4 pistes et un groupe à 5 pistes ne
    peuvent **pas** avoir la même largeur de piste avec la même largeur de
    trait — plus de pistes dans le même espace donne forcément des pistes
    plus étroites. Recalculé en sens inverse : largeur de piste fixée à
    2,6 (constante voulue), largeur de trait fixée à 2, puis la largeur
    d'espace nécessaire déduite pour chaque groupe (4 pistes + 5 traits =
    20,4 ; 5 pistes + 6 traits = 25) — ce qui déplace les dômes eux-mêmes
    (ils ne sont plus espacés uniformément), avec un effet en cascade sur
    toutes les coordonnées dépendantes : les 5 chemins de dôme, les 20
    positions de traits séparateurs, les 5 trous clairs, les 5 étiquettes,
    les points de l'ondulation du bord bas (recalés sur les nouveaux
    centres de dôme, sinon l'encoche ne serait plus centrée dessous), et
    les 5 zones cliquables (bornées aux nouveaux milieux d'espace plutôt
    qu'à des tranches fixes de 56px). Vérifié par calcul direct sur le DOM
    plutôt qu'à l'œil : distance entre chaque paire de traits consécutifs
    (hors largeur des dômes eux-mêmes) — les 20 pistes mesurent exactement
    2,6 partout, aucune exception.
15. **« les connecteurs 0/1/2/3V/GND [doivent avoir] une largeur égale à 5
    fois la largeur d'une piste dorée »** : contrainte de ratio en plus des
    deux déjà acquises (largeur totale = 280, les 20 pistes égales entre
    elles) — un système à résoudre, pas une valeur à changer isolément.
    Largeur de trait gardée fixe (2), largeur de piste P et largeur de dôme
    5P posées comme inconnues, résolu via `45P + 24×2 = 280` (équation
    obtenue en sommant tous les espaces et dômes en fonction de P) →
    P ≈ 5,1556, dôme ≈ 25,78 (`rx` 12,89). Toutes les coordonnées
    dépendantes recalculées en cascade une nouvelle fois (dômes, traits,
    trous, étiquettes, ondulation du bord bas, zones cliquables) selon la
    même méthode que la passe 14. Vérifié par script : les 20 pistes
    mesurent 5,15–5,16 (uniforme), et largeur dôme ÷ largeur piste = 5,0
    exactement.

Leçon retenue pour la suite : un même mot (« encoches », « bord ») a désigné
successivement trois défauts différents selon la capture en main à ce
moment-là — ne jamais supposer que deux signalements consécutifs parlent du
même défaut sans une capture ou un repère visuel précis à l'appui. Autre
leçon (passe 9) : un changement de balisage (`<div>` → SVG) peut préserver
la logique (l'ID, l'écouteur, la variable globale) tout en perdant un
comportement purement visuel qui reposait sur une propriété CSS différente
(`filter` sur un fond opaque vs `fill` sur un fond transparent) — tester
« ça déclenche toujours » ne suffit pas, il faut aussi retester « ça se
voit toujours » après ce genre de changement.

## À vérifier avec du matériel — je n'ai pas de carte

Rien de tout cela n'est douteux, mais rien n'est confirmé non plus.

1. **Le transfert réel** vers le lecteur MICROBIT (bouton « Envoyer sur la carte »).
   Toute la chaîne est testée sauf l'écriture sur le vrai volume.
2. **Le capteur de gestes PAJ7620.** Table d'initialisation reprise de la
   bibliothèque Seeed, logique de lecture conforme à la documentation, mais
   jamais confronté à la puce.
3. **Les six modules I²C** — AHT20/DHT20, LCD 16x2, VEML6040, DRV8830, SCD30,
   SCD41. Adresses et trames reprises des sources Seeed. Le simulateur valide la
   logique des blocs, pas le dialogue I²C.
4. **Le pilote TM1637** (afficheur 4 digits) : protocole bit-bangé sans
   temporisations explicites. Si l'afficheur reste éteint, c'est le premier
   endroit où regarder.
5. **Les servomoteurs** : conversion impulsion → `write_analog` jamais mesurée à
   l'oscilloscope.
6. **Le DHT11 et le DHT22.** Même pilote assembleur ARM Thumb (repris de
   rhubarbdog/microbit-dht11, MIT) pour capturer le signal, jamais exécuté sur
   une vraie carte ; seul le décodage des 5 octets diffère entre les deux
   capteurs, vérifié par calcul contre l'exemple du datasheet DHT22 (65,2 %,
   35,1 °C) mais pas sur un capteur réel. Sur V1 la source amont est réputée
   fonctionner ; sur V2 le pilote refuse volontairement la lecture (voir readme
   §7) au lieu de deviner un décalage bit-à-bit non vérifié. Visibles par
   défaut dans « Température & humidité », plus masqués séparément depuis que
   le sous-menu dédié a été fusionné avec AHT20/DHT20 — seuls le tooltip et le
   -1 renvoyé sur V2 avertissent maintenant. Si un V1 ou un DHT22 est
   disponible : poser le bloc, vérifier `temperature()`/`humidite()` contre un
   thermomètre, et surtout confirmer qu'un `write_digital`/`set_pull` répété ne
   perturbe pas un autre module câblé en même temps (`_dht_birq`/`_ubirq`
   coupent les interruptions le temps de la capture).
7. **Le Maqueen Plus.** Protocole I²C repris d'un pilote MicroPython tiers
   vérifié (`GBSL-Informatik/maqueen-plus-v2-mpy`), jamais confronté à la
   puce réelle du châssis. Si un Maqueen Plus est disponible : vérifier que
   le sens de rotation d'un moteur correspond bien à `sens=0`/`sens=1`, et
   que l'octet de `0x1D` associe vraiment chaque bit au bon capteur de
   ligne (l'ordre L2/L1/M/R1/R2 vient de la source, pas d'une mesure).
8. **Le Kitrobot v2.** Aucune documentation de câblage fiable trouvée pour ce
   kit (contrairement au Maqueen Plus) : plutôt que deviner un protocole,
   toutes les broches sont **laissées au choix de l'élève/enseignant** via
   des blocs « définir » facultatifs, avec des valeurs par défaut
   raisonnables mais non vérifiées (P1/P2 pour les servos, P0 l'ultrason,
   P8 le buzzer, P13/P14 les capteurs de ligne, P15 le ruban). Composé
   entièrement de briques déjà vérifiées séparément (servo continu, Grove
   ultrason, Grove ruban) : si un exemplaire est disponible, vérifier surtout
   le sens de montage des deux servos (`_kb_avancer` suppose un montage en
   miroir — signe inversé à droite — sinon le robot recule au lieu
   d'avancer) et le sens de sortie des capteurs de ligne Grove Line Finder
   (certains modules sortent l'inverse selon calibration).
9. **Maqueen Plus V3, télécommande infrarouge et LiDAR.** Registres I2C
   repris des dépôts GitHub officiels DFRobot (`pxt-DFRobot_MaqueenPlus_v20`,
   `pxt-DFRobot_matrixLidarDistanceSensor`), jamais confrontés à un vrai
   chassis V3 ni à un vrai capteur LiDAR. Si disponibles : vérifier que le
   suiveur de ligne V3 (registre 60) et les commandes PID (distance/angle,
   registres 63-72 et 85-87) produisent bien le comportement attendu — la
   source elle-même comporte une incohérence relevée en l'implémentant
   (`pidControlDistance` plafonne la distance à 60000 au lieu de 6000,
   probable coquille du fabricant, reproduite telle quelle plutôt que
   « corrigée » sans certitude) ; et que le sens gauche/droite du bloc
   « tourner (PID) » correspond à l'attente (la source ne code que le signe
   de l'angle, pas une vraie notion gauche/droite). Pour la télécommande :
   l'adresse NEC exacte de la télécommande DFRobot « noire » n'est pas
   documentée, seul le code bouton est vérifié après décodage — une autre
   télécommande NEC à la même adresse générique pourrait donc, en théorie,
   déclencher les mêmes évènements.
10. **Maqueen Lite.** Protocole repris du dépôt GitHub officiel
    `DFRobot/pxt-maqueen` (namespace `maqueen`), jamais confronté à un vrai
    chassis. Si disponible : vérifier surtout le sens des deux capteurs de
    ligne (P13/P14 lus bruts, `0`/`1` — la source ne précise pas laquelle
    des deux valeurs correspond à « sur la ligne », ça dépend du câblage du
    module), et la séquence de déclenchement de l'ultrason (elle vérifie
    l'état de repos de la broche écho avant de choisir le front à mesurer —
    fidèlement reproduite, mais jamais vue fonctionner sur une vraie carte).

## Écarté volontairement

| Module | Raison |
| --- | --- |
| **Vision AI V2** | pile SSCMA complète, JSON transporté par blocs sur I²C. Un projet en soi. |
| **UartWiFi** | initialiser l'UART sur des broches externes coupe la liaison série USB ; temporisations AT à régler avec le module en main. |
| **Import dans MakeCode** | formats incompatibles par construction, voir `readme.txt` §4. |

## Limites connues, sans remède prévu

- Le tiroir de la catégorie **Boucles** fait 406 px, imposé par `controls_for`,
  un bloc natif de Blockly. Les autres catégories sont sous 400 px.
- La **corbeille** dépasse de 4 px à droite du canevas : marge calculée par
  Blockly, sans réglage exposé.
- L'envoi sur la carte demande **Chrome ou Edge**. Firefox et Safari n'ont pas
  l'API d'accès aux fichiers ; le bouton y est désactivé.
- Après chaque transfert, le lecteur se démonte et se remonte : il faut le
  redésigner au clic suivant. C'est le comportement de la carte, pas un défaut.
- Le mode administrateur n'a **aucune sécurité réelle** : l'app est 100 %
  cliente, le raccourci Ctrl+Alt+Maj+A n'est qu'une dissuasion contre un clic
  accidentel d'élève, pas une authentification. La config est en localStorage,
  donc propre à chaque navigateur/poste : pas de partage automatique entre
  postes d'une salle.

## Reprendre dans une nouvelle conversation

Donner ces trois fichiers comme point de départ :

```
C:\Users\jreyn\OneDrive\Bureau\blockly_ts\ETAT_DU_PROJET.md
C:\Users\jreyn\OneDrive\Bureau\blockly_ts\readme.txt
C:\Users\jreyn\OneDrive\Bureau\blockly_ts\PROMPT_RECREATION.md
```

Puis préciser ce qu'on veut faire. Le code lui-même est commenté en français, en
expliquant les raisons plutôt que le fonctionnement — c'est là que se trouve le
détail des choix.

Rappel de méthode utile : **rien n'est considéré comme fonctionnel sans mesure**.
Pour le `.hex`, relire le fichier produit ; pour les blocs, générer chacun seul ;
pour la mise en page, comparer les dimensions au conteneur.

## Détail agaçant à connaître

Le navigateur garde `un.js`, `deux.js` et `firmware.hex` en cache. Après toute
modification, recharger par **Ctrl+Maj+R**, sinon on teste l'ancienne version.
Le firmware est désormais lu en `no-store`, mais pas les scripts.

`app.py` utilisait `socketserver.TCPServer`, **mono-thread** : le navigateur
ouvrant plusieurs connexions en parallèle pour charger `trois.js`, `deux.js`
et `un.js`, le serveur restait bloqué sur la première (gardée ouverte en
HTTP/1.1 keep-alive) et ne répondait jamais aux autres — `index.html`
s'affichait (première requête servie), mais l'espace de travail Blockly
restait vide indéfiniment, `un.js` n'étant jamais exécuté. Pas qu'un souci de
test occasionnel : n'importe quel navigateur peut déclencher ce blocage dès
le tout premier chargement. Corrigé en ajoutant `socketserver.ThreadingMixIn`
à `Serveur` — écarté un temps par crainte d'un accès concurrent au lecteur de
carte dans `deux.js`, mais ce lecteur est piloté côté navigateur (File System
Access API) : le serveur Python ne fait que servir des fichiers statiques en
lecture seule, sans état partagé entre requêtes, donc rien à protéger.
