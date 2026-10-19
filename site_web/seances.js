// seances.js — seances pour des groupes d'eleves : distribuer des exercices, rendre et ramasser les travaux.
//
// Tout passe par des FICHIERS, deposes la ou l'enseignant depose deja ses documents (ENT, Moodle, dossier partage,
// cle USB) : aucun serveur, aucun compte, aucune donnee d'eleve hors des outils de l'etablissement.
//
//   1. L'enseignant prepare une seance (menu Fichier > Espace enseignant) : titre, classe, groupes (et prenoms),
//      exercices choisis dans la banque (exercices.json) ou crees a partir du programme ouvert, entrainement ou
//      evaluation. Il telecharge un fichier « seance_….json » et le depose sur l'ENT.
//   2. L'eleve ouvre ce fichier (Fichier > Ouvrir une seance), choisit son groupe et son prenom (ou ceux du binome) :
//      le moteur d'exercices (exercices.js, mode seance) lui propose les exercices de la seance et memorise son
//      programme pour chacun. « Rendre mon travail » telecharge un fichier « ….rendu.json » a deposer sur l'ENT.
//   3. L'enseignant ramasse tous les fichiers rendus d'un coup (Espace enseignant > Ramasser les travaux) : tableau
//      par groupe et par eleve, programme de chaque eleve ouvrable dans l'editeur, export CSV, impression.
//
// Formats :
//   seance : { format: 'seance-microbit', version: 1, id, titre, classe, mode: 'tp' | 'eval', minutes, creee,
//              groupes: [{ nom, eleves: [...] }], exercices: [ meme forme que exercices.json, plus « depart » ] }
//   rendu  : { format: 'rendu-microbit', version: 1, date, seance: { id, titre, classe, mode }, groupe, eleves,
//              exercices: [{ id, titre, statut, etoiles, ..., blocs, python }], evaluation }   (exercices.js)
// Donnees personnelles : prenoms (ou initiales) seulement ; rien n'est envoye nulle part par l'application.

const CLE_ACTIVE = 'seance_active_v1';
const CLE_BROUILLON = 'seance_brouillon_v1';
const $ = (sel, racine = document) => racine.querySelector(sel);
const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const moteur = () => window.exercicesSeance;
// Types de blocs ignores pour le controle automatique « memes blocs que la solution » : structure et valeurs simples.
const BLOCS_NEUTRES = ['au_demarrage', 'boucle_infinie', 'math_number', 'text', 'logic_boolean', 'variables_get'];

// ---------------------------------------------------------------- outils
function telecharger(nom, texte) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([texte], { type: 'application/json;charset=utf-8' }));
    a.download = nom;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const morceau = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 30) || 'x';
const lireTexte = f => new Promise((ok, ko) => { const l = new FileReader(); l.onload = () => ok(String(l.result).replace(/^﻿/, '')); l.onerror = ko; l.readAsText(f); });
function choisirFichiers(accepte, multiple) {
    return new Promise(ok => {
        const e = document.createElement('input');
        e.type = 'file'; e.accept = accepte; e.multiple = !!multiple;
        e.addEventListener('change', () => ok(Array.from(e.files)));
        e.click();
    });
}
function fermer() { const v = $('#ex-voile'); if (v) v.remove(); }
function voile(contenu, classe = '') {
    fermer();
    const v = document.createElement('div');
    v.id = 'ex-voile';
    v.innerHTML = '<div class="ex-fenetre ' + classe + '" role="dialog" aria-modal="true">' + contenu + '</div>';
    v.addEventListener('mousedown', ev => { if (ev.target === v) fermer(); });
    document.body.appendChild(v);
    return v;
}
const espaceVierge = () => !window.workspace.getAllBlocks(false).some(b => !['au_demarrage', 'boucle_infinie'].includes(b.type));

// ---------------------------------------------------------------- ELEVE : ouvrir une seance, rendre, quitter
async function ouvrirSeance() {
    if (moteur().enEvaluation()) { alert('Une évaluation est en cours : termine-la d\'abord.'); return; }
    const [f] = await choisirFichiers('.json,application/json', false);
    if (!f) return;
    let def;
    try { def = JSON.parse(await lireTexte(f)); } catch (e) { def = null; }
    if (!def || def.format !== 'seance-microbit' || !Array.isArray(def.exercices) || !def.exercices.length) {
        alert('Ce fichier n\'est pas une séance (fichier « seance_….json » donné par le professeur).');
        return;
    }
    choisirEleves(def);
}

function choisirEleves(def) {
    const groupes = (def.groupes && def.groupes.length) ? def.groupes : [{ nom: 'Groupe', eleves: [] }];
    const v = voile('<div class="ex-haut"><h2>📂 ' + esc(def.titre) + '</h2><button class="ex-x" data-f="fermer" title="Fermer">✕</button></div>' +
        '<p>' + esc(def.classe ? def.classe + ' · ' : '') + def.exercices.length + ' exercice' + (def.exercices.length > 1 ? 's' : '') +
        (def.mode === 'eval' ? ' · <b>évaluation</b>' + (def.minutes ? ' (' + def.minutes + ' min)' : '') : ' · entraînement') + '</p>' +
        '<div class="se-form"><label>Ton groupe <select id="se-groupe">' + groupes.map((g, i) => '<option value="' + i + '">' + esc(g.nom) + '</option>').join('') + '</select></label></div>' +
        '<div id="se-eleves"></div>' +
        '<label class="se-libre">Prénom(s) <input id="se-autres" type="text" maxlength="60" placeholder="Prénom, ou deux prénoms séparés par une virgule"></label>' +
        '<p class="ex-note">Si vous travaillez à deux, cochez ou écrivez les deux prénoms : un seul fichier sera rendu pour le binôme.</p>' +
        '<p class="se-erreur" id="se-erreur" role="alert"></p>' +
        '<div class="ex-boutons"><button class="ex-primaire" data-a="commencer">Commencer</button><button data-f="fermer">Annuler</button></div>');
    const majEleves = () => {
        const g = groupes[Number($('#se-groupe', v).value)];
        $('#se-eleves', v).innerHTML = (g.eleves && g.eleves.length)
            ? '<div class="se-cases">' + g.eleves.map(n => '<label><input type="checkbox" value="' + esc(n) + '"> ' + esc(n) + '</label>').join('') + '</div>' : '';
    };
    $('#se-groupe', v).addEventListener('change', majEleves);
    majEleves();
    v.addEventListener('input', () => { $('#se-erreur', v).textContent = ''; });
    v.addEventListener('click', ev => {
        if (ev.target.closest('[data-f="fermer"]')) { fermer(); return; }
        if (!ev.target.closest('[data-a="commencer"]')) return;
        const g = groupes[Number($('#se-groupe', v).value)];
        const eleves = Array.from(v.querySelectorAll('#se-eleves input:checked')).map(c => c.value)
            .concat($('#se-autres', v).value.split(',').map(t => t.trim()).filter(Boolean));
        if (!eleves.length) { $('#se-erreur', v).textContent = 'Indique ton prénom (coche-le ou écris-le).'; return; }
        if (!espaceVierge() && !confirm('La séance démarre sur un espace vierge : ton programme actuel sera remplacé.\nContinuer ?')) return;
        demarrerSeance(def, eleves, g.nom);
    });
}

function demarrerSeance(def, eleves, groupe) {
    if (!moteur().activer(def, eleves, groupe)) return;
    try { localStorage.setItem(CLE_ACTIVE, JSON.stringify({ def, eleves, groupe })); } catch (e) { /* stockage indisponible */ }
    majMenu();
    fermer();
    if (def.mode === 'eval') moteur().evaluer(); else moteur().ouvrir();
}

function nomRendu(r) {
    return [morceau(r.seance.classe), morceau(r.groupe), r.eleves.map(morceau).join('-'), morceau(r.seance.titre)]
        .filter(x => x && x !== 'x').join('_') + '.rendu.json';
}

window.seanceRendre = function () {
    const r = moteur().rendu();
    if (!r) { alert('Aucune séance ouverte : ouvre d\'abord le fichier de séance donné par ton professeur (Fichier > Ouvrir une séance).'); return; }
    const nom = nomRendu(r);
    telecharger(nom, JSON.stringify(r));
    const faits = r.exercices.filter(e => e.statut !== 'non fait').length;
    voile('<div class="ex-haut"><h2>📤 Travail rendu</h2><button class="ex-x" data-f="fermer" title="Fermer">✕</button></div>' +
        '<p>Le fichier <b>' + esc(nom) + '</b> vient d\'être téléchargé (dossier « Téléchargements »).</p>' +
        '<p><b>Dépose-le maintenant</b> là où ton professeur l\'a demandé : casier de l\'ENT, devoir Moodle, dossier partagé…</p>' +
        '<p class="ex-note">' + faits + ' exercice' + (faits > 1 ? 's' : '') + ' sur ' + r.exercices.length + ' commencé' + (faits > 1 ? 's' : '') +
        ' ou terminé' + (faits > 1 ? 's' : '') + '. Tu peux continuer à travailler et rendre à nouveau : le professeur gardera le fichier le plus récent.</p>' +
        '<div class="ex-boutons"><button class="ex-primaire" data-f="fermer">OK</button></div>')
        .addEventListener('click', ev => { if (ev.target.closest('[data-f="fermer"]')) fermer(); });
};

window.seanceQuitter = function () {
    if (moteur().enEvaluation()) { alert('Une évaluation est en cours : termine-la d\'abord.'); return; }
    if (!confirm('Quitter la séance ? Pense à rendre ton travail avant.\n(Ton travail reste enregistré sur ce poste : rouvrir la séance permet de le retrouver.)')) return;
    moteur().quitter();
    try { localStorage.removeItem(CLE_ACTIVE); } catch (e) { /* rien */ }
    majMenu();
    fermer();
};

// ---------------------------------------------------------------- ENSEIGNANT : preparer une seance
let banque = null;
async function chargerBanque() {
    if (banque) return banque;
    try { banque = await (await fetch('exercices.json', { cache: 'no-store' })).json(); } catch (e) { banque = { niveaux: [] }; }
    return banque;
}
function brouillonVide() {
    return { titre: '', classe: '', mode: 'tp', minutes: 0, groupes: 'Groupe 1 :\nGroupe 2 :\nGroupe 3 :', choisis: [], perso: [] };
}
let brouillon = (() => { try { return Object.assign(brouillonVide(), JSON.parse(localStorage.getItem(CLE_BROUILLON) || 'null') || {}); } catch (e) { return brouillonVide(); } })();
function garderBrouillon() { try { localStorage.setItem(CLE_BROUILLON, JSON.stringify(brouillon)); } catch (e) { /* rien */ } }

// « Groupe 1 : Léa, Tom » -> { nom: 'Groupe 1', eleves: ['Léa', 'Tom'] }
function lireGroupes(texte) {
    return String(texte).split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => {
        const i = l.indexOf(':');
        const nom = (i >= 0 ? l.slice(0, i) : l).trim();
        const eleves = i >= 0 ? l.slice(i + 1).split(',').map(t => t.trim()).filter(Boolean) : [];
        return { nom, eleves };
    }).filter(g => g.nom);
}
const texteGroupes = groupes => groupes.map(g => g.nom + ' :' + (g.eleves.length ? ' ' + g.eleves.join(', ') : '')).join('\n');

// Controle automatique d'un exercice cree par l'enseignant : la solution compte N blocs de chaque type -> il en faut autant.
function regleDepuisEspace() {
    const compte = {};
    for (const b of window.workspace.getAllBlocks(false)) {
        if (BLOCS_NEUTRES.includes(b.type) || !b.isEnabled()) continue;
        compte[b.type] = (compte[b.type] || 0) + 1;
    }
    const regles = Object.entries(compte).map(([bloc, min]) => ({ bloc, min }));
    return regles.length ? { tous: regles } : null;
}

async function fenetreEnseignant(onglet = 'creer') {
    if (moteur().active()) { alert('Une séance d\'élève est ouverte sur ce poste : quittez-la d\'abord (Fichier > Quitter la séance).'); return; }
    const v = voile('<div class="ex-haut"><h2>👩‍🏫 Espace enseignant</h2><button class="ex-x" data-f="fermer" title="Fermer">✕</button></div>' +
        '<div class="ex-onglets"><button data-onglet="creer">Préparer une séance</button><button data-onglet="ramasser">Ramasser les travaux</button></div>' +
        '<div id="se-contenu"></div>', 'se-fenetre');
    let courant = onglet;
    const montrer = async o => {
        courant = o;
        v.querySelectorAll('.ex-onglets button').forEach(b => b.classList.toggle('actif', b.dataset.onglet === o));
        $('#se-contenu', v).innerHTML = o === 'creer' ? await htmlCreer() : htmlRamasser();
        if (o === 'creer') majMode(v);
    };
    v.addEventListener('click', async ev => {
        const o = ev.target.closest('[data-onglet]');
        if (o) { montrer(o.dataset.onglet); return; }
        if (ev.target.closest('[data-f="fermer"]')) { fermer(); return; }
        const a = ev.target.closest('[data-a]');
        if (!a) return;
        if (courant === 'creer') await actionCreer(a, v, () => montrer('creer'));
        else await actionRamasser(a, v, () => montrer('ramasser'));
    });
    v.addEventListener('input', ev => {
        if (courant !== 'creer') return;
        lireFormulaire(v);
        if (ev.target.id === 'se-mode') majMode(v);
    });
    v.addEventListener('change', ev => { if (courant === 'creer') { lireFormulaire(v); majMode(v); } });
    // Glisser-deposer des fichiers rendus sur la fenetre
    v.addEventListener('dragover', ev => { if (courant === 'ramasser') ev.preventDefault(); });
    v.addEventListener('drop', async ev => {
        if (courant !== 'ramasser') return;
        ev.preventDefault();
        await ajouterRendus(Array.from(ev.dataTransfer.files));
        montrer('ramasser');
    });
    await montrer(onglet);
}

async function htmlCreer() {
    const b = await chargerBanque();
    const choisis = new Set(brouillon.choisis);
    let h = '<div class="se-form">' +
        '<label>Titre de la séance <input id="se-titre" type="text" maxlength="60" value="' + esc(brouillon.titre) + '" placeholder="Robot suiveur de ligne"></label>' +
        '<label>Classe <input id="se-classe" type="text" maxlength="30" value="' + esc(brouillon.classe) + '" placeholder="4e B"></label>' +
        '<label>Mode <select id="se-mode"><option value="tp"' + (brouillon.mode === 'tp' ? ' selected' : '') + '>Entraînement (indices, solution, étoiles)</option>' +
        '<option value="eval"' + (brouillon.mode === 'eval' ? ' selected' : '') + '>Évaluation (sans aide, 3 essais, note sur 20)</option></select></label>' +
        '<label id="se-minutes-l">Durée maximale (minutes, 0 = illimitée) <input id="se-minutes" type="number" min="0" max="180" value="' + (Number(brouillon.minutes) || 0) + '"></label></div>';
    h += '<h3>Groupes <small>une ligne par groupe ; les prénoms après « : » sont facultatifs</small></h3>' +
        '<textarea id="se-groupes" rows="4" spellcheck="false" placeholder="Groupe 1 : Léa, Tom">' + esc(brouillon.groupes) + '</textarea>';
    h += '<h3>Exercices de la banque <small>' + choisis.size + ' choisi' + (choisis.size > 1 ? 's' : '') + '</small></h3>';
    for (const n of b.niveaux || []) {
        h += '<div class="se-niveau"><b>' + esc(n.titre) + '</b> <button class="se-petit" data-a="tout-niveau" data-niveau="' + esc(n.id) + '">tout</button>' +
            '<div class="se-cases">' + n.exercices.map(e => '<label title="' + esc(e.consigne) + '"><input type="checkbox" data-exo="' + esc(e.id) + '"' +
            (choisis.has(e.id) ? ' checked' : '') + '> ' + esc(e.id) + ' · ' + esc(e.titre) + '</label>').join('') + '</div></div>';
    }
    h += '<h3>Vos exercices <small>créés à partir du programme ouvert dans l\'éditeur</small></h3>';
    h += brouillon.perso.length ? '<table class="ex-table"><tr><th>N°</th><th>Titre</th><th>Programme actuel utilisé comme</th><th>Points</th><th></th></tr>' +
        brouillon.perso.map((e, i) => '<tr><td>' + esc(e.id) + '</td><td title="' + esc(e.consigne) + '">' + esc(e.titre) + '</td><td>' +
            (e.depart ? 'point de départ' : e.regle ? 'solution, contrôle automatique' : 'solution, correction par vous') + '</td><td>' + e.points +
            '</td><td><button class="se-petit" data-a="suppr-perso" data-i="' + i + '">Retirer</button></td></tr>').join('') + '</table>'
        : '<p class="ex-note">Aucun pour l\'instant.</p>';
    h += '<details class="se-nouveau"><summary>✚ Ajouter un exercice à partir du programme ouvert</summary>' +
        '<div class="se-form"><label>Titre <input id="se-p-titre" type="text" maxlength="50" placeholder="Feu tricolore"></label>' +
        '<label>Points <input id="se-p-points" type="number" min="1" max="10" value="1"></label></div>' +
        '<label class="se-libre">Consigne <textarea id="se-p-consigne" rows="2" placeholder="Programme un feu tricolore : vert 3 s, orange 1 s, rouge 3 s."></textarea></label>' +
        '<label class="se-libre">Indices (un par ligne, facultatif) <textarea id="se-p-indices" rows="2"></textarea></label>' +
        '<label class="se-libre">Le programme ouvert dans l\'éditeur sert de <select id="se-p-usage">' +
        '<option value="auto">solution, avec contrôle automatique (l\'élève doit utiliser les mêmes blocs)</option>' +
        '<option value="prof">solution, correction par vous (l\'élève clique « J\'ai terminé »)</option>' +
        '<option value="depart">point de départ pour l\'élève (correction par vous)</option></select></label>' +
        '<p class="se-erreur" id="se-p-erreur" role="alert"></p>' +
        '<div class="ex-boutons"><button data-a="ajouter-perso">Ajouter cet exercice</button></div></details>';
    h += '<p class="se-erreur" id="se-erreur" role="alert"></p>' +
        '<div class="ex-boutons"><button class="ex-primaire" data-a="telecharger">⬇ Télécharger la séance</button>' +
        '<button data-a="ouvrir">Ouvrir une séance à modifier…</button><button class="ex-danger" data-a="nouvelle">Nouvelle séance (tout effacer)</button></div>' +
        '<p class="ex-note">Déposez le fichier téléchargé sur l\'ENT (ou un dossier partagé) : les élèves l\'ouvrent avec « Fichier > Ouvrir une séance ». ' +
        'Utilisez des prénoms ou des initiales seulement.</p>';
    return h;
}

function lireFormulaire(v) {
    const val = id => { const e = $('#' + id, v); return e ? e.value : undefined; };
    if (val('se-titre') !== undefined) brouillon.titre = val('se-titre').trim();
    if (val('se-classe') !== undefined) brouillon.classe = val('se-classe').trim();
    if (val('se-mode') !== undefined) brouillon.mode = val('se-mode');
    if (val('se-minutes') !== undefined) brouillon.minutes = Math.max(0, Math.min(180, Number(val('se-minutes')) || 0));
    if (val('se-groupes') !== undefined) brouillon.groupes = val('se-groupes');
    const cases = v.querySelectorAll('input[data-exo]');
    if (cases.length) brouillon.choisis = Array.from(cases).filter(c => c.checked).map(c => c.dataset.exo);
    garderBrouillon();
}
function majMode(v) {
    const l = $('#se-minutes-l', v);
    if (l) l.style.display = brouillon.mode === 'eval' ? '' : 'none';
}

async function actionCreer(a, v, rafraichir) {
    const act = a.dataset.a;
    lireFormulaire(v);
    if (act === 'tout-niveau') {
        const n = (banque.niveaux || []).find(x => x.id === a.dataset.niveau);
        const ids = n ? n.exercices.map(e => e.id) : [];
        const tous = ids.every(id => brouillon.choisis.includes(id));
        brouillon.choisis = tous ? brouillon.choisis.filter(id => !ids.includes(id)) : Array.from(new Set(brouillon.choisis.concat(ids)));
        garderBrouillon(); rafraichir();
    } else if (act === 'suppr-perso') {
        brouillon.perso.splice(Number(a.dataset.i), 1); garderBrouillon(); rafraichir();
    } else if (act === 'ajouter-perso') {
        const titre = $('#se-p-titre', v).value.trim(), consigne = $('#se-p-consigne', v).value.trim();
        const usage = $('#se-p-usage', v).value, erreur = $('#se-p-erreur', v);
        if (!titre || !consigne) { erreur.textContent = 'Donnez un titre et une consigne.'; return; }
        const etat = Blockly.serialization.workspaces.save(window.workspace);
        const blocs = { blocks: (etat.blocks && etat.blocks.blocks) || [], variables: etat.variables };
        if (usage !== 'depart' && espaceVierge()) { erreur.textContent = 'Le programme ouvert est vide : construisez d\'abord la solution dans l\'éditeur.'; return; }
        const e = { id: 'P' + (brouillon.perso.length + 1), titre, consigne,
                    indices: $('#se-p-indices', v).value.split(/\r?\n/).map(t => t.trim()).filter(Boolean),
                    points: Math.max(1, Math.min(10, Number($('#se-p-points', v).value) || 1)) };
        if (usage === 'depart') e.depart = blocs; else e.solution = blocs;
        if (usage === 'auto') {
            e.regle = regleDepuisEspace();
            if (!e.regle) { erreur.textContent = 'La solution ne contient aucun bloc à contrôler : choisissez « correction par vous ».'; return; }
        }
        // Numerotation P1, P2... sans doublon apres une suppression
        let n = 1; while (brouillon.perso.some(x => x.id === 'P' + n)) n++; e.id = 'P' + n;
        brouillon.perso.push(e); garderBrouillon(); rafraichir();
    } else if (act === 'nouvelle') {
        if (!confirm('Effacer la séance en préparation (titre, groupes, exercices choisis et vos exercices) ?')) return;
        brouillon = brouillonVide(); garderBrouillon(); rafraichir();
    } else if (act === 'ouvrir') {
        const [f] = await choisirFichiers('.json,application/json', false);
        if (!f) return;
        let d; try { d = JSON.parse(await lireTexte(f)); } catch (e) { d = null; }
        if (!d || d.format !== 'seance-microbit') { alert('Ce fichier n\'est pas une séance.'); return; }
        const b = await chargerBanque(), idsBanque = new Set([].concat(...(b.niveaux || []).map(n => n.exercices.map(e => e.id))));
        brouillon = { titre: d.titre || '', classe: d.classe || '', mode: d.mode || 'tp', minutes: d.minutes || 0,
                      groupes: texteGroupes(d.groupes || []), id: d.id,
                      choisis: d.exercices.filter(e => idsBanque.has(e.id) && !/^P\d+$/.test(e.id)).map(e => e.id),
                      perso: d.exercices.filter(e => /^P\d+$/.test(e.id)) };
        garderBrouillon(); rafraichir();
    } else if (act === 'telecharger') {
        const erreur = $('#se-erreur', v), groupes = lireGroupes(brouillon.groupes);
        const b = await chargerBanque();
        const parId = {}; for (const n of b.niveaux || []) for (const e of n.exercices) parId[e.id] = e;
        const exercices = brouillon.choisis.filter(id => parId[id]).map(id => Object.assign({ points: 1 }, parId[id])).concat(brouillon.perso);
        if (!brouillon.titre) { erreur.textContent = 'Donnez un titre à la séance.'; return; }
        if (!groupes.length) { erreur.textContent = 'Indiquez au moins un groupe.'; return; }
        if (!exercices.length) { erreur.textContent = 'Choisissez au moins un exercice.'; return; }
        erreur.textContent = '';
        const def = { format: 'seance-microbit', version: 1,
                      id: brouillon.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 7)),
                      titre: brouillon.titre, classe: brouillon.classe, mode: brouillon.mode,
                      minutes: brouillon.mode === 'eval' ? brouillon.minutes : 0, creee: new Date().toISOString(), groupes, exercices };
        // Meme identifiant pour une seance modifiee puis retelechargee : les eleves retrouvent leur travail.
        brouillon.id = def.id; garderBrouillon();
        const nom = ['seance', morceau(def.classe), morceau(def.titre)].filter(x => x && x !== 'x').join('_') + '.json';
        telecharger(nom, JSON.stringify(def, null, 1));
        alert('Séance téléchargée : « ' + nom + ' ».\nDéposez-la sur l\'ENT ; les élèves l\'ouvrent avec « Fichier > Ouvrir une séance ».');
    }
}

// ---------------------------------------------------------------- ENSEIGNANT : ramasser les travaux
let rendus = [];      // fichiers rendus lus (memoire de la fenetre, le temps de la correction)
const cleRendu = r => r.seance.id + '|' + r.groupe + '|' + r.eleves.map(n => n.toLowerCase()).sort().join(',');

async function ajouterRendus(fichiers) {
    let ajoutes = 0, ignores = 0;
    for (const f of fichiers) {
        let r; try { r = JSON.parse(await lireTexte(f)); } catch (e) { r = null; }
        if (!r || r.format !== 'rendu-microbit' || !r.seance || !Array.isArray(r.exercices)) { ignores++; continue; }
        // Un meme groupe d'eleves qui rend plusieurs fois : on garde le fichier le plus recent.
        const i = rendus.findIndex(x => cleRendu(x) === cleRendu(r));
        if (i >= 0) { if (r.date > rendus[i].date) rendus[i] = r; } else rendus.push(r);
        ajoutes++;
    }
    if (ignores) alert(ignores + ' fichier(s) ignoré(s) : ce ne sont pas des travaux rendus (« ….rendu.json »).');
    return ajoutes;
}

const SYMBOLES = { 'réussi': '✔', 'à corriger': '✎', 'commencé': '…', 'passé': '↷', 'échec': '✘', 'non fait': '·' };
function cellule(e) {
    let t = SYMBOLES[e.statut] || '·';
    if (e.statut === 'réussi' && e.etoiles) t += ' ' + e.etoiles + '★';
    if (e.points != null) t += ' ' + e.points + '/' + e.sur;
    return t;
}

function htmlRamasser() {
    let h = '<div class="se-depot" data-a="choisir">⬇ Glissez ici les fichiers « ….rendu.json », ou <u>cliquez pour les choisir</u> (plusieurs à la fois)</div>';
    if (!rendus.length) {
        return h + '<p class="ex-note">Récupérez les fichiers déposés par les élèves (casier de l\'ENT, devoir Moodle, dossier partagé), ' +
            'puis ajoutez-les ici. Un clic sur une case ouvre le programme de l\'élève dans l\'éditeur.</p>';
    }
    // Une table par seance, lignes triees par groupe puis par eleves
    const parSeance = {};
    for (const r of rendus) (parSeance[r.seance.id] = parSeance[r.seance.id] || []).push(r);
    for (const [id, liste] of Object.entries(parSeance)) {
        liste.sort((a, b) => (a.groupe + a.eleves.join()).localeCompare(b.groupe + b.eleves.join(), 'fr'));
        const s = liste[0].seance, exos = liste[0].exercices;
        h += '<h3>' + esc(s.titre) + ' <small>' + esc(s.classe) + ' · ' + (s.mode === 'eval' ? 'évaluation' : 'entraînement') + ' · ' + liste.length + ' rendu' + (liste.length > 1 ? 's' : '') + '</small></h3>';
        h += '<div class="ex-defile"><table class="ex-table ex-classe se-table"><tr><th>Groupe</th><th>Élève(s)</th>' +
            exos.map(e => '<th title="' + esc(e.titre) + '">' + esc(e.id) + '</th>').join('') + '<th>Réussis</th>' + (s.mode === 'eval' ? '<th>Note /20</th>' : '') + '<th>Rendu le</th></tr>';
        for (const r of liste) {
            const k = rendus.indexOf(r);
            const reussis = r.exercices.filter(e => e.statut === 'réussi').length;
            h += '<tr><td>' + esc(r.groupe) + '</td><td>' + esc(r.eleves.join(', ')) + '</td>' +
                r.exercices.map((e, j) => '<td>' + (e.blocs ? '<button class="se-cell" data-a="voir" data-r="' + k + '" data-e="' + j + '" title="Ouvrir le programme : ' +
                    esc(e.titre) + ' (' + esc(e.statut) + ')">' + esc(cellule(e)) + '</button>' : '<span title="' + esc(e.statut) + '">' + esc(cellule(e)) + '</span>') + '</td>').join('') +
                '<td>' + reussis + '/' + r.exercices.length + '</td>' + (s.mode === 'eval' ? '<td><b>' + (r.evaluation ? r.evaluation.note : '—') + '</b>' +
                    (r.exercices.some(e => e.statut === 'à corriger') ? ' <span title="Note provisoire : des exercices sont à corriger par vous (comptés 0 pour l\'instant)">*</span>' : '') + '</td>' : '') +
                '<td>' + esc(new Date(r.date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })) + '</td></tr>';
        }
        h += '</table></div>';
    }
    h += '<p class="ex-note">✔ réussi (★ étoiles) · ✎ à corriger par vous · … commencé · ↷ passé · ✘ échec · · non fait. ' +
        'Cliquez sur une case pour ouvrir le programme de l\'élève. * Note provisoire : les exercices « à corriger » comptent 0 tant que vous ne les avez pas notés.</p>';
    h += '<div class="ex-boutons ex-noprint"><button data-a="choisir">Ajouter des fichiers…</button><button data-a="csv">Exporter (CSV)</button>' +
        '<button data-a="imprimer">🖨 Imprimer</button><button class="ex-danger" data-a="vider">Vider la liste</button></div>';
    return h;
}

function csvRendus() {
    const cell = t => '"' + String(t == null ? '' : t).replace(/"/g, '""') + '"';
    const lignes = [];
    const parSeance = {};
    for (const r of rendus) (parSeance[r.seance.id] = parSeance[r.seance.id] || []).push(r);
    for (const liste of Object.values(parSeance)) {
        const exos = liste[0].exercices;
        lignes.push(['Séance', 'Classe', 'Groupe', 'Élève'].concat(exos.map(e => e.id + ' ' + e.titre), ['Réussis', 'Note /20', 'Rendu le']).map(cell).join(';'));
        for (const r of liste) {
            // Une ligne par eleve (un binome = deux lignes avec les memes resultats), pratique pour reporter les notes.
            for (const eleve of r.eleves) {
                lignes.push([r.seance.titre, r.seance.classe, r.groupe, eleve].concat(
                    r.exercices.map(e => e.statut + (e.statut === 'réussi' && e.etoiles ? ' ' + e.etoiles + '★' : '') + (e.points != null ? ' ' + e.points + '/' + e.sur : '')),
                    [r.exercices.filter(e => e.statut === 'réussi').length + '/' + r.exercices.length,
                     r.evaluation ? String(r.evaluation.note).replace('.', ',') : '', new Date(r.date).toLocaleString('fr-FR')]).map(cell).join(';'));
            }
        }
        lignes.push('');
    }
    return '﻿' + lignes.join('\r\n');
}

async function actionRamasser(a, v, rafraichir) {
    const act = a.dataset.a;
    if (act === 'choisir') {
        const f = await choisirFichiers('.json,application/json', true);
        if (f.length) { await ajouterRendus(f); rafraichir(); }
    } else if (act === 'vider') {
        if (confirm('Vider la liste des travaux ramassés ? (Les fichiers eux-mêmes ne sont pas touchés.)')) { rendus = []; rafraichir(); }
    } else if (act === 'imprimer') {
        window.print();
    } else if (act === 'csv') {
        const a2 = document.createElement('a');
        a2.href = URL.createObjectURL(new Blob([csvRendus()], { type: 'text/csv;charset=utf-8' }));
        a2.download = 'travaux_rendus.csv';
        document.body.appendChild(a2); a2.click(); a2.remove();
    } else if (act === 'voir') {
        const r = rendus[Number(a.dataset.r)], e = r && r.exercices[Number(a.dataset.e)];
        if (!e || !e.blocs) return;
        if (!espaceVierge() && !confirm('Ouvrir le programme de ' + r.eleves.join(', ') + ' remplace le programme de l\'éditeur.\nContinuer ?')) return;
        Blockly.serialization.workspaces.load(e.blocs, window.workspace);
        const champ = $('#nom-fichier');
        if (champ) { champ.value = morceau(r.groupe) + '_' + r.eleves.map(morceau).join('-') + '_' + morceau(e.id); champ.dispatchEvent(new Event('input')); }
        fermer();
    }
}

// ---------------------------------------------------------------- menu Fichier et reprise au chargement
function majMenu() {
    const active = moteur() && moteur().active();
    const rendre = $('#seance-rendre-btn'), quitter = $('#seance-quitter-btn');
    if (rendre) rendre.disabled = !active;
    if (quitter) quitter.hidden = !active;
}

const style = document.createElement('style');
style.textContent = `
.se-fenetre { width: min(1000px, 100%); }
.se-form { display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: end; margin: 10px 0; }
.se-form label, .se-libre { display: flex; flex-direction: column; gap: 3px; font-size: 12px; }
.se-libre { margin: 8px 0; }
#ex-voile .se-form input, #ex-voile .se-form select, #ex-voile .se-libre input, #ex-voile .se-libre select, #ex-voile textarea {
  padding: 5px 8px; border-radius: 4px; border: 1px solid var(--bordure-chrome, #555); background: var(--fond-saisie, #202020);
  color: var(--texte-saisie, #e6e6e6); font-family: inherit; font-size: 13px; }
#ex-voile textarea { width: 100%; box-sizing: border-box; resize: vertical; }
.se-niveau { margin: 6px 0 10px; }
.se-cases { display: flex; flex-wrap: wrap; gap: 4px 16px; margin: 4px 0; font-size: 12px; }
.se-cases label { display: inline-flex; align-items: center; gap: 4px; cursor: pointer; }
#ex-voile .se-petit { font-size: 11px; padding: 1px 8px; }
.se-nouveau { margin: 10px 0; } .se-nouveau summary { cursor: pointer; color: #ff7a33; font-weight: 600; }
.se-erreur { color: #e74c3c; font-size: 13px; min-height: 1em; margin: 4px 0; }
.se-depot { border: 2px dashed #ff5501; border-radius: 8px; padding: 16px; text-align: center; cursor: pointer; margin: 10px 0; }
.se-depot:hover { background: rgba(255, 85, 1, .08); }
#ex-voile .se-cell { padding: 2px 6px; font-size: 12px; white-space: nowrap; }
.se-table td { white-space: nowrap; }
`;
document.head.appendChild(style);

function brancher() {
    const lier = (id, f) => { const b = $('#' + id); if (b) b.addEventListener('click', f); };
    lier('seance-ouvrir-btn', ouvrirSeance);
    lier('seance-rendre-btn', () => window.seanceRendre());
    lier('seance-quitter-btn', () => window.seanceQuitter());
    lier('seance-enseignant-btn', () => fenetreEnseignant('creer'));
    // Reprise apres un rechargement de la page : la seance reste ouverte, le travail aussi.
    try {
        const a = JSON.parse(localStorage.getItem(CLE_ACTIVE) || 'null');
        if (a && a.def && a.eleves && moteur()) moteur().activer(a.def, a.eleves, a.groupe);
    } catch (e) { /* rien a reprendre */ }
    majMenu();
}
brancher();

window.seancesTest = { lireGroupes, regleDepuisEspace, demarrerSeance, ajouterRendus, csvRendus, nomRendu, fenetreEnseignant,
                       rendus: () => rendus, brouillon: () => brouillon, htmlRamasser };
