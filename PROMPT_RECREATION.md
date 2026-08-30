# Prompt de recréation — éditeur Blockly pour micro:bit V2

> À copier-coller intégralement dans une IA. Tout ce qui suit est prescriptif :
> chaque point marqué **PIÈGE** correspond à une erreur réellement commise et
> corrigée. Les ignorer redonne une application non fonctionnelle.

---

Agis en développeur expert JavaScript, Blockly et MicroPython pour micro:bit.
Génère une application web **locale**, sans build ni gestionnaire de paquets,
qui permet de programmer une carte **micro:bit V2** avec des blocs, de voir la
transcription MicroPython, de simuler le programme dans le navigateur, et
d'exporter un fichier `.hex` réellement exécutable sur la carte.

Le code, les commentaires et l'interface sont **en français**.

## 1. Architecture imposée

Un seul dossier, servi par son propre serveur Python (`app.py`, voir ci-dessous) :

| Fichier | Rôle |
| --- | --- |
| `index.html` | Interface, CSS, simulateur écrit en Python via Brython |
| `un.js` | Blocs, générateurs MicroPython, boîte à outils, téléchargements, simulateur (partie JS) |
| `deux.js` | Écriture du programme dans le système de fichiers MicroPython |
| `trois.js` | Emballage au format Universal Hex |
| `firmware.hex` | Image MicroPython officielle (fournie par l'utilisateur) |
| `app.py` | Serveur local : sert le dossier et **interdit la mise en cache** |
| `app.spec` | Recette PyInstaller, pour produire un `.exe` autonome |
| `lancer_projet.bat` | Démarrage du serveur local |
| `readme.txt` | Documentation destinée à l'utilisateur — aussi chargée en runtime par `fetch()` dans l'onglet Aide du panneau administrateur (§12) : doit rester à côté d'`index.html`, y compris dans `app.spec` |

`un.js`, `deux.js`, `trois.js` sont des **modules ES** (`<script type="module">`).
`file://` ne fonctionne pas : il faut impérativement passer par le serveur HTTP.

### PIÈGE nº 0 — ne pas servir avec `python -m http.server`

C'est le premier réflexe, et il coûte des heures. Ce serveur n'envoie **aucun**
en-tête `Cache-Control` : le navigateur applique alors sa propre heuristique et
ressert un ancien `index.html` ou `un.js` après modification. On corrige un
défaut, on recharge, le défaut est toujours là — et on cherche dans le code
alors que le code servi n'est pas celui du disque. Pire quand un autre projet a
occupé le même `http://localhost:8000` : son `firmware.hex` est resservi à la
place du bon.

Écrire un serveur d'une trentaine de lignes qui force les trois en-têtes :

```python
class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()
```

Y ajouter `allow_reuse_address = True` sur le `TCPServer` (sinon un redémarrage
rapide échoue sur « Address already in use »), l'ouverture du navigateur
**après** que le serveur écoute, et un message clair si le port est pris.

## 2. Bibliothèques (CDN, aucune installation)

```html
<script src="https://unpkg.com/blockly@10.4.3/blockly_compressed.js"></script>
<script src="https://unpkg.com/blockly@10.4.3/blocks_compressed.js"></script>
<script src="https://unpkg.com/blockly@10.4.3/python_compressed.js"></script>
<script src="https://unpkg.com/blockly@10.4.3/msg/fr.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/brython/3.11.2/brython.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/brython/3.11.2/brython_stdlib.min.js"></script>
```

**PIÈGE — épingler la version de Blockly.** Sans numéro, unpkg sert la dernière
parue ; une montée de version majeure casse la page du jour au lendemain sans
qu'on ait rien changé. Blockly 10.4.3 et 13.2.1 fonctionnent tous les deux.

Dans les modules :

```js
// trois.js — import nommé, ce paquet expose bien des exports nommés
import { createUniversalHex, isUniversalHex, separateUniversalHex, microbitBoardId }
  from 'https://esm.sh/@microbit/microbit-universal-hex';

// deux.js
import microbitFsDefaut, * as microbitFsNommes
  from 'https://cdn.skypack.dev/@microbit/microbit-fs';
const microbitFs = microbitFsDefaut || microbitFsNommes;
```

**PIÈGE — Skypack ne fournit pas d'export par défaut pour `microbit-fs`.**
`import microbitFs from '…'` donne `null`. D'où le double import ci-dessus.
La classe s'appelle **`MicropythonFsHex`** (M majuscule), pas `micropythonFsHex`.

**PIÈGE — Skypack ne sert pas `nrf-intel-hex`** (pas d'en-tête CORS). Ne pas en
dépendre : voir §3, la manipulation du hex se fait sur le texte.

## 3. Génération du `.hex` — la partie la plus piégeuse

### Le principe

MicroPython n'est pas compilé. Le programme est écrit **tel quel**, sous le nom
`main.py`, dans le petit système de fichiers situé à la fin de l'image
MicroPython. C'est le travail de `@microbit/microbit-fs`, et de lui seul.

### PIÈGE nº 1 — la forme de `createUniversalHex`

Elle attend **un tableau d'objets `{hex, boardId}`**. Ces deux écritures sont
fausses et produisent `Cannot read properties of undefined (reading 'replace')` :

```js
createUniversalHex([firmware, systemeDeFichiersHex]);              // FAUX
createUniversalHex([firmware, {name: 'main.py', data: code}]);     // FAUX
```

Forme correcte : `createUniversalHex([{ hex: monHexIntel, boardId: 0x9903 }])`.

### PIÈGE nº 2 — sans `microbit-fs`, le programme n'est nulle part

Une version qui n'importe que `microbit-universal-hex` produit un `.hex` de
taille plausible **qui ne contient aucun programme**. La carte redémarre sur
MicroPython nu. Il faut obligatoirement passer par `MicropythonFsHex`.

### PIÈGE nº 3 — le firmware n'est pas vierge

Un `.hex` exporté depuis <https://python.microbit.org> contient déjà un
programme. `MicropythonFsHex` le refuse :
`There are files in the MicropythonFsHex constructor hex file input`.
Aucune option ne contourne ce garde-fou (vérifié dans la source du paquet).

Solution : effacer la zone du système de fichiers **avant** de construire
l'objet. Les bornes viennent des données UICR du firmware, jamais de son
contenu — l'effacement ne change donc pas la taille de stockage disponible.

```js
function effacerFichiersDuFirmware(hexIntel) {
  const info = microbitFs.getIntelHexDeviceMemInfo(hexIntel);
  const debut = info.fsStartAddress, fin = info.fsEndAddress;
  if (!(fin > debut)) return hexIntel;

  const gardees = [];
  let basePoidsFort = 0;
  for (const ligne of hexIntel.split(/\r?\n/)) {
    if (!ligne.startsWith(':')) { if (ligne.trim()) gardees.push(ligne); continue; }
    const type = parseInt(ligne.substr(7, 2), 16);
    if (type === 0x04) {          // Extended Linear Address
      basePoidsFort = parseInt(ligne.substr(9, 4), 16) * 0x10000;
    } else if (type === 0x02) {   // Extended Segment Address
      basePoidsFort = parseInt(ligne.substr(9, 4), 16) * 0x10;
    } else if (type === 0x00) {
      const nb = parseInt(ligne.substr(1, 2), 16);
      const adresse = basePoidsFort + parseInt(ligne.substr(3, 4), 16);
      if (adresse < fin && adresse + nb > debut) continue;   // dans la zone : jeté
    }
    gardees.push(ligne);
  }
  return gardees.join('\n') + '\n';
}
```

Un enregistrement Intel hex fait au plus 32 octets et les bornes de la zone sont
alignées sur une page de flash : aucun enregistrement n'est à cheval, il suffit
donc de jeter ceux qui tombent dedans. Les enregistrements d'adresse et l'UICR
sont conservés.

Le constructeur doit être appelé en deux temps :

```js
function construireSystemeDeFichiers(entree) {
  const MicropythonFsHex = classeSystemeDeFichiers();
  try {
    return new MicropythonFsHex(entree);
  } catch (erreur) {
    if (!/There are files/i.test(erreur.message)) throw erreur;
    const nettoyee = Array.isArray(entree)
      ? entree.map(({hex, boardId}) => ({ hex: effacerFichiersDuFirmware(hex), boardId }))
      : effacerFichiersDuFirmware(entree);
    return new MicropythonFsHex(nettoyee);
  }
}
```

### PIÈGE nº 4 — firmware universel contre firmware Intel

Un firmware universel doit être **redécoupé** avant d'être confié au système de
fichiers, et le résultat récupéré par la méthode correspondante :

```js
const entree = isUniversalHex(firmwareDeBase)
  ? separateUniversalHex(firmwareDeBase).map(({hex, boardId}) => ({hex, boardId}))
  : firmwareDeBase;
const fs = construireSystemeDeFichiers(entree);
fs.write('main.py', codePython);
const resultat = Array.isArray(entree) ? fs.getUniversalHex() : fs.getIntelHex();
```

### PIÈGE nº 5 — firmware tronqué

Une copie interrompue donne un fichier sans enregistrement de fin, dont
l'analyse échoue bien plus loin sur un message incompréhensible
(`Checksum failed at record 847`). Refuser tout de suite :

```js
if (!/^:00000001FF\s*$/m.test(hex))
  throw new Error("firmware.hex est incomplet : l'enregistrement de fin manque "
                + `(${hex.length} octets reçus).`);
```

Indiquer le nombre d'octets reçus : c'est ce qui permet de distinguer un fichier
réellement tronqué d'un fichier valide sur le disque mais servi par le cache.

### PIÈGE nº 6 — ne jamais avaler l'erreur

```js
catch (error) { alert("Erreur de génération du fichier .hex."); }   // À BANNIR
```

Ce message passe-partout masque toutes les causes ci-dessus et fait perdre des
heures. Prévoir une zone de message dans la barre du haut qui affiche
`error.message`, et un `console.error` en plus.

Ne pas non plus **coller un conseil qui ne vaut que pour une phase** à toutes les
erreurs. Le suffixe « recliquez pour redésigner le lecteur » avait été ajouté à
tout échec d'envoi, y compris à ceux de la génération du `.hex` — il envoyait
chercher du côté du lecteur un défaut qui était dans le firmware. Générer le
fichier **avant** d'ouvrir le sélecteur de dossier, et ne suffixer que les
erreurs de la phase d'écriture.

### PIÈGE nº 7 — lire le firmware avec `cache: 'no-store'`

```js
const reponse = await fetch('./firmware.hex', { cache: 'no-store' });
```

Même avec le serveur du §1, une entrée déjà en cache survit. Un autre projet
servi auparavant sur le même `http://localhost:8000` laisse son propre
`firmware.hex` à la même adresse ; le navigateur ressert ce fichier-là, et
l'erreur est incompréhensible puisque le fichier sur le disque est valide.

### Le `.hex` produit n'est pas importable dans MakeCode — c'est normal

À préciser dans la documentation, sinon la question revient. Un `.hex` MakeCode
contient du code ARM compilé depuis TypeScript, plus le projet compressé en LZMA
derrière un en-tête JSON :

```json
{"compression":"LZMA","headerSize":290,"textSize":889,"name":"Untitled",
 "eURL":"https://makecode.microbit.org/","eVER":"1.2.13","pxtTarget":"microbit"}
```

C'est cet en-tête que MakeCode relit pour reconstruire les blocs. Le `.hex`
produit ici est une image MicroPython avec `main.py` dans le système de fichiers :
aucun en-tête PXT, donc MakeCode le refuse. L'inverse est vrai aussi.

Le fichier fonctionne parfaitement **sur la carte**, et
<https://python.microbit.org> sait le rouvrir (il lit `main.py` avec la même
bibliothèque `microbit-fs`). Prévoir en plus un bouton « Télécharger le script
.py » pour l'éditeur officiel et Mu. Ne pas chercher à produire un `.hex`
MakeCode : cela suppose la chaîne de compilation PXT.

### Envoi direct sur la carte

Bouton « Envoyer sur la carte » qui écrit le `.hex` sur le lecteur `MICROBIT`
via l'API d'accès aux fichiers (`showDirectoryPicker({ mode: 'readwrite' })`),
ce qui revient à un glisser-déposer.

**PIÈGE — le lecteur n'accepte que des `.hex`.** Y déposer un `.py` ne fait
rien : ce bouton envoie donc le `.hex`, pas le script.

Points à respecter :

- Vérifier que le dossier choisi porte `DETAILS.TXT` ou `MICROBIT.HTM`, et
  refuser tout autre dossier avec un message qui dit quoi choisir.
- `queryPermission` puis `requestPermission` en mode `readwrite` avant chaque
  écriture sur un dossier déjà mémorisé.
- **Après un transfert, la carte se réinitialise : son lecteur se démonte et se
  remonte, la référence mémorisée devient invalide.** Attraper l'échec, remettre
  la référence à zéro et inviter à recliquer. Sans cela, le deuxième envoi
  échoue sans explication.
- Distinguer `AbortError` (l'utilisateur a fermé le sélecteur) d'une vraie
  erreur : ce n'est pas un échec.
- L'API n'existe que sur Chrome et Edge. Ailleurs, désactiver le bouton avec
  l'explication en infobulle plutôt que de le laisser échouer.

Les alternatives — flash WebUSB via `dapjs` (`DAPLink.flash`), ou écriture de
`main.py` par le REPL série — sont plus rapides ou plus universelles, mais
demandent une bibliothèque externe et bien plus de mise au point.
`@microbit/microbit-connection` n'est pas utilisable depuis esm.sh : ses classes
de connexion n'y sont pas réexportées.

### Le chemin du firmware

`fetch('./firmware.hex')` suffit dans tous les cas, y compris derrière un
exécutable PyInstaller : le serveur sert depuis le dossier de `index.html`.
Ne pas ajouter de détection `blob:` ou `_MEIPASS` — elle ne se déclenche jamais
et les deux chemins résolvent vers la même URL.

## 4. API MicroPython réellement disponibles

Vérifiées présentes dans le firmware micro:bit V2 (v2.1.2, MicroPython 1.18) :

`neopixel`, `NeoPixel`, `fill`, `clear`, `show`, `i2c` (`init`/`read`/`write`/`scan`),
`machine.time_pulse_us`, `machine.freq`, `utime.sleep_us`, `utime.ticks_us`, `ustruct.unpack`,
`uart` (`baudrate`/`tx`/`rx`/`any`/`readline`), `write_digital`, `read_digital`,
`read_analog`, `write_analog`, `set_analog_period`, `set_pull`, `NO_PULL`,
`PULL_UP`, `radio` (`on`/`off`/`config`/`send`/`receive`/`receive_full`).

**`write_analog` n'accepte que 0 à 1023** et lève une exception au-delà. Tout
générateur qui y transmet une valeur venue de l'utilisateur doit la borner dans
le code produit — `max(0, min(1023, valeur))` — sinon le programme s'arrête sur
la carte sans le moindre message.

## 5. Blockly — blocs et générateurs

Syntaxe moderne **obligatoire** :

```js
Blockly.Python.forBlock['mon_bloc'] = function(block, generateur) { … };
```

### PIÈGE nº 8 — l'import `from microbit import *`

**Chaque générateur** produisant du code qui touche à l'API de la carte doit le
déclarer. Oublier revient à livrer un programme qui s'arrête au démarrage sur
`NameError: name 'display' isn't defined`. Sont concernés : `display`, `Image`,
`button_a`/`button_b`, `accelerometer`, `compass`, `microphone`, `SoundEvent`,
`Sound`, `pin_logo`, `pinN`, `temperature()`, `running_time()`, `sleep()`,
`reset()`. **`Sound` appartient au module microbit** : le bloc `audio.play` a
donc besoin des deux imports.

```js
function importerMicrobit() {
  Blockly.Python.definitions_['import_microbit'] = 'from microbit import *';
}
function importerModule(nom) {
  Blockly.Python.definitions_['import_' + nom] = 'import ' + nom;
}
```

### PIÈGE nº 9 — indentation

Toujours utiliser `Blockly.Python.INDENT` (2 espaces), jamais une valeur écrite
en dur. Mélanger 4 et 2 espaces dans la même suite donne un `IndentationError`
et le programme ne démarre pas.

### PIÈGE nº 10 — largeur des blocs

Un bloc dont tous les champs tiennent sur une ligne impose sa largeur au tiroir
de toute la catégorie. Mesuré : un bloc « répéter toutes les H h M min S s MS ms »
en une ligne faisait 539 px et portait le tiroir à 584 px, ne laissant que
quelques pixels de canevas utile. Répartir les champs sur plusieurs lignes
(`appendDummyInput()` successifs) ou utiliser `setInputsInline(false)`.
Viser un tiroir sous 400 px.

### PIÈGE nº 11 — conversion en texte

`display.scroll`, `display.show` et `radio.send` n'acceptent que des chaînes ;
un nombre lève un `TypeError` sur la carte. Ne pas mettre `setCheck("String")`
sur ces entrées — cela empêcherait d'y brancher un capteur — mais convertir dans
le générateur, en laissant les littéraux texte tranquilles :

```js
function versTexte(block, nomEntree) {
  const branche = block.getInputTargetBlock(nomEntree);
  if (!branche) return "''";
  const code = P.valueToCode(block, nomEntree, P.ORDER_NONE) || "''";
  const types = branche.outputConnection && branche.outputConnection.getCheck();
  return (Array.isArray(types) && types.includes('String')) ? code : 'str(' + code + ')';
}
```

### Espace de travail par défaut

Un espace vide au premier lancement laisse l'élève devant une page blanche.
Poser d'emblée un bloc **« Au démarrage »** et un bloc **« Répéter
indéfiniment »**, aux deux emplacements attendus. « Au démarrage » est limité à
un exemplaire : `maxInstances: { 'au_demarrage': 1 }` dans les options de
l'espace de travail — Blockly grise alors l'entrée du tiroir toute seule.

### Catégories dynamiques : Variables et Fonctions

`{ "kind": "category", "name": "Variables", "custom": "VARIABLE" }` et
`{ "kind": "category", "name": "Fonctions", "custom": "PROCEDURE" }`. Blockly
remplit ces tiroirs lui-même : définition, définition avec retour, retour
conditionnel, plus **un bloc d'appel par fonction créée**, portant son nom.

À dire à l'utilisateur, car cela surprend : tant qu'aucune fonction n'existe, le
tiroir ne montre que les blocs de définition. C'est la différence avec
Vittascience, qui affiche d'emblée un bloc d'appel générique. Un bloc d'appel ne
peut pas exister sans fonction cible.

Les fonctions sont écrites en tête du programme, avant tout code exécutable,
comme les gestionnaires du §6 : les blocs peuvent donc être posés n'importe où.

### Réorganiser la boîte à outils à chaud

`workspace.updateToolbox({ kind: 'categoryToolbox', contents: […] })` remplace
le tiroir sans réinjecter Blockly. C'est la base d'une fonctionnalité bien
plus large réservée à l'enseignant — réordonner, masquer, renommer les
catégories et leurs sous-menus, en créer, changer le texte affiché sur un
bloc — détaillée au §12 (Panneau administrateur), à construire directement
sous cette forme complète plutôt que comme un simple bouton de réordonnancement
qu'il faudrait généraliser ensuite.

## 6. Les blocs « lorsque … » (événements)

MicroPython n'a **pas** de système d'événements. Chaque bloc « lorsque … »
produit une fonction `on_…()`, et l'application ajoute une boucle de scrutation.

```js
const GESTIONNAIRES = [
  ['def on_button_pressed_a(',  'if button_a.is_pressed(): on_button_pressed_a()'],
  ['def on_button_pressed_b(',  'if button_b.is_pressed(): on_button_pressed_b()'],
  ['def on_button_pressed_ab(', 'if button_a.is_pressed() and button_b.is_pressed(): on_button_pressed_ab()'],
  ['def on_logo_touched(',      'if pin_logo.is_touched(): on_logo_touched()'],
  ['def on_logo_released(',     'if not pin_logo.is_touched(): on_logo_released()'],
  ['def on_pin_pin0_touched(',  'if pin0.is_touched(): on_pin_pin0_touched()'],
  ['def on_pin_pin1_touched(',  'if pin1.is_touched(): on_pin_pin1_touched()'],
  ['def on_pin_pin2_touched(',  'if pin2.is_touched(): on_pin_pin2_touched()'],
  ['def on_pin_pin0_released(', 'if not pin0.is_touched(): on_pin_pin0_released()'],
  ['def on_pin_pin1_released(', 'if not pin1.is_touched(): on_pin_pin1_released()'],
  ['def on_pin_pin2_released(', 'if not pin2.is_touched(): on_pin_pin2_released()'],
  ['def on_gesture_shake(',     "if accelerometer.was_gesture('shake'): on_gesture_shake()"],
  ['def on_gesture_up(',        "if accelerometer.was_gesture('up'): on_gesture_up()"],
  ['def on_gesture_down(',      "if accelerometer.was_gesture('down'): on_gesture_down()"],
  ['def on_sound_LOUD(',        'if microphone.was_event(SoundEvent.LOUD): on_sound_LOUD()'],
  ['def on_sound_QUIET(',       'if microphone.was_event(SoundEvent.QUIET): on_sound_QUIET()'],
];
```

**PIÈGE nº 12 — toute fonction `on_…` que peuvent produire les blocs doit
figurer dans cette table.** Sinon le bloc correspondant définit une fonction que
personne n'appelle : il ne fait strictement rien, sans le moindre message.

Injection, avec l'indentation prise sur la ligne trouvée :

```js
if (appels.length) {
  const boucles = /^([ \t]*)while True:[ \t]*$/gm;
  if (boucles.test(code)) {
    boucles.lastIndex = 0;
    code = code.replace(boucles, (ligne, marge) =>
      ligne + '\n' + appels.map(a => marge + P.INDENT + a).join('\n'));
  } else {
    code += '\n# --- Boucle des événements (générée automatiquement) ---\n'
          + 'while True:\n' + appels.map(a => P.INDENT + a).join('\n') + '\n'
          + P.INDENT + 'sleep(100)\n';
  }
}
```

**PIÈGE nº 13 — `String.replace` avec une chaîne ne remplace que la première
occurrence.** Utiliser une expression régulière avec `g`, sinon un programme à
deux boucles infinies ignore les boutons dans l'une d'elles.

**PIÈGE nº 14 — les fonctions `on_…` doivent remonter en tête de programme.**
Blockly génère les blocs de premier niveau dans l'ordre de leur **position**. Un
bloc « lorsque … » posé à droite ou en dessous d'une boucle produit donc sa
fonction *après* l'appel qui l'utilise, et le programme s'arrête sur un
`NameError: on_button_pressed_a`. Les émettre via `definitions_` plutôt qu'en
retour du générateur :

```js
function declarerGestionnaire(nom, corps) {
    const contenu = corps.replace(/\s+$/, '');
    P.definitions_['gestionnaire_' + nom] =
        'def ' + nom + '():\n' + (contenu || P.INDENT + 'pass');
    return '';
}
```

Les définitions sont placées avant tout code exécutable, quelle que soit la
disposition des blocs.

## 7. Le simulateur (Brython)

Panneau de droite : une carte dessinée en CSS (25 LED, boutons A/B, logo,
broches), un bouton « Lancer la simulation », un bouton « Secouer la carte »,
un bouton « Réinitialiser la simulation ».

Le code MicroPython courant est exécuté par `exec(code, env)` où `env` contient
des objets factices (`display`, `button_a`, `accelerometer`, `radio`, `music`,
`audio`, `speech`, `pinN`…) qui pilotent le dessin.

Points à respecter :

- **Remplacer `while True:` par `for _ in range(5):`** — avec `replace()` sans
  argument de comptage, qui en Python remplace **toutes** les occurrences.
  Sinon la seconde boucle fige l'onglet.
- **Retirer les lignes d'import** (`from microbit import *`, `import radio`,
  `import music`, `import audio`, `import speech`, `import time`, `import math`,
  `import random`, `import neopixel`, `import machine`, `import utime`,
  `import ustruct`) avant l'`exec`.
- **`radio` doit figurer dans `env`.** Son oubli donne
  `name 'radio' is not defined` sur tout programme radio.
- **Remonter l'erreur à l'écran**, pas seulement dans la console : sinon la
  simulation semble ne rien faire.
- **File d'attente** : les actions (affichage, son, LCD, ruban) sont empilées
  puis rejouées dans l'ordre, avec les pauses. Les capteurs (distance, joystick,
  couleur, température) sont lus **directement** au moment où le programme les
  demande.
- **Jeton d'exécution** : chaque suite différée (pause, défilement, note) vérifie
  qu'elle appartient toujours à l'exécution courante avant de reprendre la file.
  Sans cela, une exécution interrompue reprend la main au milieu de la suivante.
- **Gestes ponctuels** : « Secouer » arme le geste, lance la simulation, puis le
  désarme. `was_gesture()` **consomme** le geste (vrai une seule fois),
  `is_gesture()` le constate sans le consommer. Vérifiable : sur 5 tours de
  boucle, le premier déclenche 1 fois, le second 5 fois.

**PIÈGE nº 37 — les icônes prédéfinies (`Image.HAPPY`, `SAD`, `GHOST`...) ont
un motif de pixels précis, pas un dessin approximatif.** `display.show(val)`
mappe chaque nom d'icône à une liste d'index (0-24, `y*5+x`) de LED allumées ;
rien ne rapproche automatiquement ce mapping du vrai micro:bit, donc une liste
tapée à la main peut « ressembler » à un visage sans être la bonne — c'est
resté indétecté jusqu'à ce qu'un utilisateur compare visuellement HAPPY et
SAD affichés côte à côte et remarque que ni l'un ni l'autre n'avait la forme
attendue. Vérifier chaque icône contre la définition officielle
(`microbit_constimage.c` du dépôt `microbit-foundation/micropython-microbit-v2`,
`SMALL_IMAGE(...)` en grille 5×5 de 0/1) plutôt que de redessiner à l'œil :

```
HAPPY : 0,0,0,0,0 / 0,1,0,1,0 / 0,0,0,0,0 / 1,0,0,0,1 / 0,1,1,1,0
  → index allumés : 6,8,15,19,21,22,23
SAD   : 0,0,0,0,0 / 0,1,0,1,0 / 0,0,0,0,0 / 0,1,1,1,0 / 1,0,0,0,1
  → index allumés : 6,8,16,17,18,20,24
GHOST : 1,1,1,1,1 / 1,0,1,0,1 / 1,1,1,1,1 / 1,1,1,1,1 / 1,0,1,0,1
  → index allumés : 0,1,2,3,4,5,7,9,10,11,12,13,14,15,16,17,18,19,20,22,24
```

`HEART` était déjà correcte (comparée à la même source en corrigeant ce
piège) ; seules HAPPY, SAD et GHOST avaient un motif erroné.

### Le son

Le simulateur doit **réellement** émettre du son, via Web Audio, en onde carrée
(timbre proche du buzzer de la carte). Chaque note est un couple
`[fréquence Hz, durée ms]`, fréquence nulle = silence, avec une petite enveloppe
d'attaque et d'extinction pour éviter les claquements.

Les mélodies de `music` suivent le découpage officiel : 1 temps = 4 tics à
120 bpm, donc **1 tic = 125 ms**. Exemple fidèle pour `DADADADUM`
(`['r4:2','g','g','g','eb:8','r:2','f','f','f','d:8']`) :

```
[[0,250],[392,250],[392,250],[392,250],[311.13,1000],
 [0,250],[349.23,250],[349.23,250],[349.23,250],[293.66,1000]]
```

`speech.say()` passe par `window.speechSynthesis` en `en-GB` (le module speech
de la carte parle anglais), avec repli sur une alerte.

### Les périphériques dessinés

Sous la carte, un panneau « Périphériques Grove » où **chaque section
n'apparaît que si un bloc du module correspondant est posé** dans le programme
(voir §11). Une simple table `[idDeSection, expressionRégulièreSurLeTypeDeBloc]`
suffit, réévaluée à chaque changement de l'espace de travail.

Ces sections valent la peine d'être dessinées pour de bon, pas résumées en
texte — c'est ce qui permet de reconnaître le montage réel :

- **Afficheur 4 digits** — de vrais sept segments : n'affichez pas un texte,
  allumez les segments d'après le **motif exact** que le pilote envoie à la
  puce. Boîtier noir à bord arrondi, chiffres cyan penchés de 8°, halo sur les
  segments allumés, segments éteints faiblement visibles.
- **Écran LCD 1602** — cadre noir, rétroéclairage bleu, caractères clairs.
  Chaque caractère occupe **sa propre cellule** de 5 × 8 points (10 × 16 px),
  ce qui aligne le texte en colonnes et rend visible une cellule vide. Une
  trame sombre au pas du point, posée **par-dessus** le texte
  (`repeating-linear-gradient` sur les deux axes, `pointer-events: none`),
  découpe les jambages et donne l'aspect matriciel sans avoir à redessiner une
  fonte 5 × 8 caractère par caractère. Rétroéclairage éteint : l'écran vire au
  gris-vert et le texte reste faiblement lisible, plutôt qu'un fondu global qui
  effacerait tout.
- **LED sur broche** — une pastille par broche effectivement pilotée. L'éclat
  suit la **racine carrée** du rapport cyclique : la luminosité perçue ne suit
  pas le rapport cyclique, et à 256/1023 l'œil voit environ 57 %, pas 25 %.
- **Servomoteurs** — un cadran par broche, avec le bras qui tourne. Rotation
  continue : une animation, dont la durée est l'inverse de la vitesse.
- **Ruban RGB**, **joystick**, **gestes**, **capteurs** (curseurs), **radio**
  (champ texte + « Simuler la réception »).

**PIÈGE nº 15 — l'opacité s'applique à tous les descendants.** Une pastille de
LED dont l'éclat tombe à zéro emporte le socle sombre dessiné à l'intérieur
d'elle. Séparer les deux éléments : le socle porte l'apparence au repos, un
enfant distinct porte l'éclat.

**PIÈGE nº 16 — un caractère rogné ne se voit pas au premier coup d'œil.**
Dans une cellule LCD de 10 px de large, une police de 16 px déborde de 1 px sur
`A`, `V` et `_`. Se mesure : `canvas.measureText(ch).actualBoundingBoxLeft +
actualBoundingBoxRight` pour l'encre réelle, comparé à la largeur de la
cellule. Ne pas mesurer avec un `Range` sur le contenu — cela donne la boîte de
ligne, identique pour tous les caractères, donc inutile.

## 8. Servomoteurs

Catégorie « Servos » sur P0, P1, P2. Conventions reprises de MakeCode
(`pxt-common-packages`, `libs/servo`) — **les relever à la source plutôt que de
les supposer** :

- angle 0–180° ↔ impulsion **500–2500 µs** dans une période de 20 ms (50 Hz) ;
- `setRange` : le mini est ramené entre 0 et 90, le maxi entre 90 et 180 ;
- `run(vitesse)` transpose −100…100 % sur l'intervalle ;
- avec « arrêt au neutre », MakeCode compare l'angle à `(maxi − mini) >> 1`.
  Avec l'intervalle 0–180 par défaut cela donne bien 90, mais avec un intervalle
  décalé le résultat surprend. Reproduire tel quel pour rester fidèle, et le
  documenter ;
- `stop()` cesse d'envoyer des impulsions : le servomoteur reste où il est.

En MicroPython : `broche.set_analog_period(20)` puis
`broche.write_analog(int(microsecondes * 1023 / 20000))`.

**PIÈGE — la clé d'état.** Ne pas indexer l'état par l'objet broche : passer le
nom de la broche depuis le générateur (`_servo_angle(pin0, "P0", 45)`). Sinon la
clé dépend de la représentation de l'objet, ce qui n'est pas garanti unique.

## 9. Modules Grove

Catégorie « Grove », **découpée en sous-catégories** (une par module) : 39 blocs
dans un seul tiroir demandent plus de deux écrans de défilement et les derniers
deviennent introuvables. Blockly accepte les catégories imbriquées dans un
`categoryToolbox`.

### Le cas de la LED simple : pas de pilote du tout

Sous-catégorie « LED », deux blocs :

```python
pin0.write_digital(1)                       # contrôler la LED à HAUT / BAS
pin0.write_analog(max(0, min(1023, 1023)))  # régler la luminosité
```

C'est le seul module **sans pilote**, et c'est délibéré : une LED se commande
directement par la broche, et c'est justement ce qu'il faut montrer à l'élève.
Ne pas l'envelopper dans une fonction `_grove_led()` par souci d'uniformité —
cela masquerait la seule chose qu'il y a à comprendre. Bornage obligatoire,
voir §4.

Conséquence côté simulateur : ce sont `write_digital` / `write_analog` du
substitut de broche qui alimentent l'affichage. Toute écriture y figure donc,
servomoteur compris — c'est exact, une LED réellement câblée sur cette broche
s'allumerait aussi ; le dire plutôt que d'essayer de filtrer.

### Registre des périphériques

**PIÈGE nº 17 — ne pas exiger un bloc « définir » préalable.** Un programme qui
utilise « afficher le nombre » sans avoir posé « définir l'afficheur » échoue sur
`name 'afficheur' is not defined`, à l'exécution seulement, et silencieusement
sur la carte. Créer les périphériques à la première utilisation :

```python
_grove_objets = {}

def _grove_obj(nom, fabrique):
    if nom not in _grove_objets:
        _grove_objets[nom] = fabrique()
    return _grove_objets[nom]

def _grove_afficheur():
    return _grove_obj("afficheur", lambda: _Afficheur4(pin0, pin1))
```

Les blocs d'usage appellent `_grove_afficheur().nombre(12)`. Le bloc « définir »
devient facultatif et se contente d'écrire dans le registre :
`_grove_objets["afficheur"] = _Afficheur4(pin2, pin8)`.

Un **dictionnaire** et non des variables : on peut y écrire depuis l'intérieur
d'une fonction « lorsque … » sans déclarer `global`.

### Pilotes encadrés par des marqueurs

Les pilotes de ces modules ne sont pas dans le firmware : ils sont écrits dans
le programme généré, via `definitions_`. Chacun est encadré par un marqueur qui
**porte son nom** :

```
# >>> pilote lcd1602
…
# <<< pilote lcd1602
```

Le simulateur retire ces régions :

```python
code = re.sub(r"# >>> pilote \S+.*?# <<< pilote \S+", "", code, flags=re.S)
```

et injecte ses propres objets à la place. Sans cette séparation, le pilote
TM1637 bit-bangerait dans le vide et le PAJ7620 planterait sur l'I²C.

Le nom dans le marqueur n'est pas décoratif : c'est lui qui sert d'intitulé au
repli décrit juste après. Un marqueur générique (`# >>> pilote grove` pour
tous) rendrait ce repli inutilisable.

### Replier les pilotes dans la transcription affichée

Sans cela la transcription est illisible : sur un programme LCD de trois blocs,
le pilote fait **1470 caractères pour 144 de programme**. L'élève ne voit que de
la plomberie.

Remède : à l'affichage seulement, remplacer chaque région marquée par un
`<details>` refermé, dont le résumé annonce le module et la taille — « pilote
lcd1602 — 39 lignes ». Ce qui est déplié le reste quand les blocs changent.

**Le repli ne concerne QUE l'affichage** : le `.hex` et le `.py` contiennent
toujours les pilotes en entier. C'est la différence avec Vittascience, qui écrit
ses pilotes dans des modules séparés sur la carte (`from lcd_i2c import
LCD1602`) : leur transcription est courte parce que le pilote est ailleurs, pas
parce qu'il est plus petit. Le choix retenu ici garde un `main.py` autonome,
donc un `.py` téléchargeable qui fonctionne seul — à expliquer à l'utilisateur,
qui compare forcément les deux.

### Constantes vérifiées (sources : bibliothèques Seeed)

| Module | Adresse I²C | Points clés |
| --- | --- | --- |
| LED simple | — | aucun pilote : `write_digital` / `write_analog` bornés à 0–1023 |
| Ruban WS2813 | — | module `neopixel` intégré ; pas de réglage de luminosité, atténuer les couleurs avant envoi |
| TM1637 4 digits | 2 fils | `0x40` mode écriture, `0xC0` adresse, `0x88 \| lum` contrôle ; segments `0x3F,0x06,0x5B,0x4F,0x66,0x6D,0x7D,0x07,0x7F,0x6F` |
| Ultrason | 1 fil | déclenchement 10 µs, `machine.time_pulse_us(broche, 1, 30000)`, cm = durée/58, pouces = durée/148 |
| Joystick | analogique | 0–1023 ; appui sur le manche → axe X sous 250 |
| PAJ7620 gestes | `0x73` | banque `0xEF`, résultats `0x43` (8 gestes) et `0x44` (vague) ; table d'init de 50 registres, à reprendre de `Seeed-Studio/Gesture_PAJ7620`, `src/paj7620.h` |
| AHT20 / DHT20 | `0x38` | init `BE 08 00`, mesure `AC 33 00` + 80 ms, lecture 7 octets, CRC8 sur les 6 premiers |
| LCD 16x2 v1 (JHD1802) | `0x3E` | commande `[0x80, cmd]`, donnée `[0x40, val]`, curseur `col\|0x80` ou `col\|0xC0` |
| VEML6040 | `0x10` | config `[0x00,0x00,0x00]` ; canaux R `0x08`, V `0x09`, B `0x0A`, W `0x0B` ; 16 bits, poids faible en tête |
| DRV8830 | canal 1 `0x65`, canal 2 `0x60` | vitesse `((abs(v)&0x3F)<<2) \| (1 si v<0 sinon 2)` en `0x00` ; défaut en `0x01`, effacement `0x80` |
| SCD30 | `0x61` | démarrage `0x0010`, prêt `0x0202`, lecture `0x0300` → 18 octets, 3 flottants IEEE `>f` |
| SCD41 | `0x62` | `0x3F86` arrêt, `0x3646` réinit, `0x21B1` démarrage, prêt `0xE4B8`, lecture `0xEC05` → 9 octets |

CRC8 Sensirion commun à AHT20 et SCD, à factoriser : polynôme `0x31`, valeur
initiale `0xFF`.

**Attention aux adresses DRV8830** : la documentation Seeed donne `0xCA` et
`0xC0` sur 8 bits ; il faut les décaler d'un bit → `0x65` et `0x60`.

### DHT11 et DHT22 — protocole 1 fil, fiables seulement sur micro:bit V1

Le protocole impose de mesurer des impulsions de 26 à 70 µs, hors de portée
d'une boucle Python interprétée. Solution : un pilote en **assembleur ARM
Thumb** (`@micropython.asm_thumb`), repris de `rhubarbdog/microbit-dht11`
(MIT) — ne pas réécrire ces instructions à la main sans banc de mesure, un
décalage de délai casse silencieusement la lecture. DHT11 et DHT22 partagent
exactement la même capture bas niveau (mêmes durées d'impulsion) ; seul le
décodage des 5 octets reçus diffère :

- **DHT11** : quatre octets entier+décimale (humidité, température), un
  octet de somme de contrôle.
- **DHT22** : deux fois 16 bits ×10 (humidité, température avec bit de signe
  sur le poids fort du 3ᵉ octet), même octet de somme de contrôle.

**PIÈGE nº 18 — un pilote calibré sur un modèle de carte ne l'est pas
forcément sur un autre, même « compatible ».** micro:bit V1 (nRF51822) tourne
à 16 MHz, V2 (nRF52833) à 64 MHz : les boucles de délai de l'assembleur
échantillonnent 4× trop vite sur V2 et ratent le signal. Un correctif
communautaire existe (multiplier le délai par 4) mais reste décrit comme
instable par son propre auteur. Le décalage bit-à-bit qui relie chaque broche
au registre GPIO n'a, lui, jamais été revérifié pour le V2 par personne — et
rien ne garantit qu'il soit identique, les deux puces n'ayant pas le même
routage physique. **Ne pas deviner : refuser proprement au runtime.**
`machine.freq()` distingue les deux cartes (`> 20 000 000` = V2) ; la lecture
renvoie alors `None` en amont, et les blocs `-1`, plutôt qu'une valeur
plausible mais fausse rendue sans avertissement. Le dire dans le tooltip de
chaque bloc, pas seulement dans le code : ça renvoie vers AHT20/DHT20 (I²C,
fiable sur les deux cartes) pour qui a besoin d'un V2.

### Modules à ne PAS implémenter, et pourquoi

- **Vision AI V2** — pile SSCMA complète (JSON transporté par blocs sur I²C).
  C'est un projet en soi.
- **UartWiFi** — faisable, mais initialiser l'UART sur des broches externes coupe
  la liaison série USB (plus de `print`, plus de REPL), et le dialogue en
  commandes AT dépend de temporisations à régler avec le module en main.

## 10. La radio

Catégorie « Communication », quatre sous-catégories : **Groupe** (activer,
désactiver, choisir le groupe 0–255), **Envoi** (nombre, texte, couple
nom/valeur), **Réception** (bloc « lorsque un nombre / un texte / une valeur est
reçu », et un bloc de lecture), **Plus** (puissance 0–7, longueur d'onde).

Convention de transport, purement textuelle, celle de MicroPython : un nombre
part comme `"42"`, un couple comme `"nom=valeur"`, un texte tel quel. Un
répartiteur `_radio_traiter()` classe le message reçu — `=` présent → couple ;
sinon convertible en nombre → nombre ; sinon → texte — puis appelle le
gestionnaire correspondant. Les valeurs lues vivent dans une liste unique
`_radio_dernier = [texte, nom, valeur, force]`.

**PIÈGE nº 19 — les valeurs d'une liste déroulante Blockly doivent être
uniques.** Le premier jet mappait « le texte reçu » et « le nombre reçu » sur le
même rang `0`, donc sur la même valeur de champ : Blockly n'affichait qu'une des
deux entrées et le générateur lisait l'autre. Donner des valeurs distinctes
(`texte`, `nom`, `valeur`, `nombre`, `force`) et convertir en rang dans le
générateur, jamais dans le champ.

**PIÈGE nº 20 — pas de `globals()` dans un mock Brython.** Sur la carte tout vit
dans un seul module, donc `_radio_traiter` y trouve les gestionnaires par
`globals()`. Dans le simulateur, le programme est exécuté par `exec(code, env)` :
les gestionnaires atterrissent dans `env`, pas dans les globales du module. Le
répartiteur du simulateur doit donc être **défini à l'intérieur de la fonction où
`env` existe**, chercher dans `env`, et y être injecté (`env['_radio_traiter'] =
…`). Symptôme : le message est bien délivré, aucun gestionnaire ne s'exécute, et
rien ne signale l'erreur.

**PIÈGE nº 21 — `except ValueError` imbriqué sous Brython.** Le motif
`try: int(x) / except ValueError: try: float(x) / except ValueError: None`
fonctionne sur MicroPython mais laisse échapper l'exception du `float` sous
Brython. Aplatir en deux `try` successifs avec `except:` nu.

**Non compatible en l'air avec MakeCode**, et il faut le dire à l'utilisateur :
MakeCode emploie un format binaire propre avec en-tête et numéro de série. Deux
cartes, l'une sous MakeCode l'autre sous MicroPython, ne se comprennent pas même
sur le même groupe. Deux blocs MakeCode sont donc sans équivalent et à ne pas
implémenter : « régler le numéro de série de transmission » et « radio déclencher
l'événement ».

Côté simulateur : une section « Radio : message à recevoir » (champ texte +
bouton « Simuler la réception »), visible seulement si un bloc de réception est
posé. Une boîte aux lettres à un seul message, vidée à la lecture. Force du
signal simulée : `-42`.

## 11. Mise en page

Trois colonnes : blocs / transcription MicroPython / simulateur.

### PIÈGE nº 22 — `min-height: 0`

```css
#main-container { display: flex; flex-grow: 1; min-width: 0; min-height: 0; }
#blocklyDiv { flex: 1 1 auto; min-width: 260px; min-height: 0; height: 100%; }
#code-container, #simulator-container { flex: 0 0 24%; min-height: 0; overflow-y: auto; }
```

Sans `min-height: 0`, un enfant flex ne peut pas devenir plus petit que son
contenu : le panneau du simulateur, une fois garni, pousse la rangée bien au-delà
de la fenêtre. Mesuré sans ce correctif : le canevas Blockly atteignait
**4754 px de haut**, et sa corbeille se retrouvait très loin sous la ligne de
flottaison — invisible.

### PIÈGE nº 23 — prévenir Blockly des changements de taille

Blockly met en cache les dimensions de son conteneur et place corbeille et barres
de défilement d'après ce cache. Appeler `Blockly.svgResize(workspace)` après
**tout** changement de mise en page : repli d'un panneau, affichage ou masquage
d'une section, redimensionnement. Ajouter en filet un `ResizeObserver` sur
`#blocklyDiv`.

### PIÈGE nº 24 — le zoom dans la barre, pas dans le canevas

Les contrôles de zoom internes de Blockly sont dessinés **à l'intérieur** de
l'espace de travail : ils sont rognés par le bord dès que la place manque et
peuvent chevaucher la corbeille. Mettre `zoom.controls: false` et placer des
boutons `−`, pourcentage, `+`, `Ajuster` dans la barre du haut.

Accrocher l'indicateur de pourcentage à `setScale` plutôt qu'aux événements :
toutes les façons de zoomer y passent, alors que `viewport_change` ne se
déclenche pas de façon fiable.

```js
zoom: { controls: false, wheel: true, pinch: true,
        startScale: 1, minScale: 0.3, maxScale: 3, scaleSpeed: 1.2 },
move: { scrollbars: { horizontal: true, vertical: true }, drag: true, wheel: true },
```

Avec `zoom.wheel` **et** `move.wheel` à `true` : Ctrl+molette agrandit, molette
seule fait défiler.

### Panneaux repliables et sections conditionnelles

Deux boutons « Code » et « Simulateur » replient les colonnes de droite : c'est
le remède le plus direct quand le tiroir de la boîte à outils prend toute la
place. Mesuré : le canevas utile passe de 3 px à 593 px.

À dire dans la documentation, parce que l'intuition dit le contraire : **replier
le panneau du code n'agrandit pas le simulateur.** Les deux colonnes de droite
ont chacune une largeur fixe de 24 % ; la place libérée va à la zone de blocs,
ce qui est bien le but. Seule la taille de la fenêtre change l'échelle de la
carte.

Chaque section du panneau Grove n'apparaît **que si un bloc du module
correspondant est présent** dans le programme. Sans aucun bloc Grove, le panneau
entier est masqué.

### La carte s'adapte à la largeur de sa colonne

La carte est dessinée en pixels fixes. Plutôt que de la laisser déborder ou
flotter, la mettre à l'échelle de la place disponible — et **la réduire d'un
quart** au passage, pour laisser respirer les sections placées au-dessous :

```js
const echelle = 0.75 * Math.max(0.55, Math.min(1.5, cadre.clientWidth / LARGEUR));
carte.style.transform = 'scale(' + echelle.toFixed(3) + ')';
cadre.style.height = Math.round(HAUTEUR * echelle) + 'px';   // voir ci-dessous
```

Un `transform` **ne modifie pas la place occupée** : sans un cadre dont on ajuste
la hauteur, la carte réduite laisse un vide et la carte agrandie déborde. Les
zones cliquables, elles, suivent la transformation toutes seules.

### PIÈGE nº 25 — la barre de défilement et l'échelle s'entraînent l'une l'autre

Le panneau du simulateur est en `overflow-y: auto`. Une carte plus petite fait
disparaître sa barre de défilement, ce qui **élargit** le cadre de 16 px, ce qui
réagrandit la carte, ce qui ramène la barre. La mise en page oscille, ou se fige
sur une échelle qui ne correspond pas à la mesure.

```css
#simulator-container { overflow-y: auto; scrollbar-gutter: stable; }
```

La gouttière est réservée en permanence : la largeur ne dépend plus du contenu,
la boucle est rompue.

## 12. Panneau administrateur

Extension du principe du §5 (`updateToolbox` à chaud) en un vrai panneau à
onglets, réservé à l'enseignant.

### Activation — sans vraie sécurité, et le dire

L'application est 100 % cliente, sans compte ni serveur : aucune
authentification réelle n'est possible. Un raccourci clavier discret
(Ctrl+Alt+Maj+A) bascule un booléen en mémoire et affiche/masque le seul
bouton d'entrée (`display: none` par défaut). Ce n'est qu'une dissuasion
contre un clic accidentel d'élève, pas une protection — le documenter
clairement évite qu'on s'y fie à tort.

### Modèle de données — un seul objet, une seule clé localStorage

```js
function configAdminParDefaut() {
    return { categories: { order: [], hidden: [], labels: {}, colors: {} },
             groupes: {}, sousMenus: [], libellesBlocs: {} };
}
```

- `categories` : ordre/masquage/renommage/**couleur** des catégories de
  premier niveau. On repart toujours d'une table d'origine
  (`TOOLBOX_ORIGINAL`, clonée en profondeur **une fois**, avant toute
  modification), jamais du tiroir courant, et une catégorie absente de
  l'ordre enregistré se replace à la fin plutôt que de disparaître — c'est ce
  qui permet d'ajouter une catégorie à l'application sans la faire disparaître
  chez qui a déjà réordonné.
- `groupes` : même quadruplet (order/hidden/labels/colors), mais par
  catégorie parente, pour ses **sous-catégories natives** (Communication,
  Grove). Une config sauvegardée par une version antérieure à l'ajout des
  couleurs n'a pas cette clé : la compléter au chargement
  (`config.groupes[parent].colors ||= {}`) plutôt que de laisser une
  écriture ultérieure planter sur `undefined`.
- `sousMenus` : liste de groupes **créés par l'admin**, chacun
  `{id, parent, nom, couleur, blocs: [types...]}` — n'existe que pour les
  catégories qui n'ont pas déjà de sous-catégories natives (pas de nesting à
  trois niveaux : un sous-menu ne peut pas en contenir un autre).
- `libellesBlocs` : `{ "type#index": "texte" }` — voir plus bas.

Comme pour un simple ordre : encadrer **lecture et écriture** de
`localStorage` (navigation privée, stockage refusé), avec une config par
défaut qui rend l'application utilisable même si le stockage échoue.

### Reconstruction de la toolbox — une fonction pure, jamais de mutation

`construireToolbox()` part de `TOOLBOX_ORIGINAL` (jamais modifié) et produit un
nouveau tableau à chaque appel, catégorie par catégorie :

- catégorie dynamique (`custom: "VARIABLE"/"PROCEDURE"`, pas de `contents`) :
  seul le nom affiché peut changer, Blockly remplit le reste lui-même.
- catégorie déjà organisée en sous-catégories natives : on les réordonne,
  masque, renomme, sans permettre d'en créer de nouvelles à ce niveau.
- catégorie à plat : les blocs repris dans un `sousMenus` personnalisé en
  sortent (`contents.filter(...)`), le reste garde sa position d'origine ; les
  sous-menus personnalisés sont ajoutés après.

**PIÈGE nº 26 — un nouveau tiroir doit pouvoir être caché par défaut sans
passer par la config sauvegardée.** Un module encore expérimental (le
DHT11/DHT22 du §9) doit rester masqué pour un enseignant qui n'a jamais ouvert
le panneau, donc *avant* toute lecture de `localStorage`. Une config par
défaut vide ne suffit pas : il faut une table séparée de secours,
`SOUS_MENUS_MASQUES_PAR_DEFAUT = { 'Grove': [...] }`, consultée uniquement
quand `configAdmin.groupes[nomParent]` n'existe pas encore. Dès que l'admin
touche un seul réglage de ce parent — même sans rapport avec le module masqué
— une entrée `groupes[nomParent]` est créée et sauvegardée : il faut donc
**copier la table de secours dedans au moment de cette première création**,
pas se contenter de la consulter à chaque rendu, sinon rouvrir l'onglet une
deuxième fois suffit à annuler le masquage.

### Les quatre onglets

- **Catégories** : liste réordonnable (`draggable`), une icône œil masque, un
  crayon renomme (remplace le texte par un `<input>`, valide sur `blur` ou
  Entrée, annule sur Échap), une pastille `<input type="color">` recolore.
  La couleur d'origine d'une catégorie est une **teinte Blockly** (0-360,
  ex. `"230"`), pas un hex : pour pré-remplir le sélecteur natif avec la
  couleur réellement affichée, la convertir avec la même saturation/valeur
  que la palette par défaut de Blockly (`S=0.45`, `V=0.65`), sinon la
  pastille montre une couleur différente de celle du tiroir tant qu'elle n'a
  pas été touchée. La surcharge, elle, est stockée directement en hex — un
  `colour` Blockly accepte les deux formats, aucune conversion n'est
  nécessaire pour l'appliquer.
- **Sous-menus** : un `<select>` des catégories qui ont un `contents` (donc
  pas Variables/Fonctions). Si la catégorie a déjà des sous-catégories
  natives, même liste réordonnable (et recolorable) que l'onglet Catégories.
  Sinon, formulaire de création : cases à cocher sur les blocs encore à plat,
  un nom, un bouton qui pousse dans `sousMenus` — sa couleur hérite de celle
  de la catégorie parente à la création, puis se change directement sur
  l'entrée (`sousMenu.couleur`), sans table de surcharge séparée : elle n'a
  qu'un seul possesseur, contrairement à une catégorie ou une sous-catégorie
  native qui existent indépendamment de toute personnalisation.
- **Libellés** : chaque `appendField("texte")` sans nom crée un `FieldLabel`
  anonyme. On le repère par sa **position parmi les seuls `FieldLabel` du
  bloc** (ordre des `appendField` dans `init`) : une clé `type#index` stable
  tant que le bloc n'est pas réécrit, sans avoir à nommer à la main des
  centaines de champs. Pour connaître le texte *par défaut* de chaque champ
  (nécessaire au bouton « réinitialiser » et pour peupler la recherche),
  instancier une fois chaque type de bloc dans un `new Blockly.Workspace()`
  **invisible, jamais injecté dans la page** — un bloc non rendu construit
  quand même ses champs, `getValue()` fonctionne sans SVG.

  Appliquer un libellé enregistré ne suffit pas de l'écrire une seule fois :
  chaque type de bloc doit être **patché à sa définition**, avant toute
  création d'instance (y compris les deux blocs de départ posés au premier
  chargement), pour que le tiroir *et* le canevas en bénéficient :

  ```js
  for (const type in Blockly.Blocks) {
      const definition = Blockly.Blocks[type];
      if (!definition || typeof definition.init !== 'function') continue;
      const initOrigine = definition.init;
      definition.init = function() {
          initOrigine.call(this);
          appliquerLibellesBloc(this);   // relit configAdmin.libellesBlocs
      };
  }
  ```

  Ce patch doit courir **avant** `Blockly.inject(...)`, sinon les blocs créés
  pendant l'injection (l'espace de départ) échappent au premier rendu.
- **Aide** : le contenu de `readme.txt`, chargé par `fetch()` au premier clic
  (fichier statique servi par `app.py` à côté d'`index.html` — donc à ajouter
  aussi aux `datas` de `app.spec` si le projet est empaqueté, sans quoi
  l'onglet fonctionne en développement et se casse silencieusement une fois
  packagé).

### Exposer un point d'entrée pour la vérification

Un glisser-déposer, un raccourci clavier ou la saisie dans un `<input>` ne se
simulent pas facilement depuis la console. Exposer les actions du panneau sous
un objet global (`window.adminTest`) permet de piloter les mêmes chemins de
code que l'UI — dans l'esprit du §19 (vérifier en pilotant l'application,
jamais en se fiant à l'absence d'erreur).

## 13. Édition manuelle du code

Bouton « ✎ Éditer » au-dessus de la transcription : bascule un `<textarea>` à
la place de l'affichage en lecture seule.

### Le renoncement assumé : pas de synchronisation dans les deux sens

Blockly sait transformer des blocs en Python ; l'inverse — reconnaître dans du
texte arbitraire les blocs qui l'auraient produit — n'existe pas de façon
fiable pour un jeu de blocs personnalisé. Ne pas essayer de le construire :
le mode retenu est **exclusif**, pas bidirectionnel.

- Entrer en édition **gèle le canevas Blockly** : un voile `position: absolute;
  inset: 0` par-dessus `#blocklyDiv` (dans un conteneur commun mis en
  `position: relative`, sans toucher au `<div>` que Blockly gère lui-même)
  capte aussi les clics, puisqu'un élément superposé intercepte les
  événements de pointeur sans qu'il soit nécessaire de désactiver l'espace de
  travail par son API. Le focus part sur le `<textarea>`, pour que les
  raccourcis clavier n'atteignent plus un bloc resté sélectionné.
- Ce qui est tapé remplace **en direct** une seule variable globale
  (`window.currentPythonCode`) déjà lue par le simulateur et les boutons de
  téléchargement/envoi (voir §3 et §7) : brancher l'édition manuelle sur cette
  variable unique évite de toucher à leur code.
- « ↩ Revenir aux blocs » abandonne la saisie et régénère le code à partir de
  l'état **actuel** des blocs — pas de celui d'avant l'entrée en édition, s'ils
  ont continué d'exister en arrière-plan.

Rien n'est persisté d'une session à l'autre : recharger la page perd la
saisie manuelle, comme elle perd déjà l'espace de travail Blockly lui-même.

### Ne pas dupliquer le calcul du code

La fonction qui génère le code depuis les blocs (scrutation des événements du
§6 comprise) doit être **isolée** de celle qui l'applique à la variable
globale et à l'affichage : le retour aux blocs et l'écouteur de changements de
l'espace de travail appellent la même fonction de génération, sinon les deux
chemins divergent au premier correctif apporté à l'un des deux :

```js
function genererCodeDepuisBlocs() { /* … scrutation comprise … */ return codePython; }
function definirCodeActuel(codePython) { window.currentPythonCode = codePython; /* … */ }

function updatePythonCode() {
    const codePython = genererCodeDepuisBlocs();
    if (editionManuelleActive) return;   // filet : le voile devrait déjà l'empêcher
    definirCodeActuel(codePython);
    afficherTranscription(codePython);
}
```

**PIÈGE nº 27 — une variable d'état lue avant sa déclaration, plus bas dans le
même fichier.** `updatePythonCode()` est appelée immédiatement après sa
définition (`updatePythonCode();`) et lit un booléen d'état
(`editionManuelleActive`) : le déclarer avec `let` seulement dans la section
qui construit l'UI d'édition, plus bas dans le fichier, lève `Cannot access
'editionManuelleActive' before initialization`. Le fichier entier est une
seule portée de fonction, mais `let`/`const` restent en zone morte tant que
leur ligne de déclaration n'a pas été exécutée. Déclarer ces booléens d'état
**avant** la première fonction qui les lit, jamais dans la section qui les
manipule le plus (l'endroit le plus naturel à lire n'est pas forcément le bon
endroit où déclarer).

## 14. Exécution tour par tour — sleep() ne met jamais en pause

Sans quoi un vrai suivi de ligne (§15) est impossible : `sleep()` ne fait
qu'empiler une action, et le programme entier (les 5 tours de la boucle
`while True`) s'exécute d'un seul bloc synchrone. Les délais visuels (texte,
son) sont rejoués *après coup*, avec de vrais délais — mais un capteur lu au
tour 3 voit encore la position du tour 0, puisque rien n'a encore bougé au
moment où le code Python s'exécute. Pour un ruban LED ça n'a aucune
importance (rien ne dépend de son état) ; pour un capteur qui doit refléter
un déplacement réel entre deux tours, ça rend le retour d'information faux
en silence — le programme tourne sans erreur, il regarde juste toujours la
même photo.

**PIÈGE nº 28 — restructurer l'exécution sans pouvoir suspendre Python.**
Faire vraiment pauser `sleep()` en plein milieu d'une fonction imbriquée
demanderait des générateurs Python et un `yield from` à *chaque* site
d'appel touchant potentiellement du code bloquant — y compris dans les
fonctions que les blocs "Fonctions" laissent l'utilisateur créer. Aucun
générateur de blocs ne produit ce genre de code, et le retrofit reviendrait à
réécrire tout le générateur Python. Solution retenue à la place : ne pas
suspendre *dans* une itération, mais entre deux itérations — la seule
frontière que le générateur contrôle déjà (`while True:` → `for _ in
range(5):`). Isoler le corps de la boucle et l'exécuter un tour à la fois,
en vidant sa file avec de vrais délais avant de lancer le tour suivant :

```js
// un.js — orchestration cote JS (déjà réagencé pour l'édition manuelle du §13)
window.simu_lancerTours = function(nRestants) {
    if (nRestants <= 0) { window.simu_finDesTours(); return; }
    if (window.simu_tourSuivant() === false) return;   // erreur déjà affichée
    const jeton = jetonSimulation;
    window._simuApresVidageFile = () => {
        if (jeton === jetonSimulation) window.simu_lancerTours(nRestants - 1);
    };
    window.simu_playQueue();
};
```

```python
# index.html — cote Brython : isoler le corps, l'exécuter une fois par tour
def _tour_suivant():
    try:
        exec(corps, env)          # `env` est le MEME dict a chaque tour : les
        return True                # variables du programme y survivent.
    except Exception as e:
        _rapporter_erreur(e)
        return False

window.simu_tourSuivant = _tour_suivant
window.simu_finDesTours = _fin_des_tours
window.simu_lancerTours(5)
```

Le crochet côté `simu_playQueue()` : quand la file se vide, appeler un
rappel en attente plutôt que de simplement s'arrêter :

```js
if (window.simuQueue.length === 0) {
    const suite = window._simuApresVidageFile;
    window._simuApresVidageFile = null;
    if (suite) suite();
    return;
}
```

Ce changement est **invisible pour tout ce qui existait déjà** : l'ordre et
le minutage des actions rejouées à l'écran sont identiques à l'ancien
comportement (tout précalculé d'un coup) pour toute fonctionnalité qui ne
relit pas un état modifié par le simulateur lui-même — ce qui est le cas de
tout, sauf des capteurs Maqueen. Vérifié en rejouant le test documenté au
§7 (`was_gesture` déclenche 1 fois sur 5 tours, `is_gesture` 5 fois) après le
changement : résultat identique.

**PIÈGE nº 29 — ne jamais supposer une largeur d'indentation fixe pour
séparer le corps de la boucle.** Le code généré par les blocs utilise
toujours 2 espaces (`Blockly.Python.INDENT`), mais du code tapé à la main
(§13, édition manuelle) peut très bien en utiliser 4, ou des tabulations.
Retirer un nombre fixe de caractères sur chaque ligne laisse un reliquat
d'indentation sur du code à 4 espaces, et `exec()` échoue sur
`IndentationError: unexpected indent` — silencieux à la lecture du code
(il a l'air correct), visible seulement à l'exécution. Utiliser
`textwrap.dedent()` sur le corps isolé : il retire la plus longue
indentation commune à toutes les lignes, quelle que soit sa largeur.

Cas de repli, volontairement laissés au comportement d'origine (programme
entier d'un coup, 5 tours précalculés) : aucune boucle infinie de premier
niveau trouvée, ou plusieurs (rare — un élève peut empiler deux blocs
« répéter indéfiniment »). Un vrai découpage tour par tour pour plusieurs
boucles concurrentes demanderait de les entrelacer, hors de portée ici.

## 15. Maqueen Plus — un robot qui se déplace vraiment sur une piste

Inspiré d'un simulateur avec piste et châssis Maqueen Plus vu ailleurs (type
Mind+/DFRobot). Nouvelle catégorie de blocs, plus une piste dessinée dans le
panneau simulateur où le robot avance réellement, dont les capteurs de ligne
lisent la piste sous lui — rendu possible par le §14 ci-dessus.

### Protocole I²C — repris d'un pilote MicroPython vérifié, pas deviné

Adresse `0x10`. Moteurs sur les registres `0x00` (gauche) / `0x02` (droit),
écriture de 3 octets `[registre, sens, vitesse]` (sens 0 = avant, 1 =
arrière, vitesse 0-255). État des cinq capteurs de ligne sur un seul octet
(`0x1D`, un bit par capteur : L2=`0x10`, L1=`0x08`, M=`0x04`, R1=`0x02`,
R2=`0x01`), leur valeur brute (16 bits) sur les registres `0x1E` à `0x26`.
Phares sur `0x0B`/`0x0C`. Les DEL RGB et l'ultrason ne passent **pas** par le
registre I²C : DEL en NeoPixel direct sur P15, ultrason sur P13 (trig) / P14
(echo) via `machine.time_pulse_us`, exactement le même principe que le
module Grove Ultrason déjà présent — ne pas réinventer un second pilote
ultrason, copier celui qui est déjà vérifié. Source du protocole :
`GBSL-Informatik/maqueen-plus-v2-mpy` (MicroPython, basé sur le paquet
MakeCode officiel DFRobot) — comme pour le DHT11/DHT22, ne jamais deviner un
protocole I²C à partir de captures d'écran ou de mémoire, toujours le
retrouver dans une source vérifiable.

### La piste : un `<canvas>` servant à la fois d'affichage et de capteur

Dessinée **une seule fois** avec `ctx.roundRect(...)` puis un `stroke()`
blanc épais — inutile de calculer un tracé plus élaboré, un rectangle
arrondi suffit à faire une boucle fermée franchissable. Le capteur de ligne
ne lit PAS un tracé paramétrique : il relit directement le pixel du canevas
à la position calculée du capteur (`getImageData(x, y, 1, 1)`), blanc = sur
la ligne. Ça marche pour n'importe quel dessin de piste, procédural ou non —
aucune structure de données séparée à maintenir en double.

Le robot, lui, est un `<div>` positionné par-dessus en **pourcentage** des
coordonnées internes du canevas (`left: X/largeur*100%`), pas en pixels
absolus : il suit alors tout seul la mise à l'échelle CSS du canevas
(`width: 100%` sur un `aspect-ratio` fixe) sans recalcul JS au
redimensionnement, contrairement à la mise à l'échelle par `transform:
scale()` déjà utilisée pour la carte micro:bit (§7) qui suppose un calcul
explicite de facteur.

### Cinématique différentielle — et son piège de signe

```js
const v = (vGauche + vDroite) / 2;                    // vitesse lineaire
const omega = (vGauche - vDroite) / EMPATTEMENT;       // vitesse angulaire, rad/s
x += v * dt * Math.cos(cap);
y += v * dt * Math.sin(cap);
cap += omega * dt;
```

Intégration d'Euler simple, un seul pas par appel de `sleep()` : suffisant
tant que les pas restent petits (le `sleep(50)` à `sleep(200)` typique d'une
boucle de contrôle), sans prétendre à une trajectoire d'arc exacte sur un
grand pas.

**PIÈGE nº 30 — le sens de rotation dépend de la convention d'axes, et se
trompe silencieusement.** Sur un canevas, l'axe Y pointe vers le **bas** :
un angle qui augmente fait donc tourner visuellement dans le sens des
aiguilles d'une montre, pas l'inverse comme en mathématiques classiques (Y
vers le haut). La formule manuel de la cinématique différentielle
(`omega = (vDroite - vGauche) / L`) suppose la convention mathématique
standard ; copiée telle quelle sur un canevas, elle fait tourner le robot du
**mauvais côté** — roue droite plus rapide tournait vers la droite au lieu
de la gauche, silencieusement, sans qu'aucune erreur ne le signale : le
robot bouge, juste pas dans le sens attendu. Une IndentationError se
remarque tout de suite ; un signe de rotation inversé ne se voit qu'en
mesurant. Vérifié par calcul : avec `vGauche=100, vDroite=200`, le cap doit
décroître (le nez part vers la gauche, où sont montés les capteurs L1/L2),
pas croître — la formule doit donc être `(vGauche - vDroite) / L`, pas
`(vDroite - vGauche) / L`.

### Capteurs de ligne : décalage de montage, pas une broche

Les cinq capteurs (L2, L1, M, R1, R2) ne sont pas des broches physiques
distinctes dans la simulation, seulement des décalages latéraux fixes par
rapport au centre du robot (`{L2: -16, L1: -8, M: 0, R1: 8, R2: 16}`), même
esprit que les décalages des capteurs de ligne sur le vrai châssis. Leur
position réelle se recalcule à chaque lecture à partir du cap courant :

```js
const avantX = Math.cos(cap), avantY = Math.sin(cap);
const droiteX = -avantY, droiteY = avantX;   // perpendiculaire vers la DROITE du robot
const x = robot.x + avantX * AVANT_CAPTEURS + droiteX * decalage;
const y = robot.y + avantY * AVANT_CAPTEURS + droiteY * decalage;
```

Un décalage positif va donc vers la droite (R1/R2), négatif vers la gauche
(L1/L2) — cohérent avec le signe de `omega` ci-dessus : les deux doivent
s'accorder, sinon un programme qui « tourne vers le capteur qui a quitté la
ligne » tournerait en fait à l'opposé.

### Étendre l'exécution tour par tour, pas la dupliquer

Le déplacement du robot doit s'appliquer au même endroit que le §14 fait déjà
avancer le temps simulé — dans le traitement de l'action `'sleep'` de la
file, juste avant `suiteApres()` :

```js
else if (action.type === 'sleep') {
    avancerMaqueen(action.value);   // avant la vraie pause : la position doit
    suiteApres(action.value);       // deja etre a jour quand suiteApres reprend
}
```

Écrire vitesse/phares/DEL passe par la file comme un servo ou un moteur
DRV8830 déjà présents (`window.simuQueue.push({...})`) — **jamais** en
écriture directe et instantanée sur l'état : la variable de vitesse doit
changer au même rythme que le reste de la file, sinon un programme qui
alterne plusieurs vitesses moteur dans la même boucle verrait toutes ses
écritures appliquées d'un coup avant le premier `sleep()`, invalidant tout
l'intérêt du §14. Les lectures (ligne, distance), à l'inverse, sont
synchrones — comme la distance Grove déjà en place — puisqu'un capteur se
lit à l'instant où le programme le demande, sans délai visuel à respecter.

### Un bug préexistant corrigé au passage : DHT11/DHT22 sans substitut simulateur

En construisant les substituts Maqueen, l'absence de `_CapteurDHT11Mock` /
`_CapteurDHT22Mock` dans `env` saute aux yeux par comparaison avec les
autres modules Grove. Sans eux, un programme utilisant DHT11/DHT22 plantait
sur `NameError` dès qu'on cliquait « Lancer la simulation » — jamais détecté
faute d'avoir testé ce chemin précis à l'origine (voir §19 : la génération
de code seule ne suffit pas, il faut aussi *exécuter*). Prévoir un
`_CapteurXMock` pour **chaque** classe qu'un pilote Grove peut instancier
est donc à vérifier systématiquement à la création d'un nouveau module, pas
seulement pour ceux qui ont l'air d'avoir besoin d'un rendu visuel.

### Placer le robot à la souris, et une conséquence à en tirer sur le point de départ

Glisser-déposer avec `pointerdown`/`pointermove`/`pointerup` (les Pointer
Events unifient souris et tactile, `touch-action: none` en CSS empêche le
geste de faire défiler la page à la place) : convertir la position du
pointeur en coordonnées internes de la piste (`(clientX - rect.left) /
rect.width * LARGEUR`), pas en pixels d'écran — le robot est déjà positionné
en pourcentage (voir plus haut), donc cohérent avec le redimensionnement CSS
sans code supplémentaire.

Une fois déposé, la nouvelle position devient le **point de départ**
(`MQ_DEPART`, muable et non plus une constante), pas seulement la position
courante : sans ça, « Réinitialiser la simulation » effacerait le placement
choisi à chaque clic, ce qui viderait la fonctionnalité de son intérêt — le
but est justement de pouvoir tester un programme depuis un endroit précis de
la piste de façon répétable.

### Animer le déplacement — et le piège qu'une transition CSS révèle sur l'angle

Une position mise à jour d'un coup (téléporter puis figer jusqu'au prochain
tour) se voit comme saccadée, même quand le calcul de cinématique est
correct : rien n'interpole visuellement entre l'ancienne et la nouvelle
position. Remède simple, une transition CSS calée sur la **durée réelle**
du `sleep()` qui a déclenché le déplacement :

```js
robotEl.style.transition =
    'left ' + ms + 'ms linear, top ' + ms + 'ms linear, transform ' + ms + 'ms linear';
// … puis on change left/top/transform : le navigateur anime la difference.
```

Écrire `transition = 'none'` avant tout déplacement qui doit être instantané
(glisser-déposer, réinitialisation, positionnement de test) — sinon ces
changements-là s'animent aussi, ce qui donne un robot qui « rattrape »
mollement le pointeur au lieu de le suivre.

**PIÈGE nº 31 — replier un angle dans [0, 360[ casse l'animation CSS à la
frontière.** Une transition CSS sur `transform: rotate()` interpole
**numériquement** entre l'ancienne et la nouvelle valeur, sans savoir qu'un
angle est périodique. Si le cap est ramené dans [0, 360[ après chaque pas
(`cap = ((cap + delta) % 360 + 360) % 360`), un virage qui franchit la
frontière — 350° qui devient 10° après un delta de +20° — s'affiche comme
une rotation de -340° (le tour complet dans l'autre sens) plutôt que les +20°
réels : le robot semble faire un tour sur lui-même à chaque passage par
zéro. Solution : ne **jamais** replier l'angle pendant la conduite, le
laisser croître ou décroître sans limite (`cap += delta`, un nombre réel
quelconque) — `Math.cos`/`Math.sin` et `rotate()` en CSS sont tous les deux
périodiques et s'en accommodent très bien. Ne remettre à une valeur connue
(0° ou autre) qu'à la réinitialisation explicite, où aucune animation n'est
souhaitée de toute façon (`transition: none`).

### Plusieurs tracés — un registre, pas des variantes du code de dessin

Trois pistes (`PISTES_MAQUEEN = { ovale, rectangulaire, huit }`), chacune un
objet `{ nom, depart: {x, y, cap}, dessiner(ctx) }` plutôt que trois copies
de `dessinerPisteMaqueen()` avec un `if` sur le tracé choisi — changer de
piste devient alors `dessinerPisteMaqueen()` (fond + réglages de trait
communs) suivi de `PISTES_MAQUEEN[cle].dessiner(ctx)` (juste le tracé), et
ajouter une quatrième piste n'est qu'une nouvelle entrée dans le registre.

Le point de départ appartient à la piste, **pas** au robot : un point qui
tombe sur le tracé d'une boucle ovale ne tombe pas forcément sur celui d'un
circuit en huit. Changer de piste doit donc remplacer `MQ_DEPART` par celui
de la nouvelle piste et repositionner le robot dessus tout de suite
(`reinitialiserMaqueen()`), pas garder l'ancien point et laisser l'élève
découvrir que son robot est planté en dehors de la piste.

Le circuit en huit ne calcule aucune intersection : deux tracés en boucle
(`ctx.roundRect` + `stroke`) dont les rectangles de base se chevauchent sur
une quarantaine de pixels suffisent, le croisement du trait blanc apparaît
tout seul dans la zone commune. Plus simple et plus sûr que de calculer une
courbe en forme de huit à la main.

### Éditeur de piste à points de passage

Une piste personnalisée n'est qu'une liste `[{x, y}, …]` reliée par des
segments droits, refermée du dernier point au premier
(`ctx.closePath()` dès qu'il y en a au moins 3) — même style de trait que les
pistes fixes (26 px, blanc), donc les capteurs de ligne n'ont besoin d'aucun
cas particulier pour une piste dessinée à la main. Le point de départ est le
premier point posé, orienté vers le deuxième (`atan2`) : le robot démarre
face à la piste plutôt que dans une direction arbitraire.

Les poignées (un `<div>` par point, positionné en pourcentage comme le
robot) sont des éléments DOM distincts du canevas, **jamais dessinées sur
ses pixels** : le canevas ne doit contenir que la piste elle-même, puisque
c'est aussi lui qu'on relit pour savoir si un capteur est sur la ligne — y
mélanger des poignées de couleur fausserait cette lecture pendant l'édition.

Identifier *quelle* poignée on déplace ou supprime avec un `dataset.index`
relu **au moment de l'événement**, pas capturé une fois pour toutes à la
création : les poignées sont recyclées (on ajoute/retire des `<div>` plutôt
que de tout reconstruire à chaque point posé), et supprimer le point *n*
décale les index de tous les points suivants. Un index figé dans la
fermeture au moment de `addEventListener` pointerait sur le mauvais point
dès la première suppression.

**PIÈGE nº 32 — `setPointerCapture` peut lever une exception, sur un geste
par ailleurs valide.** Rencontré en testant le glisser d'une poignée avec de
vrais `PointerEvent` synthétiques, mais le message d'erreur
(`NotFoundError: No active pointer with the given id`) n'a rien de
spécifique aux tests : un pointeur relâché entre le `pointerdown` et l'appel
à `setPointerCapture`, ou un identifiant que le navigateur ne reconnaît plus,
donne la même exception en usage réel. Comme elle n'est pas rattrapée, une
exception ici **interrompt le reste du gestionnaire** — y compris
`preventDefault()`/`stopPropagation()` placés juste après, qui ne
s'exécutent alors jamais. Encadrer l'appel d'un `try/catch` qui ne fait rien
d'autre que laisser continuer : la capture est un confort (suivre le
pointeur même s'il sort de l'élément), pas une condition pour que le reste
du glisser fonctionne, puisque les écouteurs restent actifs sur l'élément
lui-même.

### Indicateurs de capteurs de ligne — n'afficher que ce que le programme lit vraiment

Même logique que les sections du panneau Grove (§9) : un point par capteur
(L2/L1/M/R1/R2), masqué par défaut, montré seulement si un bloc `capteur de
ligne` ou `valeur brute du capteur de ligne` **posé sur l'espace de
travail** référence ce capteur précis — pas les cinq d'un coup, l'élève ne
doit voir que ce qui compte pour son programme :

```js
function capteursLigneUtilisesMaqueen() {
    const utilises = new Set();
    for (const bloc of window.workspace.getAllBlocks(false)) {
        if (bloc.type === 'maqueen_ligne_etat' || bloc.type === 'maqueen_ligne_valeur') {
            utilises.add(bloc.getFieldValue('CAPTEUR'));
        }
    }
    return utilises;
}
```

Appelée depuis `rafraichirPanneauMaqueen()` (donc à chaque changement de
bloc, comme le reste du panneau) pour la **visibilité** des points, mais leur
**état** (vert/gris) doit rester à jour bien plus souvent que ça — à chaque
déplacement du robot, simulé ou glissé à la souris. Plutôt qu'un second
mécanisme de rafraîchissement, brancher la mise à jour des indicateurs
directement dans `dessinerRobotMaqueen()` : c'est déjà le point de passage
unique pour tout changement de position, qu'il vienne d'`avancerMaqueen()`
(§15), du glisser-déposer ou d'une réinitialisation.

Conséquence : relire jusqu'à cinq pixels du canevas (un `getImageData` par
capteur visible) à *chaque* appel de `dessinerRobotMaqueen()`, largement
assez fréquent pour que le navigateur suggère `willReadFrequently: true` à
la création du contexte 2D — un avertissement console à prendre au sérieux
ici (des lectures répétées sur un petit canevas, pas un cas isolé), pas à
ignorer par réflexe.

## 16. Kitrobot v2 — un second robot, sans supposer le câblage

Second kit, distinct du Maqueen Plus (autre châssis, deux servos + une
piste dédiée départ/arrivée plutôt qu'un circuit fermé), demandé à partir de
captures d'écran (piste avec drapeaux, palette de blocs Détection /
Déplacement / Contrôle / LED RGB). Module **séparé** de Maqueen — pas une
extension — avec sa propre catégorie, sa propre piste, son propre panneau.

### Pas de protocole vérifié cette fois : les broches se choisissent, elles ne se devinent pas

Pour le Maqueen Plus (§15) et le DHT11/DHT22 (§9), un pilote MicroPython
tiers vérifiable a pu être retrouvé et cité. Pour le Kitrobot v2, aucune
source de ce niveau n'a été trouvée. Plutôt que fabriquer un faux protocole
I²C à partir d'une capture d'écran — ce que ce projet s'interdit
systématiquement — le robot est reconstruit comme une **composition de
briques déjà vérifiées séparément** :

- deux servomoteurs à rotation continue (`_servo_continu`, déjà vérifié au
  §8) pour les roues, montés en miroir (signe inversé côté droit) ;
- l'ultrason Grove (`_grove_distance_cm`, §9) pour la distance ;
- le ruban NeoPixel Grove (`neopixel.NeoPixel`, `_grove_teinte`, `_grove_lum`,
  §9) pour les LED RGB ;
- un buzzer sur simple broche numérique, technique standard (`set_analog_
  period_us` + `write_analog(512)` pour un carré PWM à la fréquence voulue) ;
- deux capteurs de ligne Grove Line Finder lus en tout-ou-rien
  (`read_digital()`).

Toutes les broches ont une valeur par défaut plausible (P1/P2 les servos, P0
l'ultrason, P8 le buzzer, P13/P14 les capteurs de ligne, P15 le ruban), mais
**modifiable** par des blocs « définir » facultatifs — exactement le choix
déjà fait pour le Maqueen Plus concernant l'ultrason/le ruban, généralisé ici
à tout le robot puisque rien n'est vérifié. Un tooltip le dit sur chaque bloc
« définir ». Ne pas présenter ces valeurs comme un câblage réel : elles ne le
sont pas.

### La piste : droite, départ/arrivée, noir sur blanc — pas le circuit fermé de Maqueen

Piste dédiée, demandée explicitement pour ne pas réutiliser le système de
piste fermée de Maqueen (§15, boucle refermée sur elle-même). Un simple
segment horizontal épais dessiné une fois au `<canvas>`
(`ctx.moveTo`/`lineTo`/`stroke()`), deux drapeaux « Départ »/« Arrivée » en
`<div>` décoratifs par-dessus — même principe que le robot lui-même :
jamais dessinés sur le canevas, seulement en CSS, puisque le canevas sert
aussi de capteur (`getImageData`) et que tout ce qui s'y dessine en plus
fausserait la lecture des capteurs de ligne.

Couleurs **inversées** par rapport à Maqueen (ligne noire sur fond blanc, au
lieu de blanche sur fond vert) : un choix délibéré pour qu'on distingue les
deux panneaux d'un coup d'œil, pas seulement par leur titre. Conséquence
directe sur la détection : Maqueen teste un pixel *clair* (`pix[0] > 200`
typiquement), Kitrobot teste un pixel *sombre* (`pix[0] < 100 && pix[1] <
100 && pix[2] < 100`). Confondre les deux revient à un capteur qui ne
détecte jamais rien — un piège silencieux (pas d'erreur, juste un capteur
qui renvoie toujours `false`), à vérifier en plaçant le robot manuellement
sur la ligne (`window.kitrobotTest.definirPosition(x, y, cap)`) et en lisant
`surLaLigne('gauche')`.

Cinématique et positionnement du robot : identiques à Maqueen au signe près
déjà corrigé (§15 — `omega = (vGauche - vDroite) / empattement`), aucune
raison de le redécouvrir une seconde fois. Vitesse en pourcentage (-100 à
100, comme les blocs Kitrobot l'exposent) plutôt qu'en -255..255 comme
Maqueen : seule la constante de conversion change.

### Chaque fonction du pilote retiré a besoin de son substitut — pas seulement les feuilles

Point déjà découvert avec DHT11/DHT22 (§9, bug corrigé au §15) et reconfirmé
ici en le construisant dès le départ plutôt qu'en le découvrant après coup :
**tout** ce qui est déclaré à l'intérieur du bloc `# >>> pilote kitrobot …
# <<< pilote kitrobot` disparaît avant l'exécution dans le simulateur — pas
seulement les fonctions qui touchent une broche, mais aussi celles qui ne
font qu'en appeler d'autres. `_kb_case(sens)`, par exemple, ne fait
qu'enchaîner `_kb_avancer()`, `sleep()` et `_kb_arreter()` — mais comme sa
propre définition est *elle-même* à l'intérieur du marqueur, ne fournir un
substitut que pour `_kb_avancer`/`_kb_arreter` et pas pour `_kb_case` produit
un `NameError` tout aussi sûrement. Les 16 fonctions `_kb_*` du pilote ont
donc chacune leur mock côté navigateur, y compris les fonctions de
composition (`_kb_case`, `_kb_virage`, `_kb_arreter`) et les fonctions
purement calculatoires (`_kb_hsv`) — écrites en réutilisant `sleep()` et les
mocks déjà mockés plus haut (`_grove_obj`, `_NeoPixelMock`, `_grove_teinte`)
plutôt qu'en réinventant un nouveau mécanisme de file d'attente : `_kb_case`
appelle `_kb_avancer()` puis `sleep(600)` puis `_kb_arreter()`, exactement
comme le vrai pilote, et ça suffit — `sleep()` est déjà une fonction mockée
qui empile une action dans la file du simulateur (§14), donc l'ordre et le
délai sont respectés sans rien coder de plus.

## 17. Maqueen Plus V3, télécommande infrarouge et LiDAR

Demandé à partir de captures d'écran d'une palette de blocs MakeCode/Mind+
montrant des variantes « v1/v2/v3 » du Maqueen Plus, une télécommande
infrarouge et un module LiDAR matriciel. Contrairement au Kitrobot v2
(§16), ici une source vérifiable existe et a été retrouvée avant d'écrire
la moindre ligne : `DFRobot/pxt-DFRobot_MaqueenPlus_v20` (fichier
`maqueenPlusV2.ts`) et `DFRobot/pxt-DFRobot_matrixLidarDistanceSensor`
(fichier `matrixLidarDistance.ts`), tous deux sur GitHub.

### Démêler « v1/v2/v3 » avant de coder quoi que ce soit

DFRobot n'a **pas de nommage cohérent** entre ses propres dépôts : le
dépôt le plus proche d'un hypothétique « V1 » (`pxt-DFRobot-Maqueenplus`,
6 capteurs de ligne, servos pilotés en I2C) pointe lui-même vers une page
produit étiquetée « V2 » chez DFRobot. En revanche, une confirmation
externe a été trouvée : « V3 et V2 utilisent la même bibliothèque, toutes
les fonctions V3 sont intégrées à la bibliothèque V2 » — exactement ce que
montre `maqueenPlusV2.ts`, où les fonctions V3 (suiveur de ligne, PID) sont
marquées `group="V3"` mais vivent dans le **même namespace**, avec le
**même registre I2C 0x10** que les fonctions déjà implémentées dans ce
projet (moteurs, 5 capteurs de ligne, phares, ruban NeoPixel — qui
correspondent déjà exactement au protocole V2, vérifié en comparant les
adresses registre par registre). Plutôt que de deviner un « V1 » incertain,
la question a été posée : la réponse retenue est que le jeu de blocs déjà
présent (motorisation, ligne, phares, ruban) *est* la base commune, et que
seules les fonctions **V3 additionnelles** (suiveur de ligne autopilote,
PID, luminosité, vitesse réelle, DEL de carrosserie) sont de nouveaux
blocs — sans sélecteur de version qui changerait le code généré, puisque
rien dans les sources trouvées n'exige de branchement par version une fois
« V1 » écarté.

### Suiveur de ligne et PID (V3) — mêmes fonctions `_mq_ecrire`/`_mq_lire`

```python
def _mq_v3_pid_avancer(sens, distance_cm, attendre):
    distance_cm = int(distance_cm)
    if distance_cm >= 6000:
        distance_cm = 60000     # tel quel dans la source DFRobot (voir plus bas)
    _mq_ecrire(64, 1 if sens == "avant" else 2)
    _mq_ecrire(85, 2)           # vitesse PID interne, fixe (pas un parametre MakeCode)
    _mq_ecrire(65, (distance_cm >> 8) & 0xFF)
    _mq_ecrire(66, distance_cm & 0xFF)
    _mq_ecrire(60, 0x04 | 0x02)
    if attendre:
        while _mq_lire(87, 1)[0] == 1:
            sleep(10)
```

**PIÈGE nº 35 — reproduire une source fidèlement, même une coquille
apparente, plutôt que la « corriger » sans certitude.** La fonction
d'origine (`pidControlDistance`) contient `if (distance >= 6000) distance
= 60000` — un plafond qui semble être une erreur de copier-coller (6000
attendu, 60000 écrit), mais rien ne prouve que ce n'est pas une valeur
volontaire tenant compte d'une unité interne différente. Corriger cette
ligne serait deviner un comportement jamais vérifié sur une vraie carte.
La reproduire telle quelle, en le signalant en commentaire et dans
`ETAT_DU_PROJET.md`, laisse la décision à quelqu'un qui pourra un jour la
vérifier sur le matériel réel — la règle « ne jamais deviner un protocole »
(§9, §15) s'applique aussi à ne pas deviner une correction.

Le sens gauche/droite du bloc « tourner (PID) » est logé dans la même
incertitude : la source ne code que le **signe** de l'angle (`angle >= 0`
→ direction 1, sinon direction 2, source déjà donc muette sur ce que ça
donne physiquement) — traduit en un choix gauche/droite pour coller à
l'interface par blocs, mais non confirmé sur un vrai chassis.

### Le suiveur de ligne autopilote n'a pas d'équivalent dans le simulateur

Contrairement aux blocs moteur ordinaires (qui pilotent directement les
deux roues, modélisées par la cinématique différentielle du §15), le
suiveur de ligne V3 et le codeur de roue sont des fonctionnalités
**embarquées dans le firmware du chassis lui-même** : le micro:bit ne fait
qu'envoyer une commande, toute la boucle de correction se passe sur la
puce du Maqueen. Le modèle cinématique de ce simulateur n'a pas de
représentation de ce firmware distinct — seuls les mouvements PID
(distance/angle) sont donc mimés en pilotant directement les moteurs
simulés déjà existants (`window.simu_maqueenMoteur`), avec un `sleep()`
proportionnel à la distance/l'angle demandé (approximation minutée, sans
odométrie réelle, même limite déjà acceptée pour le Kitrobot v2 au §16).
Les autres blocs V3 (mode aux intersections, vitesse du suiveur, capteurs
de luminosité, vitesse réelle des roues) se contentent d'enregistrer un
état sans effet visuel — les documenter comme tel plutôt que fabriquer une
fausse simulation aurait été trompeur.

### Télécommande infrarouge — protocole public, pilote DFRobot non portable

Le pilote réel de DFRobot pour l'infrarouge (`maqueenIR`/`maqueenIRV2`
dans `pxt-DFRobot-Maqueenplus`) est entièrement **natif** : les fichiers
`.ts` ne déclarent que des signatures vides (`declare namespace maqueenIR
{ function onPressEvent(...): void; }`), l'implémentation réelle vit dans
des fichiers `.cpp` compilés dans le firmware MakeCode — impossible à
réutiliser en MicroPython, exactement comme pour le premier pilote
DHT11/DHT22 (§9). Contrairement au DHT11/22, la solution n'est pas un
firmware assembleur repris d'ailleurs : le protocole NEC lui-même est une
**norme publique** (pas un secret DFRobot), documentée indépendamment de
DFRobot — le décoder n'est donc pas « deviner un protocole », c'est
implémenter une spécification ouverte.

```python
def _ir_lire_trame():
    broche = _ir_broche[0]
    if broche.read_digital() == 1:      # recepteur actif bas : repos = 1
        return None
    temps = []
    niveau = 0
    for _ in range(68):                  # 1 marque + 1 espace d'entete + 32*2 bits + 1 stop
        duree = machine.time_pulse_us(broche, niveau, 15000)
        if duree < 0:
            break
        temps.append(duree)
        niveau = 1 - niveau
    if len(temps) < 68 or not (8000 <= temps[0] <= 10000) or not (4000 <= temps[1] <= 5000):
        return None
    valeur = 0
    for i in range(2, 66, 2):
        valeur >>= 1
        if temps[i + 1] > 1120:          # espace long = bit 1, court = bit 0
            valeur |= 0x80000000
    commande = (valeur >> 16) & 0xFF
    if commande != ((valeur >> 24) & 0xFF) ^ 0xFF:   # verification du complement
        return None
    return commande
```

Même technique que le capteur ultrason (§9) : `machine.time_pulse_us`
mesure une impulsion avec la précision native du firmware, pas un
bit-bang Python microseconde par microseconde (qui, lui, aurait exigé de
l'assembleur — le DHT11/22 l'a appris à ses dépens). Les impulsions NEC
(562,5 µs minimum) sont assez larges pour que la surcharge d'un appel de
fonction MicroPython entre deux mesures reste négligeable — contrairement
au DHT11/22 dont les impulsions de ~50-70 µs ne laissent aucune marge.
Pas de gestion des trames de répétition (bouton maintenu) : simplification
assumée, chaque appui ne déclenche l'évènement qu'une fois.

Deux télécommandes reconnues, deux tables de correspondance code→bouton :
la « noire » (enum `RemoteButton` du dépôt DFRobot, adresse NEC non
documentée donc non vérifiée) et la « grise Car mp3 SE-020401 » (très
répandue, table de 21 boutons relevée sur une source indépendante :
<https://gist.github.com/danyboy666/f342c1cca26e88e0e637ee071698ac56>).

### PIÈGE nº 36 — `globals()` dans un mock ne renvoie PAS l'espace de noms du programme élève

Repose sur le même mécanisme que les blocs « lorsque … » (§6) : un bloc
« lorsque la commande X est reçue » génère `def on_ir_noire_touche1():
...`, et un dispatcher doit retrouver cette fonction par son nom pour
l'appeler. Sur la vraie carte, tout — pilote et programme élève — vit dans
un seul espace de noms, donc `globals()` fonctionne. Mais dans le
simulateur, le programme élève s'exécute via `exec(code, env)` où `env`
est un **dictionnaire séparé** de l'espace de noms du script Brython du
simulateur : une fonction mock définie avec `def _ir_traiter(): ...` au
niveau du module a son `__globals__` figé sur le module où elle est
**définie**, pas sur `env`. Résultat : `"on_ir_noire_touche1" in
globals()` est toujours faux, silencieusement — aucune erreur, l'appel
ne se produit juste jamais.

Ce piège était déjà connu et documenté pour `_radio_traiter` (commentaire
en clair dans `index.html` : « doit chercher les gestionnaires dans env,
là où exec les crée ») — mais pas réappliqué du premier coup en écrivant
`_ir_traiter` par analogie avec le pilote réel plutôt qu'avec le mock déjà
existant. Repéré uniquement en **exécutant** un programme avec un vrai
gestionnaire posé (le mock, testé isolément avec des arguments neutres,
ne révèle rien) : la fonction se déclarait « sans erreur » mais
n'appelait jamais le gestionnaire. Corrigé en déplaçant `_ir_traiter` à
l'intérieur de `lancer_simulation()`, fermeture sur `env`, exactement
comme `_radio_traiter` :

```python
def _ir_traiter():
    if not window.simu_irEnAttente():
        return
    telecommande = str(window.simu_irTelecommande())
    touche = str(window.simu_irToucheAttente())
    _ir_dernier[0] = int(window.simu_irCodeAttente())
    window.simu_irConsommer()
    nom = "on_ir_" + telecommande + "_" + touche
    if nom in env:          # env, jamais globals()
        env[nom]()
```

Règle générale : **tout mock destiné à appeler une fonction définie par
les blocs (pas seulement lire/écrire un état) doit être défini à
l'intérieur de `lancer_simulation()` et fermer sur `env`** — jamais au
niveau module, même si ça semble fonctionner en l'appelant isolément.

### Simuler une télécommande sans vrai signal infrarouge

Le panneau Maqueen Plus expose deux menus déroulants (télécommande,
touche — remplis depuis les mêmes tables `MENU_TOUCHE_NOIRE`/
`MENU_TOUCHE_GRISE` que le générateur, pas dupliqués côté HTML) et un
bouton « Simuler l'appui ». Le pont JS→Python passe par des **fonctions**
qui renvoient un type simple (`window.simu_irEnAttente()` → bool,
`window.simu_irTelecommande()` → str, `window.simu_irCodeAttente()` →
int) plutôt qu'un objet JS lu directement (`window.simu_irCommande.code`)
— ce dernier a été essayé en premier et abandonné : la lecture d'une
propriété d'objet JS imbriquée depuis Brython n'est pas un chemin aussi
éprouvé dans ce projet que l'appel de fonction renvoyant un scalaire,
déjà utilisé par tous les autres mocks (`_mq_distance`, `_grove_teinte`,
etc.) — repris par cohérence avec l'existant plutôt que re-découvert à
la dure une seconde fois.

### LiDAR matriciel (SEN0628) — capteur indépendant, protocole par paquets

Nouvelle catégorie de blocs, pas rattachée au Maqueen (utilisable seule).
Protocole entièrement différent de l'I2C « écrire un registre, lire un
registre » des autres modules : un paquet d'entête fixe, une commande, une
réponse à interroger jusqu'à un octet de statut :

```python
def _lidar_paquet(adresse, commande, donnees=b""):
    longueur = len(donnees) + 1
    entete = bytes([0x55, (longueur >> 8) & 0xFF, longueur & 0xFF, commande])
    i2c.write(adresse, entete + donnees)
    sleep(10)

def _lidar_reponse(adresse, commande):
    debut = running_time()
    while running_time() - debut < 200:
        statut = i2c.read(adresse, 1)[0]
        if statut in (0x53, 0x63):          # succes / echec
            echo = i2c.read(adresse, 1)[0]
            longueur = i2c.read(adresse, 2)
            longueur = longueur[1] << 8 | longueur[0]
            if echo != commande or longueur == 0:
                return b""
            return i2c.read(adresse, longueur)
    return b""
```

Deux modes distincts, à ne pas mélanger : « Matrice 8x8 » (lecture point
par point, x/y de 0 à 7) et « Évitement 4x4 » (une seule acquisition
renvoie direction conseillée, signal d'urgence, distances gauche/avant/
droite déjà calculées par le capteur). Un détail de la source à respecter
sans le « simplifier » : `obstacleSuggestion()` (direction conseillée) et
`getObstacleDistance()` (distance par côté) **n'utilisent pas le même
codage** pour gauche/avant/droite — la première documente 1=gauche/
2=droite/3=avant en commentaire, la seconde utilise un enum `Left=1,
Front=2, Right=3` — une incohérence de la source elle-même, reproduite
avec deux tables séparées plutôt qu'unifiée en une seule qui aurait
introduit une inversion.

Panneau simulateur minimal (trois curseurs gauche/avant/droite, pas de
vraie matrice de distances) : aucune piste ni robot associé à un capteur
générique, contrairement à Maqueen/Kitrobot.

## 18. Lanceur et empaquetage

`lancer_projet.bat` :

```bat
@echo off
cd /d "%~dp0"
```

**PIÈGE nº 33** — sans `cd /d "%~dp0"`, lancé depuis un raccourci ou une invite
positionnée ailleurs, le serveur sert le mauvais dossier et le navigateur
affiche des 404 sur `un.js`, `deux.js`, `trois.js`. Ouvrir le navigateur
**après** le démarrage du serveur, et ne pas masquer la fenêtre : si le port est
occupé, l'erreur doit rester lisible.

Pour un exécutable PyInstaller : `os.chdir(sys._MEIPASS)` en mode figé,
`os.chdir(os.path.dirname(os.path.abspath(__file__)))` sinon,
`allow_reuse_address = True` sur le `TCPServer`, et message clair si le port
est pris.

**PIÈGE nº 34 — `socketserver.TCPServer` tout court ne suffit pas : il lui
faut `ThreadingMixIn`.** Un navigateur ouvre plusieurs connexions en
parallèle pour charger `trois.js`, `deux.js` et `un.js` en même temps qu'il
sert `index.html`. Un `TCPServer` nu ne traite qu'une connexion à la fois
(gardée ouverte en HTTP/1.1 keep-alive) : la première requête aboutit,
`index.html` s'affiche avec toute sa mise en page statique, mais le serveur
reste bloqué dessus et ne répond jamais aux autres — l'espace de travail
Blockly reste vide indéfiniment, sans la moindre erreur console, puisque
`un.js` n'est simplement jamais exécuté. Pas un cas rare : ça peut arriver
au tout premier chargement, dans n'importe quel navigateur. Corrigé par
`class Serveur(socketserver.ThreadingMixIn, socketserver.TCPServer)` (plus
`daemon_threads = True`, pour que les threads ne bloquent pas l'arrêt du
serveur). Le mono-thread avait été gardé un temps par crainte d'un accès
concurrent au lecteur de carte dans `deux.js` — mais ce lecteur est piloté
côté navigateur (File System Access API), sans aucun rapport avec le
serveur Python, qui ne fait que servir des fichiers statiques en lecture
seule sans état partagé entre requêtes. Rien à protéger, donc rien qui
justifiait de s'en priver.

## 19. Comment vérifier

Aucun test automatisé : la vérification se fait dans le navigateur, en pilotant
l'application depuis la console.

1. **Chaque bloc isolé** : le générer seul et contrôler que le code contient bien
   `from microbit import *` dès qu'il touche à l'API de la carte.
2. **Indentation** : relever les indentations ligne par ligne d'un programme
   mêlant un bloc « lorsque … » et une boucle infinie ; elles doivent être
   cohérentes (0, 0, 2, 0, 2, 2 et non 0, 2, 0, 4, 2).
3. **Chaîne `.hex` complète** : générer, puis **relire** le fichier produit avec
   une instance `MicropythonFsHex` indépendante — `importFilesFromHex` puis `ls()`
   et `read('main.py')` — et vérifier que le contenu est identique au code source.
   Se contenter de l'absence d'erreur ne prouve rien.
4. **Largeur des tiroirs** : mesurer `getToolbox().getFlyout().getWidth()` pour
   chaque catégorie. Viser moins de 400 px.
5. **Simulateur** : compter les LED allumées, lire le texte de l'écran, compter
   les oscillateurs Web Audio créés. Pour le son, un rendu hors ligne
   (`OfflineAudioContext`) permet de mesurer la durée, l'énergie et même la
   hauteur des notes par comptage de passages par zéro. Pour l'écran LCD, relire
   les 32 cellules et les recomposer en deux chaînes de 16 caractères.
6. **Retrait des pilotes** : vérifier qu'après le `re.sub` il ne reste aucun
   `# >>> pilote`, et que le code exécuté ne contient plus la classe du pilote.
7. **Géométrie du texte** : voir le PIÈGE nº 16 — mesurer l'encre réelle par
   `canvas.measureText`, jamais la boîte de ligne.
8. **Panneau administrateur** : piloter par `window.adminTest` plutôt que
   simuler un glisser-déposer ou le raccourci clavier — un clic sur l'icône
   œil, lui, se simule (`element.click()`), mais l'objet de test couvre aussi
   ce qu'un clic ne peut pas déclencher facilement (drag-and-drop, `Ctrl+Alt+
   Maj+A`). Vérifier que `window.workspace.options.languageTree.contents`
   reflète bien chaque changement, pas seulement l'absence d'erreur.
9. **Édition manuelle du code** : un objet de test équivalent
   (`window.editionCodeTest`) pour entrer/sortir du mode et saisir du texte
   sans simuler la frappe clavier. Vérifier que `window.currentPythonCode`
   change en direct, et que les boutons `.hex`/`.py`/« Envoyer sur la carte »
   lisent bien cette même variable au moment du clic (relire leur code, pas
   seulement cliquer et constater l'absence d'erreur).
10. **Décodage d'un capteur sans le capteur en main** (DHT22 par exemple) :
    vérifier la formule par calcul contre un exemple documenté et connu du
    protocole (le datasheet en donne un), pas seulement en relisant le code —
    une erreur de décalage de bits se lit rarement à l'œil dans du code
    correct en apparence.
11. **Un mock qui doit appeler une fonction définie par les blocs** (un
    dispatcher d'évènement, voir PIÈGE nº 36 §17) : ne jamais se contenter
    de vérifier qu'il s'exécute sans erreur avec des arguments neutres —
    poser un vrai gestionnaire (`def on_xxx(): ...`) et vérifier qu'il est
    réellement *appelé*, sans quoi une recherche dans le mauvais espace de
    noms (`globals()` au lieu de `env`) passe inaperçue indéfiniment.
12. **Substituts d'un pilote retiré côté simulateur** (Kitrobot v2, §16) :
    lister toutes les fonctions déclarées à l'intérieur du bloc
    `# >>> pilote … # <<< pilote`, pas seulement celles que les blocs
    appellent directement — une fonction de composition (`_kb_case` par
    exemple) est tout aussi absente du code exécuté que celles qui touchent
    une broche. Exécuter un programme qui appelle chacune au moins une fois
    et vérifier l'absence de `NameError`, pas seulement les quelques-unes
    posées à la main pendant le développement.

### Les faux négatifs, à connaître avant de conclure

Ces six-là ont fait conclure à tort qu'un correctif ne marchait pas :

- **Mesurer une section masquée.** Les styles calculés d'un élément en
  `display: none` ne veulent rien dire. Rendre la section visible d'abord.
- **Attendre une transition ou une animation** dans un aperçu qui ne compose pas
  d'images : `requestAnimationFrame` et `ResizeObserver` n'y avancent pas.
  Vérifier l'état final, pas l'animation.
- **Vider l'espace de travail avant de mesurer** ce qu'il contenait.
- **Lire la première pastille venue** alors que l'état persiste d'une exécution
  à l'autre : viser l'élément par son nom, pas par son rang.
- **`elementFromPoint` sur un élément en `pointer-events: none`** : il est
  invisible au test de survol par construction. L'ordre de peinture se vérifie
  par la structure, pas par le pointeur.
- **Un espace de travail Blockly qui reste vide, sans erreur.** Si `app.py`
  utilise encore `socketserver.TCPServer` sans `ThreadingMixIn` (voir PIÈGE
  nº 34, §18), les connexions parallèles qu'un navigateur ouvre pour charger
  `trois.js`/`deux.js`/`un.js` se bloquent les unes les autres : `index.html`
  s'affiche, mais `un.js` n'est jamais exécuté, donc rien ne ressemble à une
  erreur — juste un espace de travail qui ne se remplit jamais. Ça ressemble
  à une régression du dernier correctif alors que c'est le serveur qui est
  engorgé. Vérifier `class Serveur` avant de chercher plus loin.

Règle générale : l'absence d'erreur ne prouve rien. Relire ce qui a été produit
avec un outil indépendant de celui qui l'a produit.

Fournis le code complet des fichiers du §1, prêt à être posé dans un dossier.
