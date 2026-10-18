// ia-son-immediat.js — le micro pour l'apprentissage immediat des SONS (sans entrainement, sans modele).
//
// Utilise par ia-immediat.js (type « sons et mots »). Methode classique de reconnaissance
// de mots isoles, entierement calculee ici :
//   1. le micro est ecoute en continu, ramene a 16 000 echantillons par seconde ;
//   2. toutes les 10 ms, une fenetre de 25 ms est resumee par 12 nombres decrivant son
//      TIMBRE (coefficients cepstraux sur l'echelle de Mel, « MFCC », ceux des logiciels
//      de dictee). Le coefficient 0, qui ne porte que le volume, est ecarte : l'empreinte
//      ne depend pas de la force du son ;
//   3. un SON commence quand le volume depasse nettement le bruit de fond (DEBUT_FORT
//      fenetres de suite a MARGE_DEBUT dB au-dessus), et finit apres FIN_CALME fenetres
//      calmes ; un son trop court est ignore, un bruit continu de plus de 1,5 s aussi ;
//   4. le son entier est ramene a NB_INSTANTS instants : son EMPREINTE fait 30 x 12 = 360 nombres ;
//   5. deux empreintes se comparent en les « alignant » dans le temps (DTW) : un mot dit
//      un peu plus vite ou plus lentement reste reconnu.
// Rien n'est enregistre : le son est analyse puis oublie ; seule l'empreinte (des nombres)
// est gardee par ia-immediat.js.

const FE = 16000;
const FENETRE = 400;               // 25 ms
const PAS = 160;                   // 10 ms
const NFFT = 512;
const NB_FILTRES = 26;
const NB_COEFS = 12;
const NB_INSTANTS = 30;
const AVANT = 10;                  // fenetres gardees avant le debut detecte (100 ms)
const DEBUT_FORT = 3;
const MIN_FORT = 5;                // moins de 50 ms de son fort : ignore
const FIN_CALME = 25;              // 250 ms de calme : le son est fini
const MAX_INSTANTS = 150;          // 1,5 s au plus
const MARGE_DEBUT = 14;            // dB au-dessus du bruit de fond pour commencer
const MARGE_FIN = 8;               // dB au-dessus du bruit de fond pour rester « fort »
const SEUIL_ABSOLU = -55;          // dB : en dessous, jamais un son
const FOND_MIN = -80;
const BANDE_DTW = 10;              // decalage maximal (en instants) accepte par l'alignement

// ---------- tables calculees une fois ----------
const HAMMING = Float64Array.from({ length: FENETRE }, (_, i) => 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (FENETRE - 1)));
const mel = f => 2595 * Math.log10(1 + f / 700);
const depuisMel = m => 700 * (Math.pow(10, m / 2595) - 1);

// Filtres triangulaires de 64 Hz a 7 600 Hz, regulierement espaces sur l'echelle de Mel.
const FILTRES = (() => {
    const bas = mel(64), haut = mel(7600);
    const bornes = Array.from({ length: NB_FILTRES + 2 },
        (_, i) => Math.floor((NFFT + 1) * depuisMel(bas + (haut - bas) * i / (NB_FILTRES + 1)) / FE));
    return Array.from({ length: NB_FILTRES }, (_, f) => {
        const [g, c, d] = [bornes[f], bornes[f + 1], bornes[f + 2]];
        const poids = new Float64Array(NFFT / 2 + 1);
        for (let k = g; k < c; k++) poids[k] = (k - g) / Math.max(1, c - g);
        for (let k = c; k <= d; k++) poids[k] = (d - k) / Math.max(1, d - c);
        return poids;
    });
})();

// Transformee en cosinus : coefficients 1 a NB_COEFS (le 0, le volume, est ecarte).
const COSINUS = Array.from({ length: NB_COEFS }, (_, i) =>
    Float64Array.from({ length: NB_FILTRES }, (_, j) => Math.cos(Math.PI * (i + 1) * (j + 0.5) / NB_FILTRES)));

// FFT iterative (base 2), en place.
function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
    }
    for (let taille = 2; taille <= n; taille <<= 1) {
        const angle = -2 * Math.PI / taille;
        for (let debut = 0; debut < n; debut += taille) {
            for (let k = 0; k < taille / 2; k++) {
                const c = Math.cos(angle * k), s = Math.sin(angle * k);
                const a = debut + k, b = a + taille / 2;
                const tr = re[b] * c - im[b] * s, ti = re[b] * s + im[b] * c;
                re[b] = re[a] - tr; im[b] = im[a] - ti;
                re[a] += tr; im[a] += ti;
            }
        }
    }
}

const re = new Float64Array(NFFT), im = new Float64Array(NFFT);

/** Une fenetre de FENETRE echantillons -> { db, mfcc } */
function analyserFenetre(x) {
    let energie = 0;
    for (let i = 0; i < FENETRE; i++) energie += x[i] * x[i];
    const db = 10 * Math.log10(energie / FENETRE + 1e-10);
    re.fill(0); im.fill(0);
    for (let i = 0; i < FENETRE; i++) re[i] = (x[i] - 0.97 * (i ? x[i - 1] : 0)) * HAMMING[i];   // preaccentuation
    fft(re, im);
    const logMel = new Float64Array(NB_FILTRES);
    for (let f = 0; f < NB_FILTRES; f++) {
        let s = 0;
        const p = FILTRES[f];
        for (let k = 0; k <= NFFT / 2; k++) if (p[k]) s += p[k] * (re[k] * re[k] + im[k] * im[k]);
        logMel[f] = Math.log(s / NFFT + 1e-10);
    }
    const mfcc = new Float32Array(NB_COEFS);
    for (let i = 0; i < NB_COEFS; i++) {
        let s = 0;
        for (let j = 0; j < NB_FILTRES; j++) s += COSINUS[i][j] * logMel[j];
        mfcc[i] = s;
    }
    return { db, mfcc };
}

/** Suite de MFCC (longueur quelconque) -> empreinte de NB_INSTANTS x NB_COEFS nombres. */
function empreinte(suite) {
    const v = new Float32Array(NB_INSTANTS * NB_COEFS);
    const n = suite.length;
    for (let t = 0; t < NB_INSTANTS; t++) {
        const pos = n === 1 ? 0 : t * (n - 1) / (NB_INSTANTS - 1);
        const a = Math.floor(pos), b = Math.min(n - 1, a + 1), f = pos - a;
        for (let c = 0; c < NB_COEFS; c++) v[t * NB_COEFS + c] = suite[a][c] * (1 - f) + suite[b][c] * f;
    }
    return v;
}

/** Distance de deux empreintes alignees dans le temps (DTW, bande de BANDE_DTW instants). */
function distance(a, b) {
    const n = NB_INSTANTS, INF = 1e30;
    let prec = new Float64Array(n + 1).fill(INF), cour = new Float64Array(n + 1);
    prec[0] = 0;
    for (let i = 1; i <= n; i++) {
        cour.fill(INF);
        for (let j = Math.max(1, i - BANDE_DTW); j <= Math.min(n, i + BANDE_DTW); j++) {
            let d = 0;
            for (let c = 0; c < NB_COEFS; c++) { const e = a[(i - 1) * NB_COEFS + c] - b[(j - 1) * NB_COEFS + c]; d += e * e; }
            cour[j] = Math.sqrt(d) + Math.min(prec[j], prec[j - 1], cour[j - 1]);
        }
        [prec, cour] = [cour, prec];
    }
    return prec[n] / (2 * n);
}

/** Dessin de l'empreinte (timbre au cours du temps) : une image, jamais un enregistrement. */
function vignette(v, largeur = 48, hauteur = 36) {
    const toile = document.createElement('canvas');
    toile.width = largeur; toile.height = hauteur;
    const ctx = toile.getContext('2d');
    let min = Infinity, max = -Infinity;
    for (const x of v) { if (x < min) min = x; if (x > max) max = x; }
    const ecart = max - min || 1;
    const l = largeur / NB_INSTANTS, h = hauteur / NB_COEFS;
    for (let t = 0; t < NB_INSTANTS; t++) {
        for (let c = 0; c < NB_COEFS; c++) {
            const q = (v[t * NB_COEFS + c] - min) / ecart;
            ctx.fillStyle = 'hsl(' + Math.round(240 - 200 * q) + ',80%,' + Math.round(20 + 45 * q) + '%)';
            ctx.fillRect(t * l, hauteur - (c + 1) * h, Math.ceil(l), Math.ceil(h));
        }
    }
    return toile.toDataURL('image/png');
}

// ---------- ecoute du micro et decoupage en sons ----------
const micro = {
    flux: null, contexte: null, noeud: null, raisons: new Set(),
    surSon: null, surNiveau: null,
    // reechantillonnage vers FE
    rapport: 1, position: 0, tampon: new Float32Array(FENETRE + 4096), rempli: 0,
    // decoupage
    fond: null, calibrage: [], histo: [], etat: 'calme', forts: 0, trames: [], nbForts: 0, calmes: 0,
};

function reinitialiser() {
    Object.assign(micro, { position: 0, rempli: 0, fond: null, calibrage: [], histo: [], etat: 'calme', forts: 0, trames: [], nbForts: 0, calmes: 0 });
}

function fenetre(analyse) {
    const { db, mfcc } = analyse;
    if (micro.fond === null) {                         // 300 ms pour mesurer le bruit de fond
        micro.calibrage.push(db);
        if (micro.calibrage.length >= 30) micro.fond = Math.max(FOND_MIN, micro.calibrage.reduce((a, b) => a + b, 0) / micro.calibrage.length);
        return;
    }
    if (micro.surNiveau) micro.surNiveau(db, micro.fond, micro.etat === 'son');
    micro.histo.push(mfcc);
    if (micro.histo.length > AVANT) micro.histo.shift();
    const fort = db > Math.max(micro.fond + MARGE_DEBUT, SEUIL_ABSOLU);
    const encoreFort = db > Math.max(micro.fond + MARGE_FIN, SEUIL_ABSOLU);
    if (micro.etat === 'calme') {
        // Le bruit de fond suit lentement le calme (et vite s'il baisse).
        micro.fond = Math.max(FOND_MIN, db < micro.fond ? 0.7 * micro.fond + 0.3 * db : (encoreFort ? micro.fond : 0.98 * micro.fond + 0.02 * db));
        micro.forts = fort ? micro.forts + 1 : 0;
        if (micro.forts >= DEBUT_FORT) {
            micro.etat = 'son'; micro.trames = micro.histo.slice(); micro.nbForts = micro.forts; micro.calmes = 0;
        }
        return;
    }
    micro.trames.push(mfcc);
    if (encoreFort) { micro.nbForts++; micro.calmes = 0; } else micro.calmes++;
    if (micro.etat === 'trop') {                       // bruit continu : on attend le calme sans rien garder
        if (micro.calmes >= FIN_CALME) { micro.etat = 'calme'; micro.forts = 0; }
        return;
    }
    if (micro.trames.length > MAX_INSTANTS) { micro.etat = 'trop'; micro.trames = []; return; }
    if (micro.calmes >= FIN_CALME) {
        const suite = micro.trames.slice(0, micro.trames.length - FIN_CALME + 5);   // garde 50 ms de chute
        micro.etat = 'calme'; micro.forts = 0; micro.trames = [];
        if (micro.nbForts >= MIN_FORT && micro.surSon) micro.surSon(empreinte(suite));
    }
}

// Echantillons au rythme du micro -> FE, puis fenetres de FENETRE tous les PAS echantillons.
function recevoir(entree) {
    for (let i = 0; i < entree.length; i++) {
        // reechantillonnage lineaire : on produit un echantillon a chaque pas de `rapport`
        while (micro.position <= i) {
            const a = Math.floor(micro.position), f = micro.position - a;
            const x = entree[a] * (1 - f) + (a + 1 < entree.length ? entree[a + 1] : entree[a]) * f;
            micro.tampon[micro.rempli++] = x;
            micro.position += micro.rapport;
            if (micro.rempli >= FENETRE) {
                fenetre(analyserFenetre(micro.tampon));
                micro.tampon.copyWithin(0, PAS, micro.rempli);
                micro.rempli -= PAS;
            }
        }
    }
    micro.position -= entree.length;
}

/** Allume le micro pour une raison ('capture', 'reco'...). surSon(empreinte), surNiveau(db, fond, enSon). */
async function allumer(raison, rappels) {
    if (rappels) { micro.surSon = rappels.surSon || micro.surSon; micro.surNiveau = rappels.surNiveau || micro.surNiveau; }
    micro.raisons.add(raison);
    if (micro.flux) return;
    try {
        micro.flux = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
        const Contexte = window.AudioContext || window.webkitAudioContext;
        let contexte;
        try { contexte = new Contexte({ sampleRate: FE }); } catch (e) { contexte = new Contexte(); }
        micro.contexte = contexte;
        micro.rapport = contexte.sampleRate / FE;
        reinitialiser();
        const source = contexte.createMediaStreamSource(micro.flux);
        // ScriptProcessor : simple et suffisant ici (AudioWorklet demanderait un fichier de plus).
        micro.noeud = contexte.createScriptProcessor(2048, 1, 1);
        micro.noeud.onaudioprocess = e => recevoir(e.inputBuffer.getChannelData(0));
        source.connect(micro.noeud);
        micro.noeud.connect(contexte.destination);       // sans sortie branchee, Chrome n'appelle pas onaudioprocess
        if (contexte.state === 'suspended') await contexte.resume();
    } catch (erreur) {
        micro.raisons.delete(raison);
        eteindre();
        throw erreur;
    }
}

function eteindre(raison) {
    if (raison) micro.raisons.delete(raison); else micro.raisons.clear();
    if (micro.raisons.size) return;
    if (micro.noeud) { micro.noeud.onaudioprocess = null; micro.noeud.disconnect(); micro.noeud = null; }
    if (micro.contexte) { micro.contexte.close().catch(() => {}); micro.contexte = null; }
    if (micro.flux) { micro.flux.getTracks().forEach(t => t.stop()); micro.flux = null; }
    reinitialiser();
}

window.addEventListener('pagehide', () => eteindre());

window.iaSonImmediat = {
    allumer, eteindre, allume: raison => (raison ? micro.raisons.has(raison) : !!micro.flux),
    distance, vignette, NB_INSTANTS, NB_COEFS,
    // Pour les verifications depuis la console : alimenter le decoupage avec un signal fabrique.
    test: { analyserFenetre, empreinte, recevoir, reinitialiser, micro, FE, FENETRE, PAS },
};
