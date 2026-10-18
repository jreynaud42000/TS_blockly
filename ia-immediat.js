// ia-immediat.js — apprentissage IMMEDIAT (sans entrainement) et lecture des QR codes.
//
// Complete ia.js (Teachable Machine) sans le modifier en profondeur : les resultats
// passent par les memes fonctions (window.iaNoyau), donc par les memes blocs IA
// (genre "vision") et la meme ligne envoyee au programme :
//     IA:vision:<classe>:<confiance>\n      IA:qr:<texte>:100\n
//
// 1. Apprentissage immediat (colonne « ⚡ Apprentissage immédiat »)
//    Chaque exemple est resume en une EMPREINTE (des nombres) :
//      - objets et images : MobileNet v3 (MediaPipe Image Embedder), 1024 nombres ;
//      - gestes de la main : les 21 points de la main (MediaPipe Hands), ramenes au
//        poignet et a la taille de la main, main gauche retournee : 63 nombres ;
//      - positions des bras : epaules, coudes, poignets (MediaPipe Pose), ramenes au
//        milieu des epaules et a leur largeur : 12 nombres.
//    Reconnaitre = chercher les K exemples les plus proches : chacun vote pour sa
//    classe (k plus proches voisins). Aucun entrainement : un exemple ajoute compte
//    aussitot. Les votes des LISSAGE dernieres images sont moyennes (confiance moins
//    saccadee qu'un vote sur 5).
//    Exemples : camera (bouton « Maintenir ») ou fichiers .png / .jpg.
//
// 2. QR codes et codes-barres (colonne « 🔳 QR codes ») : ZXing lit l'image de la
//    camera ; le texte (sans accents) part vers le programme. Un code qui n'est plus
//    vu depuis 700 ms n'est plus « visible ». La meme colonne cree un QR code a imprimer.
//
// Sauvegarde : l'apprentissage (les empreintes, JAMAIS les images) est range dans le
// .py telecharge (lignes de commentaire « # >>> apprentissage-ia » a la fin, ignorees
// par MicroPython) et relu a son ouverture ; « 💾 Exporter » / « 📂 Importer » font la
// meme chose dans un fichier .json a part. Il n'est pas mis dans le .hex : la place y
// est comptee et la carte n'en a pas besoin.
//
// Donnees personnelles : l'image reste dans le navigateur ; pour les gestes et les
// positions, seul le squelette est dessine. Aucune requete hors de l'application :
// MediaPipe (lib/mediapipe) et ZXing (lib/zxing) sont embarques.

const MP = 'lib/mediapipe/';
const MAX_CLASSES = 8;
const MAX_EXEMPLES = 150;          // par classe (taille du .py : environ 1,4 Ko par exemple d'image)
const K = 5;
const LISSAGE = 3;
const INTERVALLE_RECO_MS = 150;
const INTERVALLE_CAPTURE_MS = 120;
const INTERVALLE_QR_MS = 200;
const QR_VISIBLE_MS = 700;
const QR_LONGUEUR_MAX = 60;        // un texte plus long est coupe (affichage sur la carte)

const TYPES = {
    images: { nom: 'objets et images', fichier: 'mobilenet_v3_small.tflite' },
    mains: { nom: 'gestes de la main', fichier: 'hand_landmarker.task' },
    bras: { nom: 'positions des bras', fichier: 'pose_landmarker_lite.task' },
};

const $ = (sel, racine = document) => racine.querySelector(sel);
const col = $('.ia-colonne[data-genre="immediat"]');
const colQR = $('.ia-colonne[data-genre="qr"]');
const noyau = () => window.iaNoyau;
const attente = ms => new Promise(r => setTimeout(r, ms));
const messageErreur = e => (e && e.message ? e.message : String(e));

// ---------- etat ----------
const etat = {
    type: 'images',
    classes: [{ nom: 'Classe 1', ex: [] }, { nom: 'Classe 2', ex: [] }],
    enMarche: false, minuteur: null, occupe: false, historique: [],
};

function dire(texte) { const e = $('.ia-statut', col); if (e) e.textContent = texte; }
function direCreer(texte) { const e = $('.ia-creer-statut', col); if (e) e.textContent = texte; }

// ---------- MediaPipe (charge au premier besoin) ----------
let mediapipe = null;
const modeles = {};

// Le navigateur n'importe un module que si le serveur l'annonce comme JavaScript.
// app.py le fait ; pour un autre serveur qui annoncerait text/plain, on relit le
// fichier et on l'importe sous la bonne etiquette (toujours en local).
async function importerModule(adresse) {
    try {
        return await import(adresse);
    } catch (erreur) {
        const r = await fetch(adresse);
        if (!r.ok) throw new Error('bibliothèque introuvable : ' + adresse + ' (' + r.status + ')');
        const url = URL.createObjectURL(new Blob([await r.text()], { type: 'text/javascript' }));
        try { return await import(url); } finally { URL.revokeObjectURL(url); }
    }
}

function chargerMediapipe() {
    if (!mediapipe) {
        const base = new URL(MP, location.href).href;
        mediapipe = (async () => {
            const mp = await importerModule(base + 'vision_bundle.mjs');
            return { mp, fichiers: await mp.FilesetResolver.forVisionTasks(base + 'wasm') };
        })();
        mediapipe.catch(() => { mediapipe = null; });
    }
    return mediapipe;
}

function modele(type) {
    if (!modeles[type]) {
        const base = new URL(MP, location.href).href;
        modeles[type] = chargerMediapipe().then(({ mp, fichiers }) => {
            const options = { baseOptions: { modelAssetPath: base + TYPES[type].fichier, delegate: 'CPU' }, runningMode: 'IMAGE' };
            if (type === 'mains') return mp.HandLandmarker.createFromOptions(fichiers, { ...options, numHands: 1 });
            if (type === 'bras') return mp.PoseLandmarker.createFromOptions(fichiers, { ...options, numPoses: 1 });
            return mp.ImageEmbedder.createFromOptions(fichiers, { ...options, l2Normalize: true, quantize: false });
        });
        modeles[type].catch(() => { delete modeles[type]; });
    }
    return modeles[type];
}

// ---------- empreintes ----------
const LIAISONS_MAIN = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11],
    [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];
const POINTS_BRAS = [11, 12, 13, 14, 15, 16];                    // epaules, coudes, poignets
const LIAISONS_BRAS = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24]];

// Les points de MediaPipe sont en fractions de la largeur et de la hauteur : multiplier x
// par le rapport largeur / hauteur rend les distances comparables dans les deux sens.
function formeMain(points, gauche, rapport) {
    const o = points[0];
    const sens = gauche ? -1 : 1;                                 // main gauche vue comme une droite
    const p = points.map(q => [(q.x - o.x) * rapport * sens, q.y - o.y, (q.z - o.z) * rapport]);
    const taille = Math.max(...p.map(([x, y]) => Math.hypot(x, y))) || 1;
    return Float32Array.from(p.flatMap(([x, y, z]) => [x / taille, y / taille, z / taille]));
}

// Pas de retournement ici : « bras gauche leve » et « bras droit leve » restent differents.
function formeBras(points, rapport) {
    const g = points[11], d = points[12];
    const cx = (g.x + d.x) / 2, cy = (g.y + d.y) / 2;
    const largeur = Math.hypot((g.x - d.x) * rapport, g.y - d.y) || 1;
    return Float32Array.from(POINTS_BRAS.flatMap(i => [(points[i].x - cx) * rapport / largeur, (points[i].y - cy) / largeur]));
}

// Une image (video, toile, ImageBitmap) -> { v, points, liaisons } ou null si rien d'utilisable.
async function empreinte(source, largeur, hauteur) {
    const m = await modele(etat.type);
    const rapport = largeur / hauteur;
    if (etat.type === 'mains') {
        const r = m.detect(source);
        if (!r.landmarks || !r.landmarks.length) return null;
        const cote = r.handedness && r.handedness[0] && r.handedness[0][0];
        return { v: formeMain(r.landmarks[0], !!cote && cote.categoryName === 'Left', rapport), points: r.landmarks[0], liaisons: LIAISONS_MAIN };
    }
    if (etat.type === 'bras') {
        const r = m.detect(source);
        const p = r.landmarks && r.landmarks[0];
        if (!p || (p[11].visibility || 0) < 0.5 || (p[12].visibility || 0) < 0.5) return null;   // les deux epaules
        return { v: formeBras(p, rapport), points: p, liaisons: LIAISONS_BRAS };
    }
    const r = m.embed(source);
    return { v: Float32Array.from(r.embeddings[0].floatEmbedding), points: null, liaisons: null };
}

// Plus grand = plus ressemblant. Images : empreintes de longueur 1, le produit scalaire
// est le cosinus. Squelettes : moins le carre de la distance.
function proximite(a, b) {
    let s = 0;
    if (etat.type === 'images') { for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }
    for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
    return -s;
}

// K plus proches voisins : part des votes de chaque classe (0..1), ou null s'il manque des exemples.
function voter(v) {
    if (etat.classes.filter(c => c.ex.length).length < 2) return null;
    const voisins = [];
    etat.classes.forEach((c, i) => c.ex.forEach(e => voisins.push([proximite(v, e), i])));
    voisins.sort((a, b) => b[0] - a[0]);
    const k = Math.min(K, voisins.length);
    const voix = etat.classes.map(() => 0);
    for (let i = 0; i < k; i++) voix[voisins[i][1]] += 1 / k;
    return voix;
}

// ---------- camera et apercu ----------
const video = $('.ia-imm-video', col);
const calque = $('.ia-imm-calque', col);

function brancherApercu(element, allumer) {
    const flux = noyau().camera.flux;
    element.srcObject = allumer ? flux : null;
    element.closest('.ia-imm-cadre').classList.toggle('replie', !allumer);
    if (allumer) element.play().catch(() => {});
}

// Garde un cadre aux proportions de la video : le squelette se superpose exactement.
function ajusterCadre(element) {
    if (!element.videoWidth) return;
    const cadre = element.closest('.ia-imm-cadre');
    cadre.style.height = Math.round(cadre.clientWidth * element.videoHeight / element.videoWidth) + 'px';
}

async function allumerCamera(raison) {
    await noyau().ouvrirCamera(raison);
    brancherApercu(video, true);
}

function eteindreCamera(raison) {
    noyau().fermerCamera(raison);
    const encore = noyau().camera.raisons;
    if (!encore.has('imm-capture') && !encore.has('imm-reco')) { brancherApercu(video, false); effacerCalque(); }
}

function effacerCalque() { calque.getContext('2d').clearRect(0, 0, calque.width, calque.height); }

function dessinerSquelette(resultat) {
    calque.width = calque.clientWidth; calque.height = calque.clientHeight;
    const ctx = calque.getContext('2d');
    ctx.clearRect(0, 0, calque.width, calque.height);
    if (!resultat || !resultat.points) return;
    const p = resultat.points, l = calque.width, h = calque.height;
    ctx.strokeStyle = '#2ecc71'; ctx.fillStyle = '#ffffff'; ctx.lineWidth = 2;
    for (const [a, b] of resultat.liaisons) {
        if (!p[a] || !p[b]) continue;
        ctx.beginPath(); ctx.moveTo(p[a].x * l, p[a].y * h); ctx.lineTo(p[b].x * l, p[b].y * h); ctx.stroke();
    }
    const utiles = etat.type === 'bras' ? [11, 12, 13, 14, 15, 16, 23, 24] : p.map((_, i) => i);
    for (const i of utiles) { if (p[i]) { ctx.beginPath(); ctx.arc(p[i].x * l, p[i].y * h, 2.5, 0, 2 * Math.PI); ctx.fill(); } }
}

// ---------- classes (interface) ----------
function nomsClasses() { return etat.classes.map(c => c.nom.trim()).filter(Boolean); }

// Renommer une classe met a jour les blocs IA (vision) qui l'utilisaient.
function renommerDansLesBlocs(ancien, nouveau) {
    const ws = window.workspace;
    if (!ws || !window.slugIA || !ancien || !nouveau || window.slugIA(ancien) === window.slugIA(nouveau)) return;
    const cle = window.slugIA(ancien);
    Blockly.Events.setGroup(true);
    try {
        for (const b of ws.getAllBlocks(false)) {
            if ((b.type === 'ia_lorsque_reconnu' || b.type === 'ia_classe_est') &&
                b.getFieldValue('TYPE') === 'vision' && window.slugIA(b.getFieldValue('CLASSE')) === cle) {
                b.setFieldValue(nouveau, 'CLASSE');
            }
        }
    } finally {
        Blockly.Events.setGroup(false);
    }
}

function majLignes() {
    const conteneur = $('.ia-creer-classes', col);
    conteneur.textContent = '';
    etat.classes.forEach((c, i) => {
        const l = document.createElement('div');
        l.className = 'ia-ex ia-imm-ex';
        const nom = document.createElement('input');
        nom.className = 'ia-ex-nom'; nom.value = c.nom; nom.spellcheck = false; nom.maxLength = 30;
        let avant = c.nom;
        nom.addEventListener('input', () => { c.nom = nom.value; });
        nom.addEventListener('change', () => {
            const propre = nom.value.trim();
            if (!propre || etat.classes.some((x, j) => j !== i && window.slugIA(x.nom) === window.slugIA(propre))) {
                direCreer(propre ? 'Deux classes portent le même nom.' : 'Chaque classe doit avoir un nom.');
                c.nom = nom.value = avant;
                return;
            }
            c.nom = nom.value = propre;
            renommerDansLesBlocs(avant, propre);
            avant = propre;
            majBarres();
        });
        const n = document.createElement('span'); n.className = 'ia-ex-n'; n.textContent = String(c.ex.length);
        const capt = document.createElement('button');
        capt.className = 'btn-vue ia-ex-capt'; capt.textContent = 'Maintenir';
        capt.title = 'Maintenir enfoncé pour ajouter des exemples pris par la caméra';
        brancherCapture(capt, c, n);
        const fichiers = document.createElement('button');
        fichiers.className = 'btn-vue ia-imm-images'; fichiers.textContent = '🖼'; fichiers.title = 'Ajouter des exemples depuis des images (.png, .jpg)';
        fichiers.addEventListener('click', () => { entreeImages.dataset.classe = String(i); entreeImages.click(); });
        const sup = document.createElement('button');
        sup.className = 'btn-vue ia-ex-sup'; sup.textContent = '🗑'; sup.title = 'Supprimer cette classe et ses exemples';
        sup.addEventListener('click', () => { etat.classes.splice(i, 1); apresModification(); });
        l.append(nom, n, capt, fichiers, sup);
        conteneur.appendChild(l);
    });
    $('.ia-ajouter-classe', col).disabled = etat.classes.length >= MAX_CLASSES;
}

// Barres de resultat : meme balisage que les colonnes Teachable Machine (ia.js).
function majBarres() {
    const conteneur = $('.ia-classes', col);
    conteneur.textContent = '';
    for (const c of etat.classes) {
        const l = document.createElement('div');
        l.className = 'ia-classe';
        const n = document.createElement('span'); n.className = 'ia-classe-nom'; n.textContent = c.nom; n.title = c.nom;
        const b = document.createElement('span'); b.className = 'ia-classe-barre'; b.appendChild(document.createElement('i'));
        const p = document.createElement('span'); p.className = 'ia-classe-pct'; p.textContent = '0 %';
        l.append(n, b, p);
        conteneur.appendChild(l);
    }
}

function majDemarrer() {
    const b = $('.ia-demarrer', col);
    b.textContent = etat.enMarche ? '■ Arrêter' : '▶ Démarrer';
    b.classList.toggle('en-marche', etat.enMarche);
    b.disabled = !etat.enMarche && etat.classes.filter(c => c.ex.length).length < 2;
}

function apresModification() {
    etat.historique = [];
    majLignes();
    majBarres();
    majDemarrer();
}

// ---------- ajout d'exemples ----------
function ajouterExemple(c, v) {
    if (c.ex.length >= MAX_EXEMPLES) return false;
    c.ex.push(v);
    return true;
}

const MESSAGE_RIEN = {
    mains: 'Aucune main détectée : montrez une seule main, bien éclairée.',
    bras: 'Épaules non visibles : reculez pour que le haut du corps soit dans l\'image.',
    images: '',
};

function brancherCapture(bouton, c, compteur) {
    let appuye = false;
    const arret = () => { appuye = false; bouton.classList.remove('enregistre'); majDemarrer(); };
    bouton.addEventListener('pointerdown', async evenement => {
        evenement.preventDefault();
        if (appuye) return;
        if (!noyau().camera.flux || video.readyState < 2) { direCreer('Allumez d\'abord la caméra (bouton 📷 Caméra).'); return; }
        appuye = true;
        bouton.classList.add('enregistre');
        try { bouton.setPointerCapture(evenement.pointerId); } catch (erreur) { /* pas grave */ }
        direCreer('Chargement du modèle « ' + TYPES[etat.type].nom + ' »…');
        try {
            await modele(etat.type);
            direCreer('Capture en cours…');
            while (appuye) {
                const r = await empreinte(video, video.videoWidth, video.videoHeight);
                dessinerSquelette(r);
                if (!r) direCreer(MESSAGE_RIEN[etat.type] || 'Image inutilisable.');
                else if (!ajouterExemple(c, r.v)) { direCreer('Maximum atteint : ' + MAX_EXEMPLES + ' exemples par classe.'); break; }
                else direCreer('Exemple ajouté à « ' + c.nom + ' » (' + c.ex.length + ').');
                compteur.textContent = String(c.ex.length);
                await attente(INTERVALLE_CAPTURE_MS);
            }
        } catch (erreur) {
            direCreer('Capture impossible : ' + messageErreur(erreur));
        }
        arret();
    });
    bouton.addEventListener('pointerup', arret);
    bouton.addEventListener('pointercancel', arret);
    bouton.addEventListener('lostpointercapture', arret);
}

const entreeImages = $('.ia-imm-fichiers', col);
const toileImage = document.createElement('canvas');

async function ajouterImages(c, fichiers) {
    direCreer('Chargement du modèle « ' + TYPES[etat.type].nom + ' »…');
    let ajoutes = 0, rejetes = 0;
    try {
        await modele(etat.type);
        for (const f of fichiers) {
            let image = null;
            try {
                image = await createImageBitmap(f);
                toileImage.width = image.width; toileImage.height = image.height;
                toileImage.getContext('2d').drawImage(image, 0, 0);
                const r = await empreinte(toileImage, image.width, image.height);
                if (r && ajouterExemple(c, r.v)) ajoutes++; else rejetes++;
            } catch (erreur) {
                rejetes++;
            } finally {
                if (image && image.close) image.close();
            }
            direCreer('Images : ' + ajoutes + ' ajoutée(s)…');
        }
        direCreer(ajoutes + ' image(s) ajoutée(s) à « ' + c.nom + ' »' +
            (rejetes ? ', ' + rejetes + ' refusée(s) (' + (MESSAGE_RIEN[etat.type] || 'illisible ou maximum atteint') + ')' : '') + '.');
    } catch (erreur) {
        direCreer('Chargement impossible : ' + messageErreur(erreur));
    }
    apresModification();
}

entreeImages.addEventListener('change', () => {
    const c = etat.classes[Number(entreeImages.dataset.classe)];
    const fichiers = Array.from(entreeImages.files);
    entreeImages.value = '';
    if (c && fichiers.length) ajouterImages(c, fichiers);
});

// ---------- reconnaissance ----------
async function demarrer() {
    if (etat.enMarche) return;
    if (etat.classes.filter(c => c.ex.length).length < 2) { dire('Il faut au moins 2 classes avec des exemples.'); return; }
    const noms = nomsClasses();
    if (noms.length !== etat.classes.length || new Set(noms.map(n => window.slugIA(n))).size !== noms.length) {
        dire('Chaque classe doit avoir un nom différent.'); return;
    }
    // Un seul moteur a la fois pour le genre vision : Teachable Machine s'arrete.
    if (noyau().moteurs.vision.enMarche) noyau().arreter('vision');
    dire('Chargement du modèle « ' + TYPES[etat.type].nom + ' »…');
    try {
        await modele(etat.type);
        await allumerCamera('imm-reco');
    } catch (erreur) {
        const refus = erreur && (erreur.name === 'NotAllowedError' || erreur.name === 'SecurityError');
        dire(refus ? 'Accès refusé : autorisez la caméra dans le navigateur.'
            : erreur && erreur.name === 'NotFoundError' ? 'Aucune caméra détectée.' : 'Démarrage impossible : ' + messageErreur(erreur));
        return;
    }
    etat.enMarche = true;
    etat.historique = [];
    majBarres();
    etat.minuteur = setInterval(reconnaitre, INTERVALLE_RECO_MS);
    dire('Reconnaissance en marche (' + TYPES[etat.type].nom + ').');
    majDemarrer();
}

async function reconnaitre() {
    if (etat.occupe || !etat.enMarche || video.readyState < 2) return;
    etat.occupe = true;
    try {
        ajusterCadre(video);
        const r = await empreinte(video, video.videoWidth, video.videoHeight);
        if (!etat.enMarche) return;
        dessinerSquelette(r);
        const voix = r ? voter(r.v) : etat.classes.map(() => 0);
        if (!voix) return;
        etat.historique.push(voix);
        if (etat.historique.length > LISSAGE) etat.historique.shift();
        const moyenne = voix.map((_, i) => etat.historique.reduce((s, h) => s + (h[i] || 0), 0) / etat.historique.length);
        noyau().traiterResultat('vision', etat.classes.map((c, i) => ({ nom: c.nom, proba: moyenne[i] })), col);
    } catch (erreur) {
        dire('Erreur de reconnaissance : ' + messageErreur(erreur));
    } finally {
        etat.occupe = false;
    }
}

function arreter() {
    if (!etat.enMarche) return;
    etat.enMarche = false;
    clearInterval(etat.minuteur); etat.minuteur = null;
    eteindreCamera('imm-reco');
    noyau().liberer('vision');
    dire('Arrêté.');
    majDemarrer();
}

// ---------- sauvegarde ----------
// Images : empreinte de longueur 1, chaque nombre ramene a un octet signe (1 Ko par
// exemple au lieu de 4). Squelettes : peu de nombres, gardes tels quels (Float32).
function octetsVersBase64(octets) {
    let s = '';
    for (let i = 0; i < octets.length; i += 0x8000) s += String.fromCharCode.apply(null, octets.subarray(i, i + 0x8000));
    return btoa(s);
}
function base64VersOctets(texte) {
    const s = atob(texte);
    const u = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return u;
}
function coder(v, type) {
    if (type !== 'images') return octetsVersBase64(new Uint8Array(Float32Array.from(v).buffer));
    return octetsVersBase64(new Uint8Array(Int8Array.from(v, x => Math.max(-127, Math.min(127, Math.round(x * 127)))).buffer));
}
function decoder(texte, type) {
    const u = base64VersOctets(texte);
    if (type !== 'images') return new Float32Array(u.buffer);
    const v = Float32Array.from(new Int8Array(u.buffer), x => x / 127);
    const n = Math.hypot(...v) || 1;
    return v.map(x => x / n);
}

function versDonnees() {
    return {
        format: 'apprentissage-ia-microbit', version: 1, type: etat.type,
        classes: etat.classes.map(c => ({ nom: c.nom, exemples: c.ex.map(v => coder(v, etat.type)) })),
    };
}

function depuisDonnees(d) {
    if (!d || d.format !== 'apprentissage-ia-microbit' || !Array.isArray(d.classes)) throw new Error('ce fichier ne contient pas d\'apprentissage IA');
    const type = TYPES[d.type] ? d.type : 'images';
    const classes = d.classes.slice(0, MAX_CLASSES).map((c, i) => ({
        nom: String(c.nom || ('Classe ' + (i + 1))).slice(0, 30),
        ex: (c.exemples || []).slice(0, MAX_EXEMPLES).map(e => decoder(e, type)),
    }));
    arreter();
    etat.type = type;
    etat.classes = classes.length ? classes : [{ nom: 'Classe 1', ex: [] }, { nom: 'Classe 2', ex: [] }];
    $('.ia-imm-type', col).value = type;
    apresModification();
    const total = etat.classes.reduce((s, c) => s + c.ex.length, 0);
    direCreer('Apprentissage chargé : ' + TYPES[type].nom + ', ' + etat.classes.length + ' classes, ' + total + ' exemples.');
}

const aDesExemples = () => etat.classes.some(c => c.ex.length);

// .py : section de commentaires a la fin, ignoree par MicroPython et par la reconstruction en blocs.
const DEBUT_ANNEXE = '# >>> apprentissage-ia';
const FIN_ANNEXE = '# <<< apprentissage-ia';

// Le JSON (sans retour a la ligne : JSON.stringify les echappe) est coupe en lignes
// de 100 caracteres, chacune precedee de « # » ; la relecture recolle les morceaux.
// Les espaces (seulement dans les noms de classes) sont ecrits   : un editeur qui
// retire les espaces en fin de ligne ne peut pas abimer un nom coupe a cet endroit.
function annexePy() {
    if (!aDesExemples()) return '';
    const texte = JSON.stringify(versDonnees()).replace(/ /g, '\\u0020');
    const lignes = [];
    for (let i = 0; i < texte.length; i += 100) lignes.push('# ' + texte.slice(i, i + 100));
    return '\n' + DEBUT_ANNEXE + ' (exemples du panneau IA, ignore par la carte)\n' + lignes.join('\n') + '\n' + FIN_ANNEXE + '\n';
}

// Renvoie le texte sans l'annexe ; charge l'apprentissage s'il y en a un.
function lireAnnexePy(texte) {
    const motif = /\r?\n?# >>> apprentissage-ia[^\n]*\r?\n([\s\S]*?)# <<< apprentissage-ia[^\n]*\r?\n?/;
    const m = motif.exec(texte);
    if (!m) return texte;
    try {
        const json = m[1].split(/\r?\n/).filter(l => l.startsWith('# ')).map(l => l.slice(2)).join('');
        depuisDonnees(JSON.parse(json));
    } catch (erreur) {
        direCreer('Apprentissage du fichier illisible : ' + messageErreur(erreur));
    }
    return texte.replace(motif, '\n');
}

function exporter() {
    if (!aDesExemples()) { direCreer('Rien à exporter : ajoutez d\'abord des exemples.'); return; }
    const nom = (($('#nom-fichier') && $('#nom-fichier').value.trim()) || 'programme') + '-apprentissage-ia.json';
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(new Blob([JSON.stringify(versDonnees())], { type: 'application/json' }));
    lien.download = nom;
    document.body.appendChild(lien); lien.click(); lien.remove();
    setTimeout(() => URL.revokeObjectURL(lien.href), 10000);
    direCreer('Fichier téléchargé : ' + nom + '.');
}

const entreeImport = $('.ia-imm-import-fichier', col);
entreeImport.addEventListener('change', async () => {
    const f = entreeImport.files[0];
    entreeImport.value = '';
    if (!f) return;
    try { depuisDonnees(JSON.parse(await f.text())); } catch (erreur) { direCreer('Import impossible : ' + messageErreur(erreur)); }
});

// ---------- branchement de l'interface ----------
$('.ia-imm-type', col).addEventListener('change', evenement => {
    const nouveau = evenement.target.value;
    if (aDesExemples() && !confirm('Changer de type efface les exemples de toutes les classes. Continuer ?')) {
        evenement.target.value = etat.type; return;
    }
    arreter();
    etat.type = nouveau;
    etat.classes.forEach(c => { c.ex = []; });
    apresModification();
    direCreer('Type : ' + TYPES[nouveau].nom + '. Ajoutez des exemples à chaque classe.');
});
$('.ia-imm-camera', col).addEventListener('click', async evenement => {
    const bouton = evenement.currentTarget;
    try {
        if (noyau().camera.raisons.has('imm-capture')) eteindreCamera('imm-capture');
        else { await allumerCamera('imm-capture'); modele(etat.type).catch(() => {}); }
    } catch (erreur) {
        direCreer(erreur && erreur.name === 'NotAllowedError' ? 'Accès refusé : autorisez la caméra dans le navigateur.' : 'Caméra impossible : ' + messageErreur(erreur));
    }
    const allumee = noyau().camera.raisons.has('imm-capture');
    bouton.classList.toggle('en-marche', allumee);
    bouton.textContent = allumee ? '📷 Éteindre' : '📷 Caméra';
});
video.addEventListener('loadedmetadata', () => ajusterCadre(video));
$('.ia-ajouter-classe', col).addEventListener('click', () => {
    if (etat.classes.length >= MAX_CLASSES) return;
    let n = etat.classes.length + 1;
    while (etat.classes.some(c => window.slugIA(c.nom) === window.slugIA('Classe ' + n))) n++;
    etat.classes.push({ nom: 'Classe ' + n, ex: [] });
    apresModification();
});
$('.ia-tout-effacer', col).addEventListener('click', () => {
    if (aDesExemples() && !confirm('Supprimer toutes les classes et leurs exemples ?')) return;
    arreter();
    etat.classes = [{ nom: 'Classe 1', ex: [] }, { nom: 'Classe 2', ex: [] }];
    apresModification();
    direCreer('Exemples effacés.');
});
$('.ia-demarrer', col).addEventListener('click', () => (etat.enMarche ? arreter() : demarrer()));
$('.ia-imm-exporter', col).addEventListener('click', exporter);
$('.ia-imm-importer', col).addEventListener('click', () => entreeImport.click());
apresModification();

// =====================================================================
// QR codes et codes-barres (ZXing, lib/zxing)
// =====================================================================
const qr = { enMarche: false, minuteur: null, lecteur: null, vuA: 0, texte: '', toile: document.createElement('canvas') };
const videoQR = $('.ia-imm-video', colQR);

function direQR(texte) { const e = $('.ia-statut', colQR); if (e) e.textContent = texte; }

let zxing = null;
function chargerZxing() {
    if (window.ZXing) return Promise.resolve(window.ZXing);
    if (!zxing) {
        zxing = new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'lib/zxing/zxing-0.21.3.min.js';
            s.onload = () => resolve(window.ZXing);
            s.onerror = () => { zxing = null; reject(new Error('bibliothèque introuvable : lib/zxing/zxing-0.21.3.min.js')); };
            document.head.appendChild(s);
        });
    }
    return zxing;
}

// La carte affiche mal les accents et un « : » est le separateur de la ligne IA
// (le pilote recolle les morceaux, mais autant rester simple) : texte ASCII seulement.
function texteCarte(t) {
    return String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '?')
        .trim().slice(0, QR_LONGUEUR_MAX);
}

function lecteurQR(Z) {
    if (!qr.lecteur) {
        const indices = new Map();
        indices.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.QR_CODE, Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8,
            Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E, Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.CODE_39, Z.BarcodeFormat.DATA_MATRIX]);
        indices.set(Z.DecodeHintType.TRY_HARDER, true);
        qr.lecteur = new Z.MultiFormatReader();
        qr.lecteur.setHints(indices);
    }
    return qr.lecteur;
}

// Lit un code dans une toile ; renvoie le texte ou null (cas normal : aucun code sur l'image).
function decoderToile(Z, toile) {
    const L = lecteurQR(Z);
    try {
        return L.decode(new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(toile)))).getText();
    } catch (erreur) {
        return null;
    } finally {
        L.reset();
    }
}

function signalerQR(texte) {
    const d = noyau().dernierEnvoi.qr;
    if (texte !== d.classe) {
        d.classe = texte; d.confiance = texte ? 100 : 0; d.instant = Date.now();
        noyau().envoyer('qr', texte, d.confiance);
    }
    $('.ia-qr-texte', colQR).textContent = qr.texte ? 'Dernier code lu : ' + qr.texte : '';
    $('.ia-qr-texte', colQR).classList.toggle('vu', !!texte);
}

function lireQR() {
    if (!qr.enMarche || videoQR.readyState < 2 || !videoQR.videoWidth) return;
    ajusterCadre(videoQR);
    qr.toile.width = videoQR.videoWidth; qr.toile.height = videoQR.videoHeight;
    qr.toile.getContext('2d', { willReadFrequently: true }).drawImage(videoQR, 0, 0);
    const brut = decoderToile(window.ZXing, qr.toile);
    if (brut !== null) { qr.vuA = performance.now(); qr.texte = texteCarte(brut); }
    signalerQR(performance.now() - qr.vuA < QR_VISIBLE_MS ? qr.texte : '');
}

async function demarrerQR() {
    direQR('Chargement…');
    try {
        await chargerZxing();
        await noyau().ouvrirCamera('imm-qr');
    } catch (erreur) {
        direQR(erreur && erreur.name === 'NotAllowedError' ? 'Accès refusé : autorisez la caméra dans le navigateur.' : 'Démarrage impossible : ' + messageErreur(erreur));
        return;
    }
    brancherApercu(videoQR, true);
    qr.enMarche = true; qr.vuA = 0;
    qr.minuteur = setInterval(lireQR, INTERVALLE_QR_MS);
    signalerQR('');
    direQR('Montrez un QR code ou un code-barres à la caméra.');
    majQR();
}

function arreterQR() {
    if (!qr.enMarche) return;
    qr.enMarche = false;
    clearInterval(qr.minuteur); qr.minuteur = null;
    noyau().fermerCamera('imm-qr');
    brancherApercu(videoQR, false);
    noyau().liberer('qr');
    $('.ia-qr-texte', colQR).classList.remove('vu');
    direQR('Arrêté.');
    majQR();
}

function majQR() {
    const b = $('.ia-demarrer', colQR);
    b.textContent = qr.enMarche ? '■ Arrêter' : '▶ Lire les codes';
    b.classList.toggle('en-marche', qr.enMarche);
}

// --- creer un QR code a imprimer (memes bibliotheques, rien ne sort du navigateur) ---
async function creerQR() {
    const texte = $('.ia-qr-a-creer', colQR).value.trim();
    const toile = $('.ia-qr-image', colQR);
    if (!texte) { direQR('Écrivez d\'abord le texte du QR code.'); return; }
    try {
        const Z = await chargerZxing();
        const indices = new Map([[Z.EncodeHintType.MARGIN, 2], [Z.EncodeHintType.CHARACTER_SET, 'UTF-8']]);
        const matrice = new Z.QRCodeWriter().encode(texte, Z.BarcodeFormat.QR_CODE, 0, 0, indices);
        const n = matrice.getWidth(), pas = Math.max(4, Math.floor(240 / n));
        toile.width = toile.height = n * pas;
        const ctx = toile.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, toile.width, toile.height);
        ctx.fillStyle = '#000000';
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (matrice.get(x, y)) ctx.fillRect(x * pas, y * pas, pas, pas);
        toile.classList.remove('replie');
        $('.ia-qr-telecharger', colQR).disabled = false;
        direQR('QR code créé : téléchargez-le pour l\'imprimer.');
    } catch (erreur) {
        direQR('Création impossible : ' + messageErreur(erreur));
    }
}

function telechargerQR() {
    const toile = $('.ia-qr-image', colQR);
    const nom = 'qr-' + (texteCarte($('.ia-qr-a-creer', colQR).value).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'code') + '.png';
    toile.toBlob(blob => {
        const lien = document.createElement('a');
        lien.href = URL.createObjectURL(blob); lien.download = nom;
        document.body.appendChild(lien); lien.click(); lien.remove();
        setTimeout(() => URL.revokeObjectURL(lien.href), 10000);
    }, 'image/png');
}

$('.ia-demarrer', colQR).addEventListener('click', () => (qr.enMarche ? arreterQR() : demarrerQR()));
videoQR.addEventListener('loadedmetadata', () => ajusterCadre(videoQR));
$('.ia-qr-creer', colQR).addEventListener('click', creerQR);
$('.ia-qr-a-creer', colQR).addEventListener('keydown', e => { if (e.key === 'Enter') creerQR(); });
$('.ia-qr-telecharger', colQR).addEventListener('click', telechargerQR);

// Camera coupee a la fermeture de la page, comme dans ia.js.
window.addEventListener('pagehide', () => { arreter(); arreterQR(); });

window.iaImmediat = {
    arreter,
    classes: nomsClasses,
    annexePy,
    lireAnnexePy,
    // Pour les verifications depuis la console (pas d'usage dans l'application).
    test: { etat, qr, TYPES, empreinte, voter, proximite, coder, decoder, versDonnees, depuisDonnees, ajouterImages,
            formeMain, formeBras, modele, chargerZxing, decoderToile, texteCarte, signalerQR, demarrer, demarrerQR, arreterQR,
            renommerDansLesBlocs, reconnaitre },
};
