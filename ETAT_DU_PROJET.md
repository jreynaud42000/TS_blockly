# État du projet — éditeur Blockly micro:bit V2

Dossier de travail : `C:\Users\jreyn\OneDrive\Bureau\blockly_ts`
Lancement : double-clic sur `lancer_projet.bat`, puis <http://localhost:8000>

Ce fichier dit **où on en est** : ce qui a été vérifié, ce qui ne peut l'être
sans matériel, et ce qui a été écarté. Les deux autres documents complètent :

- `readme.txt` — mode d'emploi et pièges d'usage
- `PROMPT_RECREATION.md` — tout reconstruire de zéro, avec les 38 pièges connus (nº 0 à nº 37)

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
| Simulateur | LED, texte défilant, son (rendu hors ligne : durée, énergie, hauteur des notes), parole, gestes consommés à la lecture |
| Icônes prédéfinies (`Image.HAPPY`/`SAD`/`GHOST`/`HEART`) | Bug réel trouvé (signalé par l'utilisateur, qui a comparé HAPPY et SAD affichés côte à côte) et corrigé : HAPPY, SAD et GHOST allumaient un motif de LED erroné, sans rapport avec le vrai micro:bit — seule HEART était juste. Les quatre re-vérifiées pixel par pixel contre la définition officielle (`microbit_constimage.c`, dépôt `microbit-foundation/micropython-microbit-v2`) |
| Grove | 11 modules, code généré conforme aux sources Seeed, affichage conditionnel des sections |
| Servos | bornes, intervalle, rotation continue, arrêt au neutre, animation des cadrans |
| Mise en page | canevas synchronisé avec Blockly dans 9 situations, corbeille et zoom toujours visibles |
| Envoi sur la carte | écriture simulée avec un faux lecteur : 1 877 004 octets, tous les cas d'erreur |
| Panneau administrateur | Ctrl+Alt+Maj+A active/désactive, bouton ⚙ rouge caché sinon. Réordonner/masquer/renommer/**recolorer** une catégorie (pastille `<input type="color">`, conversion teinte Blockly → hex vérifiée par calcul), idem pour les sous-menus natifs (Communication, Grove) et les sous-menus personnalisés, création d'un sous-menu personnalisé avec extraction des blocs choisis, renommage d'un libellé de bloc appliqué aux blocs déjà posés et aux nouveaux, onglet Aide qui charge `readme.txt` par `fetch()` (28 420 caractères reçus, testé aussi après un blocage transitoire du serveur mono-thread — voir « détail agaçant » plus bas). Persisté en localStorage (sauf l'onglet Aide, sans état), testé via `window.adminTest` (voir un.js) faute de pouvoir simuler un glisser-déposer ou un clic sur un `<input type="color">` |
| Édition manuelle du code | Bouton « ✎ Éditer » : bascule vers un `<textarea>`, gèle le canevas Blockly (voile visuel qui capte aussi les clics), la saisie remplace `window.currentPythonCode` en direct — vérifié que `.hex`/`.py`/simulateur le lisent bien à cet instant. « Revenir aux blocs » restaure le code généré et dégèle. Testé via `window.editionCodeTest` (voir un.js), non persisté (perdu au rechargement, comme l'espace de travail lui-même) |
| Exécution tour par tour | Réécrit pour que `sleep()` laisse vraiment un capteur voir l'effet du tour précédent (voir `PROMPT_RECREATION.md` §14). Non-régression vérifiée sur le test déjà documenté : `was_gesture` déclenche 1 fois sur 5 tours, `is_gesture` 5 fois, identique à avant. Vérifié aussi : événements « lorsque … » toujours scrutés à chaque tour, programme sans boucle infinie, et repli correct sur l'ancien comportement avec deux boucles infinies empilées (cas rare) |
| Maqueen Plus | Cinématique différentielle vérifiée par calcul (roues égales → ligne droite ; roues opposées → rotation pure, position inchangée ; le signe du virage corrigé après un premier test qui tournait du mauvais côté). Capteurs de ligne : `true` sur la piste blanche, `false` en dehors, et **confirmation du point central** — un programme qui avance et relit son capteur à chaque tour voit sa position *et* sa lecture de capteur changer tour après tour (`true,true,true,false,false` en s'éloignant de la ligne), preuve que le tour précédent a bien eu le temps de bouger le robot avant la lecture suivante. Panneau affiché/masqué selon les blocs posés, vérifié en appelant directement la fonction de rafraîchissement (`window.maqueenTest`, voir un.js) — un glisser-déposer de bloc ne se simule pas de façon fiable depuis la console, y compris pour le panneau Grove déjà existant, vérifié en le constatant sur les deux à la fois. Bug préexistant corrigé au passage : DHT11/DHT22 n'avaient pas de substitut dans le simulateur (`NameError` au clic sur « Lancer la simulation ») |
| Maqueen : placement et fluidité | Glisser-déposer du robot testé par de vrais `PointerEvent` (`pointerdown`/`pointermove`/`pointerup`), position confirmée en pourcentage exact du point relâché ; « Réinitialiser » confirmé revenir à la position déposée, pas à l'ancien point fixe. Déplacement animé par transition CSS calée sur la durée réelle de chaque `sleep()` (corrige un rendu saccadé signalé par l'utilisateur) ; vérifié que le cap n'est plus replié dans [0, 360[ pendant la conduite (sinon une transition CSS interprète un passage 350°→10° comme -340° au lieu de +20°, testé en le faisant dépasser -360° sans reprendre une valeur positive) |
| Maqueen : plusieurs pistes | Sélecteur (`<select>`) peuplé de 3 tracés (ovale, rectangulaire, en huit), chacun avec son propre point de départ. Changement de piste vérifié via le vrai `<select>` (`change` déclenché) et non seulement via le raccourci de test, avec le point de départ des trois tracés confirmé « sur la ligne » (`window.maqueenTest.surLaLigne('M')` renvoie `true` dans les trois cas) |
| Maqueen : éditeur de piste | Ajout/déplacement/suppression de points testés par de vrais événements (`click` sur le canevas, `PointerEvent` sur une poignée, `dblclick`), pas seulement via les raccourcis de test. Tracé vérifié pixel par pixel (segments et fermeture du dernier au premier point tous blancs). Persistance en `localStorage` confirmée après un vrai rechargement de page (la piste réapparaît dans le sélecteur). « Annuler » confirmé ne rien écrire en stockage ; validation (< 3 points) confirmée refuser sans planter. Un bug réel trouvé par le test synthétique et corrigé : `setPointerCapture` peut lever `NotFoundError`, encadré de `try/catch` (sur la poignée d'édition et sur le glisser du robot) |
| Maqueen : largeur de la piste réglable | Curseur (8 à 40 px, 26 par défaut) remplaçant l'épaisseur de trait jusque-là fixée en dur en deux endroits (`dessinerPisteMaqueen` et l'aperçu de l'éditeur de piste), désormais une seule variable `MQ_LARGEUR_LIGNE` relue par les deux. Vérifié que les trois tracés prédéfinis et la piste personnalisée en cours d'édition redessinent immédiatement au glissement du curseur, et que la détection des capteurs de ligne (`window.maqueenTest.surLaLigne`) continue de fonctionner à la largeur minimale comme maximale |
| Maqueen : indicateurs de capteurs de ligne sur le robot | Mêmes points (vert/gris) que la ligne sous la piste, dupliqués directement sur le bord avant du sprite (ordre L2/L1/M/R1/R2 de haut en bas à cap=0, déduit de `positionCapteurMaqueen`), pour les lire sans quitter le robot des yeux. Même registre de visibilité (`capteursLigneUtilisesMaqueen`) et même mise à jour (`mettreAJourIndicateursLigneMaqueen`) que la ligne existante — pas un second mécanisme. Vérifié : rien de visible sans bloc posé, les 5 apparaissent avec les 5 blocs, et l'état vert/gris suit la position du robot en direct (`window.maqueenTest.etatIndicateursLigneSprite`) |
| Maqueen : indicateurs de capteurs de ligne | N'affiche que les capteurs réellement lus par un bloc du programme (vérifié : ajouter un bloc `capteur de ligne (M)` + un `valeur brute (R1)` fait apparaître exactement ces deux-là, masque L1/L2/R2 ; les retirer masque toute la ligne). État vert/gris confirmé suivre la position du robot en direct (déplacé hors piste → gris, replacé sur la piste → vert), y compris via glisser-déposer, pas seulement pendant une simulation. Avertissement navigateur (`willReadFrequently`) sur les lectures `getImageData` répétées, corrigé en le déclarant à la création du contexte du canevas |
| Maqueen : sprite du robot | Coque CSS redessinée deux fois à la demande de l'utilisateur, sans jamais utiliser d'image externe (cohérent avec le reste du simulateur, tout dessiné) : d'abord bord doré/vis aux coins/bouton orange, puis — après une photo plus détaillée du vrai châssis — remplacement du bouton par un compartiment à pile 18650 (cylindre orange, « + » visible) et un liseré de circuit imprimé vert avec deux connecteurs rouges, pour se rapprocher de la photo fournie. Les deux DEL du sprite (repositionnées sous la pile pour ne plus être masquées) vérifiées refléter la vraie couleur programmée (`simu_maqueenRgb`), pas seulement celles du panneau ; confirmé visuellement par capture à l'échelle ×15 |
| Maqueen Plus V3 + télécommande IR + LiDAR | Registres I2C vérifiés depuis les dépôts GitHub officiels DFRobot (`pxt-DFRobot_MaqueenPlus_v20` pour le suiveur de ligne/PID V3, `pxt-DFRobot_matrixLidarDistanceSensor` pour le LiDAR) — jamais sur du vrai matériel. Génération de code vérifiée pour les 14 nouveaux blocs V3, les 7 blocs LiDAR et les 5 blocs infrarouge (dont les deux blocs événementiels `lorsque la commande...`). Décodeur NEC réécrit en MicroPython (le pilote DFRobot d'origine est du C++ natif non portable), avec les tables de boutons des deux télécommandes reconnues (« noire » DFRobot, « grise Car mp3 » — vérifiée depuis une source indépendante). Bug réel trouvé et corrigé en testant : le dispatcher infrarouge appelé depuis le code compilé cherchait les gestionnaires `on_ir_...` via `globals()`, qui renvoie l'espace de noms du **module où la fonction est définie** (le script Brython du simulateur), pas celui où `exec()` a créé les fonctions du programme élève (`env`) — exactement le piège déjà documenté pour `_radio_traiter` mais pas appliqué à ce nouveau code du premier coup. Corrigé en définissant le dispatcher à l'intérieur de `lancer_simulation()`, fermeture sur `env` comme son homologue radio. Vérifié avec les deux télécommandes, en code à la main et via de vrais blocs compilés. Panneau LiDAR (trois curseurs gauche/avant/droite) et simulateur de télécommande (deux menus + bouton) affichés/masqués selon les blocs posés, comme les autres panneaux |
| Kitrobot v2 | Module séparé de Maqueen : broches **facultatives et configurables** par des blocs « définir » (pas de câblage réel vérifié pour ce kit), piste dédiée départ/arrivée (droite, noir sur blanc — inversée de Maqueen exprès pour les distinguer d'un coup d'œil). Génération de code vérifiée (tous les blocs, y compris ceux à l'intérieur du pilote retiré côté simulateur). Les 16 fonctions `_kb_*` du pilote — entièrement à l'intérieur du bloc `# >>> pilote kitrobot`, donc retirées avant exécution — ont chacune leur substitut dans le simulateur ; vérifié en exécutant un programme qui les appelle toutes (`_kb_avancer`, `_kb_pivoter`, `_kb_moteur`, `_kb_case`, `_kb_virage`, `_kb_buzzer`, `_kb_del_couleur`, `_kb_del_rgb`, `_kb_clignoter`, `_kb_arcenciel`…) sans aucune erreur. Cinématique et capteurs de ligne réutilisent le modèle de Maqueen (même formule différentielle), avec seulement deux capteurs (gauche/droit) et une détection **inversée** (ligne sombre sur fond clair). Panneau affiché/masqué selon les blocs posés, vérifié via `window.kitrobotTest` (même limite déjà connue : `workspace.clear()` synthétique ne déclenche pas l'écouteur de changement, la fonction de rafraîchissement appelée directement si). Non-régression sur Maqueen confirmée (les deux panneaux réagissent indépendamment) |

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
