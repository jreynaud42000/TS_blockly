// un.js : Interface complète avec Animation du Texte
import { genererFichierHexFinal } from './deux.js';

try {
    // ==========================================
    // 0. OUTILS COMMUNS AUX GÉNÉRATEURS
    // ==========================================

    const P = Blockly.Python;

    // Le panneau Grove est câblé en section 5 ; tant que ce n'est pas fait, le
    // premier appel à updatePythonCode ne doit pas essayer de le rafraîchir.
    let panneauGrovePret = false;

    /**
     * Déclare `from microbit import *`.
     *
     * À appeler dans TOUT générateur qui produit du code touchant à l'API de la
     * carte (display, Image, button_a, accelerometer, compass, microphone,
     * SoundEvent, Sound, pin_logo, pinN, temperature(), running_time(), sleep(),
     * reset()). Sans cet import, le programme s'arrête au démarrage sur un
     * NameError.
     */
    function importerMicrobit() {
        P.definitions_['import_microbit'] = 'from microbit import *';
    }

    /** Déclare un module supplémentaire (audio, music, speech, radio, math, time, random). */
    function importerModule(nom) {
        P.definitions_['import_' + nom] = 'import ' + nom;
    }

    /** Une entrée convertie en texte : display et radio n'acceptent que des chaînes. */
    function versTexte(block, nomEntree, defaut) {
        return 'str(' + (P.valueToCode(block, nomEntree, P.ORDER_NONE) || (defaut || '""')) + ')';
    }

    // ==========================================
    // 1. CRÉATION DE TOUS LES BLOCS MICRO:BIT
    // ==========================================

    // ---------- Temps ----------

    Blockly.Blocks['attendre_temps'] = { init: function() {
        this.appendValueInput("TEMPS").setCheck("Number").appendField("attendre");
        this.appendDummyInput().appendField(new Blockly.FieldDropdown([
            ["seconde.s", "s"], ["milliseconde.s", "ms"]
        ]), "UNITE");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(230);
    }};
    P.forBlock['attendre_temps'] = function(block) {
        importerMicrobit();
        const temps = P.valueToCode(block, 'TEMPS', P.ORDER_ATOMIC) || '0';
        return block.getFieldValue('UNITE') === 's'
            ? 'sleep(' + temps + ' * 1000)\n'
            : 'sleep(' + temps + ')\n';
    };

    Blockly.Blocks['attendre_jusqua'] = { init: function() {
        this.appendValueInput("CONDITION").setCheck("Boolean").appendField("attendre jusqu'à");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(230);
    }};
    P.forBlock['attendre_jusqua'] = function(block) {
        importerMicrobit();
        const condition = P.valueToCode(block, 'CONDITION', P.ORDER_ATOMIC) || 'False';
        return 'while not (' + condition + '):\n' + P.INDENT + 'sleep(10)\n';
    };

    // Champs répartis sur trois lignes : sur une seule, le bloc faisait 539 px
    // et imposait à lui seul la largeur du tiroir de la catégorie.
    Blockly.Blocks['repeter_toutes_les'] = { init: function() {
        this.appendDummyInput().appendField("répéter toutes les");
        this.appendDummyInput()
            .appendField(new Blockly.FieldNumber(0, 0), "H").appendField("h")
            .appendField(new Blockly.FieldNumber(0, 0), "M").appendField("min");
        this.appendDummyInput()
            .appendField(new Blockly.FieldNumber(1, 0), "S").appendField("s")
            .appendField(new Blockly.FieldNumber(0, 0), "MS").appendField("ms");
        this.appendStatementInput("DO").setCheck(null);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(230);
    }};
    P.forBlock['repeter_toutes_les'] = function(block) {
        importerMicrobit();
        const h = block.getFieldValue('H') || 0;
        const m = block.getFieldValue('M') || 0;
        const s = block.getFieldValue('S') || 0;
        const ms = block.getFieldValue('MS') || 0;
        const total = (h * 3600000) + (m * 60000) + (s * 1000) + Number(ms);
        const branche = P.statementToCode(block, 'DO') || P.INDENT + 'pass\n';
        return 'while True:\n' + branche + P.INDENT + 'sleep(' + total + ')\n';
    };

    Blockly.Blocks['reset_chrono'] = { init: function() {
        this.appendDummyInput().appendField("remettre le chronomètre à 0");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(230);
    }};
    P.forBlock['reset_chrono'] = function(block) {
        importerMicrobit();
        return '_timer_start = running_time()\n';
    };

    Blockly.Blocks['valeur_chrono'] = { init: function() {
        this.appendDummyInput().appendField("valeur du chronomètre en")
            .appendField(new Blockly.FieldDropdown([["(s)", "s"], ["(ms)", "ms"]]), "UNITE");
        this.setOutput(true, "Number");
        this.setColour(230);
    }};
    P.forBlock['valeur_chrono'] = function(block) {
        importerMicrobit();
        let code = '(running_time() - globals().get("_timer_start", 0))';
        if (block.getFieldValue('UNITE') === 's') code += ' / 1000';
        return [code, P.ORDER_ATOMIC];
    };

    // ---------- Affichage ----------

    Blockly.Blocks['afficher_valeur'] = { init: function() {
        this.appendValueInput("VALEUR").appendField("afficher");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(160);
    }};
    P.forBlock['afficher_valeur'] = function(block) {
        importerMicrobit();
        return 'display.show(' + versTexte(block, 'VALEUR') + ')\n';
    };

    Blockly.Blocks['faire_defiler'] = { init: function() {
        this.appendValueInput("VALEUR").appendField("faire défiler");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(160);
    }};
    P.forBlock['faire_defiler'] = function(block) {
        importerMicrobit();
        return 'display.scroll(' + versTexte(block, 'VALEUR') + ')\n';
    };

    Blockly.Blocks['afficher_icone'] = { init: function() {
        this.appendDummyInput().appendField("afficher l'icône")
            .appendField(new Blockly.FieldDropdown([
                ["Cœur", "HEART"], ["Heureux", "HAPPY"], ["Triste", "SAD"], ["Fantôme", "GHOST"]
            ]), "ICONE");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(160);
    }};
    P.forBlock['afficher_icone'] = function(block) {
        importerMicrobit();
        return 'display.show(Image.' + block.getFieldValue('ICONE') + ')\n';
    };

    Blockly.Blocks['afficher_image_matrice'] = { init: function() {
        this.appendDummyInput().appendField("afficher l'image");
        for (let y = 0; y < 5; y++) {
            const ligne = this.appendDummyInput();
            for (let x = 0; x < 5; x++) {
                ligne.appendField(new Blockly.FieldCheckbox("FALSE"), "LED_" + x + "_" + y);
            }
        }
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(160);
    }};
    P.forBlock['afficher_image_matrice'] = function(block) {
        importerMicrobit();
        let image = "";
        for (let y = 0; y < 5; y++) {
            for (let x = 0; x < 5; x++) {
                image += block.getFieldValue("LED_" + x + "_" + y) === 'TRUE' ? "9" : "0";
            }
            if (y < 4) image += ":";
        }
        return 'display.show(Image("' + image + '"))\n';
    };

    Blockly.Blocks['effacer_ecran'] = { init: function() {
        this.appendDummyInput().appendField("effacer l'écran");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(160);
    }};
    P.forBlock['effacer_ecran'] = function(block) {
        importerMicrobit();
        return 'display.clear()\n';
    };

    // ---------- Blocs « lorsque … » ----------
    //
    // MicroPython n'a pas de système d'événements : ces blocs produisent une
    // fonction, que la boucle construite en section 4 vient appeler. Tout nom
    // `on_…` défini ici DOIT avoir son entrée correspondante dans GESTIONNAIRES,
    // sans quoi le bloc reste sans effet.

    /**
     * Declare une fonction de gestionnaire en tete de programme.
     *
     * Les blocs « lorsque ... » se posent n'importe ou, et Blockly genere les
     * blocs de premier niveau dans l'ordre de leur position. Une fonction posee
     * sous la boucle serait donc definie apres l'appel qui l'utilise, d'ou un
     * NameError a l'execution. En passant par definitions_, elle remonte avant
     * tout le code executable, quelle que soit la disposition des blocs.
     */
    function declarerGestionnaire(nom, corps) {
        const contenu = corps.replace(/\s+$/, '');
        P.definitions_['gestionnaire_' + nom] =
            'def ' + nom + '():' + '\n' + (contenu ? contenu : P.INDENT + 'pass');
        return '';
    }
    Blockly.Blocks['lorsque_bouton'] = { init: function() {
        this.appendDummyInput().appendField("lorsque le bouton")
            .appendField(new Blockly.FieldDropdown([["A", "a"], ["B", "b"], ["A+B", "ab"]]), "BOUTON")
            .appendField("est pressé");
        this.appendStatementInput("DO").setCheck(null);
        this.setColour(300);
    }};
    P.forBlock['lorsque_bouton'] = function(block) {
        importerMicrobit();
        return declarerGestionnaire('on_button_pressed_' + block.getFieldValue('BOUTON'), P.statementToCode(block, 'DO'));
    };

    Blockly.Blocks['lorsque_geste'] = { init: function() {
        this.appendDummyInput().appendField("lorsque")
            .appendField(new Blockly.FieldDropdown([
                ["secouer", "shake"], ["logo vers le haut", "up"], ["logo vers le bas", "down"]
            ]), "GESTE");
        this.appendStatementInput("DO").setCheck(null);
        this.setColour(300);
    }};
    P.forBlock['lorsque_geste'] = function(block) {
        importerMicrobit();
        return declarerGestionnaire('on_gesture_' + block.getFieldValue('GESTE'), P.statementToCode(block, 'DO'));
    };

    Blockly.Blocks['lorsque_broche'] = { init: function() {
        this.appendDummyInput().appendField("lorsque la broche")
            .appendField(new Blockly.FieldDropdown([["P0", "pin0"], ["P1", "pin1"], ["P2", "pin2"]]), "BROCHE")
            .appendField("est")
            .appendField(new Blockly.FieldDropdown([["activée", "touched"], ["relachée", "released"]]), "ETAT");
        this.appendStatementInput("DO").setCheck(null);
        this.setColour(300);
    }};
    P.forBlock['lorsque_broche'] = function(block) {
        importerMicrobit();
        return declarerGestionnaire('on_pin_' + block.getFieldValue('BROCHE') + '_' + block.getFieldValue('ETAT'), P.statementToCode(block, 'DO'));
    };

    Blockly.Blocks['lorsque_son_detecte'] = { init: function() {
        this.appendDummyInput().appendField("lorsque le son")
            .appendField(new Blockly.FieldDropdown([["bruyant", "LOUD"], ["faible", "QUIET"]]), "SON")
            .appendField("est detecté");
        this.appendStatementInput("DO").setCheck(null);
        this.setColour(300);
    }};
    P.forBlock['lorsque_son_detecte'] = function(block) {
        importerMicrobit();
        return declarerGestionnaire('on_sound_' + block.getFieldValue('SON'), P.statementToCode(block, 'DO'));
    };

    Blockly.Blocks['lorsque_logo'] = { init: function() {
        this.appendDummyInput().appendField("sur le logo")
            .appendField(new Blockly.FieldDropdown([["appuyé", "touched"], ["relaché", "released"]]), "ACTION");
        this.appendStatementInput("DO").setCheck(null);
        this.setColour(300);
    }};
    P.forBlock['lorsque_logo'] = function(block) {
        importerMicrobit();
        return declarerGestionnaire('on_logo_' + block.getFieldValue('ACTION'), P.statementToCode(block, 'DO'));
    };

    // ---------- Entrées / Sorties ----------

    /** Condition « bouton pressé », commune à deux blocs. */
    function conditionBouton(bouton) {
        if (bouton === 'a') return 'button_a.is_pressed()';
        if (bouton === 'b') return 'button_b.is_pressed()';
        return '(button_a.is_pressed() and button_b.is_pressed())';
    }

    Blockly.Blocks['si_bouton_appuye'] = { init: function() {
        this.appendDummyInput().appendField("si le bouton")
            .appendField(new Blockly.FieldDropdown([["A", "a"], ["B", "b"], ["A+B", "ab"]]), "BOUTON")
            .appendField("est appuyé alors");
        this.appendStatementInput("DO").setCheck(null);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(210);
    }};
    P.forBlock['si_bouton_appuye'] = function(block) {
        importerMicrobit();
        const branche = P.statementToCode(block, 'DO') || P.INDENT + 'pass\n';
        return 'if ' + conditionBouton(block.getFieldValue('BOUTON')) + ':\n' + branche;
    };

    Blockly.Blocks['si_logo_touche'] = { init: function() {
        this.appendDummyInput().appendField("si LOGO est touché alors");
        this.appendStatementInput("DO").setCheck(null);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(210);
    }};
    P.forBlock['si_logo_touche'] = function(block) {
        importerMicrobit();
        const branche = P.statementToCode(block, 'DO') || P.INDENT + 'pass\n';
        return 'if pin_logo.is_touched():\n' + branche;
    };

    Blockly.Blocks['si_secoue_alors'] = { init: function() {
        this.appendDummyInput().appendField("si secoué alors");
        this.appendStatementInput("DO").setCheck(null);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(210);
    }};
    P.forBlock['si_secoue_alors'] = function(block) {
        importerMicrobit();
        const branche = P.statementToCode(block, 'DO') || P.INDENT + 'pass\n';
        return 'if accelerometer.was_gesture("shake"):\n' + branche;
    };

    Blockly.Blocks['bouton_est_appuye'] = { init: function() {
        this.appendDummyInput().appendField("bouton")
            .appendField(new Blockly.FieldDropdown([["A", "a"], ["B", "b"], ["A+B", "ab"]]), "BOUTON")
            .appendField("est appuyé");
        this.setOutput(true, "Boolean");
        this.setColour(300);
    }};
    P.forBlock['bouton_est_appuye'] = function(block) {
        importerMicrobit();
        return [conditionBouton(block.getFieldValue('BOUTON')), P.ORDER_ATOMIC];
    };

    Blockly.Blocks['broche_est_pressee'] = { init: function() {
        this.appendDummyInput().appendField("broche")
            .appendField(new Blockly.FieldDropdown([["P0", "pin0"], ["P1", "pin1"], ["P2", "pin2"]]), "BROCHE")
            .appendField("est pressée");
        this.setOutput(true, "Boolean");
        this.setColour(300);
    }};
    P.forBlock['broche_est_pressee'] = function(block) {
        importerMicrobit();
        return [block.getFieldValue('BROCHE') + '.is_touched()', P.ORDER_ATOMIC];
    };

    Blockly.Blocks['geste_est_actif'] = { init: function() {
        this.appendDummyInput().appendField("geste")
            .appendField(new Blockly.FieldDropdown([
                ["secouer", "shake"], ["logo vers le haut", "up"], ["logo vers le bas", "down"]
            ]), "GESTE")
            .appendField("est actif");
        this.setOutput(true, "Boolean");
        this.setColour(300);
    }};
    P.forBlock['geste_est_actif'] = function(block) {
        importerMicrobit();
        return ['accelerometer.is_gesture("' + block.getFieldValue('GESTE') + '")', P.ORDER_ATOMIC];
    };

    Blockly.Blocks['logo_est_touche'] = { init: function() {
        this.appendDummyInput().appendField("le logo est appuyé");
        this.setOutput(true, "Boolean");
        this.setColour(300);
    }};
    P.forBlock['logo_est_touche'] = function(block) {
        importerMicrobit();
        return ['pin_logo.is_touched()', P.ORDER_ATOMIC];
    };

    Blockly.Blocks['nombre_clics_bouton'] = { init: function() {
        this.appendDummyInput().appendField("nombre de clics du bouton")
            .appendField(new Blockly.FieldDropdown([["A", "a"], ["B", "b"]]), "BOUTON");
        this.setOutput(true, "Number");
        this.setColour(210);
    }};
    P.forBlock['nombre_clics_bouton'] = function(block) {
        importerMicrobit();
        return ['button_' + block.getFieldValue('BOUTON') + '.get_presses()', P.ORDER_ATOMIC];
    };

    Blockly.Blocks['reinitialiser_microbit'] = { init: function() {
        this.appendDummyInput().appendField("[Micro:bit] réinitialiser la carte");
        this.setPreviousStatement(true, null);
        this.setColour(210);
    }};
    P.forBlock['reinitialiser_microbit'] = function(block) {
        importerMicrobit();
        return 'reset()\n';
    };

    // ---------- Capteurs ----------

    Blockly.Blocks['capteur_acceleration'] = { init: function() {
        this.appendDummyInput().appendField("accélération (mg)")
            .appendField(new Blockly.FieldDropdown([["x", "x"], ["y", "y"], ["z", "z"], ["force", "strength"]]), "AXIS");
        this.setOutput(true, "Number");
        this.setColour(300);
    }};
    P.forBlock['capteur_acceleration'] = function(block) {
        importerMicrobit();
        const axe = block.getFieldValue('AXIS');
        const code = axe === 'strength' ? 'accelerometer.get_strength()' : 'accelerometer.get_' + axe + '()';
        return [code, P.ORDER_ATOMIC];
    };

    Blockly.Blocks['capteur_luminosite'] = { init: function() {
        this.appendDummyInput().appendField("niveau d'intensité lumineuse");
        this.setOutput(true, "Number");
        this.setColour(300);
    }};
    P.forBlock['capteur_luminosite'] = function(block) {
        importerMicrobit();
        return ['display.read_light_level()', P.ORDER_ATOMIC];
    };

    Blockly.Blocks['capteur_boussole_direction'] = { init: function() {
        this.appendDummyInput().appendField("direction de la boussole (°)");
        this.setOutput(true, "Number");
        this.setColour(300);
    }};
    P.forBlock['capteur_boussole_direction'] = function(block) {
        importerMicrobit();
        return ['compass.heading()', P.ORDER_ATOMIC];
    };

    Blockly.Blocks['capteur_boussole_force'] = { init: function() {
        this.appendDummyInput().appendField("force magnétique (µT)")
            .appendField(new Blockly.FieldDropdown([["x", "x"], ["y", "y"], ["z", "z"], ["force", "strength"]]), "AXIS");
        this.setOutput(true, "Number");
        this.setColour(300);
    }};
    P.forBlock['capteur_boussole_force'] = function(block) {
        importerMicrobit();
        const axe = block.getFieldValue('AXIS');
        const code = axe === 'strength' ? 'compass.get_field_strength()' : 'compass.get_' + axe + '()';
        return [code, P.ORDER_ATOMIC];
    };

    Blockly.Blocks['capteur_boussole_calibrer'] = { init: function() {
        this.appendDummyInput().appendField("calibrer la boussole");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(300);
    }};
    P.forBlock['capteur_boussole_calibrer'] = function(block) {
        importerMicrobit();
        return 'compass.calibrate()\n';
    };

    Blockly.Blocks['capteur_temperature'] = { init: function() {
        this.appendDummyInput().appendField("température (° C)");
        this.setOutput(true, "Number");
        this.setColour(300);
    }};
    P.forBlock['capteur_temperature'] = function(block) {
        importerMicrobit();
        return ['temperature()', P.ORDER_ATOMIC];
    };

    Blockly.Blocks['capteur_rotation'] = { init: function() {
        this.appendDummyInput().appendField("rotation (°)")
            .appendField(new Blockly.FieldDropdown([["pitch", "pitch"], ["roll", "roll"]]), "AXIS");
        this.setOutput(true, "Number");
        this.setColour(300);
    }};
    P.forBlock['capteur_rotation'] = function(block) {
        importerMicrobit();
        importerModule('math');
        if (block.getFieldValue('AXIS') === 'pitch') {
            P.definitions_['def_pitch'] =
                'def get_pitch():\n' +
                '    x, y, z = accelerometer.get_values()\n' +
                '    return int(math.atan2(y, math.sqrt(x*x + z*z)) * 180 / math.pi)';
            return ['get_pitch()', P.ORDER_ATOMIC];
        }
        P.definitions_['def_roll'] =
            'def get_roll():\n' +
            '    x, y, z = accelerometer.get_values()\n' +
            '    return int(math.atan2(-x, z) * 180 / math.pi)';
        return ['get_roll()', P.ORDER_ATOMIC];
    };

    Blockly.Blocks['temps_execution'] = { init: function() {
        this.appendDummyInput().appendField("temps d'exécution")
            .appendField(new Blockly.FieldDropdown([["(ms)", "ms"], ["(micros)", "us"]]), "UNITE");
        this.setOutput(true, "Number");
        this.setColour(300);
    }};
    P.forBlock['temps_execution'] = function(block) {
        importerMicrobit();
        if (block.getFieldValue('UNITE') === 'ms') {
            return ['running_time()', P.ORDER_ATOMIC];
        }
        importerModule('time');
        return ['time.ticks_us()', P.ORDER_ATOMIC];
    };

    Blockly.Blocks['gamme_accelerometre'] = { init: function() {
        this.appendDummyInput().appendField("spécifier la gamme de l'acceleromètre")
            .appendField(new Blockly.FieldDropdown([["1g", "1"], ["2g", "2"], ["4g", "4"], ["8g", "8"]]), "GAMME");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(300);
    }};
    P.forBlock['gamme_accelerometre'] = function(block) {
        importerMicrobit();
        return 'accelerometer.set_range(' + block.getFieldValue('GAMME') + ')\n';
    };

    Blockly.Blocks['micro_intensite_son'] = { init: function() {
        this.appendDummyInput().appendField("niveau sonore");
        this.setOutput(true, "Number");
        this.setColour(300);
    }};
    P.forBlock['micro_intensite_son'] = function(block) {
        importerMicrobit();
        return ['microphone.sound_level()', P.ORDER_ATOMIC];
    };

    Blockly.Blocks['micro_definir_seuil'] = { init: function() {
        this.appendDummyInput().appendField("définit le seuil du son")
            .appendField(new Blockly.FieldDropdown([["bruyant", "LOUD"], ["faible", "QUIET"]]), "SON")
            .appendField("à");
        this.appendValueInput("SEUIL").setCheck("Number");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(300);
        this.setInputsInline(true);
    }};
    P.forBlock['micro_definir_seuil'] = function(block) {
        importerMicrobit();
        const seuil = P.valueToCode(block, 'SEUIL', P.ORDER_ATOMIC) || '128';
        return 'microphone.set_threshold(SoundEvent.' + block.getFieldValue('SON') + ', ' + seuil + ')\n';
    };

    // ---------- Actionneurs (audio) ----------

    Blockly.Blocks['audio_jouer'] = { init: function() {
        this.appendDummyInput().appendField("[Audio] jouer la musique")
            .appendField(new Blockly.FieldDropdown([
                ["Giggle", "GIGGLE"], ["Happy", "HAPPY"], ["Hello", "HELLO"],
                ["Sad", "SAD"], ["Twinkle", "TWINKLE"]
            ]), "SON");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(330);
    }};
    P.forBlock['audio_jouer'] = function(block) {
        importerMicrobit();          // `Sound` appartient au module microbit
        importerModule('audio');
        return 'audio.play(Sound.' + block.getFieldValue('SON') + ')\n';
    };

    Blockly.Blocks['audio_arreter'] = { init: function() {
        this.appendDummyInput().appendField("[Audio] arrêter la musique");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(330);
    }};
    P.forBlock['audio_arreter'] = function(block) {
        importerModule('audio');
        return 'audio.stop()\n';
    };

    Blockly.Blocks['music_jouer_melodie'] = { init: function() {
        this.appendDummyInput().appendField("[Music] jouer la mélodie")
            .appendField(new Blockly.FieldDropdown([
                ["Dadadadum", "DADADADUM"], ["Pirates", "PUNCHLINE"], ["Entertainer", "ENTERTAINER"]
            ]), "MELODY");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(330);
    }};
    P.forBlock['music_jouer_melodie'] = function(block) {
        importerModule('music');
        return 'music.play(music.' + block.getFieldValue('MELODY') + ')\n';
    };

    Blockly.Blocks['speech_dire'] = { init: function() {
        this.appendValueInput("TEXT").setCheck("String").appendField("[Speech] dire");
        this.appendDummyInput()
            .appendField("vitesse").appendField(new Blockly.FieldNumber(100, 0, 255), "SPEED");
        this.appendDummyInput()
            .appendField("hauteur").appendField(new Blockly.FieldNumber(100, 0, 255), "PITCH");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(330);
    }};
    P.forBlock['speech_dire'] = function(block) {
        importerModule('speech');
        const texte = P.valueToCode(block, 'TEXT', P.ORDER_ATOMIC) || '""';
        return 'speech.say(' + texte + ', speed=' + block.getFieldValue('SPEED') +
               ', pitch=' + block.getFieldValue('PITCH') + ')\n';
    };

    // ---------- Communication ----------

    Blockly.Blocks['radio_activer'] = { init: function() {
        this.appendDummyInput().appendField("allumer la radio");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(120);
    }};
    P.forBlock['radio_activer'] = function(block) {
        importerModule('radio');
        return 'radio.on()\n';
    };

    // Pas de setCheck sur l'entrée : on veut pouvoir envoyer un nombre (une
    // température, un compteur). La conversion est faite par le générateur, car
    // radio.send() n'accepte que des chaînes.
    Blockly.Blocks['radio_envoyer_texte'] = { init: function() {
        this.appendValueInput("MESSAGE").appendField("envoyer msg radio");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(120);
    }};
    P.forBlock['radio_envoyer_texte'] = function(block) {
        importerModule('radio');
        return 'radio.send(' + versTexte(block, 'MESSAGE') + ')\n';
    };

    // Bloc de demarrage : son contenu s'execute une fois, avant tout le reste.
    // Ni encoche du dessus ni du dessous — il vit seul, comme dans MakeCode.
    Blockly.Blocks['au_demarrage'] = { init: function() {
        this.appendDummyInput().appendField("Au démarrage");
        this.appendStatementInput("DO").setCheck(null);
        this.setColour(120);
        this.setTooltip("Exécuté une seule fois au démarrage de la carte, avant les boucles.");
    }};
    P.forBlock['au_demarrage'] = function(block) {
        const branche = P.statementToCode(block, 'DO');
        if (!branche.trim()) return '';
        // statementToCode indente d'un cran ; ce code est de premier niveau,
        // on le remet donc a plat.
        return branche.replace(new RegExp('^' + P.INDENT, 'gm'), '');
    };

    // ---------- Radio ----------
    //
    // MicroPython n'envoie que du texte : radio.send(chaine). MakeCode, lui,
    // encode des paquets binaires types. Les deux ne s'entendent donc PAS sur
    // les ondes. On adopte une convention texte simple, lisible et symetrique :
    //   un nombre      -> "42"
    //   un couple      -> "temperature=21"
    //   une chaine     -> "bonjour"
    // La reception decide du type d'apres la forme du message recu.

    const COULEUR_RADIO = 120;

    function piloteRadio() {
        importerMicrobit();
        importerModule('radio');
        pilote('radio', [
            '_radio_dernier = ["", "", "", 0]   # texte, nom, valeur, force du signal',
            '',
            'def _radio_nombre(texte):',
            '    try:',
            '        return int(texte)',
            '    except:',
            '        pass',
            '    try:',
            '        return float(texte)',
            '    except:',
            '        return None',
            '',
            'def _radio_traiter():',
            '    paquet = radio.receive_full()',
            '    if paquet is None:',
            '        return',
            '    message = str(paquet[0], "utf-8")',
            '    _radio_dernier[0] = message',
            '    _radio_dernier[3] = paquet[1]',
            '    g = globals()',
            '    if "=" in message:',
            '        nom, _, valeur = message.partition("=")',
            '        _radio_dernier[1] = nom',
            '        _radio_dernier[2] = valeur',
            '        if "on_radio_valeur" in g:',
            '            g["on_radio_valeur"]()',
            '            return',
            '    nombre = _radio_nombre(message)',
            '    if nombre is not None and "on_radio_nombre" in g:',
            '        g["on_radio_nombre"]()',
            '        return',
            '    if "on_radio_texte" in g:',
            '        g["on_radio_texte"]()',
        ]);
    }

    Blockly.Blocks['radio_groupe'] = { init: function() {
        this.appendValueInput("GROUPE").setCheck("Number").appendField("radio : définir le groupe");
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COULEUR_RADIO);
        this.setTooltip("De 0 à 255. Seules les cartes du même groupe s'entendent.");
    }};
    P.forBlock['radio_groupe'] = function(block) {
        piloteRadio();
        return 'radio.config(group=' + (P.valueToCode(block, 'GROUPE', P.ORDER_NONE) || '1') + ')\n';
    };

    Blockly.Blocks['radio_envoyer_nombre'] = { init: function() {
        this.appendValueInput("NOMBRE").setCheck("Number").appendField("envoyer le nombre");
        this.appendDummyInput().appendField("par radio");
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COULEUR_RADIO);
    }};
    P.forBlock['radio_envoyer_nombre'] = function(block) {
        piloteRadio();
        return 'radio.send(str(' + (P.valueToCode(block, 'NOMBRE', P.ORDER_NONE) || '0') + '))\n';
    };

    Blockly.Blocks['radio_envoyer_valeur'] = { init: function() {
        this.appendValueInput("NOM").appendField("envoyer la valeur");
        this.appendValueInput("VALEUR").appendField("=");
        this.appendDummyInput().appendField("par radio");
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COULEUR_RADIO);
        this.setTooltip("Envoie « nom=valeur », que la réception sait relire.");
    }};
    P.forBlock['radio_envoyer_valeur'] = function(block) {
        piloteRadio();
        return 'radio.send(' + versTexte(block, 'NOM') + ' + "=" + ' +
               versTexte(block, 'VALEUR') + ')\n';
    };

    // --- Reception ---

    const TYPES_RADIO = [
        ["un nombre", "nombre"], ["une valeur nommée", "valeur"], ["du texte", "texte"]
    ];

    Blockly.Blocks['radio_quand_recu'] = { init: function() {
        this.appendDummyInput().appendField("quand la radio reçoit")
            .appendField(new Blockly.FieldDropdown(TYPES_RADIO), "TYPE");
        this.appendStatementInput("DO").setCheck(null);
        this.setColour(COULEUR_RADIO);
        this.setTooltip("Le type est déduit du message reçu : « 42 » est un nombre, " +
                        "« nom=valeur » une valeur nommée, le reste du texte.");
    }};
    P.forBlock['radio_quand_recu'] = function(block) {
        piloteRadio();
        return declarerGestionnaire('on_radio_' + block.getFieldValue('TYPE'),
                                    P.statementToCode(block, 'DO'));
    };

    // Valeurs distinctes obligatoires : deux options de meme valeur rendent le
    // menu ambigu, Blockly resolvant toujours vers la premiere.
    const LECTURES_RADIO = [
        ["le nombre reçu", "nombre"], ["le nom reçu", "nom"],
        ["la valeur reçue", "valeur"], ["le texte reçu", "texte"],
        ["la force du signal", "force"]
    ];
    const RANGS_RADIO = { texte: 0, nom: 1, valeur: 2, force: 3 };

    Blockly.Blocks['radio_lecture'] = { init: function() {
        this.appendDummyInput().appendField("radio :")
            .appendField(new Blockly.FieldDropdown(LECTURES_RADIO), "QUOI");
        this.setOutput(true, null);
        this.setColour(COULEUR_RADIO);
        this.setTooltip("À utiliser dans un bloc « quand la radio reçoit ».");
    }};
    P.forBlock['radio_lecture'] = function(block) {
        piloteRadio();
        const quoi = block.getFieldValue('QUOI');
        // Le message circule en texte : le nombre est reconverti a la lecture.
        if (quoi === 'nombre') return ['_radio_nombre(_radio_dernier[0])', P.ORDER_FUNCTION_CALL];
        return ['_radio_dernier[' + RANGS_RADIO[quoi] + ']', P.ORDER_MEMBER];
    };

    // --- Reglages avances ---

    Blockly.Blocks['radio_puissance'] = { init: function() {
        this.appendValueInput("NIVEAU").setCheck("Number")
            .appendField("radio : puissance d'émission");
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COULEUR_RADIO);
        this.setTooltip("De 0 (portée minimale) à 7 (maximale).");
    }};
    P.forBlock['radio_puissance'] = function(block) {
        piloteRadio();
        return 'radio.config(power=' + (P.valueToCode(block, 'NIVEAU', P.ORDER_NONE) || '7') + ')\n';
    };

    Blockly.Blocks['radio_canal'] = { init: function() {
        this.appendValueInput("CANAL").setCheck("Number")
            .appendField("radio : bande de fréquence");
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COULEUR_RADIO);
        this.setTooltip("De 0 à 83. Deux bandes différentes ne se gênent pas.");
    }};
    P.forBlock['radio_canal'] = function(block) {
        piloteRadio();
        return 'radio.config(channel=' + (P.valueToCode(block, 'CANAL', P.ORDER_NONE) || '7') + ')\n';
    };

    Blockly.Blocks['boucle_infinie'] = { init: function() {
        this.appendDummyInput().appendField("Répéter indéfiniment");
        this.appendStatementInput("DO").setCheck(null);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(120);
    }};
    P.forBlock['boucle_infinie'] = function(block) {
        const branche = P.statementToCode(block, 'DO') || P.INDENT + 'pass\n';
        return 'while True:\n' + branche;
    };

    // ---------- Maths ----------

    Blockly.Blocks['math_min_max'] = { init: function() {
        this.appendValueInput("A").setCheck("Number")
            .appendField(new Blockly.FieldDropdown([["min", "min"], ["max", "max"]]), "OP").appendField("de");
        this.appendValueInput("B").setCheck("Number").appendField("et");
        this.setOutput(true, "Number");
        this.setColour(280);
    }};
    P.forBlock['math_min_max'] = function(block) {
        const a = P.valueToCode(block, 'A', P.ORDER_NONE) || '0';
        const b = P.valueToCode(block, 'B', P.ORDER_NONE) || '0';
        return [block.getFieldValue('OP') + '(' + a + ', ' + b + ')', P.ORDER_FUNCTION_CALL];
    };

    Blockly.Blocks['math_absolue'] = { init: function() {
        this.appendValueInput("NUM").setCheck("Number").appendField("valeur absolue de");
        this.setOutput(true, "Number");
        this.setColour(280);
    }};
    P.forBlock['math_absolue'] = function(block) {
        const num = P.valueToCode(block, 'NUM', P.ORDER_NONE) || '0';
        return ['abs(' + num + ')', P.ORDER_FUNCTION_CALL];
    };

    Blockly.Blocks['math_racine'] = { init: function() {
        this.appendValueInput("NUM").setCheck("Number")
            .appendField(new Blockly.FieldDropdown([["racine carrée", "sqrt"]]), "OP");
        this.setOutput(true, "Number");
        this.setColour(280);
    }};
    P.forBlock['math_racine'] = function(block) {
        importerModule('math');
        const num = P.valueToCode(block, 'NUM', P.ORDER_NONE) || '0';
        return ['math.sqrt(' + num + ')', P.ORDER_FUNCTION_CALL];
    };

    Blockly.Blocks['math_arrondi_custom'] = { init: function() {
        this.appendValueInput("NUM").setCheck("Number")
            .appendField(new Blockly.FieldDropdown([
                ["arrondi", "round"], ["arrondi supérieur", "ceil"], ["arrondi inférieur", "floor"]
            ]), "OP");
        this.setOutput(true, "Number");
        this.setColour(280);
    }};
    P.forBlock['math_arrondi_custom'] = function(block) {
        const op = block.getFieldValue('OP');
        const num = P.valueToCode(block, 'NUM', P.ORDER_NONE) || '0';
        if (op === 'round') return ['round(' + num + ')', P.ORDER_FUNCTION_CALL];
        importerModule('math');
        return ['math.' + op + '(' + num + ')', P.ORDER_FUNCTION_CALL];
    };

    Blockly.Blocks['math_random_bool'] = { init: function() {
        this.appendDummyInput().appendField("choisir au hasard vrai ou faux");
        this.setOutput(true, "Boolean");
        this.setColour(280);
    }};
    P.forBlock['math_random_bool'] = function(block) {
        importerModule('random');
        return ['random.choice([True, False])', P.ORDER_FUNCTION_CALL];
    };

    Blockly.Blocks['math_convert'] = { init: function() {
        this.appendValueInput("NUM").setCheck("Number").appendField("convert");
        this.appendDummyInput().appendField("from")
            .appendField(new Blockly.FieldDropdown([
                ["degrees to radians", "radians"], ["radians to degrees", "degrees"]
            ]), "OP");
        this.setOutput(true, "Number");
        this.setColour(280);
        this.setInputsInline(false);
    }};
    P.forBlock['math_convert'] = function(block) {
        importerModule('math');
        const num = P.valueToCode(block, 'NUM', P.ORDER_NONE) || '0';
        return ['math.' + block.getFieldValue('OP') + '(' + num + ')', P.ORDER_FUNCTION_CALL];
    };

    Blockly.Blocks['math_map'] = { init: function() {
        this.appendValueInput("VAL").setCheck("Number").appendField("projeter");
        this.appendValueInput("FROMLOW").setCheck("Number").appendField("de");
        this.appendValueInput("FROMHIGH").setCheck("Number").appendField("et");
        this.appendValueInput("TOLOW").setCheck("Number").appendField("à");
        this.appendValueInput("TOHIGH").setCheck("Number").appendField("et");
        this.setOutput(true, "Number");
        this.setColour(280);
        this.setInputsInline(false);
    }};
    P.forBlock['math_map'] = function(block) {
        P.definitions_['def_map'] =
            'def map_val(value, from_low, from_high, to_low, to_high):\n' +
            '    return (value - from_low) * (to_high - to_low) / (from_high - from_low) + to_low';
        const val = P.valueToCode(block, 'VAL', P.ORDER_NONE) || '0';
        const fromL = P.valueToCode(block, 'FROMLOW', P.ORDER_NONE) || '0';
        const fromH = P.valueToCode(block, 'FROMHIGH', P.ORDER_NONE) || '1023';
        const toL = P.valueToCode(block, 'TOLOW', P.ORDER_NONE) || '0';
        const toH = P.valueToCode(block, 'TOHIGH', P.ORDER_NONE) || '4';
        return ['map_val(' + val + ', ' + fromL + ', ' + fromH + ', ' + toL + ', ' + toH + ')',
                P.ORDER_FUNCTION_CALL];
    };

    // ---------- Servomoteurs ----------
    //
    // Conventions reprises de MakeCode (pxt-common-packages, libs/servo) :
    // angle 0-180 correspondant a une impulsion de 500 a 2500 us dans une
    // periode de 20 ms, soit 50 Hz. L'intervalle borne l'angle, le mini restant
    // entre 0 et 90 et le maxi entre 90 et 180.

    const COULEUR_SERVO = 140;
    const BROCHES_SERVO = [["P0", "pin0"], ["P1", "pin1"], ["P2", "pin2"]];
    const menuBrocheServo = () => new Blockly.FieldDropdown(BROCHES_SERVO);
    /** Nom lisible de la broche, qui sert de clé d'état côté MicroPython. */
    const nomBroche = block => block.getFieldValue('BROCHE').replace('pin', 'P');

    function piloteServo() {
        importerMicrobit();
        P.definitions_['servo_pilote'] =
            '# >>> pilote servo\n' + [
            '# Un servomoteur attend une impulsion de 500 a 2500 us toutes les 20 ms.',
            '# write_analog prend un rapport cyclique sur 1023 : d ou la conversion.',
            '_SERVO_ETAT = {}',
            '',
            'def _servo_etat(nom):',
            '    if nom not in _SERVO_ETAT:',
            '        _SERVO_ETAT[nom] = [0, 180, False]   # angle mini, maxi, arret au neutre',
            '    return _SERVO_ETAT[nom]',
            '',
            'def _servo_impulsion(broche, microsecondes, nom=""):',
            '    microsecondes = max(500, min(2500, int(microsecondes)))',
            '    broche.set_analog_period(20)',
            '    broche.write_analog(int(microsecondes * 1023 / 20000))',
            '',
            'def _servo_angle(broche, nom, angle):',
            '    etat = _servo_etat(nom)',
            '    angle = max(etat[0], min(etat[1], int(angle)))',
            '    _servo_impulsion(broche, 500 + angle * 2000 / 180, nom)',
            '',
            'def _servo_arreter(broche, nom):',
            '    # On cesse d envoyer des impulsions : le servo reste ou il est.',
            '    broche.write_analog(0)',
            '',
            'def _servo_continu(broche, nom, vitesse):',
            '    etat = _servo_etat(nom)',
            '    vitesse = max(-100, min(100, int(vitesse)))',
            '    angle = etat[0] + (vitesse + 100) * (etat[1] - etat[0]) / 200',
            '    angle = max(etat[0], min(etat[1], int(angle)))',
            '    # Neutre calcule comme dans MakeCode : (maxi - mini) // 2.',
            '    if etat[2] and angle == (etat[1] - etat[0]) // 2:',
            '        _servo_arreter(broche, nom)',
            '    else:',
            '        _servo_angle(broche, nom, angle)',
            '',
            'def _servo_intervalle(nom, mini, maxi):',
            '    etat = _servo_etat(nom)',
            '    etat[0] = max(0, min(90, int(mini)))',
            '    etat[1] = max(90, min(180, int(maxi)))',
            '',
            'def _servo_arret_neutre(nom, actif):',
            '    _servo_etat(nom)[2] = bool(actif)',
        ].join('\n') + '\n# <<< pilote servo';
    }

    Blockly.Blocks['servo_angle'] = { init: function() {
        this.appendDummyInput().appendField("régler l'angle du servomoteur")
            .appendField(menuBrocheServo(), "BROCHE").appendField("à");
        this.appendValueInput("ANGLE").setCheck("Number");
        this.appendDummyInput().appendField("°");
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COULEUR_SERVO);
        this.setTooltip("De 0 à 180°, borné par l'intervalle défini pour cette broche.");
    }};
    P.forBlock['servo_angle'] = function(block) {
        piloteServo();
        const angle = P.valueToCode(block, 'ANGLE', P.ORDER_NONE) || '90';
        return '_servo_angle(' + block.getFieldValue('BROCHE') +
               ', "' + nomBroche(block) + '", ' + angle + ')\n';
    };

    Blockly.Blocks['servo_continu'] = { init: function() {
        this.appendDummyInput().appendField("servomoteur")
            .appendField(menuBrocheServo(), "BROCHE")
            .appendField("à rotation continue fonctionne à");
        this.appendValueInput("VITESSE").setCheck("Number");
        this.appendDummyInput().appendField("%");
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COULEUR_SERVO);
        this.setTooltip("De -100 à 100 %. 0 correspond à l'arrêt du mouvement.");
    }};
    P.forBlock['servo_continu'] = function(block) {
        piloteServo();
        const vitesse = P.valueToCode(block, 'VITESSE', P.ORDER_NONE) || '0';
        return '_servo_continu(' + block.getFieldValue('BROCHE') +
               ', "' + nomBroche(block) + '", ' + vitesse + ')\n';
    };

    Blockly.Blocks['servo_arreter'] = { init: function() {
        this.appendDummyInput().appendField("arrêter le servomoteur")
            .appendField(menuBrocheServo(), "BROCHE");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COULEUR_SERVO);
        this.setTooltip("Cesse d'envoyer des impulsions : le servomoteur reste où il est.");
    }};
    P.forBlock['servo_arreter'] = function(block) {
        piloteServo();
        return '_servo_arreter(' + block.getFieldValue('BROCHE') +
               ', "' + nomBroche(block) + '")\n';
    };

    Blockly.Blocks['servo_arret_neutre'] = { init: function() {
        this.appendDummyInput().appendField("mettre l'arrêt au neutre du servomoteur")
            .appendField(menuBrocheServo(), "BROCHE").appendField("à")
            .appendField(new Blockly.FieldDropdown([["ON", "True"], ["OFF", "False"]]), "ETAT");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COULEUR_SERVO);
        this.setTooltip("Si actif, une vitesse nulle arrête le servomoteur au lieu de le maintenir.");
    }};
    P.forBlock['servo_arret_neutre'] = function(block) {
        piloteServo();
        return '_servo_arret_neutre("' + nomBroche(block) + '", ' +
               block.getFieldValue('ETAT') + ')\n';
    };

    Blockly.Blocks['servo_intervalle'] = { init: function() {
        this.appendDummyInput().appendField("définir l'intervalle du servomoteur")
            .appendField(menuBrocheServo(), "BROCHE").appendField("de");
        this.appendValueInput("MINI").setCheck("Number");
        this.appendValueInput("MAXI").setCheck("Number").appendField("à");
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COULEUR_SERVO);
        this.setTooltip("Le mini est ramené entre 0 et 90, le maxi entre 90 et 180.");
    }};
    P.forBlock['servo_intervalle'] = function(block) {
        piloteServo();
        const mini = P.valueToCode(block, 'MINI', P.ORDER_NONE) || '0';
        const maxi = P.valueToCode(block, 'MAXI', P.ORDER_NONE) || '180';
        return '_servo_intervalle("' + nomBroche(block) + '", ' + mini + ', ' + maxi + ')\n';
    };

    Blockly.Blocks['servo_impulsion'] = { init: function() {
        this.appendDummyInput().appendField("régler la largeur d'impulsion du servomoteur")
            .appendField(menuBrocheServo(), "BROCHE").appendField("à");
        this.appendValueInput("MICROS").setCheck("Number");
        this.appendDummyInput().appendField("µs");
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COULEUR_SERVO);
        this.setTooltip("Bornée entre 500 et 2500 µs. 1500 µs correspond à la position centrale.");
    }};
    P.forBlock['servo_impulsion'] = function(block) {
        piloteServo();
        const micros = P.valueToCode(block, 'MICROS', P.ORDER_NONE) || '1500';
        return '_servo_impulsion(' + block.getFieldValue('BROCHE') + ', ' + micros +
               ', "' + nomBroche(block) + '")\n';
    };

    // ---------- Grove ----------
    //
    // Les pilotes de ces modules ne sont pas dans le firmware : ils sont écrits
    // dans le programme généré, via definitions_. Chacun est encadré par
    //     # >>> pilote grove   …   # <<< pilote grove
    // pour que le simulateur puisse les retirer et leur substituer ses propres
    // objets : sur la carte on pilote de vraies broches, ici on dessine.

    const COULEUR_GROVE = 285;

    const BROCHES_GROVE = [
        ["P0", "pin0"], ["P1", "pin1"], ["P2", "pin2"], ["P8", "pin8"],
        ["P12", "pin12"], ["P13", "pin13"], ["P14", "pin14"],
        ["P15", "pin15"], ["P16", "pin16"]
    ];

    const COULEURS_GROVE = [
        ["rouge", "0xFF0000"], ["orange", "0xFF7F00"], ["jaune", "0xFFFF00"],
        ["vert", "0x00FF00"], ["bleu", "0x0000FF"], ["indigo", "0x4B0082"],
        ["violet", "0x8B00FF"], ["blanc", "0xFFFFFF"], ["noir", "0x000000"]
    ];

    const menuBroche = () => new Blockly.FieldDropdown(BROCHES_GROVE);
    const menuCouleur = () => new Blockly.FieldDropdown(COULEURS_GROVE);

    // --- LED simple sur une broche ---
    //
    // Aucun pilote ici : une LED se commande directement par la broche, et
    // c'est justement ce qu'il faut montrer a l'eleve. Le code produit est
    // celui qu'on ecrirait a la main.

    Blockly.Blocks['grove_led_etat'] = { init: function() {
        this.appendDummyInput().appendField("[LED] contrôler la LED à")
            .appendField(new Blockly.FieldDropdown([
                ["HAUT (1)", "1"], ["BAS (0)", "0"]
            ]), "ETAT")
            .appendField("sur la broche").appendField(menuBroche(), "BROCHE");
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COULEUR_GROVE);
        this.setTooltip("Allume (HAUT) ou éteint (BAS) la LED. Tout ou rien.");
    }};
    P.forBlock['grove_led_etat'] = function(block) {
        importerMicrobit();
        return block.getFieldValue('BROCHE') + '.write_digital(' +
               block.getFieldValue('ETAT') + ')\n';
    };

    Blockly.Blocks['grove_led_luminosite'] = { init: function() {
        this.appendValueInput("NIVEAU").setCheck("Number")
            .appendField("[LED] régler la luminosité à");
        this.appendDummyInput().appendField("sur la broche")
            .appendField(menuBroche(), "BROCHE");
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COULEUR_GROVE);
        this.setTooltip("De 0 (éteinte) à 1023 (au maximum). La broche est " +
                        "pilotée en modulation de largeur d'impulsion.");
    }};
    P.forBlock['grove_led_luminosite'] = function(block) {
        importerMicrobit();
        const niveau = P.valueToCode(block, 'NIVEAU', P.ORDER_NONE) || '1023';
        // Bornage : write_analog leve une exception hors de 0-1023, ce qui
        // arreterait le programme sur la carte sans rien afficher.
        return block.getFieldValue('BROCHE') +
               '.write_analog(max(0, min(1023, ' + niveau + ')))\n';
    };

    /** Enrobe un pilote des marqueurs que le simulateur reconnaît. */
    function pilote(nom, lignes) {
        // Le nom figure dans le marqueur : c'est lui qui sert d'intitule au
        // resume replie de la transcription.
        P.definitions_['grove_' + nom] =
            '# >>> pilote ' + nom + '\n' + lignes.join('\n') + '\n# <<< pilote ' + nom;
    }

    /**
     * Registre des périphériques, créés à la première utilisation.
     *
     * Sans cela, oublier le bloc « définir … » donnait un NameError à
     * l'exécution — invisible tant qu'on n'avait pas lancé le programme, et
     * muet sur la carte. Chaque module a donc un accesseur qui le fabrique au
     * besoin ; le bloc « définir … » ne sert plus qu'à choisir d'autres
     * broches, et devient facultatif.
     *
     * Le registre est un dictionnaire : on peut y écrire depuis une fonction
     * sans avoir à déclarer `global`.
     */
    function piloteRegistre() {
        pilote('objets', [
            '_grove_objets = {}',
            '',
            'def _grove_obj(nom, fabrique):',
            '    if nom not in _grove_objets:',
            '        _grove_objets[nom] = fabrique()',
            '    return _grove_objets[nom]',
        ]);
    }

    // --- Ruban RGB WS2813 (module neopixel intégré au firmware) ---

    function piloteRuban() {
        importerMicrobit();
        importerModule('neopixel');
        piloteRegistre();
        // La luminosité est rangée dans une liste : on peut alors la changer
        // depuis une fonction sans avoir à déclarer `global`.
        pilote('teinte', [
            '_grove_lum = [100]',
            '',
            'def _grove_teinte(couleur):',
            '    f = _grove_lum[0] / 100',
            '    return (int(((couleur >> 16) & 255) * f),',
            '            int(((couleur >> 8) & 255) * f),',
            '            int((couleur & 255) * f))',
            '',
            '# Par defaut : broche P1, 16 LED.',
            'def _grove_ruban():',
            '    return _grove_obj("ruban", lambda: neopixel.NeoPixel(pin1, 16))',
        ]);
    }

    Blockly.Blocks['grove_ruban_definir'] = { init: function() {
        this.appendDummyInput().appendField("définir le ruban RGB sur")
            .appendField(menuBroche(), "BROCHE")
            .appendField("avec").appendField(new Blockly.FieldNumber(16, 1, 64), "NB")
            .appendField("LED(s)");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COULEUR_GROVE);
        this.setTooltip("Facultatif : sans ce bloc, le ruban est pris sur P1 avec 16 LED.");
    }};
    P.forBlock['grove_ruban_definir'] = function(block) {
        piloteRuban();
        return '_grove_objets["ruban"] = neopixel.NeoPixel(' + block.getFieldValue('BROCHE') +
               ', ' + block.getFieldValue('NB') + ')\n';
    };

    Blockly.Blocks['grove_ruban_couleur'] = { init: function() {
        this.appendDummyInput().appendField("colorer tout le ruban en")
            .appendField(menuCouleur(), "COULEUR");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COULEUR_GROVE);
    }};
    P.forBlock['grove_ruban_couleur'] = function(block) {
        piloteRuban();
        return '_grove_ruban().fill(_grove_teinte(' + block.getFieldValue('COULEUR') + '))\n_grove_ruban().show()\n';
    };

    Blockly.Blocks['grove_ruban_effacer'] = { init: function() {
        this.appendDummyInput().appendField("éteindre le ruban");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COULEUR_GROVE);
    }};
    P.forBlock['grove_ruban_effacer'] = function(block) {
        piloteRuban();
        return '_grove_ruban().clear()\n';
    };

    Blockly.Blocks['grove_ruban_couleur_index'] = { init: function() {
        this.appendValueInput("INDEX").setCheck("Number").appendField("colorer la LED n°");
        this.appendDummyInput().appendField("en").appendField(menuCouleur(), "COULEUR");
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COULEUR_GROVE);
    }};
    P.forBlock['grove_ruban_couleur_index'] = function(block) {
        piloteRuban();
        const index = P.valueToCode(block, 'INDEX', P.ORDER_NONE) || '0';
        return '_grove_ruban()[' + index + '] = _grove_teinte(' + block.getFieldValue('COULEUR') + ')\n_grove_ruban().show()\n';
    };

    Blockly.Blocks['grove_ruban_effacer_index'] = { init: function() {
        this.appendValueInput("INDEX").setCheck("Number").appendField("éteindre la LED n°");
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COULEUR_GROVE);
    }};
    P.forBlock['grove_ruban_effacer_index'] = function(block) {
        piloteRuban();
        const index = P.valueToCode(block, 'INDEX', P.ORDER_NONE) || '0';
        return '_grove_ruban()[' + index + '] = (0, 0, 0)\n_grove_ruban().show()\n';
    };

    Blockly.Blocks['grove_ruban_perso'] = { init: function() {
        this.appendDummyInput().appendField("colorer tout le ruban en R");
        this.appendValueInput("R").setCheck("Number");
        this.appendValueInput("V").setCheck("Number").appendField("V");
        this.appendValueInput("B").setCheck("Number").appendField("B");
        this.setInputsInline(false);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COULEUR_GROVE);
    }};
    P.forBlock['grove_ruban_perso'] = function(block) {
        piloteRuban();
        const r = P.valueToCode(block, 'R', P.ORDER_NONE) || '0';
        const v = P.valueToCode(block, 'V', P.ORDER_NONE) || '0';
        const b = P.valueToCode(block, 'B', P.ORDER_NONE) || '0';
        return '_grove_ruban().fill(_grove_teinte(((' + r + ') << 16) + ((' + v + ') << 8) + (' + b + ')))\n_grove_ruban().show()\n';
    };

    Blockly.Blocks['grove_ruban_perso_index'] = { init: function() {
        this.appendValueInput("INDEX").setCheck("Number").appendField("colorer la LED n°");
        this.appendValueInput("R").setCheck("Number").appendField("en R");
        this.appendValueInput("V").setCheck("Number").appendField("V");
        this.appendValueInput("B").setCheck("Number").appendField("B");
        this.setInputsInline(false);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COULEUR_GROVE);
    }};
    P.forBlock['grove_ruban_perso_index'] = function(block) {
        piloteRuban();
        const index = P.valueToCode(block, 'INDEX', P.ORDER_NONE) || '0';
        const r = P.valueToCode(block, 'R', P.ORDER_NONE) || '0';
        const v = P.valueToCode(block, 'V', P.ORDER_NONE) || '0';
        const b = P.valueToCode(block, 'B', P.ORDER_NONE) || '0';
        return '_grove_ruban()[' + index + '] = _grove_teinte(((' + r + ') << 16) + ((' + v + ') << 8) + (' + b + '))\n_grove_ruban().show()\n';
    };

    Blockly.Blocks['grove_ruban_luminosite'] = { init: function() {
        this.appendValueInput("NIVEAU").setCheck("Number").appendField("luminosité du ruban à");
        this.appendDummyInput().appendField("%");
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COULEUR_GROVE);
        this.setTooltip("Le module neopixel n'a pas de réglage de luminosité : les couleurs sont atténuées avant envoi.");
    }};
    P.forBlock['grove_ruban_luminosite'] = function(block) {
        piloteRuban();
        const niveau = P.valueToCode(block, 'NIVEAU', P.ORDER_NONE) || '100';
        return '_grove_lum[0] = max(0, min(100, ' + niveau + '))\n';
    };

    // --- Afficheur 4 digits (TM1637, protocole 2 fils) ---

    function piloteAfficheur() {
        importerMicrobit();
        piloteRegistre();
        pilote('tm1637', [
            '_TM_SEG = (0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F)',
            '',
            'class _Afficheur4:',
            '    def __init__(self, clk, dio):',
            '        self.clk = clk',
            '        self.dio = dio',
            '        self.lum = 7',
            '        self.pts = False',
            '        self.tampon = [0, 0, 0, 0]',
            '',
            '    def _debut(self):',
            '        self.dio.write_digital(1)',
            '        self.clk.write_digital(1)',
            '        self.dio.write_digital(0)',
            '        self.clk.write_digital(0)',
            '',
            '    def _fin(self):',
            '        self.clk.write_digital(0)',
            '        self.dio.write_digital(0)',
            '        self.clk.write_digital(1)',
            '        self.dio.write_digital(1)',
            '',
            '    def _octet(self, valeur):',
            '        for i in range(8):',
            '            self.clk.write_digital(0)',
            '            self.dio.write_digital((valeur >> i) & 1)',
            '            self.clk.write_digital(1)',
            '        # neuvieme front : acquittement de l afficheur',
            '        self.clk.write_digital(0)',
            '        self.dio.write_digital(1)',
            '        self.clk.write_digital(1)',
            '        self.clk.write_digital(0)',
            '',
            '    def _envoyer(self):',
            '        self._debut(); self._octet(0x40); self._fin()',
            '        self._debut(); self._octet(0xC0)',
            '        for i in range(4):',
            '            v = self.tampon[i]',
            '            if i == 1 and self.pts:',
            '                v = v | 0x80',
            '            self._octet(v)',
            '        self._fin()',
            '        self._debut(); self._octet(0x88 | (self.lum & 7)); self._fin()',
            '',
            '    def effacer(self):',
            '        self.tampon = [0, 0, 0, 0]',
            '        self._envoyer()',
            '',
            '    def chiffre(self, position, valeur):',
            '        position = max(0, min(3, int(position)))',
            '        valeur = int(valeur)',
            '        self.tampon[position] = _TM_SEG[valeur % 10] if 0 <= valeur <= 9 else 0',
            '        self._envoyer()',
            '',
            '    def nombre(self, valeur):',
            '        valeur = int(valeur)',
            '        negatif = valeur < 0',
            '        valeur = abs(valeur) % 10000',
            '        for i in range(3, -1, -1):',
            '            self.tampon[i] = _TM_SEG[valeur % 10]',
            '            valeur = valeur // 10',
            '        if negatif:',
            '            self.tampon[0] = 0x40',
            '        self._envoyer()',
            '',
            '    def points(self, actif):',
            '        self.pts = bool(actif)',
            '        self._envoyer()',
            '',
            '    def luminosite(self, niveau):',
            '        self.lum = max(0, min(7, int(niveau)))',
            '        self._envoyer()',
            '',
            '# Par defaut : CLK sur P0, DIO sur P1.',
            'def _grove_afficheur():',
            '    return _grove_obj("afficheur", lambda: _Afficheur4(pin0, pin1))',
        ]);
    }

    Blockly.Blocks['grove_4d_definir'] = { init: function() {
        this.appendDummyInput().appendField("définir l'afficheur 4 digits : CLK")
            .appendField(menuBroche(), "CLK")
            .appendField("DIO").appendField(menuBroche(), "DIO");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COULEUR_GROVE);
        this.setTooltip("Facultatif : sans ce bloc, CLK est pris sur P0 et DIO sur P1.");
    }};
    P.forBlock['grove_4d_definir'] = function(block) {
        piloteAfficheur();
        return '_grove_objets["afficheur"] = _Afficheur4(' + block.getFieldValue('CLK') +
               ', ' + block.getFieldValue('DIO') + ')\n';
    };

    Blockly.Blocks['grove_4d_nombre'] = { init: function() {
        this.appendValueInput("VALEUR").setCheck("Number").appendField("afficher le nombre");
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COULEUR_GROVE);
    }};
    P.forBlock['grove_4d_nombre'] = function(block) {
        piloteAfficheur();
        return '_grove_afficheur().nombre(' + (P.valueToCode(block, 'VALEUR', P.ORDER_NONE) || '0') + ')\n';
    };

    Blockly.Blocks['grove_4d_chiffre'] = { init: function() {
        this.appendValueInput("VALEUR").setCheck("Number").appendField("afficher le chiffre");
        this.appendValueInput("POSITION").setCheck("Number").appendField("à la position");
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COULEUR_GROVE);
    }};
    P.forBlock['grove_4d_chiffre'] = function(block) {
        piloteAfficheur();
        const valeur = P.valueToCode(block, 'VALEUR', P.ORDER_NONE) || '0';
        const position = P.valueToCode(block, 'POSITION', P.ORDER_NONE) || '0';
        return '_grove_afficheur().chiffre(' + position + ', ' + valeur + ')\n';
    };

    Blockly.Blocks['grove_4d_points'] = { init: function() {
        this.appendDummyInput().appendField(new Blockly.FieldDropdown([
            ["allumer", "True"], ["éteindre", "False"]
        ]), "ETAT").appendField("les deux points");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COULEUR_GROVE);
    }};
    P.forBlock['grove_4d_points'] = function(block) {
        piloteAfficheur();
        return '_grove_afficheur().points(' + block.getFieldValue('ETAT') + ')\n';
    };

    Blockly.Blocks['grove_4d_luminosite'] = { init: function() {
        this.appendValueInput("NIVEAU").setCheck("Number").appendField("luminosité de l'afficheur à");
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COULEUR_GROVE);
        this.setTooltip("De 0 (le plus faible) à 7 (le plus fort).");
    }};
    P.forBlock['grove_4d_luminosite'] = function(block) {
        piloteAfficheur();
        return '_grove_afficheur().luminosite(' + (P.valueToCode(block, 'NIVEAU', P.ORDER_NONE) || '7') + ')\n';
    };

    Blockly.Blocks['grove_4d_effacer'] = { init: function() {
        this.appendDummyInput().appendField("effacer l'afficheur");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COULEUR_GROVE);
    }};
    P.forBlock['grove_4d_effacer'] = function(block) {
        piloteAfficheur();
        return '_grove_afficheur().effacer()\n';
    };

    // --- Télémètre à ultrasons (un seul fil, déclenchement puis écho) ---

    function piloteUltrason() {
        importerMicrobit();
        importerModule('machine');
        importerModule('utime');
        pilote('ultrason', [
            'def _grove_echo_us(broche):',
            '    broche.write_digital(0)',
            '    utime.sleep_us(2)',
            '    broche.write_digital(1)',
            '    utime.sleep_us(10)',
            '    broche.write_digital(0)',
            '    broche.set_pull(broche.NO_PULL)',
            '    # 30 ms de patience : au-dela, plus rien ne revient (~5 m)',
            '    return machine.time_pulse_us(broche, 1, 30000)',
            '',
            'def _grove_distance_cm(broche):',
            '    duree = _grove_echo_us(broche)',
            '    return 0 if duree < 0 else duree // 58',
            '',
            'def _grove_distance_pouces(broche):',
            '    duree = _grove_echo_us(broche)',
            '    return 0 if duree < 0 else duree // 148',
        ]);
    }

    Blockly.Blocks['grove_ultrason_cm'] = { init: function() {
        this.appendDummyInput().appendField("distance (cm) sur").appendField(menuBroche(), "BROCHE");
        this.setOutput(true, "Number");
        this.setColour(COULEUR_GROVE);
    }};
    P.forBlock['grove_ultrason_cm'] = function(block) {
        piloteUltrason();
        return ['_grove_distance_cm(' + block.getFieldValue('BROCHE') + ')', P.ORDER_FUNCTION_CALL];
    };

    Blockly.Blocks['grove_ultrason_pouces'] = { init: function() {
        this.appendDummyInput().appendField("distance (pouces) sur").appendField(menuBroche(), "BROCHE");
        this.setOutput(true, "Number");
        this.setColour(COULEUR_GROVE);
    }};
    P.forBlock['grove_ultrason_pouces'] = function(block) {
        piloteUltrason();
        return ['_grove_distance_pouces(' + block.getFieldValue('BROCHE') + ')', P.ORDER_FUNCTION_CALL];
    };

    // --- Joystick (deux axes analogiques, appui = axe X au plancher) ---

    function piloteJoystick() {
        importerMicrobit();
        pilote('joystick', [
            'def _grove_joystick(bx, by, direction):',
            '    x = bx.read_analog()',
            '    y = by.read_analog()',
            '    if direction == "gauche":',
            '        return x < 350',
            '    if direction == "droite":',
            '        return x > 700',
            '    if direction == "bas":',
            '        return y < 350',
            '    if direction == "haut":',
            '        return y > 700',
            '    return 350 <= x <= 700 and 350 <= y <= 700',
        ]);
    }

    Blockly.Blocks['grove_joystick_valeur'] = { init: function() {
        this.appendDummyInput().appendField("valeur du joystick sur").appendField(menuBroche(), "BROCHE");
        this.setOutput(true, "Number");
        this.setColour(COULEUR_GROVE);
        this.setTooltip("De 0 à 1023. Un axe par broche.");
    }};
    P.forBlock['grove_joystick_valeur'] = function(block) {
        importerMicrobit();
        return [block.getFieldValue('BROCHE') + '.read_analog()', P.ORDER_FUNCTION_CALL];
    };

    Blockly.Blocks['grove_joystick_direction'] = { init: function() {
        this.appendDummyInput().appendField("joystick X").appendField(menuBroche(), "X")
            .appendField("Y").appendField(menuBroche(), "Y")
            .appendField("vers").appendField(new Blockly.FieldDropdown([
                ["le haut", "haut"], ["le bas", "bas"],
                ["la gauche", "gauche"], ["la droite", "droite"], ["le centre", "centre"]
            ]), "DIRECTION");
        this.setOutput(true, "Boolean");
        this.setColour(COULEUR_GROVE);
    }};
    P.forBlock['grove_joystick_direction'] = function(block) {
        piloteJoystick();
        return ['_grove_joystick(' + block.getFieldValue('X') + ', ' + block.getFieldValue('Y') +
                ', "' + block.getFieldValue('DIRECTION') + '")', P.ORDER_FUNCTION_CALL];
    };

    Blockly.Blocks['grove_joystick_bouton'] = { init: function() {
        this.appendDummyInput().appendField("bouton du joystick sur")
            .appendField(menuBroche(), "BROCHE").appendField("pressé");
        this.setOutput(true, "Boolean");
        this.setColour(COULEUR_GROVE);
        this.setTooltip("L'appui sur le manche tire l'axe X presque à zéro.");
    }};
    P.forBlock['grove_joystick_bouton'] = function(block) {
        importerMicrobit();
        return ['(' + block.getFieldValue('BROCHE') + '.read_analog() < 250)', P.ORDER_ATOMIC];
    };

    // --- Capteur de gestes PAJ7620 (I2C) ---
    //
    // Table d'initialisation et registres repris de la bibliotheque Seeed
    // (Gesture_PAJ7620, src/paj7620.h) : 50 registres, adresse 0x73, resultats
    // en 0x43 (8 gestes) et 0x44 (le geste « vague »).

    const GESTES_PAJ = [
        ["vers le haut", "haut"], ["vers le bas", "bas"],
        ["vers la gauche", "gauche"], ["vers la droite", "droite"],
        ["vers l'avant", "avant"], ["vers l'arrière", "arriere"],
        ["sens horaire", "horaire"], ["sens antihoraire", "antihoraire"],
        ["vague", "vague"]
    ];

    function piloteGestes() {
        importerMicrobit();
        piloteRegistre();
        pilote('paj7620', [
            '_PAJ_ADR = 0x73',
            '_PAJ_INIT = (',
            '    (0xEF, 0x00), (0x37, 0x07), (0x38, 0x17), (0x39, 0x06), (0x42, 0x01),',
            '    (0x46, 0x2D), (0x47, 0x0F), (0x48, 0x3C), (0x49, 0x00), (0x4A, 0x1E),',
            '    (0x4C, 0x20), (0x51, 0x10), (0x5E, 0x10), (0x60, 0x27), (0x80, 0x42),',
            '    (0x81, 0x44), (0x82, 0x04), (0x8B, 0x01), (0x90, 0x06), (0x95, 0x0A),',
            '    (0x96, 0x0C), (0x97, 0x05), (0x9A, 0x14), (0x9C, 0x3F), (0xA5, 0x19),',
            '    (0xCC, 0x19), (0xCD, 0x0B), (0xCE, 0x13), (0xCF, 0x64), (0xD0, 0x21),',
            '    (0xEF, 0x01), (0x02, 0x0F), (0x03, 0x10), (0x04, 0x02), (0x25, 0x01),',
            '    (0x27, 0x39), (0x28, 0x7F), (0x29, 0x08), (0x3E, 0xFF), (0x5E, 0x3D),',
            '    (0x65, 0x96), (0x67, 0x97), (0x69, 0xCD), (0x6A, 0x01), (0x6D, 0x2C),',
            '    (0x6E, 0x01), (0x72, 0x01), (0x73, 0x35), (0x77, 0x01), (0xEF, 0x00),',
            ')',
            '',
            '# bit 0 a 7 du registre 0x43, puis bit 0 du registre 0x44',
            '_PAJ_NOMS = ("haut", "bas", "gauche", "droite",',
            '             "avant", "arriere", "horaire", "antihoraire")',
            '',
            'class _CapteurGestes:',
            '    def __init__(self):',
            '        i2c.init()',
            '        # Reveil du capteur : la premiere lecture echoue souvent.',
            '        try:',
            '            i2c.write(_PAJ_ADR, bytes([0x00]))',
            '            i2c.read(_PAJ_ADR, 1)',
            '        except OSError:',
            '            pass',
            '        sleep(5)',
            '        for registre, valeur in _PAJ_INIT:',
            '            i2c.write(_PAJ_ADR, bytes([registre, valeur]))',
            '',
            '    def lire(self):',
            '        try:',
            '            i2c.write(_PAJ_ADR, bytes([0x43]))',
            '            drapeaux = i2c.read(_PAJ_ADR, 2)',
            '        except OSError:',
            '            return ""',
            '        bas = drapeaux[0]',
            '        for i in range(8):',
            '            if bas & (1 << i):',
            '                return _PAJ_NOMS[i]',
            '        if drapeaux[1] & 1:',
            '            return "vague"',
            '        return ""',
            '',
            'def _grove_gestes():',
            '    return _grove_obj("gestes", _CapteurGestes)',
        ]);
    }

    Blockly.Blocks['grove_gestes_init'] = { init: function() {
        this.appendDummyInput().appendField("initialiser le capteur de gestes");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COULEUR_GROVE);
        this.setTooltip("Facultatif : le capteur s'initialise à la première lecture.");
    }};
    P.forBlock['grove_gestes_init'] = function(block) {
        piloteGestes();
        return '_grove_objets["gestes"] = _CapteurGestes()\n';
    };

    Blockly.Blocks['grove_gestes_lire'] = { init: function() {
        this.appendDummyInput().appendField("geste détecté");
        this.setOutput(true, "String");
        this.setColour(COULEUR_GROVE);
        this.setTooltip("Texte vide si aucun geste depuis la dernière lecture.");
    }};
    P.forBlock['grove_gestes_lire'] = function(block) {
        piloteGestes();
        return ['_grove_gestes().lire()', P.ORDER_FUNCTION_CALL];
    };

    Blockly.Blocks['grove_gestes_est'] = { init: function() {
        this.appendDummyInput().appendField("le geste détecté est")
            .appendField(new Blockly.FieldDropdown(GESTES_PAJ), "GESTE");
        this.setOutput(true, "Boolean");
        this.setColour(COULEUR_GROVE);
    }};
    P.forBlock['grove_gestes_est'] = function(block) {
        piloteGestes();
        return ['(_grove_gestes().lire() == "' + block.getFieldValue('GESTE') + '")', P.ORDER_ATOMIC];
    };

    // ---------- Grove : modules I2C ----------
    //
    // Adresses, trames et formules reprises des bibliotheques Seeed
    // (pxt-grove : sensors/AHT20.ts, blocks/GroveLCD1602v1.ts,
    // sensors/VEML6040.ts, sensors/DRV8830.ts, sensors/SCD30.ts,
    // sensors/SCD41.ts). Meme encadrement « pilote grove » que plus haut.

    /** CRC8 Sensirion (polynome 0x31, valeur initiale 0xFF), commun à AHT20 et SCD. */
    function piloteCrc8() {
        pilote('crc8', [
            'def _grove_crc8(donnees):',
            '    crc = 0xFF',
            '    for octet in donnees:',
            '        crc ^= octet',
            '        for _ in range(8):',
            '            if crc & 0x80:',
            '                crc = ((crc << 1) ^ 0x31) & 0xFF',
            '            else:',
            '                crc = (crc << 1) & 0xFF',
            '    return crc',
        ]);
    }

    // --- Température & humidité : AHT20, et DHT20 qui embarque la même puce ---

    function piloteTempHum() {
        importerMicrobit();
        piloteRegistre();
        piloteCrc8();
        pilote('aht20', [
            'class _CapteurTH:',
            '    ADR = 0x38',
            '',
            '    def __init__(self):',
            '        i2c.init()',
            '        sleep(40)',
            '        i2c.write(self.ADR, bytes([0xBE, 0x08, 0x00]))',
            '        sleep(10)',
            '',
            '    def _mesurer(self):',
            '        i2c.write(self.ADR, bytes([0xAC, 0x33, 0x00]))',
            '        sleep(80)',
            '        t = i2c.read(self.ADR, 7)',
            '        # Le 7e octet controle les 6 premiers : mesure rejetee si faux.',
            '        if _grove_crc8(t[0:6]) != t[6]:',
            '            return None',
            '        return t',
            '',
            '    def humidite(self):',
            '        t = self._mesurer()',
            '        if t is None:',
            '            return -1',
            '        brut = (t[1] << 12) + (t[2] << 4) + (t[3] >> 4)',
            '        return brut * 100 / 1048576',
            '',
            '    def temperature(self):',
            '        t = self._mesurer()',
            '        if t is None:',
            '            return -1',
            '        brut = ((t[3] & 0x0F) << 16) + (t[4] << 8) + t[5]',
            '        return brut * 200 / 1048576 - 50',
            '',
            'def _grove_th():',
            '    return _grove_obj("th", _CapteurTH)',
        ]);
    }

    Blockly.Blocks['grove_th_init'] = { init: function() {
        this.appendDummyInput().appendField("initialiser le capteur température & humidité");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COULEUR_GROVE);
        this.setTooltip("AHT20 ou DHT20 : même puce, adresse I²C 0x38. Facultatif.");
    }};
    P.forBlock['grove_th_init'] = function(block) {
        piloteTempHum();
        return '_grove_objets["th"] = _CapteurTH()\n';
    };

    Blockly.Blocks['grove_th_mesure'] = { init: function() {
        this.appendDummyInput().appendField("capteur T&H :")
            .appendField(new Blockly.FieldDropdown([
                ["température (°C)", "c"], ["température (°F)", "f"], ["humidité (%)", "h"]
            ]), "GRANDEUR");
        this.setOutput(true, "Number");
        this.setColour(COULEUR_GROVE);
    }};
    P.forBlock['grove_th_mesure'] = function(block) {
        piloteTempHum();
        const g = block.getFieldValue('GRANDEUR');
        if (g === 'h') return ['_grove_th().humidite()', P.ORDER_FUNCTION_CALL];
        if (g === 'f') return ['(_grove_th().temperature() * 9 / 5 + 32)', P.ORDER_ATOMIC];
        return ['_grove_th().temperature()', P.ORDER_FUNCTION_CALL];
    };

    // --- DHT11 et DHT22 : experimental, fiables uniquement sur micro:bit V1 ---
    //
    // Assemblage ARM Thumb repris de rhubarbdog/microbit-dht11 (MIT), seule
    // implementation DHT11 connue pour micro:bit-MicroPython qui fonctionne
    // reellement : le protocole une-seule-broche de ces capteurs exige de
    // mesurer des impulsions de 26 a 70 microsecondes, hors de portee d'une
    // boucle Python interpretee, d'ou l'assembleur. Le DHT22 utilise le meme
    // schema de signal (mêmes durees d'impulsion), seul le decodage des 5
    // octets differe : le meme _dht_grab sert aux deux capteurs.
    //
    // Sur V2 (nRF52833 a 64 MHz contre 16 MHz pour le V1), ce meme code
    // echantillonne 4x trop vite et rate le signal. Un correctif communautaire
    // existe pour le DHT11 (multiplier le delai par 4) mais son auteur le
    // decrit lui-meme comme instable : une mesure valide toutes les ~20
    // secondes environ (issue #93, depot micropython-microbit-v2 de la
    // fondation micro:bit). Le decalage bit-a-bit ci-dessous (DHT_DECALAGE),
    // lui, n'a jamais ete revalide pour le V2 par personne. Plutot que de
    // deviner un decalage invisible dans un mauvais resultat, la lecture
    // refuse proprement sur V2 (machine.freq() les distingue) : _mesurer()
    // renvoie alors False et les blocs -1, plutot qu'une valeur fausse sans
    // avertissement. Utiliser AHT20/DHT20 (en I²C, fiable sur V1 et V2) si la
    // carte peut etre un V2.

    const DHT_DECALAGE = {
        pin0: 3, pin1: 2, pin2: 1, pin8: 18, pin12: 20,
        pin13: 23, pin14: 22, pin15: 21, pin16: 16
    };

    function piloteDht() {
        importerMicrobit();
        importerModule('machine');
        piloteRegistre();
        pilote('dht', [
            '@micropython.asm_thumb',
            'def _dht_birq():',
            "    cpsid('i')",
            '',
            '@micropython.asm_thumb',
            'def _dht_ubirq():',
            "    cpsie('i')",
            '',
            '# Echantillonne la broche pendant `limite` cycles et range 0/1 dans',
            '# `tampon` : c\'est la seule partie du pilote assez rapide et reguliere',
            '# pour suivre les impulsions du DHT11/DHT22. r0 = decalage bit GPIO,',
            '# r1 = tampon, r2 = limite. Ne pas modifier sans banc de mesure : un',
            '# decalage de delai casse silencieusement la lecture.',
            '@micropython.asm_thumb',
            'def _dht_grab(r0, r1, r2):',
            '    b(DEBUT)',
            '    label(DELAI)',
            '    mov(r7, 0x2d)',
            '    label(boucle_delai)',
            '    sub(r7, 1)',
            '    bne(boucle_delai)',
            '    bx(lr)',
            '    label(LIRE_BROCHE)',
            '    mov(r3, 0x50)',
            '    lsl(r3, r3, 16)',
            '    add(r3, 0x05)',
            '    lsl(r3, r3, 8)',
            '    add(r3, 0x10)',
            '    ldr(r4, [r3, 0])',
            '    mov(r3, 0x01)',
            '    lsl(r3, r0)',
            '    and_(r4, r3)',
            '    lsr(r4, r0)',
            '    bx(lr)',
            '    label(DEBUT)',
            '    mov(r5, 0x00)',
            '    label(boucle)',
            '    mov(r6, 0x00)',
            '    bl(LIRE_BROCHE)',
            '    orr(r6, r4)',
            '    bl(DELAI)',
            '    bl(LIRE_BROCHE)',
            '    lsl(r4, r4, 8)',
            '    orr(r6, r4)',
            '    bl(DELAI)',
            '    bl(LIRE_BROCHE)',
            '    lsl(r4, r4, 16)',
            '    orr(r6, r4)',
            '    bl(DELAI)',
            '    bl(LIRE_BROCHE)',
            '    lsl(r4, r4, 24)',
            '    orr(r6, r4)',
            '    bl(DELAI)',
            '    add(r1, r1, r5)',
            '    str(r6, [r1, 0])',
            '    sub(r1, r1, r5)',
            '    add(r5, r5, 4)',
            '    sub(r4, r2, r5)',
            '    bne(boucle)',
            '    mov(r0, r5)',
            '',
            '# Le tampon capture par blocs de 4 cycles compresses sur 4 octets :',
            "# on le redeplie en une liste de longueurs d'impulsions (des suites de",
            '# 1 consecutifs).',
            'def _dht_analyser(tampon):',
            '    longueurs = bytearray(50)',
            '    en_cours = 0',
            '    indice = 0',
            '    debut = True',
            '    for valeur in tampon:',
            '        if valeur == 1:',
            '            en_cours += 1',
            '        elif indice == 0 and en_cours == 0:',
            '            pass',
            '        elif debut:',
            '            en_cours = 0',
            '            debut = False',
            '        elif indice >= 50:',
            '            pass',
            '        elif en_cours > 0:',
            '            longueurs[indice] = en_cours',
            '            en_cours = 0',
            '            indice += 1',
            '    if indice == 0:',
            '        return None',
            '    resultat = bytearray(indice)',
            '    for i in range(indice):',
            '        resultat[i] = longueurs[i]',
            '    return resultat',
            '',
            "# Un bit court est un '0', un bit long est un '1' : le seuil est le",
            '# milieu entre la plus courte et la plus longue impulsion mesurees.',
            'def _dht_octets(impulsions):',
            '    plus_courte, plus_longue = 1000, 0',
            '    for l in impulsions:',
            '        if l < plus_courte: plus_courte = l',
            '        if l > plus_longue: plus_longue = l',
            '    seuil = plus_courte + (plus_longue - plus_courte) / 2',
            '    octets = bytearray(5)',
            '    indice_octet = 0',
            '    accumulateur = 0',
            '    for i, l in enumerate(impulsions):',
            '        accumulateur = (accumulateur << 1) & 0xFF',
            '        if l > seuil:',
            '            accumulateur |= 1',
            '        if (i + 1) % 8 == 0:',
            '            octets[indice_octet] = accumulateur',
            '            indice_octet += 1',
            '            accumulateur = 0',
            '    return octets',
            '',
            '# Commun aux deux capteurs : signal de depart, capture, verification du',
            '# nombre de bits recus. Renvoie les 5 octets bruts, ou None si la carte',
            '# est un V2 ou si la mesure a echoue (capteur absent, bruit, ...).',
            'def _dht_mesurer_octets(broche, decalage):',
            '    if machine.freq() > 20000000:',
            '        return None   # V2 : refus volontaire, voir en tete de pilote',
            '    tampon = bytearray(320)',
            '    limite = (len(tampon) // 4) * 4',
            '    for i in range(limite, len(tampon)):',
            '        tampon[i] = 1',
            '    broche.write_digital(1)',
            '    sleep(50)',
            '    _dht_birq()',
            '    broche.write_digital(0)',
            '    sleep(20)',
            '    broche.set_pull(broche.PULL_UP)',
            '    capture = _dht_grab(decalage, tampon, limite)',
            '    _dht_ubirq()',
            '    if capture != limite:',
            '        return None',
            '    impulsions = _dht_analyser(tampon)',
            '    del tampon',
            '    if impulsions is None or len(impulsions) != 40:',
            '        return None',
            '    octets = _dht_octets(impulsions)',
            '    if octets[4] != (octets[0] + octets[1] + octets[2] + octets[3]) & 0xFF:',
            '        return None',
            '    return octets',
            '',
            'class _CapteurDHT11:',
            '    def __init__(self, broche, decalage):',
            '        self._p, self._d = broche, decalage',
            '        self.t, self.h = -1, -1',
            '',
            '    def _mesurer(self):',
            '        octets = _dht_mesurer_octets(self._p, self._d)',
            '        sleep(1000)   # le DHT11 refuse une nouvelle lecture avant ~1 s',
            '        if octets is None:',
            '            return False',
            '        self.t = octets[2] + octets[3] / 10',
            '        self.h = octets[0] + octets[1] / 10',
            '        return True',
            '',
            '    def temperature(self):',
            '        return self.t if self._mesurer() else -1',
            '',
            '    def humidite(self):',
            '        return self.h if self._mesurer() else -1',
            '',
            '# Meme signal que le DHT11, mais 16 bits par grandeur (dixiemes de degre',
            '# et de %) au lieu de deux octets entier+decimale : la temperature a un',
            '# bit de signe (bit de poids fort du 3e octet).',
            'class _CapteurDHT22:',
            '    def __init__(self, broche, decalage):',
            '        self._p, self._d = broche, decalage',
            '        self.t, self.h = -1, -1',
            '',
            '    def _mesurer(self):',
            '        octets = _dht_mesurer_octets(self._p, self._d)',
            '        sleep(2000)   # le DHT22 refuse une nouvelle lecture avant ~2 s',
            '        if octets is None:',
            '            return False',
            '        humidite_brute = (octets[0] << 8) | octets[1]',
            '        temperature_brute = ((octets[2] & 0x7F) << 8) | octets[3]',
            '        self.h = humidite_brute / 10',
            '        self.t = -temperature_brute / 10 if octets[2] & 0x80 else temperature_brute / 10',
            '        return True',
            '',
            '    def temperature(self):',
            '        return self.t if self._mesurer() else -1',
            '',
            '    def humidite(self):',
            '        return self.h if self._mesurer() else -1',
            '',
            'def _grove_dht11():',
            '    return _grove_obj("dht11", lambda: _CapteurDHT11(pin1, 2))',
            '',
            'def _grove_dht22():',
            '    return _grove_obj("dht22", lambda: _CapteurDHT22(pin1, 2))',
        ]);
    }

    function blocDefinirDht(type, nomCapteur, nomVariable, classe) {
        Blockly.Blocks[type] = { init: function() {
            this.appendDummyInput().appendField("définir le " + nomCapteur + " sur")
                .appendField(menuBroche(), "BROCHE");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(COULEUR_GROVE);
            this.setTooltip("Facultatif : sans ce bloc, le " + nomCapteur + " est pris sur P1. " +
                "Fiable uniquement sur micro:bit V1 — sur V2, les mesures renvoient -1 (voir readme.txt §7).");
        }};
        P.forBlock[type] = function(block) {
            piloteDht();
            const broche = block.getFieldValue('BROCHE');
            return '_grove_objets["' + nomVariable + '"] = ' + classe + '(' + broche + ', ' + DHT_DECALAGE[broche] + ')\n';
        };
    }

    function blocMesurerDht(type, nomCapteur, accesseur) {
        Blockly.Blocks[type] = { init: function() {
            this.appendDummyInput().appendField(nomCapteur + " :")
                .appendField(new Blockly.FieldDropdown([
                    ["température (°C)", "c"], ["température (°F)", "f"], ["humidité (%)", "h"]
                ]), "GRANDEUR");
            this.setOutput(true, "Number");
            this.setColour(COULEUR_GROVE);
            this.setTooltip("Renvoie -1 sur micro:bit V2 : ce capteur n'est fiable que sur le V1, " +
                "protocole minuté en assembleur incompatible avec l'horloge du V2. Utiliser AHT20/DHT20 " +
                "(module I²C ci-dessus) à la place si la carte peut être un V2.");
        }};
        P.forBlock[type] = function(block) {
            piloteDht();
            const g = block.getFieldValue('GRANDEUR');
            if (g === 'h') return [accesseur + '().humidite()', P.ORDER_FUNCTION_CALL];
            if (g === 'f') return ['(' + accesseur + '().temperature() * 9 / 5 + 32)', P.ORDER_ATOMIC];
            return [accesseur + '().temperature()', P.ORDER_FUNCTION_CALL];
        };
    }

    blocDefinirDht('grove_dht11_definir', 'DHT11', 'dht11', '_CapteurDHT11');
    blocMesurerDht('grove_dht11_mesure', 'DHT11', '_grove_dht11');
    blocDefinirDht('grove_dht22_definir', 'DHT22', 'dht22', '_CapteurDHT22');
    blocMesurerDht('grove_dht22_mesure', 'DHT22', '_grove_dht22');

    // --- Écran LCD 16x2 v1 (JHD1802) ---

    function piloteLcd() {
        importerMicrobit();
        piloteRegistre();
        pilote('lcd1602', [
            'class _EcranLCD:',
            '    ADR = 0x3E',
            '',
            '    def __init__(self):',
            '        i2c.init()',
            '        self.controle = 0x04',
            '        sleep(50)',
            '        self._commande(0x28)                       # 2 lignes, 5x8',
            '        self._commande(0x08 | self.controle)       # affichage allume',
            '        self._commande(0x06)                       # avance du curseur',
            '        self.effacer()',
            '',
            '    def _commande(self, valeur):',
            '        i2c.write(self.ADR, bytes([0x80, valeur]))',
            '',
            '    def _donnee(self, valeur):',
            '        i2c.write(self.ADR, bytes([0x40, valeur]))',
            '',
            '    def effacer(self):',
            '        self._commande(0x01)',
            '        sleep(2)',
            '',
            '    def allumer(self):',
            '        self.controle = self.controle | 0x04',
            '        self._commande(0x08 | self.controle)',
            '',
            '    def eteindre(self):',
            '        self.controle = self.controle & 0xFB',
            '        self._commande(0x08 | self.controle)',
            '',
            '    def texte(self, message, x, y):',
            '        x = max(0, min(15, int(x)))',
            '        y = max(0, min(1, int(y)))',
            '        self._commande((x | 0x80) if y == 0 else (x | 0xC0))',
            '        for c in str(message)[:16 - x]:',
            '            self._donnee(ord(c))',
            '',
            'def _grove_lcd():',
            '    return _grove_obj("lcd", _EcranLCD)',
        ]);
    }

    Blockly.Blocks['grove_lcd_init'] = { init: function() {
        this.appendDummyInput().appendField("initialiser l'écran LCD 16x2");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COULEUR_GROVE);
        this.setTooltip("Adresse I²C 0x3E. Facultatif : l'écran s'initialise à la première utilisation.");
    }};
    P.forBlock['grove_lcd_init'] = function(block) {
        piloteLcd();
        return '_grove_objets["lcd"] = _EcranLCD()\n';
    };

    Blockly.Blocks['grove_lcd_texte'] = { init: function() {
        this.appendValueInput("TEXTE").appendField("LCD : afficher");
        this.appendValueInput("X").setCheck("Number").appendField("en x");
        this.appendValueInput("Y").setCheck("Number").appendField("y");
        this.setInputsInline(false);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COULEUR_GROVE);
        this.setTooltip("x de 0 à 15, y de 0 à 1.");
    }};
    P.forBlock['grove_lcd_texte'] = function(block) {
        piloteLcd();
        const x = P.valueToCode(block, 'X', P.ORDER_NONE) || '0';
        const y = P.valueToCode(block, 'Y', P.ORDER_NONE) || '0';
        return '_grove_lcd().texte(' + versTexte(block, 'TEXTE') + ', ' + x + ', ' + y + ')\n';
    };

    Blockly.Blocks['grove_lcd_effacer'] = { init: function() {
        this.appendDummyInput().appendField("LCD : effacer");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COULEUR_GROVE);
    }};
    P.forBlock['grove_lcd_effacer'] = function(block) {
        piloteLcd();
        return '_grove_lcd().effacer()\n';
    };

    Blockly.Blocks['grove_lcd_alimenter'] = { init: function() {
        this.appendDummyInput().appendField("LCD :")
            .appendField(new Blockly.FieldDropdown([
                ["allumer", "allumer"], ["éteindre", "eteindre"]
            ]), "ETAT").appendField("l'affichage");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COULEUR_GROVE);
    }};
    P.forBlock['grove_lcd_alimenter'] = function(block) {
        piloteLcd();
        return '_grove_lcd().' + block.getFieldValue('ETAT') + '()\n';
    };

    // --- Capteur de couleur VEML6040 ---

    function piloteCouleur() {
        importerMicrobit();
        piloteRegistre();
        pilote('veml6040', [
            'class _CapteurCouleur:',
            '    ADR = 0x10',
            '    CANAUX = {"rouge": 0x08, "vert": 0x09, "bleu": 0x0A, "blanc": 0x0B}',
            '',
            '    def __init__(self):',
            '        i2c.init()',
            '        # Configuration : mesure continue, integration 40 ms.',
            '        i2c.write(self.ADR, bytes([0x00, 0x00, 0x00]))',
            '        sleep(50)',
            '',
            '    def lire(self, canal):',
            '        i2c.write(self.ADR, bytes([self.CANAUX[canal]]))',
            '        t = i2c.read(self.ADR, 2)',
            '        return t[0] + (t[1] << 8)   # 16 bits, octet de poids faible en tete',
            '',
            'def _grove_couleur():',
            '    return _grove_obj("couleur", _CapteurCouleur)',
        ]);
    }

    Blockly.Blocks['grove_couleur_init'] = { init: function() {
        this.appendDummyInput().appendField("initialiser le capteur de couleur");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COULEUR_GROVE);
        this.setTooltip("VEML6040, adresse I²C 0x10. Facultatif.");
    }};
    P.forBlock['grove_couleur_init'] = function(block) {
        piloteCouleur();
        return '_grove_objets["couleur"] = _CapteurCouleur()\n';
    };

    Blockly.Blocks['grove_couleur_lire'] = { init: function() {
        this.appendDummyInput().appendField("capteur de couleur : canal")
            .appendField(new Blockly.FieldDropdown([
                ["rouge", "rouge"], ["vert", "vert"], ["bleu", "bleu"], ["blanc", "blanc"]
            ]), "CANAL");
        this.setOutput(true, "Number");
        this.setColour(COULEUR_GROVE);
        this.setTooltip("Valeur brute sur 16 bits.");
    }};
    P.forBlock['grove_couleur_lire'] = function(block) {
        piloteCouleur();
        return ['_grove_couleur().lire("' + block.getFieldValue('CANAL') + '")', P.ORDER_FUNCTION_CALL];
    };

    // --- Pilote moteur DRV8830 (deux canaux, deux adresses) ---

    function piloteMoteur() {
        importerMicrobit();
        pilote('drv8830', [
            '# Canal 1 : adresse 8 bits 0xCA, canal 2 : 0xC0, decalees d un bit.',
            '_DRV_ADR = {1: 0x65, 2: 0x60}',
            '',
            'def _grove_moteur_ecrire(canal, registre, valeur):',
            '    i2c.init()',
            '    i2c.write(_DRV_ADR[canal], bytes([registre, valeur]))',
            '',
            'def _grove_moteur_vitesse(canal, vitesse):',
            '    vitesse = max(-63, min(63, int(vitesse)))',
            '    _grove_moteur_ecrire(canal, 0x01, 0x80)   # effacer un defaut en attente',
            '    sens = 0x01 if vitesse < 0 else 0x02',
            '    _grove_moteur_ecrire(canal, 0x00, ((abs(vitesse) & 0x3F) << 2) | sens)',
            '',
            'def _grove_moteur_arret(canal):',
            '    _grove_moteur_ecrire(canal, 0x00, 0x00)',
            '',
            'def _grove_moteur_frein(canal):',
            '    _grove_moteur_ecrire(canal, 0x00, 0x03)',
            '',
            'def _grove_moteur_effacer_defaut(canal):',
            '    _grove_moteur_ecrire(canal, 0x01, 0x80)',
            '',
            'def _grove_moteur_defaut(canal):',
            '    i2c.init()',
            '    i2c.write(_DRV_ADR[canal], bytes([0x01]))',
            '    return i2c.read(_DRV_ADR[canal], 1)[0]',
        ]);
    }

    const menuCanalMoteur = () => new Blockly.FieldDropdown([["1", "1"], ["2", "2"]]);

    Blockly.Blocks['grove_moteur_vitesse'] = { init: function() {
        this.appendValueInput("VITESSE").setCheck("Number")
            .appendField("moteur canal").appendField(menuCanalMoteur(), "CANAL")
            .appendField("vitesse");
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COULEUR_GROVE);
        this.setTooltip("De -63 à 63. Négatif pour tourner à l'envers.");
    }};
    P.forBlock['grove_moteur_vitesse'] = function(block) {
        piloteMoteur();
        const v = P.valueToCode(block, 'VITESSE', P.ORDER_NONE) || '0';
        return '_grove_moteur_vitesse(' + block.getFieldValue('CANAL') + ', ' + v + ')\n';
    };

    Blockly.Blocks['grove_moteur_action'] = { init: function() {
        this.appendDummyInput()
            .appendField(new Blockly.FieldDropdown([
                ["arrêter", "arret"], ["freiner", "frein"], ["effacer le défaut de", "effacer_defaut"]
            ]), "ACTION")
            .appendField("le moteur canal").appendField(menuCanalMoteur(), "CANAL");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COULEUR_GROVE);
    }};
    P.forBlock['grove_moteur_action'] = function(block) {
        piloteMoteur();
        return '_grove_moteur_' + block.getFieldValue('ACTION') +
               '(' + block.getFieldValue('CANAL') + ')\n';
    };

    Blockly.Blocks['grove_moteur_defaut'] = { init: function() {
        this.appendDummyInput().appendField("défaut du moteur canal").appendField(menuCanalMoteur(), "CANAL");
        this.setOutput(true, "Number");
        this.setColour(COULEUR_GROVE);
        this.setTooltip("0 si tout va bien.");
    }};
    P.forBlock['grove_moteur_defaut'] = function(block) {
        piloteMoteur();
        return ['_grove_moteur_defaut(' + block.getFieldValue('CANAL') + ')', P.ORDER_FUNCTION_CALL];
    };

    // --- Capteurs de CO2 SCD30 et SCD41 ---

    function piloteScd30() {
        importerMicrobit();
        piloteRegistre();
        importerModule('ustruct');
        piloteCrc8();
        pilote('scd30', [
            'class _CapteurSCD30:',
            '    ADR = 0x61',
            '',
            '    def __init__(self):',
            '        i2c.init()',
            '        self._commande(0x0010, 0x0000)   # mesure continue',
            '        sleep(20)',
            '',
            '    def _commande(self, commande, valeur):',
            '        trame = bytes([commande >> 8, commande & 0xFF, valeur >> 8, valeur & 0xFF])',
            '        i2c.write(self.ADR, trame + bytes([_grove_crc8(trame[2:4])]))',
            '',
            '    def _pret(self):',
            '        i2c.write(self.ADR, bytes([0x02, 0x02]))',
            '        sleep(3)',
            '        t = i2c.read(self.ADR, 3)',
            '        return ((t[0] << 8) + t[1]) != 0',
            '',
            '    def lire(self, grandeur):',
            '        if not self._pret():',
            '            return -1',
            '        i2c.write(self.ADR, bytes([0x03, 0x00]))',
            '        sleep(3)',
            '        t = i2c.read(self.ADR, 18)',
            '        # Trois flottants, chacun en deux moities suivies de leur CRC.',
            '        depart = {"co2": 0, "temperature": 6, "humidite": 12}[grandeur]',
            '        d = depart',
            '        return ustruct.unpack(">f", bytes([t[d], t[d+1], t[d+3], t[d+4]]))[0]',
            '',
            'def _grove_scd30():',
            '    return _grove_obj("scd30", _CapteurSCD30)',
        ]);
    }

    function piloteScd41() {
        importerMicrobit();
        piloteRegistre();
        pilote('scd41', [
            'class _CapteurSCD41:',
            '    ADR = 0x62',
            '',
            '    def __init__(self):',
            '        i2c.init()',
            '        self._commande(0x3F86)   # arreter une mesure periodique en cours',
            '        sleep(500)',
            '        self._commande(0x3646)   # reinitialiser',
            '        sleep(30)',
            '        self._commande(0x21B1)   # demarrer la mesure periodique',
            '        sleep(10)',
            '',
            '    def _commande(self, commande):',
            '        i2c.write(self.ADR, bytes([commande >> 8, commande & 0xFF]))',
            '',
            '    def _pret(self):',
            '        self._commande(0xE4B8)',
            '        sleep(2)',
            '        t = i2c.read(self.ADR, 3)',
            '        return (((t[0] << 8) + t[1]) & 0x07FF) != 0',
            '',
            '    def lire(self, grandeur):',
            '        if not self._pret():',
            '            return -1',
            '        self._commande(0xEC05)',
            '        sleep(2)',
            '        t = i2c.read(self.ADR, 9)',
            '        if grandeur == "co2":',
            '            return (t[0] << 8) + t[1]',
            '        if grandeur == "temperature":',
            '            return ((t[3] << 8) + t[4]) * 175.0 / 65535.0 - 45.0',
            '        return ((t[6] << 8) + t[7]) * 100.0 / 65535.0',
            '',
            'def _grove_scd41():',
            '    return _grove_obj("scd41", _CapteurSCD41)',
        ]);
    }

    const GRANDEURS_CO2 = [["CO₂ (ppm)", "co2"], ["température (°C)", "temperature"], ["humidité (%)", "humidite"]];

    Blockly.Blocks['grove_scd30_init'] = { init: function() {
        this.appendDummyInput().appendField("initialiser le capteur CO₂ SCD30");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COULEUR_GROVE);
        this.setTooltip("Adresse I²C 0x61. Facultatif.");
    }};
    P.forBlock['grove_scd30_init'] = function(block) {
        piloteScd30();
        return '_grove_objets["scd30"] = _CapteurSCD30()\n';
    };

    Blockly.Blocks['grove_scd30_lire'] = { init: function() {
        this.appendDummyInput().appendField("SCD30 :")
            .appendField(new Blockly.FieldDropdown(GRANDEURS_CO2), "GRANDEUR");
        this.setOutput(true, "Number");
        this.setColour(COULEUR_GROVE);
    }};
    P.forBlock['grove_scd30_lire'] = function(block) {
        piloteScd30();
        return ['_grove_scd30().lire("' + block.getFieldValue('GRANDEUR') + '")', P.ORDER_FUNCTION_CALL];
    };

    Blockly.Blocks['grove_scd41_init'] = { init: function() {
        this.appendDummyInput().appendField("initialiser le capteur CO₂ SCD41");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COULEUR_GROVE);
        this.setTooltip("Adresse I²C 0x62. Facultatif.");
    }};
    P.forBlock['grove_scd41_init'] = function(block) {
        piloteScd41();
        return '_grove_objets["scd41"] = _CapteurSCD41()\n';
    };

    Blockly.Blocks['grove_scd41_lire'] = { init: function() {
        this.appendDummyInput().appendField("SCD41 :")
            .appendField(new Blockly.FieldDropdown(GRANDEURS_CO2), "GRANDEUR");
        this.setOutput(true, "Number");
        this.setColour(COULEUR_GROVE);
    }};
    P.forBlock['grove_scd41_lire'] = function(block) {
        piloteScd41();
        return ['_grove_scd41().lire("' + block.getFieldValue('GRANDEUR') + '")', P.ORDER_FUNCTION_CALL];
    };

    // ==========================================
    // 1 bis. PROFIL ADMINISTRATEUR — configuration et libellés
    // ==========================================
    // Chargee et cablee AVANT l'injection de Blockly : les deux blocs de
    // depart (au_demarrage, boucle_infinie) sont crees juste apres l'inject,
    // et doivent deja beneficier des libelles personnalises s'il y en a.

    const CLE_CONFIG_ADMIN = 'blockly_ts_config_admin';

    function configAdminParDefaut() {
        return { categories: { order: [], hidden: [], labels: {} }, groupes: {}, sousMenus: [], libellesBlocs: {} };
    }

    function chargerConfigAdmin() {
        const defaut = configAdminParDefaut();
        try {
            const brut = localStorage.getItem(CLE_CONFIG_ADMIN);
            if (!brut) return defaut;
            const lu = JSON.parse(brut);
            return {
                categories: Object.assign(defaut.categories, lu.categories),
                groupes: lu.groupes || {},
                sousMenus: lu.sousMenus || [],
                libellesBlocs: lu.libellesBlocs || {}
            };
        } catch (erreur) { return defaut; }
    }

    function sauvegarderConfigAdmin() {
        try { localStorage.setItem(CLE_CONFIG_ADMIN, JSON.stringify(configAdmin)); }
        catch (erreur) { /* stockage indisponible : la config vaut pour la session */ }
    }

    let configAdmin = chargerConfigAdmin();

    // Chaque appendField("texte") sans nom cree un FieldLabel anonyme. On le
    // repere par sa position parmi les seuls FieldLabel du bloc (ordre des
    // appendField dans init) : une cle stable tant que le bloc n'est pas
    // reecrit, sans avoir a nommer a la main les centaines de libelles.
    function texteChampsLibelle(bloc) {
        const textes = [];
        for (const entree of bloc.inputList) {
            for (const champ of entree.fieldRow) {
                if (champ instanceof Blockly.FieldLabel) textes.push(champ.getValue());
            }
        }
        return textes;
    }

    function appliquerLibellesBloc(bloc) {
        let index = 0;
        for (const entree of bloc.inputList) {
            for (const champ of entree.fieldRow) {
                if (champ instanceof Blockly.FieldLabel) {
                    const voulu = configAdmin.libellesBlocs[bloc.type + '#' + index];
                    if (voulu !== undefined && champ.getValue() !== voulu) champ.setValue(voulu);
                    index++;
                }
            }
        }
    }

    // Espace de travail invisible, jamais injecte dans la page : sert
    // uniquement a instancier chaque type de bloc une fois pour relever ses
    // libelles d'origine, avant que la surcouche ne les modifie.
    const LIBELLES_DEFAUT = {};
    const espaceSonde = new Blockly.Workspace();
    for (const type in Blockly.Blocks) {
        const definition = Blockly.Blocks[type];
        if (!definition || typeof definition.init !== 'function') continue;
        const initOrigine = definition.init;

        try {
            const sonde = espaceSonde.newBlock(type);
            LIBELLES_DEFAUT[type] = texteChampsLibelle(sonde);
            sonde.dispose();
        } catch (erreur) { /* bloc dynamique ou mutateur incompatible hors atelier : ignore */ }

        definition.init = function() {
            initOrigine.call(this);
            appliquerLibellesBloc(this);
        };
    }
    espaceSonde.dispose();

    // ==========================================
    // 2. CRÉATION DE L'INTERFACE (TOOLBOX)
    // ==========================================
    window.workspace = Blockly.inject('blocklyDiv', {
      // Sans ces options, Blockly reste figé à l'échelle 1 : ni boutons de zoom,
      // ni molette, ni recentrage. Avec zoom.wheel ET move.wheel actifs,
      // Ctrl+molette agrandit et la molette seule fait défiler.
      zoom: {
        // Les boutons internes de Blockly sont desactives : ils sont dessines
        // dans le canevas, donc rognes des que la place manque, et ils se
        // chevauchaient avec la corbeille. Ils sont remplaces par des boutons
        // de la barre du haut, toujours visibles.
        controls: false,
        wheel: true,
        pinch: true,
        startScale: 1.0,
        minScale: 0.3,
        maxScale: 3.0,
        scaleSpeed: 1.2
      },
      move: {
        scrollbars: { horizontal: true, vertical: true },
        drag: true,
        wheel: true
      },
      grid: { spacing: 20, length: 3, colour: '#e4e4e4', snap: false },
      trashcan: true,
      // Un seul bloc de demarrage a la fois : deux rendraient l'ordre
      // d'execution ambigu. Le tiroir grise le bloc quand il est deja pose.
      maxInstances: { 'au_demarrage': 1 },
      toolbox: {
        "kind": "categoryToolbox",
        "contents": [
          {
            "kind": "category", "name": "Temps", "colour": "230",
            "contents": [
              { "kind": "block", "type": "attendre_temps", "inputs": { "TEMPS": { "shadow": { "type": "math_number", "fields": { "NUM": "1" } } } } },
              { "kind": "block", "type": "attendre_jusqua" },
              { "kind": "block", "type": "repeter_toutes_les" },
              { "kind": "block", "type": "reset_chrono" },
              { "kind": "block", "type": "valeur_chrono" }
            ]
          },
          {
            "kind": "category", "name": "Affichage", "colour": "160",
            "contents": [
              { "kind": "block", "type": "afficher_valeur", "inputs": { "VALEUR": { "shadow": { "type": "text", "fields": { "TEXT": "Bonjour !" } } } } },
              { "kind": "block", "type": "faire_defiler", "inputs": { "VALEUR": { "shadow": { "type": "text", "fields": { "TEXT": "Bonjour !" } } } } },
              { "kind": "block", "type": "afficher_icone" },
              { "kind": "block", "type": "afficher_image_matrice" },
              { "kind": "block", "type": "effacer_ecran" }
            ]
          },
          {
            "kind": "category", "name": "Entrées/Sorties", "colour": "210",
            "contents": [
              { "kind": "block", "type": "si_bouton_appuye" },
              { "kind": "block", "type": "si_logo_touche" },
              { "kind": "block", "type": "si_secoue_alors" },
              { "kind": "block", "type": "bouton_est_appuye" },
              { "kind": "block", "type": "logo_est_touche" },
              { "kind": "block", "type": "nombre_clics_bouton" },
              { "kind": "block", "type": "reinitialiser_microbit" }
            ]
          },
          {
            "kind": "category", "name": "Capteurs", "colour": "300",
            "contents": [
              { "kind": "block", "type": "lorsque_bouton" },
              { "kind": "block", "type": "lorsque_geste" },
              { "kind": "block", "type": "lorsque_broche" },
              { "kind": "block", "type": "lorsque_son_detecte" },
              { "kind": "block", "type": "lorsque_logo" },
              { "kind": "block", "type": "capteur_acceleration" },
              { "kind": "block", "type": "broche_est_pressee" },
              { "kind": "block", "type": "capteur_luminosite" },
              { "kind": "block", "type": "capteur_boussole_direction" },
              { "kind": "block", "type": "capteur_temperature" },
              { "kind": "block", "type": "geste_est_actif" },
              { "kind": "block", "type": "micro_intensite_son" },
              { "kind": "block", "type": "capteur_boussole_calibrer" },
              { "kind": "block", "type": "capteur_boussole_force" },
              { "kind": "block", "type": "capteur_rotation" },
              { "kind": "block", "type": "temps_execution" },
              { "kind": "block", "type": "gamme_accelerometre" },
              { "kind": "block", "type": "micro_definir_seuil", "inputs": { "SEUIL": { "shadow": { "type": "math_number", "fields": { "NUM": "128" } } } } }
            ]
          },
          {
            "kind": "category", "name": "Actionneurs (Audio)", "colour": "330",
            "contents": [
              { "kind": "block", "type": "audio_jouer" },
              { "kind": "block", "type": "audio_arreter" },
              { "kind": "block", "type": "music_jouer_melodie" },
              { "kind": "block", "type": "speech_dire", "inputs": { "TEXT": { "shadow": { "type": "text", "fields": { "TEXT": "Bonjour !" } } } } }
            ]
          },
          {
            "kind": "category", "name": "Communication", "colour": "120",
            "contents": [
            {
            "kind": "category", "name": "Groupe", "colour": "120",
            "contents": [
              { "kind": "block", "type": "radio_activer" },
              { "kind": "block", "type": "radio_groupe", "inputs": { "GROUPE": { "shadow": { "type": "math_number", "fields": { "NUM": "1" } } } } }
            ]
            },
            {
            "kind": "category", "name": "Envoi", "colour": "120",
            "contents": [
              { "kind": "block", "type": "radio_envoyer_nombre", "inputs": { "NOMBRE": { "shadow": { "type": "math_number", "fields": { "NUM": "0" } } } } },
              { "kind": "block", "type": "radio_envoyer_valeur", "inputs": { "NOM": { "shadow": { "type": "text", "fields": { "TEXT": "nom" } } }, "VALEUR": { "shadow": { "type": "math_number", "fields": { "NUM": "0" } } } } },
              { "kind": "block", "type": "radio_envoyer_texte", "inputs": { "MESSAGE": { "shadow": { "type": "text", "fields": { "TEXT": "salut" } } } } }
            ]
            },
            {
            "kind": "category", "name": "Réception", "colour": "120",
            "contents": [
              { "kind": "block", "type": "radio_quand_recu" },
              { "kind": "block", "type": "radio_lecture" }
            ]
            },
            {
            "kind": "category", "name": "Plus", "colour": "120",
            "contents": [
              { "kind": "block", "type": "radio_puissance", "inputs": { "NIVEAU": { "shadow": { "type": "math_number", "fields": { "NUM": "7" } } } } },
              { "kind": "block", "type": "radio_canal", "inputs": { "CANAL": { "shadow": { "type": "math_number", "fields": { "NUM": "7" } } } } }
            ]
            }
            ]
          },
          {
            "kind": "category", "name": "Servos", "colour": String(COULEUR_SERVO),
            "contents": [
              { "kind": "label", "text": "Positionnel" },
              { "kind": "block", "type": "servo_angle", "inputs": { "ANGLE": { "shadow": { "type": "math_number", "fields": { "NUM": "90" } } } } },

              { "kind": "label", "text": "En continu" },
              { "kind": "block", "type": "servo_continu", "inputs": { "VITESSE": { "shadow": { "type": "math_number", "fields": { "NUM": "50" } } } } },
              { "kind": "block", "type": "servo_arreter" },

              { "kind": "label", "text": "Configuration" },
              { "kind": "block", "type": "servo_arret_neutre" },
              { "kind": "block", "type": "servo_intervalle", "inputs": { "MINI": { "shadow": { "type": "math_number", "fields": { "NUM": "0" } } }, "MAXI": { "shadow": { "type": "math_number", "fields": { "NUM": "180" } } } } },
              { "kind": "block", "type": "servo_impulsion", "inputs": { "MICROS": { "shadow": { "type": "math_number", "fields": { "NUM": "1500" } } } } }
            ]
          },
          {
            // 37 blocs dans un seul tiroir demandaient plus de deux ecrans de
            // defilement : les derniers etaient introuvables en pratique. Un
            // sous-menu par module, chacun tenant d'un coup d'oeil.
            "kind": "category", "name": "Grove", "colour": String(COULEUR_GROVE),
            "contents": [
            {
            "kind": "category", "name": "LED", "colour": String(COULEUR_GROVE),
            "contents": [
              { "kind": "block", "type": "grove_led_etat" },
              { "kind": "block", "type": "grove_led_luminosite", "inputs": { "NIVEAU": { "shadow": { "type": "math_number", "fields": { "NUM": "1023" } } } } }
            ]
            },
            {
            "kind": "category", "name": "Ruban RGB (WS2813)", "colour": String(COULEUR_GROVE),
            "contents": [
              { "kind": "block", "type": "grove_ruban_definir" },
              { "kind": "block", "type": "grove_ruban_couleur" },
              { "kind": "block", "type": "grove_ruban_effacer" },
              { "kind": "block", "type": "grove_ruban_couleur_index", "inputs": { "INDEX": { "shadow": { "type": "math_number", "fields": { "NUM": "0" } } } } },
              { "kind": "block", "type": "grove_ruban_effacer_index", "inputs": { "INDEX": { "shadow": { "type": "math_number", "fields": { "NUM": "0" } } } } },
              { "kind": "block", "type": "grove_ruban_perso", "inputs": { "R": { "shadow": { "type": "math_number", "fields": { "NUM": "255" } } }, "V": { "shadow": { "type": "math_number", "fields": { "NUM": "0" } } }, "B": { "shadow": { "type": "math_number", "fields": { "NUM": "0" } } } } },
              { "kind": "block", "type": "grove_ruban_perso_index", "inputs": { "INDEX": { "shadow": { "type": "math_number", "fields": { "NUM": "0" } } }, "R": { "shadow": { "type": "math_number", "fields": { "NUM": "255" } } }, "V": { "shadow": { "type": "math_number", "fields": { "NUM": "0" } } }, "B": { "shadow": { "type": "math_number", "fields": { "NUM": "0" } } } } },
              { "kind": "block", "type": "grove_ruban_luminosite", "inputs": { "NIVEAU": { "shadow": { "type": "math_number", "fields": { "NUM": "100" } } } } },

              ]
            },
            {
            "kind": "category", "name": "Afficheur 4 digits", "colour": String(COULEUR_GROVE),
            "contents": [
              { "kind": "block", "type": "grove_4d_definir" },
              { "kind": "block", "type": "grove_4d_nombre", "inputs": { "VALEUR": { "shadow": { "type": "math_number", "fields": { "NUM": "0" } } } } },
              { "kind": "block", "type": "grove_4d_chiffre", "inputs": { "VALEUR": { "shadow": { "type": "math_number", "fields": { "NUM": "0" } } }, "POSITION": { "shadow": { "type": "math_number", "fields": { "NUM": "0" } } } } },
              { "kind": "block", "type": "grove_4d_points" },
              { "kind": "block", "type": "grove_4d_luminosite", "inputs": { "NIVEAU": { "shadow": { "type": "math_number", "fields": { "NUM": "7" } } } } },
              { "kind": "block", "type": "grove_4d_effacer" },

              ]
            },
            {
            "kind": "category", "name": "Ultrason", "colour": String(COULEUR_GROVE),
            "contents": [
              { "kind": "block", "type": "grove_ultrason_cm" },
              { "kind": "block", "type": "grove_ultrason_pouces" },

              ]
            },
            {
            "kind": "category", "name": "Joystick", "colour": String(COULEUR_GROVE),
            "contents": [
              { "kind": "block", "type": "grove_joystick_valeur" },
              { "kind": "block", "type": "grove_joystick_direction" },
              { "kind": "block", "type": "grove_joystick_bouton" },

              ]
            },
            {
            "kind": "category", "name": "Capteur de gestes", "colour": String(COULEUR_GROVE),
            "contents": [
              { "kind": "block", "type": "grove_gestes_init" },
              { "kind": "block", "type": "grove_gestes_est" },
              { "kind": "block", "type": "grove_gestes_lire" },

              ]
            },
            {
            "kind": "category", "name": "Température & humidité", "colour": String(COULEUR_GROVE),
            "contents": [
              { "kind": "block", "type": "grove_th_init" },
              { "kind": "block", "type": "grove_th_mesure" },
              { "kind": "block", "type": "grove_dht11_definir" },
              { "kind": "block", "type": "grove_dht11_mesure" },
              { "kind": "block", "type": "grove_dht22_definir" },
              { "kind": "block", "type": "grove_dht22_mesure" },

              ]
            },
            {
            "kind": "category", "name": "Écran LCD 16x2", "colour": String(COULEUR_GROVE),
            "contents": [
              { "kind": "block", "type": "grove_lcd_init" },
              { "kind": "block", "type": "grove_lcd_texte", "inputs": { "TEXTE": { "shadow": { "type": "text", "fields": { "TEXT": "Bonjour" } } }, "X": { "shadow": { "type": "math_number", "fields": { "NUM": "0" } } }, "Y": { "shadow": { "type": "math_number", "fields": { "NUM": "0" } } } } },
              { "kind": "block", "type": "grove_lcd_effacer" },
              { "kind": "block", "type": "grove_lcd_alimenter" },

              ]
            },
            {
            "kind": "category", "name": "Capteur de couleur", "colour": String(COULEUR_GROVE),
            "contents": [
              { "kind": "block", "type": "grove_couleur_init" },
              { "kind": "block", "type": "grove_couleur_lire" },

              ]
            },
            {
            "kind": "category", "name": "Pilote moteur", "colour": String(COULEUR_GROVE),
            "contents": [
              { "kind": "block", "type": "grove_moteur_vitesse", "inputs": { "VITESSE": { "shadow": { "type": "math_number", "fields": { "NUM": "30" } } } } },
              { "kind": "block", "type": "grove_moteur_action" },
              { "kind": "block", "type": "grove_moteur_defaut" },

              ]
            },
            {
            "kind": "category", "name": "CO₂ (SCD30 / SCD41)", "colour": String(COULEUR_GROVE),
            "contents": [
              { "kind": "block", "type": "grove_scd30_init" },
              { "kind": "block", "type": "grove_scd30_lire" },
              { "kind": "block", "type": "grove_scd41_init" },
              { "kind": "block", "type": "grove_scd41_lire" }
            ]
            }
            ]
          },
          {
            "kind": "category", "name": "Boucles", "colour": "120",
            "contents": [
              { "kind": "block", "type": "au_demarrage" },
              { "kind": "block", "type": "boucle_infinie" },
              { "kind": "block", "type": "controls_repeat_ext", "inputs": { "TIMES": { "shadow": { "type": "math_number", "fields": { "NUM": "10" } } } } },
              { "kind": "block", "type": "controls_whileUntil" },
              { "kind": "block", "type": "controls_for", "inputs": { "FROM": { "shadow": { "type": "math_number", "fields": { "NUM": "1" } } }, "TO": { "shadow": { "type": "math_number", "fields": { "NUM": "10" } } }, "BY": { "shadow": { "type": "math_number", "fields": { "NUM": "1" } } } } }
            ]
          },
          {
            "kind": "category", "name": "Logique", "colour": "210",
            "contents": [
              { "kind": "block", "type": "controls_if" },
              { "kind": "block", "type": "logic_compare" },
              { "kind": "block", "type": "logic_operation" },
              { "kind": "block", "type": "logic_negate" },
              { "kind": "block", "type": "logic_boolean" },
              { "kind": "block", "type": "logic_null" },
              { "kind": "block", "type": "logic_ternary" }
            ]
          },
          {
            "kind": "category", "name": "Variables", "custom": "VARIABLE", "colour": "330"
          },
          {
            // Categorie dynamique de Blockly : elle fournit la definition, la
            // definition avec retour, le retour conditionnel, et un bloc d'appel
            // par fonction creee. Les fonctions sont emises via definitions_,
            // donc placees avant tout code executable.
            "kind": "category", "name": "Fonctions", "custom": "PROCEDURE", "colour": "290"
          },
          {
            "kind": "category", "name": "Maths", "colour": "280",
            "contents": [
              { "kind": "block", "type": "math_number", "fields": { "NUM": "0" } },
              { "kind": "block", "type": "math_arithmetic", "fields": { "OP": "ADD" } },
              { "kind": "block", "type": "math_arithmetic", "fields": { "OP": "MINUS" } },
              { "kind": "block", "type": "math_arithmetic", "fields": { "OP": "MULTIPLY" } },
              { "kind": "block", "type": "math_arithmetic", "fields": { "OP": "DIVIDE" } },
              { "kind": "block", "type": "math_modulo", "inputs": { "DIVIDEND": { "shadow": { "type": "math_number", "fields": { "NUM": "0" } } }, "DIVISOR": { "shadow": { "type": "math_number", "fields": { "NUM": "1" } } } } },
              { "kind": "block", "type": "math_min_max", "inputs": { "A": { "shadow": { "type": "math_number", "fields": { "NUM": "0" } } }, "B": { "shadow": { "type": "math_number", "fields": { "NUM": "0" } } } } },
              { "kind": "block", "type": "math_absolue", "inputs": { "NUM": { "shadow": { "type": "math_number", "fields": { "NUM": "0" } } } } },
              { "kind": "block", "type": "math_racine", "inputs": { "NUM": { "shadow": { "type": "math_number", "fields": { "NUM": "0" } } } } },
              { "kind": "block", "type": "math_arrondi_custom", "inputs": { "NUM": { "shadow": { "type": "math_number", "fields": { "NUM": "0" } } } } },
              { "kind": "block", "type": "math_random_int", "inputs": { "FROM": { "shadow": { "type": "math_number", "fields": { "NUM": "0" } } }, "TO": { "shadow": { "type": "math_number", "fields": { "NUM": "10" } } } } },
              { "kind": "block", "type": "math_constrain", "inputs": { "VALUE": { "shadow": { "type": "math_number", "fields": { "NUM": "0" } } }, "LOW": { "shadow": { "type": "math_number", "fields": { "NUM": "0" } } }, "HIGH": { "shadow": { "type": "math_number", "fields": { "NUM": "0" } } } } },
              { "kind": "block", "type": "math_map", "inputs": { "VAL": { "shadow": { "type": "math_number", "fields": { "NUM": "0" } } }, "FROMLOW": { "shadow": { "type": "math_number", "fields": { "NUM": "0" } } }, "FROMHIGH": { "shadow": { "type": "math_number", "fields": { "NUM": "1023" } } }, "TOLOW": { "shadow": { "type": "math_number", "fields": { "NUM": "0" } } }, "TOHIGH": { "shadow": { "type": "math_number", "fields": { "NUM": "4" } } } } },
              { "kind": "block", "type": "math_random_bool" },
              { "kind": "block", "type": "math_convert", "inputs": { "NUM": { "shadow": { "type": "math_number", "fields": { "NUM": "0" } } } } },
              { "kind": "block", "type": "math_constant", "fields": { "CONSTANT": "PI" } }
            ]
          },
          {
            "kind": "category", "name": "Texte", "colour": "160",
            "contents": [
              { "kind": "block", "type": "text" },
              { "kind": "block", "type": "text_join" }
            ]
          }
        ]
      }
    });

    // Espace de depart : le demarrage puis la boucle, comme dans MakeCode.
    // Les blocs de premier niveau sont generes dans l'ordre de leur position,
    // le demarrage est donc pose au-dessus pour s'executer en premier.
    if (!window.workspace.getTopBlocks(false).length) {
        Blockly.serialization.workspaces.load({ blocks: { languageVersion: 0, blocks: [
            { type: 'au_demarrage', x: 40, y: 40 },
            { type: 'boucle_infinie', x: 40, y: 190 }
        ]}}, window.workspace);
    }

    // ------------------------------------------
    // PANNEAU ADMINISTRATEUR — categories, sous-menus, libelles
    // ------------------------------------------
    // Blockly conserve la definition de la boite a outils dans
    // options.languageTree ; on la lit une seule fois ici (TOOLBOX_ORIGINAL)
    // et on la reconstruit a chaque changement plutot que de la modifier en
    // place, pour toujours pouvoir revenir a l'etat d'origine.

    function cloneProfond(x) { return JSON.parse(JSON.stringify(x)); }

    const TOOLBOX_ORIGINAL = cloneProfond(window.workspace.options.languageTree.contents);

    // Sous-menus masques la premiere fois que l'admin les rencontre (avant
    // toute config sauvegardee pour ce parent). Rien aujourd'hui — le DHT11 et
    // le DHT22 vivent dans « Température & humidité », visibles comme le
    // reste : seuls le tooltip et le refus au runtime sur V2 (voir
    // piloteDht()) les distinguent desormais. Mecanisme garde pour un usage
    // futur.
    const SOUS_MENUS_MASQUES_PAR_DEFAUT = {};

    function groupesConfDefaut(nomParent) {
        return { order: [], hidden: (SOUS_MENUS_MASQUES_PAR_DEFAUT[nomParent] || []).slice(), labels: {} };
    }

    function construireCategorie(catOriginale) {
        const nomOrig = catOriginale.name;
        const nomAffiche = configAdmin.categories.labels[nomOrig] || nomOrig;

        if (!catOriginale.contents) {
            // Categorie dynamique (Variables, Fonctions) : Blockly la remplit
            // lui-meme, seul le nom affiche peut etre change.
            return Object.assign({}, catOriginale, { name: nomAffiche });
        }

        const sousNatives = catOriginale.contents.filter(e => e.kind === 'category');
        let contenuFinal;

        if (sousNatives.length) {
            // Deja organisee en sous-menus (Communication, Grove) : on les
            // reordonne / masque / renomme. Pas de creation ici, la
            // categorie a deja sa structure.
            const groupesConf = configAdmin.groupes[nomOrig] || groupesConfDefaut(nomOrig);
            const dispo = new Map(sousNatives.map(s => [s.name, s]));
            const ordre = groupesConf.order.length ? groupesConf.order : [...dispo.keys()];
            const resultat = [];
            for (const nom of ordre) {
                if (!dispo.has(nom) || groupesConf.hidden.includes(nom)) { dispo.delete(nom); continue; }
                const s = dispo.get(nom);
                dispo.delete(nom);
                const label = groupesConf.labels[nom];
                resultat.push(label ? Object.assign({}, s, { name: label }) : s);
            }
            for (const [nom, s] of dispo) if (!groupesConf.hidden.includes(nom)) resultat.push(s);
            contenuFinal = resultat;
        } else {
            // Categorie a plat : les blocs repris dans un sous-menu
            // personnalise en sortent, le reste garde sa place d'origine.
            const sousMenusIci = configAdmin.sousMenus.filter(s => s.parent === nomOrig);
            const typesExtraits = new Set(sousMenusIci.flatMap(s => s.blocs));
            const restants = catOriginale.contents.filter(e =>
                e.kind === 'label' || !typesExtraits.has(e.type));
            const sousPersonnalises = sousMenusIci.map(s => ({
                kind: 'category', name: s.nom, colour: s.couleur,
                contents: s.blocs
                    .map(type => catOriginale.contents.find(e => e.kind === 'block' && e.type === type))
                    .filter(Boolean)
            }));
            contenuFinal = [...restants, ...sousPersonnalises];
        }

        return { kind: 'category', name: nomAffiche, colour: catOriginale.colour, contents: contenuFinal };
    }

    function construireToolbox() {
        const dispo = new Map(TOOLBOX_ORIGINAL.map(c => [c.name, c]));
        const ordre = configAdmin.categories.order.length
            ? configAdmin.categories.order : [...dispo.keys()];
        const resultat = [];
        for (const nom of ordre) {
            if (!dispo.has(nom)) continue;
            const cat = dispo.get(nom);
            dispo.delete(nom);
            if (!configAdmin.categories.hidden.includes(nom)) resultat.push(construireCategorie(cat));
        }
        for (const [nom, cat] of dispo) {
            if (!configAdmin.categories.hidden.includes(nom)) resultat.push(construireCategorie(cat));
        }
        return resultat;
    }

    function appliquerToolbox() {
        window.workspace.updateToolbox({ kind: 'categoryToolbox', contents: construireToolbox() });
        Blockly.svgResize(window.workspace);
    }

    // Toujours reconstruite au demarrage, meme sans config sauvegardee : des
    // sous-menus comme DHT11 sont masques par defaut (groupesConfDefaut) sans
    // que ca passe par configAdmin, l'injection Blockly seule ne le sait pas.
    appliquerToolbox();

    // --- Le panneau : construction commune (onglets) ---

    let voileOptions = null;
    let panneauOptions = null;
    let listeCategories = null;
    let selecteurParent = null;
    let zoneSousMenus = null;
    let champRecherche = null;
    let zoneLibelles = null;
    let elementAttrape = null;

    function construireLigneReordonnable(cle, texteAffiche, estMasque, onRenommer, onBasculerMasque) {
        const ligne = document.createElement('li');
        ligne.draggable = true;
        ligne.dataset.cle = cle;
        ligne.classList.toggle('masquee', estMasque);

        const nomSpan = document.createElement('span');
        nomSpan.className = 'nom-ligne';
        nomSpan.textContent = texteAffiche;
        ligne.appendChild(nomSpan);

        const btnMasquer = document.createElement('button');
        btnMasquer.className = 'icone-admin';
        btnMasquer.title = estMasque ? 'Afficher aux élèves' : 'Masquer aux élèves';
        btnMasquer.textContent = estMasque ? '🚫' : '👁';
        btnMasquer.addEventListener('click', e => { e.stopPropagation(); onBasculerMasque(); });
        ligne.appendChild(btnMasquer);

        const btnRenommer = document.createElement('button');
        btnRenommer.className = 'icone-admin';
        btnRenommer.title = 'Renommer';
        btnRenommer.textContent = '✎';
        btnRenommer.addEventListener('click', e => {
            e.stopPropagation();
            const input = document.createElement('input');
            input.type = 'text';
            input.value = texteAffiche;
            nomSpan.replaceWith(input);
            input.focus();
            input.select();
            input.addEventListener('blur', () => onRenommer(input.value.trim() || null));
            input.addEventListener('keydown', e2 => {
                if (e2.key === 'Enter') input.blur();
                if (e2.key === 'Escape') { input.value = texteAffiche; input.blur(); }
            });
        });
        ligne.appendChild(btnRenommer);

        ligne.addEventListener('dragstart', () => { elementAttrape = ligne; ligne.classList.add('attrape'); });
        ligne.addEventListener('dragend', () => {
            ligne.classList.remove('attrape');
            elementAttrape = null;
            if (ligne.parentElement) [...ligne.parentElement.children].forEach(l => l.classList.remove('survol'));
        });
        ligne.addEventListener('dragover', e => {
            e.preventDefault();
            if (!elementAttrape || elementAttrape === ligne) return;
            ligne.classList.add('survol');
            const boite = ligne.getBoundingClientRect();
            const apres = e.clientY > boite.top + boite.height / 2;
            ligne.parentElement.insertBefore(elementAttrape, apres ? ligne.nextSibling : ligne);
        });
        ligne.addEventListener('dragleave', () => ligne.classList.remove('survol'));
        ligne.addEventListener('drop', e => e.preventDefault());

        return ligne;
    }

    function construireOptions() {
        if (voileOptions) return;
        voileOptions = document.createElement('div');
        voileOptions.id = 'voile-options';
        panneauOptions = document.createElement('div');
        panneauOptions.id = 'panneau-options';
        panneauOptions.innerHTML =
            '<h3>Panneau administrateur</h3>' +
            '<div class="onglets-admin">' +
            '<button class="onglet-admin" data-onglet="categories">Catégories</button>' +
            '<button class="onglet-admin" data-onglet="sousmenus">Sous-menus</button>' +
            '<button class="onglet-admin" data-onglet="libelles">Libellés</button>' +
            '</div>' +
            '<div class="vue-admin" data-vue="categories">' +
            '<p>Glissez pour réordonner. L’œil masque une catégorie aux élèves, le crayon renomme ' +
            'son intitulé. Conservé d’une session à l’autre.</p>' +
            '<ul id="liste-categories" class="panneau-admin-liste"></ul>' +
            '<div class="actions">' +
            '<button id="btn-ordre-fermer">Fermer</button>' +
            '<button id="btn-ordre-defaut">Tout réinitialiser</button></div>' +
            '</div>' +
            '<div class="vue-admin" data-vue="sousmenus">' +
            '<p>Choisissez une catégorie : ses sous-menus existants se réorganisent, ou de nouveaux ' +
            'se créent en regroupant des blocs.</p>' +
            '<select id="selecteur-parent-sousmenu"></select>' +
            '<div id="zone-sousmenus"></div>' +
            '</div>' +
            '<div class="vue-admin" data-vue="libelles">' +
            '<p>Change le texte affiché sur un bloc, sans toucher au code généré.</p>' +
            '<input id="recherche-libelles" type="text" placeholder="Filtrer (ex: attendre, afficher)">' +
            '<div id="zone-libelles"></div>' +
            '</div>';
        voileOptions.appendChild(panneauOptions);
        document.body.appendChild(voileOptions);

        listeCategories = panneauOptions.querySelector('#liste-categories');
        selecteurParent = panneauOptions.querySelector('#selecteur-parent-sousmenu');
        zoneSousMenus = panneauOptions.querySelector('#zone-sousmenus');
        champRecherche = panneauOptions.querySelector('#recherche-libelles');
        zoneLibelles = panneauOptions.querySelector('#zone-libelles');

        // Fermer en cliquant a cote, jamais en cliquant dans le panneau.
        voileOptions.addEventListener('click', e => {
            if (e.target === voileOptions) fermerOptions();
        });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && voileOptions.classList.contains('ouvert')) fermerOptions();
        });

        panneauOptions.querySelector('#btn-ordre-fermer').addEventListener('click', fermerOptions);
        panneauOptions.querySelector('#btn-ordre-defaut').addEventListener('click', () => {
            configAdmin = configAdminParDefaut();
            sauvegarderConfigAdmin();
            appliquerToolbox();
            remplirOngletCategories();
            remplirSelecteurParent();
        });

        panneauOptions.querySelectorAll('.onglet-admin').forEach(bouton => {
            bouton.addEventListener('click', () => activerOnglet(bouton.dataset.onglet));
        });

        listeCategories.addEventListener('dragend', () => {
            configAdmin.categories.order = [...listeCategories.children].map(li => li.dataset.cle);
            sauvegarderConfigAdmin();
            appliquerToolbox();
        });
        selecteurParent.addEventListener('change', () => remplirZoneSousMenus(selecteurParent.value));
        champRecherche.addEventListener('input', () => remplirOngletLibelles(champRecherche.value));

        activerOnglet('categories');
    }

    function activerOnglet(nom) {
        panneauOptions.querySelectorAll('.onglet-admin').forEach(b => b.classList.toggle('actif', b.dataset.onglet === nom));
        panneauOptions.querySelectorAll('.vue-admin').forEach(v => v.classList.toggle('active', v.dataset.vue === nom));
    }

    // --- Onglet Catégories ---

    function remplirOngletCategories() {
        listeCategories.textContent = '';
        const noms = TOOLBOX_ORIGINAL.map(c => c.name);
        const ordre = configAdmin.categories.order.length
            ? configAdmin.categories.order.filter(n => noms.includes(n))
            : noms;
        for (const nomOrig of ordre) {
            const masque = configAdmin.categories.hidden.includes(nomOrig);
            const texte = configAdmin.categories.labels[nomOrig] || nomOrig;
            listeCategories.appendChild(construireLigneReordonnable(nomOrig, texte, masque,
                nouveauTexte => {
                    if (nouveauTexte && nouveauTexte !== nomOrig) configAdmin.categories.labels[nomOrig] = nouveauTexte;
                    else delete configAdmin.categories.labels[nomOrig];
                    sauvegarderConfigAdmin(); appliquerToolbox(); remplirOngletCategories(); remplirSelecteurParent();
                },
                () => {
                    const i = configAdmin.categories.hidden.indexOf(nomOrig);
                    if (i === -1) configAdmin.categories.hidden.push(nomOrig); else configAdmin.categories.hidden.splice(i, 1);
                    sauvegarderConfigAdmin(); appliquerToolbox(); remplirOngletCategories();
                }));
        }
    }

    // --- Onglet Sous-menus ---

    function remplirSelecteurParent() {
        const valeurCourante = selecteurParent.value;
        selecteurParent.innerHTML = '';
        for (const c of TOOLBOX_ORIGINAL.filter(c => c.contents)) {
            const option = document.createElement('option');
            option.value = c.name;
            option.textContent = configAdmin.categories.labels[c.name] || c.name;
            selecteurParent.appendChild(option);
        }
        selecteurParent.value = [...selecteurParent.options].some(o => o.value === valeurCourante)
            ? valeurCourante : (selecteurParent.options[0] ? selecteurParent.options[0].value : '');
        remplirZoneSousMenus(selecteurParent.value);
    }

    function remplirZoneSousMenus(nomParent) {
        zoneSousMenus.textContent = '';
        const original = TOOLBOX_ORIGINAL.find(c => c.name === nomParent);
        if (!original) return;
        const sousNatives = original.contents.filter(e => e.kind === 'category');

        if (sousNatives.length) {
            const ul = document.createElement('ul');
            ul.className = 'panneau-admin-liste';
            const groupesConf = configAdmin.groupes[nomParent] || (configAdmin.groupes[nomParent] = groupesConfDefaut(nomParent));
            const nomsNatifs = sousNatives.map(s => s.name);
            const ordre = groupesConf.order.length ? groupesConf.order.filter(n => nomsNatifs.includes(n)) : nomsNatifs;
            for (const nom of ordre) {
                const masque = groupesConf.hidden.includes(nom);
                const texte = groupesConf.labels[nom] || nom;
                ul.appendChild(construireLigneReordonnable(nom, texte, masque,
                    nv => {
                        if (nv && nv !== nom) groupesConf.labels[nom] = nv; else delete groupesConf.labels[nom];
                        sauvegarderConfigAdmin(); appliquerToolbox(); remplirZoneSousMenus(nomParent);
                    },
                    () => {
                        const i = groupesConf.hidden.indexOf(nom);
                        if (i === -1) groupesConf.hidden.push(nom); else groupesConf.hidden.splice(i, 1);
                        sauvegarderConfigAdmin(); appliquerToolbox(); remplirZoneSousMenus(nomParent);
                    }));
            }
            ul.addEventListener('dragend', () => {
                groupesConf.order = [...ul.children].map(li => li.dataset.cle);
                sauvegarderConfigAdmin(); appliquerToolbox();
            });
            zoneSousMenus.appendChild(ul);
            return;
        }

        // Categorie a plat : sous-menus personnalises existants, puis le
        // formulaire de creation avec les blocs restants.
        const existants = configAdmin.sousMenus.filter(s => s.parent === nomParent);
        if (existants.length) {
            const ul = document.createElement('ul');
            ul.className = 'panneau-admin-liste';
            for (const sm of existants) {
                const ligne = document.createElement('li');
                ligne.classList.add('sans-poignee');
                const nomSpan = document.createElement('span');
                nomSpan.className = 'nom-ligne';
                nomSpan.textContent = sm.nom + ' (' + sm.blocs.length + ' bloc' + (sm.blocs.length > 1 ? 's' : '') + ')';
                ligne.appendChild(nomSpan);
                const btnSuppr = document.createElement('button');
                btnSuppr.className = 'icone-admin';
                btnSuppr.title = 'Supprimer ce sous-menu (les blocs reviennent au niveau supérieur)';
                btnSuppr.textContent = '🗑';
                btnSuppr.addEventListener('click', () => {
                    configAdmin.sousMenus = configAdmin.sousMenus.filter(s => s !== sm);
                    sauvegarderConfigAdmin(); appliquerToolbox(); remplirZoneSousMenus(nomParent);
                });
                ligne.appendChild(btnSuppr);
                ul.appendChild(ligne);
            }
            zoneSousMenus.appendChild(ul);
        }

        const blocsRestants = original.contents.filter(e => e.kind === 'block' &&
            !configAdmin.sousMenus.some(s => s.parent === nomParent && s.blocs.includes(e.type)));
        if (!blocsRestants.length) return;

        const indication = document.createElement('p');
        indication.style.cssText = 'margin:10px 0 6px;font-size:12px;color:#9fb3c8;';
        indication.textContent = 'Regrouper des blocs dans un nouveau sous-menu :';
        zoneSousMenus.appendChild(indication);

        const champNom = document.createElement('input');
        champNom.type = 'text';
        champNom.id = 'champ-nom-sousmenu';
        champNom.placeholder = 'Nom du sous-menu';
        zoneSousMenus.appendChild(champNom);

        const listeCases = document.createElement('div');
        listeCases.style.cssText = 'max-height:160px;overflow-y:auto;margin:8px 0;';
        for (const bloc of blocsRestants) {
            const label = document.createElement('label');
            label.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:12px;padding:3px 0;font-family:monospace;';
            const case_ = document.createElement('input');
            case_.type = 'checkbox';
            case_.value = bloc.type;
            label.appendChild(case_);
            label.appendChild(document.createTextNode(bloc.type));
            listeCases.appendChild(label);
        }
        zoneSousMenus.appendChild(listeCases);

        const btnCreer = document.createElement('button');
        btnCreer.textContent = 'Créer le sous-menu';
        btnCreer.style.cssText = 'font-size:13px;padding:7px 12px;margin:0;';
        btnCreer.addEventListener('click', () => {
            const nom = champNom.value.trim();
            const coches = [...listeCases.querySelectorAll('input:checked')].map(c => c.value);
            if (!nom || !coches.length) return;
            configAdmin.sousMenus.push({
                id: 'sm_' + Date.now().toString(36), parent: nomParent, nom,
                couleur: original.colour, blocs: coches
            });
            sauvegarderConfigAdmin(); appliquerToolbox(); remplirZoneSousMenus(nomParent);
        });
        zoneSousMenus.appendChild(btnCreer);
    }

    // --- Onglet Libellés ---

    function texteEffectifChamp(type, index, defaut) {
        const cle = type + '#' + index;
        return configAdmin.libellesBlocs[cle] !== undefined ? configAdmin.libellesBlocs[cle] : defaut;
    }

    function appliquerLibellesSurCanevas(type) {
        for (const bloc of window.workspace.getAllBlocks(false)) {
            if (bloc.type === type) appliquerLibellesBloc(bloc);
        }
    }

    function remplirOngletLibelles(filtre) {
        zoneLibelles.textContent = '';
        const f = (filtre || '').toLowerCase().trim();
        if (!f) {
            const indication = document.createElement('p');
            indication.style.cssText = 'font-size:12px;color:#9fb3c8;';
            indication.textContent = 'Tapez un mot pour retrouver un bloc (ex: "attendre", "afficher").';
            zoneLibelles.appendChild(indication);
            return;
        }
        const types = Object.keys(LIBELLES_DEFAUT).filter(type => LIBELLES_DEFAUT[type].length && (
            type.toLowerCase().includes(f) || LIBELLES_DEFAUT[type].some(t => t.toLowerCase().includes(f))
        )).sort();

        for (const type of types) {
            const carte = document.createElement('div');
            carte.className = 'bloc-libelle';
            const titre = document.createElement('div');
            titre.className = 'type-bloc';
            titre.textContent = type;
            carte.appendChild(titre);

            LIBELLES_DEFAUT[type].forEach((defaut, index) => {
                const ligne = document.createElement('div');
                ligne.className = 'champ-libelle';
                const input = document.createElement('input');
                input.type = 'text';
                input.value = texteEffectifChamp(type, index, defaut);
                input.addEventListener('change', () => {
                    const cle = type + '#' + index;
                    if (input.value === defaut) delete configAdmin.libellesBlocs[cle];
                    else configAdmin.libellesBlocs[cle] = input.value;
                    sauvegarderConfigAdmin();
                    appliquerLibellesSurCanevas(type);
                });
                ligne.appendChild(input);

                const btnReset = document.createElement('button');
                btnReset.className = 'icone-admin';
                btnReset.title = 'Revenir au texte par défaut';
                btnReset.textContent = '↺';
                btnReset.addEventListener('click', () => {
                    input.value = defaut;
                    delete configAdmin.libellesBlocs[type + '#' + index];
                    sauvegarderConfigAdmin();
                    appliquerLibellesSurCanevas(type);
                });
                ligne.appendChild(btnReset);
                carte.appendChild(ligne);
            });
            zoneLibelles.appendChild(carte);
        }

        if (!types.length) {
            const vide = document.createElement('p');
            vide.style.cssText = 'font-size:12px;color:#9fb3c8;';
            vide.textContent = 'Aucun bloc ne correspond.';
            zoneLibelles.appendChild(vide);
        }
    }

    function ouvrirOptions() {
        construireOptions();
        remplirOngletCategories();
        remplirSelecteurParent();
        remplirOngletLibelles('');
        if (champRecherche) champRecherche.value = '';
        voileOptions.classList.add('ouvert');
    }

    function fermerOptions() {
        if (voileOptions) voileOptions.classList.remove('ouvert');
    }

    // --- Activation du mode administrateur ---
    // L'application est 100% cliente, sans serveur ni compte : il n'existe
    // aucune authentification reelle possible. Ce raccourci ne sert qu'a
    // eviter qu'un eleve tombe sur ces reglages par hasard, pas a proteger
    // quoi que ce soit serieusement.

    let adminActif = false;
    const btnOptions = document.getElementById('btn-options');

    function afficherToastAdmin(texte) {
        const toast = document.getElementById('toast-admin');
        if (!toast) return;
        toast.textContent = texte;
        toast.classList.add('visible');
        clearTimeout(afficherToastAdmin._t);
        afficherToastAdmin._t = setTimeout(() => toast.classList.remove('visible'), 2200);
    }

    function activerAdmin(actif) {
        adminActif = actif;
        if (btnOptions) btnOptions.style.display = actif ? 'inline-block' : 'none';
        if (!actif) fermerOptions();
        afficherToastAdmin(actif ? 'Mode administrateur activé' : 'Mode administrateur désactivé');
    }

    document.addEventListener('keydown', e => {
        if (e.ctrlKey && e.altKey && e.shiftKey && e.key.toLowerCase() === 'a') {
            e.preventDefault();
            activerAdmin(!adminActif);
        }
    });

    if (btnOptions) btnOptions.addEventListener('click', ouvrirOptions);

    // Expose pour les verifications : le glisser-deposer et les raccourcis
    // clavier ne se simulent pas depuis la console.
    window.adminTest = {
        activer: () => activerAdmin(true),
        desactiver: () => activerAdmin(false),
        estActif: () => adminActif,
        etat: () => cloneProfond(configAdmin),
        ouvrirPanneau: ouvrirOptions,
        fermerPanneau: fermerOptions,
        reordonnerCategories: noms => {
            configAdmin.categories.order = noms.slice();
            sauvegarderConfigAdmin(); appliquerToolbox();
        },
        masquerCategorie: (nom, masquer) => {
            const i = configAdmin.categories.hidden.indexOf(nom);
            if (masquer && i === -1) configAdmin.categories.hidden.push(nom);
            if (!masquer && i !== -1) configAdmin.categories.hidden.splice(i, 1);
            sauvegarderConfigAdmin(); appliquerToolbox();
        },
        renommerCategorie: (nom, texte) => {
            if (texte) configAdmin.categories.labels[nom] = texte; else delete configAdmin.categories.labels[nom];
            sauvegarderConfigAdmin(); appliquerToolbox();
        },
        creerSousMenu: (parent, nom, blocs) => {
            const original = TOOLBOX_ORIGINAL.find(c => c.name === parent);
            configAdmin.sousMenus.push({
                id: 'sm_' + Date.now().toString(36), parent, nom,
                couleur: original ? original.colour : '160', blocs: blocs.slice()
            });
            sauvegarderConfigAdmin(); appliquerToolbox();
        },
        supprimerSousMenu: id => {
            configAdmin.sousMenus = configAdmin.sousMenus.filter(s => s.id !== id);
            sauvegarderConfigAdmin(); appliquerToolbox();
        },
        renommerLibelleBloc: (type, index, texte) => {
            const cle = type + '#' + index;
            if (texte !== null) configAdmin.libellesBlocs[cle] = texte; else delete configAdmin.libellesBlocs[cle];
            sauvegarderConfigAdmin();
            appliquerLibellesSurCanevas(type);
        },
        libellesDefaut: type => (LIBELLES_DEFAUT[type] || []).slice(),
        reinitialiser: () => {
            configAdmin = configAdminParDefaut();
            sauvegarderConfigAdmin(); appliquerToolbox();
        }
    };

    // ------------------------------------------
    // REPLI DES PANNEAUX
    // ------------------------------------------
    // La boîte à outils ouvre un tiroir aussi large que son bloc le plus long ;
    // sur la catégorie Grove il ne restait presque plus rien pour travailler.
    // Replier la transcription ou le simulateur rend cette largeur au canevas.

    function basculerPanneau(bouton, panneau) {
        const replie = panneau.classList.toggle('replie');
        bouton.classList.toggle('inactif', replie);
        // Blockly ne s'apercoit pas tout seul qu'on lui a rendu de la place.
        Blockly.svgResize(window.workspace);
        adapterEchelleSimulateur();
    }

    const btnVueCode = document.getElementById('btn-vue-code');
    const btnVueSimu = document.getElementById('btn-vue-simu');
    if (btnVueCode) {
        btnVueCode.addEventListener('click', () =>
            basculerPanneau(btnVueCode, document.getElementById('code-container')));
    }
    if (btnVueSimu) {
        btnVueSimu.addEventListener('click', () =>
            basculerPanneau(btnVueSimu, document.getElementById('simulator-container')));
    }
    window.addEventListener('resize', () => Blockly.svgResize(window.workspace));

    // Filet principal : on surveille la taille du canevas lui-meme. Blockly garde
    // en cache les dimensions de son conteneur et place corbeille et barres de
    // defilement d'apres ce cache ; des qu'il est perime, ils partent hors de
    // l'ecran. Un observateur couvre toutes les causes — fenetre redimensionnee,
    // panneau replie, sections Grove affichees ou masquees, zoom du navigateur —
    // et se declenche apres le recalcul de la mise en page, donc au bon moment.
    if (window.ResizeObserver) {
        new ResizeObserver(() => Blockly.svgResize(window.workspace))
            .observe(document.getElementById('blocklyDiv'));
    }

    // ------------------------------------------
    // ZOOM DEPUIS LA BARRE
    // ------------------------------------------
    // Au chargement, Blockly place la corbeille d'apres des metriques pas encore
    // a jour : elle se retrouvait 329 px sous le bas du canevas, donc invisible.
    Blockly.svgResize(window.workspace);

    const zoomValeur = document.getElementById('zoom-valeur');

    function afficherZoom() {
        if (zoomValeur) zoomValeur.textContent = Math.round(window.workspace.getScale() * 100) + ' %';
    }

    // L'indicateur est accroche a setScale plutot qu'aux evenements : toutes les
    // facons de zoomer (boutons, molette, pincement, ajustement) y passent, alors
    // que l'evenement viewport_change ne se declenche pas de facon fiable.
    const reglerEchelleOrigine = window.workspace.setScale.bind(window.workspace);
    window.workspace.setScale = function(echelle) {
        const resultat = reglerEchelleOrigine(echelle);
        afficherZoom();
        return resultat;
    };

    function reglerZoom(sens) {
        window.workspace.zoomCenter(sens);
        afficherZoom();
    }

    /** Ajuste l'échelle aux blocs présents, ou revient à 100 % si l'espace est vide. */
    function ajusterZoom() {
        const ws = window.workspace;
        if (ws.getTopBlocks(false).length === 0) {
            ws.setScale(1);
        } else {
            ws.zoomToFit();
        }
        ws.scrollCenter();
        afficherZoom();
    }

    const btnZoomMoins = document.getElementById('btn-zoom-moins');
    const btnZoomPlus = document.getElementById('btn-zoom-plus');
    const btnZoomAjuster = document.getElementById('btn-zoom-ajuster');
    if (btnZoomMoins) btnZoomMoins.addEventListener('click', () => reglerZoom(-1));
    if (btnZoomPlus) btnZoomPlus.addEventListener('click', () => reglerZoom(1));
    if (btnZoomAjuster) btnZoomAjuster.addEventListener('click', ajusterZoom);

    afficherZoom();

    // ==========================================
    // 3. GESTION DES TÉLÉCHARGEMENTS (.HEX et .PY)
    // ==========================================
    window.currentPythonCode = "";

    const zoneEtat = document.getElementById('etat');
    const boutonHex = document.getElementById('download-btn');

    function afficherEtat(message, enErreur) {
        if (!zoneEtat) return;
        zoneEtat.textContent = message;
        zoneEtat.classList.toggle('erreur', !!enErreur);
    }
    // Utilisé aussi par le simulateur Brython, qui n'a pas d'autre moyen de
    // remonter une erreur à l'utilisateur.
    window.simu_erreur = function(message) { afficherEtat('Simulateur : ' + message, true); };
    window.simu_ok = function() { afficherEtat('', false); };

    boutonHex.addEventListener('click', async () => {
        const codePython = window.currentPythonCode;
        if (!codePython || codePython.trim() === "") {
            afficherEtat("Ajoutez d'abord des blocs sur l'espace de travail.", true);
            return;
        }

        boutonHex.disabled = true;
        afficherEtat('Génération…', false);

        try {
            const finalHex = await genererFichierHexFinal(codePython);
            const blob = new Blob([finalHex], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'programme-microbit.hex';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            afficherEtat('Fichier téléchargé.', false);
        } catch (error) {
            // On affiche la cause réelle : un message passe-partout masquerait le
            // vrai problème (firmware incomplet, CDN injoignable, image invalide…).
            console.error("Erreur lors de la génération du .hex :", error);
            afficherEtat(error.message, true);
        } finally {
            boutonHex.disabled = false;
        }
    });

    // ------------------------------------------
    // ENVOI DIRECT SUR LE LECTEUR MICROBIT
    // ------------------------------------------
    // Le lecteur n'accepte que des .hex : y deposer un .py ne ferait rien. On y
    // ecrit donc le meme fichier que celui du bouton de telechargement, ce qui
    // revient exactement a un glisser-deposer.
    //
    // L'API d'acces aux fichiers n'existe que sur Chrome et Edge ; ailleurs le
    // bouton est desactive plutot que trompeur.

    const boutonEnvoyer = document.getElementById('btn-envoyer');
    let dossierCarte = null;

    /** Un lecteur micro:bit porte toujours l'un de ces deux fichiers. */
    async function estLecteurMicrobit(dossier) {
        for (const nom of ['DETAILS.TXT', 'MICROBIT.HTM']) {
            try {
                await dossier.getFileHandle(nom);
                return true;
            } catch (erreur) { /* fichier absent, on essaie le suivant */ }
        }
        return false;
    }

    /** Redemande l'autorisation d'ecriture sur un dossier deja choisi. */
    async function autorisationEcriture(dossier) {
        const options = { mode: 'readwrite' };
        if (await dossier.queryPermission(options) === 'granted') return true;
        return await dossier.requestPermission(options) === 'granted';
    }

    async function envoyerSurLaCarte() {
        const codePython = window.currentPythonCode;
        if (!codePython || !codePython.trim()) {
            afficherEtat("Ajoutez d'abord des blocs sur l'espace de travail.", true);
            return;
        }

        boutonEnvoyer.disabled = true;
        // On distingue les deux moitiés de l'opération : un firmware invalide
        // n'a rien à voir avec le lecteur, et proposer d'en redésigner un
        // envoyait sur une fausse piste.
        let etape = 'generation';
        try {
            // Générer d'abord : inutile de faire choisir un lecteur si le
            // programme ne peut de toute façon pas être produit.
            afficherEtat('Génération du programme…', false);
            const contenuHex = await genererFichierHexFinal(codePython);

            etape = 'lecteur';
            if (!dossierCarte) {
                afficherEtat('Choisissez le lecteur MICROBIT…', false);
                const choisi = await window.showDirectoryPicker({ mode: 'readwrite', id: 'microbit' });
                if (!await estLecteurMicrobit(choisi)) {
                    throw new Error("Ce dossier ne ressemble pas au lecteur MICROBIT : ni DETAILS.TXT " +
                                    'ni MICROBIT.HTM ne s\'y trouvent. Choisir le lecteur de la carte.');
                }
                dossierCarte = choisi;
            }

            if (!await autorisationEcriture(dossierCarte)) {
                throw new Error("Autorisation d'écriture refusée sur le lecteur.");
            }

            afficherEtat('Écriture sur la carte…', false);
            const fichier = await dossierCarte.getFileHandle('programme-microbit.hex', { create: true });
            const flux = await fichier.createWritable();
            await flux.write(new Blob([contenuHex], { type: 'application/octet-stream' }));
            await flux.close();

            afficherEtat('Programme envoyé. La carte clignote puis redémarre.', false);
        } catch (erreur) {
            console.error('Envoi sur la carte :', erreur);
            if (erreur && erreur.name === 'AbortError') {
                afficherEtat('Envoi annulé.', false);
            } else if (etape === 'generation') {
                afficherEtat(erreur.message, true);
            } else {
                // Apres un transfert, le lecteur se demonte et se remonte : la
                // reference gardee ne vaut plus rien, il faut le redesigner.
                dossierCarte = null;
                afficherEtat(erreur.message + ' — recliquez pour redésigner le lecteur.', true);
            }
        } finally {
            boutonEnvoyer.disabled = false;
        }
    }

    if (boutonEnvoyer) {
        if (typeof window.showDirectoryPicker !== 'function') {
            boutonEnvoyer.disabled = true;
            boutonEnvoyer.title = "Cette fonction demande Chrome ou Edge : Firefox et Safari " +
                                  "n'ont pas l'API d'accès aux fichiers. Utilisez le bouton .hex.";
        } else {
            boutonEnvoyer.addEventListener('click', envoyerSurLaCarte);
        }
    }

    document.getElementById('download-py-btn').addEventListener('click', () => {
        let codePython = window.currentPythonCode;
        if (!codePython || codePython.trim() === "") {
            codePython = "# Aucun bloc n'a été ajouté.\nfrom microbit import *\n";
        }
        const blob = new Blob([codePython], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'script_microbit.py';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        afficherEtat('Script .py téléchargé.', false);
    });

    // ==========================================
    // 4. AFFICHAGE ET INJECTION AUTOMATIQUE DES ÉVÉNEMENTS
    // ==========================================

    // Chaque fonction `on_…` que peuvent produire les blocs « lorsque … » doit
    // figurer ici, sinon le bloc correspondant ne serait jamais exécuté.
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
        // La radio n'a pas d'interruption : on releve la boite aux lettres a
        // chaque tour, et le pilote appelle le gestionnaire qui convient.
        ['def on_radio_',             '_radio_traiter()'],
    ];

    // ------------------------------------------
    // AFFICHAGE DE LA TRANSCRIPTION
    // ------------------------------------------
    // Les pilotes des modules Grove et des servos font plusieurs dizaines de
    // lignes et noyaient le programme de l'eleve. Ils sont replies derriere un
    // resume depliable. Le code envoye a la carte, lui, est complet : seul
    // l'affichage change.

    const pilotesOuverts = new Set();

    function afficherTranscription(code) {
        const zone = document.getElementById('code-display');
        if (!zone) return;
        if (!code) {
            zone.textContent = '# Glissez des blocs pour voir le code...';
            return;
        }
        zone.textContent = '';
        const motif = /# >>> pilote (\S+)\r?\n([\s\S]*?)\r?\n# <<< pilote \S+\r?\n?/g;
        let position = 0;
        let premier = true;
        let trouve;
        while ((trouve = motif.exec(code)) !== null) {
            // Un resume replie occupe deja sa propre ligne : les sauts de ligne
            // qui l'entouraient dans le code sont donc en trop a l'affichage.
            let avant = resserrer(code.slice(position, trouve.index));
            if (!premier) avant = avant.replace(/^\n+/, '\n');
            avant = avant.replace(/\n+$/, '');
            if (avant) zone.appendChild(document.createTextNode(avant));
            zone.appendChild(replierPilote(trouve[1], trouve[2]));
            premier = false;
            position = trouve.index + trouve[0].length;
        }
        let reste = resserrer(code.slice(position));
        if (!premier) reste = reste.replace(/^\n+/, '\n');
        if (reste) zone.appendChild(document.createTextNode(reste));
    }

    /** Retirer un pilote laisse un trou de lignes vides : on le resserre. */
    function resserrer(texte) {
        return texte.replace(/\n{3,}/g, '\n\n');
    }

    function replierPilote(nom, corps) {
        const bloc = document.createElement('details');
        bloc.className = 'pilote-replie';
        // On garde ouvert ce que l'utilisateur avait deplie : la transcription
        // est reconstruite a chaque modification du programme.
        bloc.open = pilotesOuverts.has(nom);
        bloc.addEventListener('toggle', () => {
            if (bloc.open) pilotesOuverts.add(nom); else pilotesOuverts.delete(nom);
        });

        const resume = document.createElement('summary');
        const nbLignes = corps.split('\n').length;
        resume.textContent = 'pilote ' + nom + ' — ' + nbLignes +
                             (nbLignes > 1 ? ' lignes' : ' ligne');
        const contenu = document.createElement('div');
        contenu.className = 'pilote-corps';
        contenu.textContent = corps;

        bloc.appendChild(resume);
        bloc.appendChild(contenu);
        return bloc;
    }

    function updatePythonCode() {
        let codePython = Blockly.Python.workspaceToCode(window.workspace);

        const appels = GESTIONNAIRES
            .filter(([signature]) => codePython.includes(signature))
            .map(([, appel]) => appel);

        if (appels.length) {
            // L'indentation doit suivre celle du générateur Python de Blockly
            // (P.INDENT), et non une valeur écrite en dur : mélanger 4 espaces et
            // 2 espaces dans la même suite donne un IndentationError.
            const boucles = /^([ \t]*)while True:[ \t]*$/gm;
            if (boucles.test(codePython)) {
                boucles.lastIndex = 0;
                // Toutes les boucles infinies reçoivent la scrutation, pas
                // seulement la première : sinon un programme à deux boucles
                // ignorerait les boutons dans l'une d'elles.
                codePython = codePython.replace(boucles, (ligne, marge) =>
                    ligne + '\n' + appels.map(a => marge + P.INDENT + a).join('\n'));
            } else {
                codePython += '\n# --- Boucle des événements (générée automatiquement) ---\n' +
                    'while True:\n' +
                    appels.map(a => P.INDENT + a).join('\n') + '\n' +
                    P.INDENT + 'sleep(100)\n';
            }
        }

        window.currentPythonCode = codePython;

        if (panneauGrovePret) rafraichirPanneauGrove();

        afficherTranscription(codePython);


        const wrapAB = document.getElementById('wrap-ab');
        if (wrapAB) {
            wrapAB.style.display =
                (codePython.includes('button_a.is_pressed() and button_b.is_pressed()') ||
                 codePython.includes('_ab()')) ? 'flex' : 'none';
        }
    }
    window.workspace.addChangeListener(updatePythonCode);
    updatePythonCode();

    // ==========================================
    // 5. FONCTIONS GRAPHIQUES POUR LE SIMULATEUR (AVEC ANIMATION TEXTE)
    // ==========================================
    const ledGrid = document.getElementById('led-grid');
    const leds = [];
    for (let i = 0; i < 25; i++) {
        const led = document.createElement('div');
        led.classList.add('led');
        ledGrid.appendChild(led);
        leds.push(led);
    }

    window.simuQueue = [];

    // Numéro de l'exécution en cours. Les suites différées (pauses, défilement,
    // notes, parole) ne reprennent la file que si elles appartiennent encore à
    // l'exécution courante : sans cela, un minuteur laissé par une exécution
    // interrompue ferait avancer la suivante d'un cran de trop.
    let jetonSimulation = 0;

    /** Reprend la file après un délai, sauf si la simulation a été relancée entre-temps. */
    function suiteApres(ms) {
        const jeton = jetonSimulation;
        setTimeout(() => { if (jeton === jetonSimulation) window.simu_playQueue(); }, ms);
    }

    // Relancer la simulation coupe ce qui jouait encore : sinon deux exécutions
    // se superposent.
    window.simu_clearQueue = function() { window.simuQueue = []; jetonSimulation++; arreterSon(); };

    /** Demande une remise à zéro de la carte depuis le programme (bloc reset()). */
    window.simu_resetCarte = function() { window.simuQueue.push({ type: 'reset' }); };
    window.simu_effacerEcran = function() { window.simuQueue.push({ type: 'clear' }); };
    window.simu_afficherIcone = function(icone) { window.simuQueue.push({ type: 'show', value: icone }); };
    window.simu_sleep = function(ms) { window.simuQueue.push({ type: 'sleep', value: ms }); };

    // NOUVELLES FONCTIONS POUR LE TEXTE
    window.simu_showTexte = function(txt) { window.simuQueue.push({ type: 'showText', value: txt }); };
    window.simu_scrollTexte = function(txt) { window.simuQueue.push({ type: 'scrollText', value: txt }); };

    // ------------------------------------------
    // SORTIE SONORE (Web Audio)
    // ------------------------------------------
    // Le haut-parleur de la carte est un buzzer : une onde carrée en donne un
    // timbre proche. Les notes sont des couples [fréquence en Hz, durée en ms],
    // une fréquence nulle valant silence.
    //
    // Les mélodies de `music` suivent le decoupage officiel (1 temps = 4 tics,
    // 120 bpm, donc 1 tic = 125 ms). Les sons de `audio`, eux, sont des
    // approximations : ce sont des echantillons expressifs sur la vraie carte.

    const MELODIES = {
        DADADADUM: [[0, 250], [392, 250], [392, 250], [392, 250], [311.13, 1000],
                    [0, 250], [349.23, 250], [349.23, 250], [349.23, 250], [293.66, 1000]],
        PUNCHLINE: [[523.25, 375], [164.81, 125], [164.81, 125], [523.25, 125],
                    [164.81, 375], [196, 125], [0, 125], [155.56, 125]],
        ENTERTAINER: [[293.66, 125], [311.13, 125], [329.63, 125], [523.25, 250],
                      [329.63, 125], [523.25, 250], [329.63, 125], [523.25, 375],
                      [523.25, 125], [587.33, 125], [622.25, 125], [659.25, 125],
                      [523.25, 125], [587.33, 125], [659.25, 250], [493.88, 125],
                      [587.33, 250], [523.25, 500]],
    };

    const SONS = {
        GIGGLE:  [[659.25, 80], [783.99, 80], [659.25, 80], [880, 120]],
        HAPPY:   [[523.25, 120], [659.25, 120], [783.99, 120], [1046.5, 200]],
        HELLO:   [[783.99, 120], [523.25, 200]],
        SAD:     [[440, 200], [392, 200], [329.63, 300], [261.63, 400]],
        TWINKLE: [[1046.5, 80], [1318.51, 80], [1567.98, 80], [2093, 150]],
    };

    let ctxAudio = null;
    let oscillateursActifs = [];

    function contexteAudio() {
        const Constructeur = window.AudioContext || window.webkitAudioContext;
        if (!Constructeur) return null;
        if (!ctxAudio) ctxAudio = new Constructeur();
        // Les navigateurs suspendent le son tant qu'aucun clic n'a eu lieu.
        if (ctxAudio.state === 'suspended') ctxAudio.resume();
        return ctxAudio;
    }

    /**
     * Programme une suite de notes dans un contexte audio.
     *
     * Séparée de la lecture pour être vérifiable hors ligne (OfflineAudioContext).
     *
     * @returns {number} la durée totale, en secondes
     */
    function programmerNotes(ctx, sortie, notes, debut) {
        let t = debut;
        for (const [frequence, dureeMs] of notes) {
            const duree = dureeMs / 1000;
            if (frequence > 0) {
                const osc = ctx.createOscillator();
                const enveloppe = ctx.createGain();
                osc.type = 'square';
                osc.frequency.value = frequence;
                // Montée et descente rapides : sans elles, chaque note claque.
                enveloppe.gain.setValueAtTime(0, t);
                enveloppe.gain.linearRampToValueAtTime(1, t + 0.008);
                enveloppe.gain.setValueAtTime(1, Math.max(t + 0.008, t + duree - 0.015));
                enveloppe.gain.linearRampToValueAtTime(0, t + duree);
                osc.connect(enveloppe);
                enveloppe.connect(sortie);
                osc.start(t);
                osc.stop(t + duree);
                oscillateursActifs.push(osc);
                osc.onended = () => {
                    oscillateursActifs = oscillateursActifs.filter(o => o !== osc);
                };
            }
            t += duree;
        }
        return t - debut;
    }
    // Exposée pour pouvoir vérifier le rendu sonore sans haut-parleur.
    window.simu_programmerNotes = programmerNotes;
    window.simu_MELODIES = MELODIES;
    window.simu_SONS = SONS;

    /** Joue une suite de notes et renvoie sa durée en millisecondes. */
    function jouerNotes(notes) {
        const ctx = contexteAudio();
        if (!ctx) return 0;
        const volume = ctx.createGain();
        volume.gain.value = 0.18;
        volume.connect(ctx.destination);
        return programmerNotes(ctx, volume, notes, ctx.currentTime + 0.02) * 1000;
    }

    function arreterSon() {
        oscillateursActifs.forEach(osc => { try { osc.stop(); } catch (e) { /* déjà arrêté */ } });
        oscillateursActifs = [];
        if (window.speechSynthesis) window.speechSynthesis.cancel();
    }

    function parler(texte, suite) {
        const synthese = window.speechSynthesis;
        if (!synthese || typeof SpeechSynthesisUtterance === 'undefined') {
            alert("La micro:bit dit : " + texte);
            suite();
            return;
        }
        let termine = false;
        const continuer = () => { if (!termine) { termine = true; suite(); } };
        const enonce = new SpeechSynthesisUtterance(texte);
        enonce.lang = 'en-GB';   // le module speech de la micro:bit parle anglais
        enonce.onend = continuer;
        enonce.onerror = continuer;
        synthese.cancel();
        synthese.speak(enonce);
        // Filet de sécurité : certains navigateurs n'émettent jamais onend.
        setTimeout(continuer, 1500 + texte.length * 90);
    }

    // ------------------------------------------
    // PÉRIPHÉRIQUES GROVE
    // ------------------------------------------
    // Les sorties (ruban, afficheur) passent par la file, pour rester dans
    // l'ordre du programme. Les entrées (distance, joystick, geste) sont lues
    // directement : ce sont des capteurs, pas des actions.

    const zoneRuban = document.getElementById('grove-ruban');
    const ecran4Digit = document.getElementById('grove-4digit-ecran');

    // Sept segments, dans l'ordre des bits du TM1637 : a b c d e f g.
    const SEGMENTS_7 = [
        ['a', '10,2 30,2 34,6 30,10 10,10 6,6'],
        ['b', '35,7 39,11 39,29 35,33 31,29 31,11'],
        ['c', '35,37 39,41 39,59 35,63 31,59 31,41'],
        ['d', '10,60 30,60 34,64 30,68 10,68 6,64'],
        ['e', '5,37 9,41 9,59 5,63 1,59 1,41'],
        ['f', '5,7 9,11 9,29 5,33 1,29 1,11'],
        ['g', '10,31 30,31 34,35 30,39 10,39 6,35'],
    ];
    let chiffres7 = [];
    let pointsDeuxPoints = null;

    function construireAfficheur7() {
        if (!ecran4Digit || chiffres7.length) return;
        const svgNS = 'http://www.w3.org/2000/svg';
        for (let i = 0; i < 4; i++) {
            const svg = document.createElementNS(svgNS, 'svg');
            svg.setAttribute('class', 'digit7');
            svg.setAttribute('viewBox', '0 0 40 70');
            const segments = {};
            for (const [nom, points] of SEGMENTS_7) {
                const p = document.createElementNS(svgNS, 'polygon');
                p.setAttribute('class', 'seg');
                p.setAttribute('points', points);
                svg.appendChild(p);
                segments[nom] = p;
            }
            ecran4Digit.appendChild(svg);
            chiffres7.push(segments);
            // Les deux points du TM1637 se placent entre le 2e et le 3e chiffre.
            if (i === 1) {
                pointsDeuxPoints = document.createElement('div');
                pointsDeuxPoints.className = 'digit7-points';
                pointsDeuxPoints.innerHTML = '<span></span><span></span>';
                ecran4Digit.appendChild(pointsDeuxPoints);
            }
        }
    }

    /**
     * Allume les segments d'après le motif envoyé par le pilote.
     *
     * @param {string} motifs  quatre octets en hexadécimal, séparés par des virgules
     * @param {boolean} points les deux points du milieu
     */
    function afficher7Segments(motifs, points) {
        construireAfficheur7();
        if (!chiffres7.length) return;
        const octets = String(motifs).split(',');
        chiffres7.forEach((segments, i) => {
            const valeur = parseInt(octets[i], 16) || 0;
            SEGMENTS_7.forEach(([nom], bit) => {
                segments[nom].classList.toggle('on', (valeur & (1 << bit)) !== 0);
            });
        });
        if (pointsDeuxPoints) pointsDeuxPoints.classList.toggle('on', !!points);
    }
    const curseurDistance = document.getElementById('grove-distance');
    const valeurDistance = document.getElementById('grove-distance-val');
    const curseurJX = document.getElementById('grove-jx');
    const curseurJY = document.getElementById('grove-jy');
    const valeurJX = document.getElementById('grove-jx-val');
    const valeurJY = document.getElementById('grove-jy-val');
    const caseBoutonJoystick = document.getElementById('grove-jbtn');
    const menuGesteGrove = document.getElementById('grove-geste');
    const boutonGesteGrove = document.getElementById('grove-geste-btn');

    const zoneLcd = document.getElementById('grove-lcd');
    const lignesLcd = [document.getElementById('grove-lcd-l0'), document.getElementById('grove-lcd-l1')];
    const curseurTemp = document.getElementById('grove-temp');
    const curseurHumi = document.getElementById('grove-humi');
    const curseurCo2 = document.getElementById('grove-co2');
    const selecteurCouleur = document.getElementById('grove-couleur');
    const zoneMoteurs = document.getElementById('grove-moteurs');
    const zoneLeds = document.getElementById('grove-leds');

    let ledsRuban = [];
    let etatLeds = {};
    let gesteGroveEnAttente = '';
    let tamponLcd = ['                ', '                '];
    let etatMoteurs = { 1: 'arrêt', 2: 'arrêt' };
    const zoneServos = document.getElementById('grove-servos');
    let etatServos = {};
    const cadransServos = {};

    /** Crée le cadran d'une broche, ou rend celui qui existe déjà. */
    function cadranServo(nom) {
        if (cadransServos[nom]) return cadransServos[nom];
        const bloc = document.createElement('div');
        bloc.className = 'servo';
        bloc.innerHTML =
            '<div class="servo-cadran"><div class="servo-rotor"><div class="servo-bras"></div></div>' +
            '<div class="servo-axe"></div></div>' +
            '<div class="servo-nom"></div><div class="servo-etat"></div>';
        bloc.querySelector('.servo-nom').textContent = nom;
        zoneServos.appendChild(bloc);
        cadransServos[nom] = {
            cadran: bloc.querySelector('.servo-cadran'),
            rotor: bloc.querySelector('.servo-rotor'),
            texte: bloc.querySelector('.servo-etat')
        };
        return cadransServos[nom];
    }

    function dessinerServos() {
        if (!zoneServos) return;
        const noms = Object.keys(etatServos).sort();

        if (!noms.length) {
            zoneServos.textContent = 'aucun';
            for (const cle of Object.keys(cadransServos)) delete cadransServos[cle];
            return;
        }
        // Le texte « aucun » n'est pas un cadran : on le retire avant d'en poser un.
        if (zoneServos.firstChild && zoneServos.firstChild.nodeType === Node.TEXT_NODE) {
            zoneServos.textContent = '';
        }

        for (const nom of noms) {
            const info = etatServos[nom];
            const c = cadranServo(nom);
            // Le bras pointe vers le haut à 90° : l'angle du servo est donc
            // décalé de 90° pour l'affichage.
            const orientation = (Number(info.angle) || 0) - 90;

            c.cadran.classList.toggle('arret', info.mode === 'arret');
            if (info.mode === 'continu' && info.valeur !== 0) {
                // Deux secondes par tour à 100 %, proportionnellement plus lent
                // en dessous. Le sens vient du signe de la vitesse.
                const duree = Math.min(20, 200 / Math.abs(info.valeur));
                c.cadran.classList.add('continu');
                c.cadran.classList.toggle('inverse', info.valeur < 0);
                c.rotor.style.setProperty('--duree', duree.toFixed(2) + 's');
                c.texte.textContent = info.valeur + ' %';
            } else {
                c.cadran.classList.remove('continu', 'inverse');
                c.rotor.style.transform = 'rotate(' + orientation + 'deg)';
                if (info.mode === 'arret') c.texte.textContent = 'arrêt';
                else if (info.mode === 'impulsion') c.texte.textContent = info.valeur + ' µs';
                else if (info.mode === 'continu') c.texte.textContent = '0 %';
                else c.texte.textContent = info.valeur + '°';
            }
        }
    }

    // Les 32 cellules sont creees une seule fois, puis seul leur contenu
    // change : reconstruire le balisage a chaque ecriture ferait clignoter
    // l'ecran, et le vrai afficheur ne se rafraichit pas ainsi.
    const cellulesLcd = [];

    function preparerLcd() {
        if (cellulesLcd.length) return;
        lignesLcd.forEach((ligne, i) => {
            if (!ligne) return;
            cellulesLcd[i] = [];
            for (let c = 0; c < 16; c++) {
                const cellule = document.createElement('span');
                cellule.className = 'lcd-cell';
                ligne.appendChild(cellule);
                cellulesLcd[i].push(cellule);
            }
        });
    }

    function dessinerLcd() {
        preparerLcd();
        cellulesLcd.forEach((ligne, i) => {
            const texte = tamponLcd[i] || '';
            ligne.forEach((cellule, c) => {
                const caractere = texte.charAt(c) || ' ';
                // Une espace laisse la cellule vide : son fond suffit a la
                // rendre visible, comme les points eteints du composant.
                const contenu = caractere === ' ' ? '' : caractere;
                if (cellule.textContent !== contenu) cellule.textContent = contenu;
            });
        });
    }

    function dessinerMoteurs() {
        if (zoneMoteurs) {
            zoneMoteurs.textContent = 'canal 1 : ' + etatMoteurs[1] + ' · canal 2 : ' + etatMoteurs[2];
        }
    }

    /**
     * LED simples : une pastille par broche effectivement pilotée.
     *
     * Rien n'est affiché tant que le programme n'a rien écrit — on ne sait pas
     * d'avance sur quelle broche la LED est câblée, et montrer les neuf broches
     * ferait un mur de pastilles éteintes.
     */
    function dessinerLeds() {
        if (!zoneLeds) return;
        const broches = Object.keys(etatLeds);
        if (!broches.length) {
            zoneLeds.innerHTML = '<span class="grove-vide">aucune broche pilotée</span>';
            return;
        }
        // Ordre des broches : celui du menu, pas celui des écritures, sinon
        // les pastilles sauteraient d'une exécution à l'autre.
        broches.sort((a, b) => Number(a) - Number(b));
        zoneLeds.innerHTML = broches.map(broche => {
            const niveau = etatLeds[broche];
            const f = niveau / 1023;
            // La luminosité perçue ne suit pas le rapport cyclique : une racine
            // rapproche l'affichage de ce que voit l'œil.
            const eclat = niveau ? 0.15 + 0.85 * Math.sqrt(f) : 0;
            return '<div class="led-broche">' +
                   '<span class="led-socle"><span class="led-pastille" style="opacity:' +
                   eclat.toFixed(3) + '"></span></span>' +
                   '<span class="led-nom">P' + broche + '</span>' +
                   '<span class="led-val">' + niveau + '</span></div>';
        }).join('');
    }

    // Chaque section du panneau Grove n'apparaît que si un bloc du module
    // correspondant est posé dans le programme : sur un projet qui n'utilise
    // qu'un ruban, les neuf autres n'ont rien à faire à l'écran.
    const SECTIONS_GROVE = [
        ['grove-sec-led',      /^grove_led_/],
        ['grove-sec-ruban',    /^grove_ruban_/],
        ['grove-sec-4digit',   /^grove_4d_/],
        ['grove-sec-ultrason', /^grove_ultrason_/],
        ['grove-sec-joystick', /^grove_joystick_/],
        ['grove-sec-gestes',   /^grove_gestes_/],
        ['grove-sec-lcd',      /^grove_lcd_/],
        // Les SCD mesurent aussi température et humidité : leurs curseurs
        // servent donc aux trois capteurs.
        ['grove-sec-th',       /^grove_(th|scd30|scd41)_/],
        ['grove-sec-co2',      /^grove_scd(30|41)_/],
        ['grove-sec-couleur',  /^grove_couleur_/],
        ['grove-sec-moteurs',  /^grove_moteur_/],
        ['grove-sec-servos',   /^servo_/],
        ['grove-sec-radio',    /^radio_quand_recu$/],
    ];

    function rafraichirPanneauGrove() {
        const types = window.workspace.getAllBlocks(false).map(b => b.type);
        let auMoinsUne = false;
        for (const [id, motif] of SECTIONS_GROVE) {
            const section = document.getElementById(id);
            if (!section) continue;
            const utilise = types.some(t => motif.test(t));
            section.classList.toggle('replie', !utilise);
            if (utilise) auMoinsUne = true;
        }
        const panneau = document.getElementById('grove-panneau');
        if (panneau) panneau.classList.toggle('replie', !auMoinsUne);

        // Montrer ou masquer ces sections change la hauteur de la colonne de
        // droite, donc celle du canevas. Sans cet avertissement, Blockly garde
        // en cache une hauteur perimee et place la corbeille hors de l'ecran.
        // Lire la geometrie force le navigateur a recalculer la mise en page :
        // l'appel synchrone voit donc deja les sections montrees ou masquees.
        Blockly.svgResize(window.workspace);
    }

    function reinitialiserGrove() {
        if (zoneRuban) {
            zoneRuban.innerHTML = '<span class="grove-vide">non défini</span>';
            ledsRuban = [];
        }
        afficher7Segments('00,00,00,00', false);
        gesteGroveEnAttente = '';
        tamponLcd = ['                ', '                '];
        if (zoneLcd) zoneLcd.classList.remove('eteint');
        dessinerLcd();
        etatMoteurs = { 1: 'arrêt', 2: 'arrêt' };
        dessinerMoteurs();
        etatLeds = {};
        dessinerLeds();
        etatServos = {};
        dessinerServos();
    }

    window.simu_rubanDefinir = function(nombre) {
        window.simuQueue.push({ type: 'rubanDef', nombre: Number(nombre) });
    };
    window.simu_rubanAfficher = function(couleurs) {
        window.simuQueue.push({ type: 'rubanShow', couleurs: String(couleurs) });
    };
    window.simu_afficheur = function(motifs, points) {
        window.simuQueue.push({ type: 'afficheur', motifs: String(motifs), points: !!points });
    };
    window.simu_afficheurLuminosite = function(niveau) {
        window.simuQueue.push({ type: 'afficheurLum', niveau: Number(niveau) });
    };

    window.simu_led = function(broche, niveau) {
        window.simuQueue.push({ type: 'led', broche: String(broche), niveau: Number(niveau) });
    };

    window.simu_lcd = function(action, texte, x, y) {
        window.simuQueue.push({ type: 'lcd', action: String(action),
                                texte: String(texte), x: Number(x), y: Number(y) });
    };
    window.simu_moteur = function(canal, vitesse) {
        window.simuQueue.push({ type: 'moteur', canal: Number(canal), vitesse: vitesse });
    };
    // Un seul message est delivre par declenchement, comme une vraie boite aux
    // lettres qu'on vide : sans cela le meme message reviendrait a chaque tour.
    let messageRadioEnAttente = '';
    window.simu_radioRecevoir = function() {
        const m = messageRadioEnAttente;
        messageRadioEnAttente = '';
        return m;
    };

    window.simu_servo = function(broche, mode, valeur, angle) {
        window.simuQueue.push({ type: 'servo', broche: String(broche), mode: String(mode),
                                valeur: Math.round(Number(valeur)), angle: Number(angle) });
    };

    // Entrées : lues à l'instant où le programme les demande.
    window.simu_mesure = function(grandeur) {
        const g = String(grandeur);
        if (g === 'humidite') return curseurHumi ? Number(curseurHumi.value) : 0;
        if (g === 'co2') return curseurCo2 ? Number(curseurCo2.value) : 0;
        return curseurTemp ? Number(curseurTemp.value) : 0;
    };
    window.simu_couleurCanal = function(canal) {
        if (!selecteurCouleur) return 0;
        const hexa = selecteurCouleur.value;                  // « #rrggbb »
        const r = parseInt(hexa.substr(1, 2), 16);
        const v = parseInt(hexa.substr(3, 2), 16);
        const b = parseInt(hexa.substr(5, 2), 16);
        // Le VEML6040 rend 16 bits : on transpose les 8 bits du sélecteur.
        const brut = { rouge: r, vert: v, bleu: b, blanc: Math.max(r, v, b) };
        return (brut[String(canal)] || 0) * 257;
    };
    window.simu_distanceCm = function() {
        return curseurDistance ? Number(curseurDistance.value) : 0;
    };
    window.simu_lireAnalogique = function(idBroche) {
        const id = String(idBroche);
        // L'appui sur le manche tire l'axe X presque à zéro, comme sur le module.
        if (id === '0' && caseBoutonJoystick && caseBoutonJoystick.checked) return 0;
        if (id === '1') return curseurJY ? Number(curseurJY.value) : 512;
        return curseurJX ? Number(curseurJX.value) : 512;
    };
    window.simu_joystickDirection = function(direction) {
        const x = caseBoutonJoystick && caseBoutonJoystick.checked ? 0 : Number(curseurJX.value);
        const y = Number(curseurJY.value);
        if (direction === 'gauche') return x < 350;
        if (direction === 'droite') return x > 700;
        if (direction === 'bas') return y < 350;
        if (direction === 'haut') return y > 700;
        return x >= 350 && x <= 700 && y >= 350 && y <= 700;
    };
    /** Le capteur réel vide son registre à la lecture : on fait de même. */
    window.simu_gesteGrove = function() {
        const geste = gesteGroveEnAttente;
        gesteGroveEnAttente = '';
        return geste;
    };

    function dessinerRuban(nombre) {
        zoneRuban.innerHTML = '';
        ledsRuban = [];
        for (let i = 0; i < nombre; i++) {
            const led = document.createElement('div');
            led.className = 'grove-led';
            led.title = 'LED n° ' + i;
            zoneRuban.appendChild(led);
            ledsRuban.push(led);
        }
    }

    function colorerRuban(couleurs) {
        const liste = couleurs ? couleurs.split(',') : [];
        liste.forEach((hexa, i) => {
            if (!ledsRuban[i]) return;
            const eteinte = hexa === '000000';
            ledsRuban[i].style.background = eteinte ? '#2a2a2a' : '#' + hexa;
            ledsRuban[i].style.boxShadow = eteinte ? 'inset 0 0 2px #000' : '0 0 6px #' + hexa;
        });
    }

    if (curseurDistance) {
        curseurDistance.addEventListener('input', () => {
            valeurDistance.textContent = curseurDistance.value;
        });
    }
    if (curseurJX) curseurJX.addEventListener('input', () => { valeurJX.textContent = curseurJX.value; });
    if (curseurJY) curseurJY.addEventListener('input', () => { valeurJY.textContent = curseurJY.value; });
    [['grove-temp', 'grove-temp-val'], ['grove-humi', 'grove-humi-val'],
     ['grove-co2', 'grove-co2-val']].forEach(([idCurseur, idValeur]) => {
        const c = document.getElementById(idCurseur);
        const v = document.getElementById(idValeur);
        if (c && v) c.addEventListener('input', () => { v.textContent = c.value; });
    });
    dessinerLcd();
    dessinerMoteurs();
    dessinerServos();

    window.simu_jouerMelodie = function(nom) {
        window.simuQueue.push({ type: 'son', notes: MELODIES[nom] || MELODIES.DADADADUM });
    };
    window.simu_jouerSon = function(nom) {
        window.simuQueue.push({ type: 'son', notes: SONS[nom] || SONS.HELLO });
    };
    window.simu_jouerNote = function(frequence, dureeMs) {
        window.simuQueue.push({ type: 'son', notes: [[Number(frequence), Number(dureeMs)]] });
    };
    window.simu_arreterSon = function() { window.simuQueue.push({ type: 'stopSon' }); };
    window.simu_parler = function(texte) { window.simuQueue.push({ type: 'parler', texte: String(texte) }); };

    window.simu_playQueue = function() {
        if (window.simuQueue.length === 0) return;
        let action = window.simuQueue.shift();

        const textContainer = document.getElementById('led-text-container');
        const textContent = document.getElementById('led-text-content');

        if (action.type === 'clear') {
            leds.forEach(led => led.classList.remove('on'));
            if(textContainer) textContainer.style.display = 'none';
            window.simu_playQueue();
        }
        else if (action.type === 'show') {
            leds.forEach(led => led.classList.remove('on'));
            if(textContainer) textContainer.style.display = 'none';
            let pattern = [];
            if (action.value === "HEART") pattern = [1,3,5,6,7,8,9,10,11,12,13,14,16,17,18,22];
            else if (action.value === "HAPPY") pattern = [1,3,5,9,10,14,16,18,21,22,23];
            else if (action.value === "SAD") pattern = [1,3,5,9,11,12,13,16,18,20,24];
            else if (action.value === "GHOST") pattern = [1,2,3,5,7,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24];
            else if (typeof action.value === 'string' && action.value.includes(':')) {
                let rows = action.value.split(':');
                for (let y = 0; y < 5; y++) {
                    if (rows[y]) {
                        for (let x = 0; x < 5; x++) {
                            if (rows[y][x] && rows[y][x] !== '0') {
                                pattern.push(y * 5 + x);
                            }
                        }
                    }
                }
            }
            pattern.forEach(index => { if(leds[index]) leds[index].classList.add('on'); });
            window.simu_playQueue();
        }
        // GESTION MAGIQUE DE L'AFFICHAGE ET DÉFILEMENT DU TEXTE
        else if (action.type === 'showText' || action.type === 'scrollText') {
            leds.forEach(led => led.classList.remove('on')); // Éteindre les LEDs
            if (textContainer && textContent) {
                textContainer.style.display = 'flex';
                textContent.textContent = action.value;

                if (action.type === 'scrollText') {
                    textContent.style.animation = 'none';
                    void textContent.offsetWidth; // Force le redémarrage de l'animation
                    let duration = Math.max(2, action.value.length * 0.3); // Le défilement s'adapte à la longueur
                    textContent.style.animation = `scroll-left ${duration}s linear forwards`;

                    const jeton = jetonSimulation;
                    setTimeout(() => {
                        if (jeton !== jetonSimulation) return;
                        textContainer.style.display = 'none';
                        window.simu_playQueue();
                    }, duration * 1000);
                } else {
                    // Affichage fixe (show)
                    textContent.style.animation = 'none';
                    textContent.style.transform = 'none';
                    const jeton = jetonSimulation;
                    setTimeout(() => {
                        if (jeton !== jetonSimulation) return;
                        textContainer.style.display = 'none';
                        window.simu_playQueue();
                    }, 1000); // Reste affiché 1 seconde avant de continuer
                }
            } else {
                window.simu_playQueue();
            }
        }
        else if (action.type === 'son') {
            // On enchaîne après la dernière note, pour que le son reste dans
            // l'ordre du programme vis-à-vis des affichages et des pauses.
            suiteApres(jouerNotes(action.notes));
        }
        else if (action.type === 'rubanDef') {
            dessinerRuban(action.nombre);
            window.simu_playQueue();
        }
        else if (action.type === 'rubanShow') {
            colorerRuban(action.couleurs);
            window.simu_playQueue();
        }
        else if (action.type === 'afficheur') {
            afficher7Segments(action.motifs, action.points);
            window.simu_playQueue();
        }
        else if (action.type === 'led') {
            etatLeds[action.broche] = Math.max(0, Math.min(1023, action.niveau));
            dessinerLeds();
            window.simu_playQueue();
        }
        else if (action.type === 'lcd') {
            if (action.action === 'init' || action.action === 'effacer') {
                tamponLcd = ['                ', '                '];
                if (action.action === 'init') zoneLcd.classList.remove('eteint');
            } else if (action.action === 'allumer') {
                zoneLcd.classList.remove('eteint');
            } else if (action.action === 'eteindre') {
                zoneLcd.classList.add('eteint');
            } else if (action.action === 'texte') {
                const y = Math.max(0, Math.min(1, action.y));
                const x = Math.max(0, Math.min(15, action.x));
                const morceau = action.texte.slice(0, 16 - x);
                tamponLcd[y] = (tamponLcd[y].slice(0, x) + morceau +
                                tamponLcd[y].slice(x + morceau.length)).slice(0, 16);
            }
            dessinerLcd();
            window.simu_playQueue();
        }
        else if (action.type === 'servo') {
            etatServos[action.broche] = { mode: action.mode, valeur: action.valeur, angle: action.angle };
            dessinerServos();
            window.simu_playQueue();
        }
        else if (action.type === 'moteur') {
            etatMoteurs[action.canal] = action.vitesse === 'frein' ? 'frein'
                : (action.vitesse === 0 ? 'arrêt' : 'vitesse ' + action.vitesse);
            dessinerMoteurs();
            window.simu_playQueue();
        }
        else if (action.type === 'afficheurLum') {
            // 0 à 7 sur le module : on rend l'écart en opacité.
            ecran4Digit.style.opacity = String(0.25 + 0.75 * (action.niveau / 7));
            window.simu_playQueue();
        }
        else if (action.type === 'stopSon') {
            arreterSon();
            window.simu_playQueue();
        }
        else if (action.type === 'parler') {
            const jeton = jetonSimulation;
            parler(action.texte, () => { if (jeton === jetonSimulation) window.simu_playQueue(); });
        }
        else if (action.type === 'reset') {
            // Le bloc reset() redémarre la carte : l'écran s'éteint, le son se
            // tait, et ce qui suivait dans le programme n'est pas execute.
            window.simu_reinitialiser();
        }
        else if (action.type === 'sleep') {
            suiteApres(action.value);
        }
    };

    // ==========================================
    // 6. GESTION DES CLICS (BOUTONS, LOGO, BROCHES)
    // ==========================================
    window.simu_btnA_pressed = false;
    window.simu_btnB_pressed = false;
    window.simu_logo_pressed = false;
    window.simu_pin0_pressed = false;
    window.simu_pin1_pressed = false;
    window.simu_pin2_pressed = false;

    // Geste en attente ('shake' ou null). Un geste est ponctuel : il ne vaut que
    // pour une exécution de la simulation, contrairement aux boutons qui sont
    // maintenus enfoncés.
    window.simu_geste = null;

    /** Lecture consommatrice, comme accelerometer.was_gesture() sur la carte. */
    window.simu_consommerGeste = function(geste) {
        if (window.simu_geste !== geste) return false;
        window.simu_geste = null;
        return true;
    };

    /** Lecture simple, comme accelerometer.is_gesture(). */
    window.simu_gesteActif = function(geste) {
        return window.simu_geste === geste;
    };

    const btnLancer = document.getElementById('run-sim');
    const carte = document.getElementById('microbit-board');

    // ------------------------------------------
    // MISE A L'ECHELLE DU SIMULATEUR
    // ------------------------------------------
    // La carte est dessinee en pixels fixes. Plutot que de la laisser deborder
    // ou flotter dans une colonne trop large, on l'agrandit ou on la reduit pour
    // qu'elle occupe la largeur disponible.

    const cadreCarte = document.getElementById('carte-cadre');
    const LARGEUR_CARTE = 280;
    const HAUTEUR_CARTE = 230;
    // La carte ne remplit pas toute la largeur offerte : elle est volontairement
    // reduite d'un quart, ce qui laisse respirer les sections du panneau
    // (peripheriques Grove, radio, servomoteurs) placees au-dessous.
    const REDUCTION = 0.75;

    function adapterEchelleSimulateur() {
        if (!cadreCarte || !carte) return;
        const disponible = cadreCarte.clientWidth;
        // Panneau replie : largeur nulle, rien a calculer.
        if (!disponible) return;
        const echelle = REDUCTION *
            Math.max(0.55, Math.min(1.5, disponible / LARGEUR_CARTE));
        carte.style.transform = 'scale(' + echelle.toFixed(3) + ')';
        // Un transform ne modifie pas la place occupee : le cadre s'en charge.
        cadreCarte.style.height = Math.round(HAUTEUR_CARTE * echelle) + 'px';
    }

    window.addEventListener('resize', adapterEchelleSimulateur);
    if (window.ResizeObserver && cadreCarte) {
        new ResizeObserver(adapterEchelleSimulateur).observe(cadreCarte);
    }
    adapterEchelleSimulateur();

    /**
     * Remet la simulation dans son état de départ.
     *
     * Vide la file, coupe le son et la parole, éteint les 25 LED et l'écran de
     * texte, relâche boutons, logo, broches et geste en attente, et efface le
     * message d'état. L'incrément du jeton neutralise les minuteurs encore en
     * vol : rien de l'exécution précédente ne peut plus reprendre la main.
     */
    window.simu_reinitialiser = function() {
        window.simuQueue = [];
        jetonSimulation++;
        arreterSon();

        leds.forEach(led => led.classList.remove('on'));
        const conteneurTexte = document.getElementById('led-text-container');
        const contenuTexte = document.getElementById('led-text-content');
        if (conteneurTexte) conteneurTexte.style.display = 'none';
        if (contenuTexte) {
            contenuTexte.style.animation = 'none';
            contenuTexte.textContent = '';
        }
        if (carte) carte.classList.remove('secoue');

        window.simu_btnA_pressed = false;
        window.simu_btnB_pressed = false;
        window.simu_logo_pressed = false;
        window.simu_pin0_pressed = false;
        window.simu_pin1_pressed = false;
        window.simu_pin2_pressed = false;
        window.simu_geste = null;

        reinitialiserGrove();
        afficherEtat('', false);
    };

    // Le geste Grove s'arme puis se joue, comme la secousse : il est ponctuel.
    if (boutonGesteGrove) {
        boutonGesteGrove.addEventListener('click', () => {
            gesteGroveEnAttente = menuGesteGrove.value;
            btnLancer.click();
            gesteGroveEnAttente = '';
        });
    }

    const btnReinit = document.getElementById('btn-reset');
    if (btnReinit) {
        btnReinit.addEventListener('click', () => {
            window.simu_reinitialiser();
            afficherEtat('Simulation réinitialisée.', false);
        });
    }

    function lierCapteurTactile(idHTML, nomVariableGlobale) {
        const element = document.getElementById(idHTML);
        if(element) {
            element.addEventListener('mousedown', () => {
                window[nomVariableGlobale] = true;
                btnLancer.click();
            });
            element.addEventListener('mouseup', () => window[nomVariableGlobale] = false);
            element.addEventListener('mouseleave', () => window[nomVariableGlobale] = false);
        }
    }

    lierCapteurTactile('btn-a', 'simu_btnA_pressed');
    lierCapteurTactile('btn-b', 'simu_btnB_pressed');
    lierCapteurTactile('mb-logo', 'simu_logo_pressed');
    lierCapteurTactile('pin0', 'simu_pin0_pressed');
    lierCapteurTactile('pin1', 'simu_pin1_pressed');
    lierCapteurTactile('pin2', 'simu_pin2_pressed');

    // Bouton « Secouer la carte » : arme le geste, lance la simulation, puis
    // désarme. Le tout est synchrone — le gestionnaire Brython de #run-sim
    // s'exécute pendant l'appel à click() — donc le geste est bien vu par le
    // programme, et par lui seul.
    const btnRadio = document.getElementById('grove-radio-envoi');
    if (btnRadio) {
        btnRadio.addEventListener('click', () => {
            const champ = document.getElementById('grove-radio-msg');
            messageRadioEnAttente = champ ? champ.value : '';
            btnLancer.click();
            messageRadioEnAttente = '';
        });
    }

    const btnSecouer = document.getElementById('btn-shake');
    if (btnSecouer) {
        btnSecouer.addEventListener('click', () => {
            if (carte) {
                carte.classList.remove('secoue');
                void carte.offsetWidth;      // force le redémarrage de l'animation
                carte.classList.add('secoue');
            }
            window.simu_geste = 'shake';
            btnLancer.click();
            window.simu_geste = null;
        });
    }

    // Tout le panneau Grove est en place : on peut le montrer, et le laisser
    // se mettre à jour à chaque modification du programme.
    panneauGrovePret = true;
    rafraichirPanneauGrove();

    const btnAB = document.getElementById('btn-ab');
    if (btnAB) {
        btnAB.addEventListener('mousedown', () => {
            window.simu_btnA_pressed = true;
            window.simu_btnB_pressed = true;
            btnLancer.click();
        });
        btnAB.addEventListener('mouseup', () => {
            window.simu_btnA_pressed = false;
            window.simu_btnB_pressed = false;
        });
        btnAB.addEventListener('mouseleave', () => {
            window.simu_btnA_pressed = false;
            window.simu_btnB_pressed = false;
        });
    }

} catch(erreur) {
    console.error(erreur);
    const zone = document.getElementById('etat');
    if (zone) {
        zone.textContent = "Chargement de l'interface impossible : " + erreur.message;
        zone.classList.add('erreur');
    } else {
        alert("Une erreur est survenue lors du chargement de Blockly : " + erreur.message);
    }
}
