# État du projet — éditeur Blockly micro:bit V2

Dossier de travail : `C:\Users\jreyn\OneDrive\Bureau\blockly_ts`
Lancement : double-clic sur `lancer_projet.bat`, puis <http://localhost:8000>

Ce fichier dit **où on en est** : ce qui a été vérifié, ce qui ne peut l'être
sans matériel, et ce qui a été écarté. Les deux autres documents complètent :

- `readme.txt` — mode d'emploi et pièges d'usage
- `PROMPT_RECREATION.md` — tout reconstruire de zéro, avec les 18 pièges connus

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
| Grove | 11 modules, code généré conforme aux sources Seeed, affichage conditionnel des sections |
| Servos | bornes, intervalle, rotation continue, arrêt au neutre, animation des cadrans |
| Mise en page | canevas synchronisé avec Blockly dans 9 situations, corbeille et zoom toujours visibles |
| Envoi sur la carte | écriture simulée avec un faux lecteur : 1 877 004 octets, tous les cas d'erreur |
| Panneau administrateur | Ctrl+Alt+Maj+A active/désactive, bouton ⚙ caché sinon. Réordonner/masquer/renommer une catégorie, idem pour les sous-menus natifs (Communication, Grove), création d'un sous-menu personnalisé avec extraction des blocs choisis, renommage d'un libellé de bloc appliqué aux blocs déjà posés et aux nouveaux, onglet Aide qui charge `readme.txt` par `fetch()` (28 420 caractères reçus, testé aussi après un blocage transitoire du serveur mono-thread — voir « détail agaçant » plus bas). Persisté en localStorage (sauf l'onglet Aide, sans état), testé via `window.adminTest` (voir un.js) faute de pouvoir simuler un glisser-déposer |
| Édition manuelle du code | Bouton « ✎ Éditer » : bascule vers un `<textarea>`, gèle le canevas Blockly (voile visuel qui capte aussi les clics), la saisie remplace `window.currentPythonCode` en direct — vérifié que `.hex`/`.py`/simulateur le lisent bien à cet instant. « Revenir aux blocs » restaure le code généré et dégèle. Testé via `window.editionCodeTest` (voir un.js), non persisté (perdu au rechargement, comme l'espace de travail lui-même) |

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

`app.py` utilise `socketserver.TCPServer`, **mono-thread** : une requête qui ne
se termine pas (onglet resté ouvert sur une vieille page, connexion coupée en
plein téléchargement du `.hex`...) bloque tout le serveur derrière elle, y
compris de nouveaux onglets. Symptôme : le navigateur charge indéfiniment,
même `index.html` ne répond plus. Rencontré une fois en testant l'onglet Aide
après une session de tests intensive. Redémarrer `app.py` suffit ; passer à
`socketserver.ThreadingTCPServer` l'éviterait mais n'a pas été fait, pour ne
pas complexifier `deux.js` (accès concurrent au même lecteur de carte) sans
besoin démontré en usage normal (un seul élève, un seul onglet).
