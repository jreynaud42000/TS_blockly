// ia.js — reconnaissance d'images (camera) et de sons (micro) avec des modeles
// Teachable Machine. Le navigateur reconnait ; seul le NOM de la classe part
// vers le programme, sous forme d'une ligne de texte :
//
//     IA:<vision|son>:<classe>:<confiance 0-100>\n
//
// - simulateur : ligne poussee dans le faux uart (window.simu_uartPousser, un.js) ;
// - vraie carte : ecrite sur le port serie de la console (window.ecrireSerie, un.js).
// Le programme MicroPython (pilote "ia", genere par les blocs IA) la decode : le
// meme code tourne donc dans le simulateur et sur la carte.
//
// Bibliotheques (lib/tm/, embarquees dans l'exe, donc hors connexion) chargees
// seulement au premier besoin : tf.min.js (TensorFlow.js 1.3.1),
// teachablemachine-image.min.js, speech-commands.min.js.
//
// Le dernier resultat de chaque genre est RENVOYE toutes les 500 ms (RAPPEL_MS) :
// une ligne perdue sur le cable ne laisse plus la carte bloquee sur une ancienne
// classe, et le pilote de la carte oublie un resultat de plus de 1,5 s (navigateur
// ferme, cable debranche). L'apprentissage immediat et les QR codes (ia-immediat.js)
// passent par les memes fonctions, exposees dans window.iaNoyau.

const DOSSIER_LIB = 'lib/tm/';
const INTERVALLE_VISION_MS = 120;
const ECART_CONFIANCE = 10;        // renvoyer la confiance si elle varie d'au moins 10 points...
const DELAI_CONFIANCE_MS = 500;    // ...et pas plus d'une fois par demi-seconde
const RAPPEL_MS = 500;             // renvoi du dernier resultat, meme inchange

const $ = (sel, racine = document) => racine.querySelector(sel);

const panneau = $('#ia-panneau');
const curseurSeuil = $('#ia-seuil');
const valeurSeuil = $('#ia-seuil-val');
const caseCarte = $('#ia-vers-carte');
const etatCarte = $('#ia-etat-carte');

// ---------- chargement paresseux des bibliotheques ----------
const scriptsCharges = {};
function chargerScript(nom) {
    if (!scriptsCharges[nom]) {
        scriptsCharges[nom] = new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = DOSSIER_LIB + nom;
            s.onload = () => resolve();
            s.onerror = () => { delete scriptsCharges[nom]; reject(new Error('bibliothèque introuvable : ' + nom)); };
            document.head.appendChild(s);
        });
    }
    return scriptsCharges[nom];
}
async function chargerBibliotheque(genre) {
    await chargerScript('tf.min.js');
    await chargerScript(genre === 'vision' ? 'teachablemachine-image.min.js' : 'speech-commands.min.js');
}

// ---------- etat ----------
const seuil = () => (curseurSeuil ? Number(curseurSeuil.value) : 80);

const moteurs = {
    vision: { modele: null, classes: [], enMarche: false, flux: null, minuteur: null, occupe: false },
    son:    { modele: null, classes: [], enMarche: false, flux: null, reconnaisseur: null },
};
// classe === null : rien en cours pour ce genre (pas de renvoi periodique).
// Le genre "qr" (texte du dernier QR code, ia-immediat.js) n'a pas de moteur ici.
const dernierEnvoi = {
    vision: { classe: null, confiance: -1, instant: 0 },
    son:    { classe: null, confiance: -1, instant: 0 },
    qr:     { classe: null, confiance: -1, instant: 0 },
};
const colonne = genre => $('.ia-colonne[data-genre="' + genre + '"]');

function dire(genre, texte) { const e = $('.ia-statut', colonne(genre)); if (e) e.textContent = texte; }

// ---------- envoi vers le programme ----------
function slug(nom) {
    return typeof window.slugIA === 'function' ? window.slugIA(nom) : String(nom);
}

function majEtatCarte() {
    if (!etatCarte) return;
    if (!caseCarte || !caseCarte.checked) { etatCarte.textContent = ''; return; }
    etatCarte.textContent = window.carteConnectee && window.carteConnectee()
        ? 'Carte connectée : les résultats lui sont envoyés.'
        : 'Aucune carte connectée : utilisez « Connecter » dans la console.';
}

// Une ligne par changement de classe, plus un rappel de la confiance quand elle bouge.
// Le texte d'un QR code part tel quel (deja nettoye par ia-immediat.js) : ce n'est pas un nom de classe.
async function envoyer(genre, classe, confiance) {
    const ligne = 'IA:' + genre + ':' + (classe ? (genre === 'qr' ? classe : slug(classe)) : '') + ':' + confiance + '\n';
    if (typeof window.simu_uartPousser === 'function') window.simu_uartPousser(ligne);
    if (caseCarte && caseCarte.checked && typeof window.ecrireSerie === 'function') {
        await window.ecrireSerie(ligne);
    }
    majEtatCarte();
    return ligne;
}

// Point d'entree commun (camera, micro, et tests) : probas = [{nom, proba 0..1}, ...]
// col : colonne dont les barres sont mises a jour (l'apprentissage immediat a la sienne).
function traiterResultat(genre, probas, col = colonne(genre)) {
    let meilleur = null;
    for (const p of probas) if (!meilleur || p.proba > meilleur.proba) meilleur = p;
    const confiance = meilleur ? Math.round(meilleur.proba * 100) : 0;
    const retenue = meilleur && confiance >= seuil() ? meilleur.nom : '';

    if (col) {
        const lignes = $('.ia-classes', col).children;
        probas.forEach((p, i) => {
            const l = lignes[i];
            if (!l) return;
            $('.ia-classe-barre > i', l).style.width = Math.round(p.proba * 100) + '%';
            $('.ia-classe-pct', l).textContent = Math.round(p.proba * 100) + ' %';
            l.classList.toggle('retenue', retenue !== '' && p.nom === retenue);
        });
    }

    const d = dernierEnvoi[genre];
    const maintenant = Date.now();
    const classeChangee = retenue !== d.classe;
    const confianceBouge = retenue !== '' && Math.abs(confiance - d.confiance) >= ECART_CONFIANCE &&
        maintenant - d.instant >= DELAI_CONFIANCE_MS;
    if (classeChangee || confianceBouge) {
        d.classe = retenue;
        d.confiance = retenue ? confiance : 0;
        d.instant = maintenant;
        return envoyer(genre, retenue, d.confiance);
    }
    return null;
}

// Renvoi periodique du dernier resultat de chaque genre en cours (voir RAPPEL_MS).
setInterval(() => {
    const maintenant = Date.now();
    for (const genre of Object.keys(dernierEnvoi)) {
        const d = dernierEnvoi[genre];
        if (d.classe === null || maintenant - d.instant < RAPPEL_MS) continue;
        d.instant = maintenant;
        envoyer(genre, d.classe, d.confiance);
    }
}, 100);

// Plus rien n'est reconnu pour ce genre : le programme repart d'une classe vide,
// et le renvoi periodique s'arrete.
function liberer(genre) {
    const enCours = dernierEnvoi[genre].classe !== null;
    dernierEnvoi[genre] = { classe: null, confiance: -1, instant: 0 };
    if (!enCours) return;
    const ligne = 'IA:' + genre + '::0\n';
    if (typeof window.simu_uartPousser === 'function') window.simu_uartPousser(ligne);
    if (caseCarte && caseCarte.checked && typeof window.ecrireSerie === 'function') window.ecrireSerie(ligne);
}

function afficherClasses(genre, noms) {
    const conteneur = $('.ia-classes', colonne(genre));
    conteneur.textContent = '';
    for (const nom of noms) {
        const l = document.createElement('div');
        l.className = 'ia-classe';
        const n = document.createElement('span'); n.className = 'ia-classe-nom'; n.textContent = nom; n.title = nom;
        const b = document.createElement('span'); b.className = 'ia-classe-barre'; b.appendChild(document.createElement('i'));
        const p = document.createElement('span'); p.className = 'ia-classe-pct'; p.textContent = '0 %';
        l.append(n, b, p);
        conteneur.appendChild(l);
    }
}

// ---------- chargement des modeles ----------
function racineModele(adresse) {
    let a = adresse.trim();
    if (!a) throw new Error('Collez d\'abord l\'adresse du modèle.');
    if (!/^https?:\/\//i.test(a)) throw new Error('L\'adresse doit commencer par https://');
    a = a.replace(/[?#].*$/, '').replace(/(model|metadata)\.json$/i, '');
    return a.endsWith('/') ? a : a + '/';
}

// 3 fichiers choisis d'un coup : metadata*.json, autre .json = modele, .bin = poids.
function trierFichiers(fichiers) {
    const f = { modele: null, metadata: null, poids: null };
    for (const x of fichiers) {
        const nom = x.name.toLowerCase();
        if (nom.endsWith('.bin')) f.poids = x;
        else if (nom.endsWith('.json') && nom.includes('metadata')) f.metadata = x;
        else if (nom.endsWith('.json')) f.modele = x;
    }
    if (!f.modele || !f.metadata || !f.poids) {
        throw new Error('Sélectionnez les 3 fichiers à la fois : model.json, metadata.json et weights.bin.');
    }
    return f;
}

async function chargerModele(genre, source) {
    arreter(genre);
    const m = moteurs[genre];
    m.modele = null; m.reconnaisseur = null; m.classes = [];
    colonne(genre).querySelector('.ia-demarrer').disabled = true;
    dire(genre, 'Chargement des bibliothèques…');
    try {
        await chargerBibliotheque(genre);
        dire(genre, 'Chargement du modèle…');
        if (genre === 'vision') {
            if (source.fichiers) {
                const f = trierFichiers(source.fichiers);
                m.modele = await window.tmImage.loadFromFiles(f.modele, f.poids, f.metadata);
            } else {
                const r = racineModele(source.adresse);
                m.modele = await window.tmImage.load(r + 'model.json', r + 'metadata.json');
            }
            m.classes = m.modele.getClassLabels();
        } else {
            let modeleArt, meta;
            if (source.fichiers) {
                const f = trierFichiers(source.fichiers);
                const json = JSON.parse(await f.modele.text());
                const manifeste = json.weightsManifest || [];
                modeleArt = {
                    modelTopology: json.modelTopology,
                    weightSpecs: manifeste.reduce((acc, e) => acc.concat(e.weights), []),
                    weightData: await f.poids.arrayBuffer(),
                };
                meta = JSON.parse(await f.metadata.text());
            } else {
                const r = racineModele(source.adresse);
                modeleArt = r + 'model.json';
                meta = r + 'metadata.json';
            }
            m.reconnaisseur = window.speechCommands.create('BROWSER_FFT', undefined, modeleArt, meta);
            await m.reconnaisseur.ensureModelLoaded();
            m.classes = m.reconnaisseur.wordLabels();
        }
        afficherClasses(genre, m.classes);
        colonne(genre).querySelector('.ia-demarrer').disabled = false;
        dire(genre, 'Modèle chargé : ' + m.classes.length + ' classes. Cliquez « Démarrer ».');
        if (source.adresse) memoriser(genre, source.adresse);
    } catch (erreur) {
        dire(genre, 'Chargement impossible : ' + (erreur && erreur.message ? erreur.message : erreur));
    }
}

// ---------- camera ----------
// Le flux est partage : la reconnaissance ("reco") et la capture d'exemples
// ("capture") peuvent chacune le demander ; il s'eteint quand plus personne n'en a besoin.
const camera = { flux: null, raisons: new Set() };

// L'apercu de la colonne Vision ne s'affiche que pour SES usages ("reco", "capture") :
// l'apprentissage immediat et les QR codes ont leur propre apercu (raisons commencant par "imm").
function majApercuVision() {
    const video = $('#ia-video');
    if (video) video.classList.toggle('replie', !camera.flux || ![...camera.raisons].some(r => !r.startsWith('imm')));
}

async function ouvrirCamera(raison) {
    const video = $('#ia-video');
    if (!camera.flux) {
        camera.flux = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        video.srcObject = camera.flux;
        await video.play().catch(() => {});
    }
    camera.raisons.add(raison);
    majApercuVision();
}

function fermerCamera(raison) {
    if (raison) camera.raisons.delete(raison); else camera.raisons.clear();
    majApercuVision();
    if (camera.raisons.size) return;
    if (camera.flux) { camera.flux.getTracks().forEach(t => t.stop()); camera.flux = null; }
    const video = $('#ia-video');
    if (video) { video.srcObject = null; video.classList.add('replie'); }
}

async function demarrerVision() {
    const m = moteurs.vision;
    const video = $('#ia-video');
    await ouvrirCamera('reco');
    m.enMarche = true;
    m.minuteur = setInterval(async () => {
        if (m.occupe || !m.enMarche || video.readyState < 2) return;
        m.occupe = true;
        try {
            const sortie = await m.modele.predict(video);
            if (m.enMarche) {
                traiterResultat('vision', sortie.map(s => ({ nom: s.className, proba: s.probability })));
            }
        } catch (erreur) {
            dire('vision', 'Erreur de reconnaissance : ' + erreur.message);
        } finally {
            m.occupe = false;
        }
    }, INTERVALLE_VISION_MS);
}

function arreterVision() {
    const m = moteurs.vision;
    m.enMarche = false;
    if (m.minuteur) { clearInterval(m.minuteur); m.minuteur = null; }
    fermerCamera('reco');
}

// ---------- micro ----------
async function demarrerSon() {
    const m = moteurs.son;
    m.enMarche = true;
    await m.reconnaisseur.listen(resultat => {
        if (!m.enMarche) return;
        const scores = Array.from(resultat.scores);
        traiterResultat('son', m.classes.map((nom, i) => ({ nom, proba: scores[i] || 0 })));
    }, {
        probabilityThreshold: 0,
        invokeCallbackOnNoiseAndUnknown: true,
        overlapFactor: 0.5,
    });
}

function arreterSon() {
    const m = moteurs.son;
    m.enMarche = false;
    try { if (m.reconnaisseur && m.reconnaisseur.isListening()) m.reconnaisseur.stopListening(); } catch (e) { /* deja arrete */ }
}

// ---------- demarrer / arreter ----------
function majBouton(genre) {
    const b = $('.ia-demarrer', colonne(genre));
    const enMarche = moteurs[genre].enMarche;
    b.textContent = enMarche ? '■ Arrêter' : '▶ Démarrer';
    b.classList.toggle('en-marche', enMarche);
}

function arreter(genre) {
    const enMarche = moteurs[genre].enMarche;
    if (genre === 'vision') arreterVision(); else arreterSon();
    if (enMarche) liberer(genre);
    majBouton(genre);
}

async function basculer(genre) {
    const m = moteurs[genre];
    if (m.enMarche) { arreter(genre); dire(genre, 'Arrêté.'); return; }
    if (!m.classes.length) return;
    // Un seul moteur a la fois pour le genre vision : l'apprentissage immediat s'arrete.
    if (genre === 'vision' && window.iaImmediat) window.iaImmediat.arreter();
    dire(genre, genre === 'vision' ? 'Démarrage de la caméra…' : 'Démarrage du micro…');
    try {
        if (genre === 'vision') await demarrerVision(); else await demarrerSon();
        dire(genre, genre === 'vision' ? 'Caméra en marche.' : 'Micro en marche.');
    } catch (erreur) {
        arreter(genre);
        const refus = erreur && (erreur.name === 'NotAllowedError' || erreur.name === 'SecurityError');
        const absent = erreur && erreur.name === 'NotFoundError';
        dire(genre, refus ? 'Accès refusé : autorisez ' + (genre === 'vision' ? 'la caméra' : 'le micro') + ' dans le navigateur.'
            : absent ? 'Aucun' + (genre === 'vision' ? 'e caméra' : ' micro') + ' détecté.'
            : 'Démarrage impossible : ' + (erreur && erreur.message ? erreur.message : erreur));
    }
    majBouton(genre);
}

// ---------- creation d'un modele (entrainement dans le navigateur) ----------
// Apprentissage par transfert, comme Teachable Machine : un reseau de base
// (MobileNet pour les images, speech-commands pour les sons, dans lib/tm/base,
// donc hors connexion) extrait des caracteristiques ; seule une petite couche
// finale est entrainee sur les exemples captures. Les exemples ne quittent pas
// le navigateur et sont perdus au rechargement de la page : "Enregistrer" garde
// le modele (3 fichiers, a recharger avec « Fichiers… »).
const absolu = chemin => new URL(chemin, location.href).href;
const attente = ms => new Promise(r => setTimeout(r, ms));

const creation = {
    vision: { classes: [{ nom: 'Classe 1', echantillons: [] }, { nom: 'Classe 2', echantillons: [] }], tm: null, occupe: false },
    son: { classes: [{ nom: 'Bruit de fond', n: 0 }, { nom: 'Classe 1', n: 0 }], base: null, transfer: null, compteur: 0,
           motsEntraines: null, occupe: false },
};
const colCreer = genre => $('.ia-creer', colonne(genre));
function direCreer(genre, texte) { const e = $('.ia-creer-statut', colonne(genre)); if (e) e.textContent = texte; }
const messageErreur = e => (e && e.message ? e.message : String(e));

function telecharger(nom, contenu, type) {
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(new Blob([contenu], { type }));
    lien.download = nom;
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(lien.href), 10000);
}

// Sauvegarde au format Teachable Machine (model.json + weights.bin + metadata.json).
async function enregistrerModele(modele, metadata) {
    await modele.save(window.tf.io.withSaveHandler(async artefacts => {
        const json = {
            modelTopology: artefacts.modelTopology,
            format: 'layers-model',
            generatedBy: 'Programmation Micro:bit V2',
            convertedBy: null,
            weightsManifest: [{ paths: ['weights.bin'], weights: artefacts.weightSpecs }],
        };
        telecharger('model.json', JSON.stringify(json), 'application/json');
        telecharger('weights.bin', artefacts.weightData, 'application/octet-stream');
        return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: 'JSON' } };
    }));
    telecharger('metadata.json', JSON.stringify(metadata), 'application/json');
}

function majLignesClasses(genre) {
    const conteneur = $('.ia-creer-classes', colCreer(genre));
    const etat = creation[genre];
    conteneur.textContent = '';
    etat.classes.forEach((c, i) => {
        const nb = genre === 'vision' ? c.echantillons.length : c.n;
        const l = document.createElement('div');
        l.className = 'ia-ex';
        const nom = document.createElement('input');
        nom.className = 'ia-ex-nom'; nom.value = c.nom; nom.spellcheck = false;
        nom.disabled = genre === 'son' && nb > 0;      // le nom est inscrit dans chaque exemple sonore
        nom.addEventListener('input', () => { c.nom = nom.value; });
        const n = document.createElement('span'); n.className = 'ia-ex-n'; n.textContent = String(nb);
        const capt = document.createElement('button');
        capt.className = 'btn-vue ia-ex-capt';
        capt.textContent = genre === 'vision' ? 'Maintenir' : '● 1 s';
        capt.title = genre === 'vision' ? 'Maintenir enfoncé pour capturer des images' : 'Enregistrer 1 seconde de son';
        const sup = document.createElement('button');
        sup.className = 'btn-vue ia-ex-sup'; sup.textContent = '🗑'; sup.title = 'Supprimer cette classe et ses exemples';
        sup.addEventListener('click', () => supprimerClasse(genre, i));
        if (genre === 'vision') brancherCaptureVision(capt, i, n);
        else capt.addEventListener('click', () => capturerSon(i, capt));
        l.append(nom, n, capt, sup);
        conteneur.appendChild(l);
    });
}

function ajouterClasse(genre) {
    const etat = creation[genre];
    const nom = 'Classe ' + (etat.classes.length + 1);
    etat.classes.push(genre === 'vision' ? { nom, echantillons: [] } : { nom, n: 0 });
    majLignesClasses(genre);
}

function supprimerClasse(genre, i) {
    const etat = creation[genre];
    const c = etat.classes[i];
    if (genre === 'son' && c.n > 0 && etat.transfer) {
        try { for (const e of etat.transfer.getExamples(c.nom)) etat.transfer.removeExample(e.uid); } catch (erreur) { /* rien a retirer */ }
    }
    etat.classes.splice(i, 1);
    majLignesClasses(genre);
}

function toutEffacer(genre) {
    const etat = creation[genre];
    if (genre === 'vision') {
        etat.classes = [{ nom: 'Classe 1', echantillons: [] }, { nom: 'Classe 2', echantillons: [] }];
    } else {
        try { if (etat.transfer) etat.transfer.clearExamples(); } catch (erreur) { /* deja vide */ }
        etat.classes = [{ nom: 'Bruit de fond', n: 0 }, { nom: 'Classe 1', n: 0 }];
    }
    majLignesClasses(genre);
    direCreer(genre, 'Exemples effacés.');
}

// Le modele entraine devient le modele actif de la colonne.
function installerModele(genre, modele, noms) {
    arreter(genre);
    const m = moteurs[genre];
    if (genre === 'vision') m.modele = modele; else m.reconnaisseur = modele;
    m.classes = noms;
    afficherClasses(genre, noms);
    $('.ia-demarrer', colonne(genre)).disabled = false;
    $('.ia-enregistrer', colonne(genre)).disabled = false;
    dire(genre, 'Modèle entraîné : ' + noms.length + ' classes. Cliquez « Démarrer ».');
}

// ----- vision -----
async function modeleBaseVision() {
    const etat = creation.vision;
    if (!etat.tm) {
        await chargerBibliotheque('vision');
        etat.tm = await window.tmImage.createTeachable(
            { tfjsVersion: window.tf.version.tfjs, labels: ['x'] },
            { checkpointUrl: absolu('lib/tm/base/mobilenet/model.json'), trainingLayer: 'out_relu' });
    }
    return etat.tm;
}

// Une image -> ses caracteristiques MobileNet (1280 nombres), via le reseau tronque.
// addExample attend une image deja en 224x224 : on decoupe le carre central et on le redimensionne,
// comme le fait predict() a la reconnaissance.
const toileCapture = document.createElement('canvas');
toileCapture.width = toileCapture.height = 224;
async function activationImage(source) {
    const tm = await modeleBaseVision();
    const l = source.videoWidth || source.width, h = source.videoHeight || source.height;
    const cote = Math.min(l, h);
    toileCapture.getContext('2d').drawImage(source, (l - cote) / 2, (h - cote) / 2, cote, cote, 0, 0, 224, 224);
    tm.examples = [[]];
    await tm.addExample(0, toileCapture);
    tm.totalSamples = 0;
    return tm.examples[0].pop();
}

function brancherCaptureVision(bouton, i, compteur) {
    let appuye = false;
    const arret = () => { appuye = false; bouton.classList.remove('enregistre'); };
    bouton.addEventListener('pointerdown', async evenement => {
        evenement.preventDefault();
        const etat = creation.vision;
        if (appuye || etat.occupe) return;
        const video = $('#ia-video');
        if (!camera.flux || video.readyState < 2) { direCreer('vision', 'Allumez d\'abord la caméra (bouton 📷 Caméra).'); return; }
        appuye = true;
        bouton.classList.add('enregistre');
        try { bouton.setPointerCapture(evenement.pointerId); } catch (erreur) { /* pas grave */ }
        try {
            while (appuye) {
                etat.classes[i].echantillons.push(await activationImage(video));
                compteur.textContent = String(etat.classes[i].echantillons.length);
                await attente(40);
            }
        } catch (erreur) {
            direCreer('vision', 'Capture impossible : ' + messageErreur(erreur));
        }
        arret();
    });
    bouton.addEventListener('pointerup', arret);
    bouton.addEventListener('pointercancel', arret);
    bouton.addEventListener('lostpointercapture', arret);
}

async function basculerCameraCapture() {
    const bouton = $('.ia-camera-capture', colonne('vision'));
    try {
        if (camera.raisons.has('capture')) {
            fermerCamera('capture');
        } else {
            await ouvrirCamera('capture');
        }
    } catch (erreur) {
        direCreer('vision', erreur && erreur.name === 'NotAllowedError'
            ? 'Accès refusé : autorisez la caméra dans le navigateur.' : 'Caméra impossible : ' + messageErreur(erreur));
    }
    const allumee = camera.raisons.has('capture');
    bouton.classList.toggle('en-marche', allumee);
    bouton.textContent = allumee ? '📷 Éteindre' : '📷 Caméra';
}

function nomsValides(classes) {
    const noms = classes.map(c => c.nom.trim());
    if (noms.some(n => !n)) throw new Error('Chaque classe doit avoir un nom.');
    if (new Set(noms.map(n => n.toLowerCase())).size !== noms.length) throw new Error('Deux classes portent le même nom.');
    return noms;
}

async function entrainerVision() {
    const etat = creation.vision;
    if (etat.occupe) return;
    etat.occupe = true;
    const bouton = $('.ia-entrainer', colonne('vision'));
    bouton.disabled = true;
    try {
        const noms = nomsValides(etat.classes);
        if (noms.length < 2) throw new Error('Il faut au moins 2 classes.');
        const pauvres = etat.classes.filter(c => c.echantillons.length < 5).map(c => c.nom);
        if (pauvres.length) throw new Error('Au moins 5 images par classe (il en manque pour : ' + pauvres.join(', ') + ').');
        const tm = await modeleBaseVision();
        tm.setLabels(noms);                                    // remet les exemples a zero...
        tm.examples = etat.classes.map(c => c.echantillons.slice());   // ...on remet les notres
        tm.totalSamples = tm.examples.reduce((a, e) => a + e.length, 0);
        tm.trainDataset = null; tm.validationDataset = null;
        const EPOQUES = 50;
        direCreer('vision', 'Entraînement…');
        await tm.train({ denseUnits: 100, epochs: EPOQUES, learningRate: 0.001, batchSize: 16 }, {
            onEpochEnd: async (epoque, logs) => {
                const precision = logs.acc != null ? logs.acc : logs.accuracy;
                direCreer('vision', 'Entraînement : époque ' + (epoque + 1) + '/' + EPOQUES +
                    (precision != null ? ' — précision ' + Math.round(precision * 100) + ' %' : ''));
                await attente(0);
            },
        });
        installerModele('vision', tm, noms.slice());
        direCreer('vision', 'Entraînement terminé. Cliquez « Démarrer » (colonne du haut) pour tester.');
    } catch (erreur) {
        direCreer('vision', 'Entraînement impossible : ' + messageErreur(erreur));
    } finally {
        etat.occupe = false;
        bouton.disabled = false;
    }
}

// ----- son -----
async function baseSon() {
    const etat = creation.son;
    if (!etat.base) {
        await chargerBibliotheque('son');
        // metadataURL doit etre en http(s) pour la bibliotheque : adresse absolue.
        etat.base = window.speechCommands.create('BROWSER_FFT', undefined,
            absolu('lib/tm/base/son/model.json'), absolu('lib/tm/base/son/metadata.json'));
        await etat.base.ensureModelLoaded();
    }
    if (!etat.transfer) etat.transfer = etat.base.createTransfer('projet' + (++etat.compteur));
    return etat.transfer;
}

async function capturerSon(i, bouton) {
    const etat = creation.son;
    if (etat.occupe) return;
    if (moteurs.son.enMarche) { direCreer('son', 'Arrêtez d\'abord le micro (bouton « Arrêter » du haut).'); return; }
    const c = etat.classes[i];
    const nom = c.nom.trim();
    if (!nom) { direCreer('son', 'Donnez d\'abord un nom à la classe.'); return; }
    if (etat.classes.some((x, j) => j !== i && x.nom.trim().toLowerCase() === nom.toLowerCase())) {
        direCreer('son', 'Deux classes portent le même nom.'); return;
    }
    etat.occupe = true;
    bouton.classList.add('enregistre'); bouton.textContent = '● …';
    direCreer('son', 'Enregistrement de « ' + nom + ' » (1 seconde)…');
    try {
        const transfer = await baseSon();
        c.nom = nom;
        await transfer.collectExample(nom);
        c.n = (transfer.countExamples()[nom]) || c.n + 1;
        direCreer('son', 'Exemple ajouté à « ' + nom + ' » (' + c.n + ').');
    } catch (erreur) {
        direCreer('son', erreur && erreur.name === 'NotAllowedError'
            ? 'Accès refusé : autorisez le micro dans le navigateur.' : 'Enregistrement impossible : ' + messageErreur(erreur));
    } finally {
        etat.occupe = false;
        majLignesClasses('son');
    }
}

async function entrainerSon() {
    const etat = creation.son;
    if (etat.occupe) return;
    etat.occupe = true;
    const bouton = $('.ia-entrainer', colonne('son'));
    bouton.disabled = true;
    try {
        if (moteurs.son.enMarche) throw new Error('Arrêtez d\'abord le micro.');
        let transfer = await baseSon();
        const comptes = transfer.countExamples();
        const mots = Object.keys(comptes).filter(k => comptes[k] > 0).sort();
        if (mots.length < 2) throw new Error('Au moins 2 classes avec des exemples sont nécessaires.');
        const faibles = mots.filter(k => comptes[k] < 5);
        if (faibles.length) throw new Error('Au moins 5 exemples par classe (il en manque pour : ' + faibles.join(', ') + ').');
        // Les classes ont change depuis le dernier entrainement : la couche finale n'a plus la bonne taille.
        if (transfer.model && etat.motsEntraines && etat.motsEntraines !== mots.join('|')) {
            const exemples = transfer.serializeExamples();
            transfer = etat.base.createTransfer('projet' + (++etat.compteur));
            transfer.loadExamples(exemples, true);
            etat.transfer = transfer;
        }
        const EPOQUES = 25;
        direCreer('son', 'Entraînement…');
        await transfer.train({
            epochs: EPOQUES,
            batchSize: 16,
            callback: {
                onEpochEnd: async (epoque, logs) => {
                    const precision = logs.acc != null ? logs.acc : logs.accuracy;
                    direCreer('son', 'Entraînement : époque ' + (epoque + 1) + '/' + EPOQUES +
                        (precision != null ? ' — précision ' + Math.round(precision * 100) + ' %' : ''));
                    await attente(0);
                },
            },
        });
        etat.motsEntraines = mots.join('|');
        installerModele('son', transfer, transfer.wordLabels());
        direCreer('son', 'Entraînement terminé. Cliquez « Démarrer » (colonne du haut) pour tester.');
    } catch (erreur) {
        direCreer('son', 'Entraînement impossible : ' + messageErreur(erreur));
    } finally {
        etat.occupe = false;
        bouton.disabled = false;
    }
}

async function enregistrerGenre(genre) {
    try {
        const m = moteurs[genre];
        const horodatage = new Date().toISOString();
        if (genre === 'vision') {
            await enregistrerModele(m.modele, {
                tfjsVersion: window.tf.version.tfjs, tmVersion: '2.4.0', packageVersion: '0.8.4',
                packageName: '@teachablemachine/image', timeStamp: horodatage, userMetadata: {},
                modelName: 'modele-microbit', labels: m.classes, imageSize: 224,
            });
        } else {
            await enregistrerModele(m.reconnaisseur, {
                tfjsVersion: window.tf.version.tfjs, tfjsSpeechCommandsVersion: '0.4.0',
                modelName: 'modele-microbit', timeStamp: horodatage, wordLabels: m.classes,
            });
        }
        direCreer(genre, 'Fichiers téléchargés : model.json, weights.bin, metadata.json (rechargez-les avec « Fichiers… »).');
    } catch (erreur) {
        direCreer(genre, 'Enregistrement impossible : ' + messageErreur(erreur));
    }
}

// ---------- memoire des adresses (confort uniquement) ----------
function memoriser(genre, adresse) {
    try { localStorage.setItem('ia-url-' + genre, adresse); } catch (e) { /* stockage indisponible */ }
}
function rappeler(genre) {
    try { return localStorage.getItem('ia-url-' + genre) || ''; } catch (e) { return ''; }
}

// ---------- branchement de l'interface ----------
for (const genre of ['vision', 'son']) {
    const col = colonne(genre);
    if (!col) continue;
    const champ = $('.ia-url', col);
    champ.value = rappeler(genre);
    $('.ia-charger-url', col).addEventListener('click', () => chargerModele(genre, { adresse: champ.value }));
    champ.addEventListener('keydown', e => { if (e.key === 'Enter') chargerModele(genre, { adresse: champ.value }); });
    const entree = $('.ia-fichiers', col);
    $('.ia-charger-fichiers', col).addEventListener('click', () => entree.click());
    entree.addEventListener('change', () => {
        if (entree.files.length) chargerModele(genre, { fichiers: Array.from(entree.files) });
        entree.value = '';
    });
    $('.ia-demarrer', col).addEventListener('click', () => basculer(genre));
}
for (const genre of ['vision', 'son']) {
    const col = colonne(genre);
    if (!col || !colCreer(genre)) continue;
    majLignesClasses(genre);
    $('.ia-ajouter-classe', col).addEventListener('click', () => ajouterClasse(genre));
    $('.ia-tout-effacer', col).addEventListener('click', () => toutEffacer(genre));
    $('.ia-entrainer', col).addEventListener('click', () => (genre === 'vision' ? entrainerVision() : entrainerSon()));
    $('.ia-enregistrer', col).addEventListener('click', () => enregistrerGenre(genre));
}
$('.ia-camera-capture', colonne('vision')).addEventListener('click', basculerCameraCapture);
if (curseurSeuil) curseurSeuil.addEventListener('input', () => { valeurSeuil.textContent = curseurSeuil.value; });
if (caseCarte) caseCarte.addEventListener('change', majEtatCarte);
setInterval(() => { if (caseCarte && caseCarte.checked) majEtatCarte(); }, 2000);

// Camera et micro ne doivent pas rester allumes en cachette : on coupe a la fermeture de la page.
window.addEventListener('pagehide', () => { arreterVision(); arreterSon(); fermerCamera(); });

// Noms de classes connus pour un genre (menus des blocs IA, un.js) : modele charge,
// classes en cours de creation, et apprentissage immediat pour la vision.
window.iaClassesConnues = function (genre) {
    const noms = [];
    if (moteurs[genre]) noms.push(...moteurs[genre].classes);
    // Classes en creation : seulement celles qui ont des exemples (pas les « Classe 1 » par defaut).
    if (creation[genre]) noms.push(...creation[genre].classes.filter(c => (c.echantillons ? c.echantillons.length : c.n) > 0).map(c => c.nom));
    if (genre === 'vision' && window.iaImmediat) noms.push(...window.iaImmediat.classes());
    const vus = new Set();
    return noms.map(n => String(n).trim()).filter(n => n && !vus.has(slug(n)) && vus.add(slug(n)));
};

window.iaNoyau = { traiterResultat, liberer, envoyer, ouvrirCamera, fermerCamera, camera, dernierEnvoi, moteurs, arreter, seuil };

window.iaTest = { liberer, creation, camera, ouvrirCamera, fermerCamera, activationImage, entrainerVision, entrainerSon, capturerSon, enregistrerGenre, ajouterClasse, chargerBibliotheque, traiterResultat, chargerModele, basculer, arreter, moteurs, envoyer, trierFichiers, racineModele, dernierEnvoi };
