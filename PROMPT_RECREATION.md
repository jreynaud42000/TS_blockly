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
code que l'UI — dans l'esprit du §15 (vérifier en pilotant l'application,
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

## 14. Lanceur et empaquetage

`lancer_projet.bat` :

```bat
@echo off
cd /d "%~dp0"
```

**PIÈGE nº 28** — sans `cd /d "%~dp0"`, lancé depuis un raccourci ou une invite
positionnée ailleurs, le serveur sert le mauvais dossier et le navigateur
affiche des 404 sur `un.js`, `deux.js`, `trois.js`. Ouvrir le navigateur
**après** le démarrage du serveur, et ne pas masquer la fenêtre : si le port est
occupé, l'erreur doit rester lisible.

Pour un exécutable PyInstaller : `os.chdir(sys._MEIPASS)` en mode figé,
`os.chdir(os.path.dirname(os.path.abspath(__file__)))` sinon,
`allow_reuse_address = True` sur le `TCPServer`, et message clair si le port
est pris.

## 15. Comment vérifier

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
- **Un serveur qui ne répond plus après une rafale de tests.** Le serveur du
  §1 est mono-thread (`socketserver.TCPServer`, pas `ThreadingTCPServer`) : une
  requête qui ne se termine pas — un onglet resté ouvert, un fetch abandonné —
  bloque tout le reste derrière elle, y compris un tout nouvel onglet. Ça
  ressemble à une régression du dernier correctif alors que c'est le serveur
  de test qui est engorgé. Redémarrer `app.py` avant de conclure à un bug.

Règle générale : l'absence d'erreur ne prouve rien. Relire ce qui a été produit
avec un outil indépendant de celui qui l'a produit.

Fournis le code complet des fichiers du §1, prêt à être posé dans un dossier.
