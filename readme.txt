=========================================================
  PROJET : PROGRAMMATION MICRO:BIT V2 (INTERFACE BLOCKLY)
=========================================================

Application web locale : on assemble des blocs, on lit la transcription
MicroPython, on essaie le programme dans le simulateur, puis on telecharge
un fichier .hex a glisser sur le lecteur MICROBIT.

---------------------------------------------------------
1. STRUCTURE DU DOSSIER DU PROJET
---------------------------------------------------------
Tous ces fichiers doivent rester ensemble dans le meme dossier :

- index.html        (Interface, simulateur en Brython)
- un.js             (Blocs, generateurs MicroPython, boite a outils)
- deux.js           (Ecriture du programme dans le systeme de fichiers embarque)
- trois.js          (Emballage au format Universal Hex)
- firmware.hex      (Image MicroPython officielle de la micro:bit)
- readme.txt        (Ce fichier : affiche dans l'onglet Aide du panneau administrateur, §13)
- lancer_projet.bat (Demarrage du serveur local)
- app.py / app.spec (Version empaquetee en .exe avec PyInstaller)

Il n'y a pas de bibliotheque locale a installer : Blockly, Brython, microbit-fs
et microbit-universal-hex sont charges depuis Internet. Une connexion est donc
necessaire au chargement de la page.

---------------------------------------------------------
2. COMMENT LANCER LE SERVEUR WEB LOCAL
---------------------------------------------------------
Les navigateurs interdisent aux modules JavaScript de lire des fichiers locaux
par un simple double-clic sur index.html. Il faut passer par un serveur web.

Le plus simple : double-cliquer sur lancer_projet.bat. Il se place tout seul
dans le bon dossier, verifie les fichiers, demarre app.py et ouvre le navigateur.

A la main :
   1. Ouvrir un terminal.
   2. cd C:\chemin\vers\votre\dossier      <-- indispensable
   3. python app.py
   4. Laisser la fenetre ouverte, puis ouvrir http://localhost:8000

IMPORTANT : passer par app.py, et non par "python -m http.server". Ce dernier
n'envoie aucun en-tete de cache : le navigateur ressert alors un ancien
index.html ou un.js apres modification, et on regarde la version precedente sans
s'en apercevoir. app.py envoie Cache-Control: no-store, ce qui supprime le
probleme.

Si un.js / deux.js / trois.js apparaissent en erreur 404 dans la console du
navigateur, c'est que le serveur a ete lance depuis un autre dossier.

---------------------------------------------------------
3. UTILISATION
---------------------------------------------------------
- Panneau de gauche : les blocs. Le zoom se commande depuis la barre du haut
  (boutons - et +, pourcentage courant, bouton "Ajuster"), et non plus depuis le
  canevas : les controles internes de Blockly y sont dessines, donc rognes par le
  bord des que la place manque. Ctrl + molette agrandit aussi, la molette seule
  fait defiler, le pincement fonctionne sur ecran tactile. Echelle de 0,3 a 3.
  "Ajuster" cadre les blocs presents, ou revient a 100 % si l'espace est vide.

  Les boutons "Code" et "Simulateur" de la barre du haut replient les deux
  panneaux de droite. C'est utile sur les categories aux blocs longs, comme
  Grove : le tiroir de la boite a outils est aussi large que son bloc le plus
  long, et peut ne laisser presque aucune place pour deposer les blocs. Replier
  un panneau rend cette largeur au canevas ; le zoom, lui, n'agit que sur les
  blocs deja poses, pas sur le tiroir.
- Panneau du milieu : le code MicroPython correspondant, mis a jour en direct.

  Les pilotes des modules Grove et des servomoteurs y sont REPLIES derriere une
  ligne du genre "pilote lcd1602 - 39 lignes", depliable d'un clic. Sur un
  programme LCD, cela ramene la transcription de 1470 a 144 caracteres : l'eleve
  voit son programme, pas la plomberie. Ce qui est deplie le reste quand on
  modifie les blocs.

  Le repli ne concerne QUE l'affichage : le .hex et le .py contiennent toujours
  les pilotes en entier. C'est la difference avec Vittascience, qui ecrit ses
  pilotes dans des modules separes sur la carte (from lcd_i2c import LCD1602) —
  leur transcription est courte parce que le pilote est ailleurs, pas parce
  qu'il est plus petit. Notre choix garde un main.py autonome, donc un .py
  telechargeable qui fonctionne seul.
- Panneau de droite : le simulateur. Les boutons A, B, le logo et les broches
  sont cliquables ; "Lancer la simulation" execute cinq tours de boucle.
  La carte s'adapte a la largeur de la colonne : elle retrecit quand la fenetre
  est etroite, grandit quand elle est large, et reste dessinee a 75 % de la
  place disponible pour laisser respirer les sections placees au-dessous.
  Les proportions sont conservees et les zones cliquables suivent.

  A noter : replier le panneau du code n'agrandit PAS la carte. Les deux
  panneaux de droite ont chacun une largeur fixe de 24 % ; la place liberee va
  a la zone de blocs, ce qui est bien le but recherche. Seule la taille de la
  fenetre change l'echelle de la carte.
  "Secouer la carte" declenche le geste et lance la simulation dans la foulee.
  Comme sur la carte, was_gesture("shake") ne repond vrai qu'une seule fois par
  secousse, tandis que is_gesture("shake") reste vrai pendant l'execution.

  Le son est audible : les blocs [Music] et [Audio] sont joues par le navigateur
  en onde carree, timbre proche du buzzer de la carte, et [Speech] passe par la
  synthese vocale du systeme. Les melodies de music suivent le decoupage
  officiel (1 tic = 125 ms) ; les sons de audio sont des approximations, la
  vraie carte lisant des echantillons. Relancer la simulation coupe le son en
  cours. Si rien ne sort, verifier que l'onglet n'est pas muet : le navigateur
  n'autorise le son qu'apres un premier clic dans la page.

  "Reinitialiser la simulation" remet tout a zero : file d'attente videe, son et
  parole coupes, LED eteintes, ecran de texte efface, boutons, logo, broches et
  geste relaches. Rien de l'execution interrompue ne peut reprendre la main.
  Le bloc "[Micro:bit] reinitialiser la carte" produit reset(), qui declenche la
  meme remise a zero pendant l'execution : l'ecran s'eteint et la suite du
  programme n'est pas jouee, comme lors d'un redemarrage de la carte.
- Bouton engrenage : ordre des categories. On y fait glisser les categories pour
  les reordonner ; le tiroir se reconstruit aussitot. "Ordre par defaut" retablit
  l'ordre d'origine. L'ordre choisi est conserve d'une session a l'autre, dans le
  navigateur (localStorage) : il suit le poste, pas le projet. Une categorie
  ajoutee plus tard a l'application reprend sa place a la fin de la liste plutot
  que de disparaitre.
- Bouton .hex : le programme pret a copier sur la carte.
- Bouton .py  : le seul script Python, pour l'editeur officiel ou un cours.
- Bouton "Envoyer sur la carte" : ecrit directement le .hex sur le lecteur
  MICROBIT, ce qui revient exactement a un glisser-deposer.

  Au premier envoi, le navigateur demande de designer le lecteur : choisir le
  volume MICROBIT. L'application verifie qu'il porte bien DETAILS.TXT ou
  MICROBIT.HTM et refuse tout autre dossier. Le choix est ensuite conserve pour
  la session.

  Apres un transfert, la carte se reinitialise et son lecteur se demonte puis se
  remonte : le lecteur designe n'est alors plus valide. Le message invite a
  recliquer pour le redesigner. C'est normal, pas une panne.

  Cette fonction demande Chrome ou Edge. Firefox et Safari n'ont pas l'API
  d'acces aux fichiers : le bouton y est desactive, avec l'explication en
  infobulle. Le bouton .hex reste disponible partout.

  A noter : le lecteur MICROBIT n'accepte QUE des .hex. Y deposer un .py ne fait
  rien, c'est pourquoi ce bouton envoie le .hex et non le script.

En cas de probleme, le message exact s'affiche en haut a droite de la barre.
Le detail complet est dans la console du navigateur (touche F12).

---------------------------------------------------------
4. LE .HEX PRODUIT N'EST PAS IMPORTABLE DANS MAKECODE
---------------------------------------------------------
C'est normal, les deux formats n'ont rien de commun.

Un .hex MakeCode contient du code ARM compile depuis TypeScript, plus le projet
lui-meme compresse en LZMA derriere un en-tete JSON du genre :
  {"compression":"LZMA", ..., "pxtTarget":"microbit"}
C'est cet en-tete que MakeCode relit pour reconstruire les blocs.

Le .hex produit ici est une image MicroPython, avec le programme ecrit en clair
sous main.py dans le systeme de fichiers embarque. Il n'a pas d'en-tete PXT :
MakeCode ne le reconnait pas. L'inverse est vrai aussi, un .hex MakeCode n'a pas
de main.py.

Ce qui fonctionne :
- Sur la carte : glisser le .hex sur le lecteur MICROBIT. C'est l'essentiel.
- Pour rouvrir un programme : https://python.microbit.org importe le .hex et en
  ressort le main.py. Cet editeur utilise la meme bibliotheque microbit-fs que
  deux.js emploie pour l'ecrire.
- Le bouton "Telecharger le script .py" donne le fichier directement ouvrable
  dans l'editeur Python officiel ou dans Mu.

Attention : la "Python" de MakeCode n'est pas MicroPython mais une variante de
TypeScript a syntaxe Python. Le .py n'y est pas exploitable non plus.

---------------------------------------------------------
5. LES SERVOMOTEURS
---------------------------------------------------------
Categorie "Servos", sur les broches P0, P1 et P2 comme dans MakeCode.

Conventions reprises de MakeCode (pxt-common-packages, libs/servo) :
- angle de 0 a 180 degres, correspondant a une impulsion de 500 a 2500 us
  dans une periode de 20 ms (50 Hz) ;
- l'intervalle borne l'angle. Le mini est ramene entre 0 et 90, le maxi entre
  90 et 180 ;
- la rotation continue transpose une vitesse de -100 a 100 % sur l'intervalle ;
- avec "arret au neutre" actif, une vitesse ramenant au neutre arrete le
  servomoteur au lieu de le maintenir. MakeCode calcule ce neutre (maxi - mini)/2,
  formule reprise telle quelle : avec l'intervalle 0-180 par defaut cela donne
  bien 90, mais avec un intervalle decale le resultat surprend ;
- "arreter" cesse d'envoyer des impulsions : le servomoteur reste ou il est ;
- la largeur d'impulsion est bornee entre 500 et 2500 us, 1500 us etant le centre.

Le simulateur dessine un cadran par broche utilisee, dans la section
"Servomoteurs" du panneau de droite :

- servo positionnel : le bras pivote jusqu'a l'angle demande, avec une
  transition. Le bras pointe vers le haut a 90 degres, a gauche a 0, a droite
  a 180 ;
- rotation continue : le bras tourne sans fin. Deux secondes par tour a 100 %,
  proportionnellement plus lent en dessous, et dans l'autre sens si la vitesse
  est negative. Une vitesse nulle immobilise le bras ;
- arret : le cadran passe en gris et le bras reste ou il est ;
- largeur d'impulsion : le bras se place a l'angle correspondant, 500 us
  valant 0 degre et 2500 us valant 180.

---------------------------------------------------------
6. CARTE D'EXTENSION BITMAKER V2
---------------------------------------------------------
La BitMaker V2 (Seeed, ref 114992653) est un simple repartiteur : elle amene des
broches de la micro:bit sur six connecteurs Grove. Aucun bloc special n'est
necessaire, il suffit de choisir la broche correspondant au port utilise.

Correspondance des six ports Grove :

   Port          Broches         Modules a y brancher
   ------------  --------------  ----------------------------------------
   1             P0 / P1         joystick (deux axes analogiques)
   2             P1 / P2         afficheur 4 digits (CLK / DIO)
   3             P2 / P12        ultrason, ruban RGB, servomoteur
   4             P8 / P14        ruban RGB, ultrason
   5             P15 / P16       usage general
   6             I2C             AHT20/DHT20, LCD 16x2, VEML6040, DRV8830,
                                 SCD30, SCD41, capteur de gestes PAJ7620

Le premier fil d'un connecteur Grove correspond a la premiere broche indiquee.
Pour le joystick sur le port 1 : X sur P0, Y sur P1 — exactement ce que suppose
le simulateur par defaut.

Tous les modules I2C partagent le meme port : ils peuvent cohabiter sur un
concentrateur, leurs adresses etant differentes (0x38, 0x3E, 0x10, 0x65, 0x61,
0x62, 0x73).

Autres connexions de la carte : pastilles P0, P1, P2, 3V3 et GND compatibles
bananes et pinces crocodiles, alimentation USB micro 5 V, batterie LiPo sur
connecteur JST, selecteur de niveau logique 3,3 V ou 5 V, protection contre les
surintensites a 1,5 A.

Deux points a savoir :
- P13 figure dans les menus de broches de l'application mais n'est PAS sorti sur
  la BitMaker V2. Les huit autres choix correspondent bien a des ports.
- La carte porte quatre LED RGB adressables. La broche qui les commande n'est
  pas indiquee dans la documentation que j'ai pu consulter. Pour la trouver,
  poser "definir le ruban RGB sur <broche> avec 4 LED" puis "colorer tout le
  ruban", et essayer les broches candidates.

---------------------------------------------------------
7. LES MODULES GROVE
---------------------------------------------------------
La categorie "Grove" se deplie en dix sous-menus, un par module. Ses blocs
tenaient auparavant dans un seul tiroir de plus de deux ecrans de haut, ou les
derniers etaient introuvables en pratique.

Elle couvre douze modules Seeed :

- LED simple sur une broche. Deux blocs : "controler la LED a HAUT/BAS" ecrit
  tout ou rien (write_digital), "regler la luminosite a 0-1023" module la
  broche (write_analog). C'est le seul module SANS pilote : une LED se commande
  directement par la broche, et le code produit est celui qu'on ecrirait a la
  main. La valeur est bornee a 0-1023 dans le code genere, car write_analog
  leve une exception hors de cette plage et arreterait le programme sur la
  carte, sans rien afficher.
  A savoir : c'est le tiroir le plus large de l'application (452 px). Replier
  le panneau du code rend cette place a la zone de blocs.
- Ruban RGB WS2813 : s'appuie sur le module neopixel, integre au firmware.
  Le module n'a pas de reglage de luminosite : le bloc "luminosite" attenue
  les couleurs avant envoi.
- Afficheur 4 digits (TM1637), protocole 2 fils, CLK et DIO au choix.
  Le simulateur le dessine en vrais sept segments : il n'affiche pas un texte
  mais allume les segments d'apres le motif exact que le pilote envoie a la
  puce. Aspect proche du module du commerce : boitier noir a bord arrondi,
  chiffres cyan penches de 8 degres, halo lumineux sur les segments allumes.
  Les segments eteints restent faiblement visibles, comme sur le module.
  Les deux points sont entre le 2e et le 3e chiffre, et la luminosite 0 a 7
  agit sur l'intensite. Consequence a connaitre : "afficher le nombre 92"
  montre 0092, et -5 montre -005, parce que le pilote remplit les quatre
  chiffres. C'est bien ce que ferait la carte.
- Ultrason : un seul fil, declenchement puis mesure de l'echo.
- Joystick : deux axes analogiques. L'appui sur le manche tire l'axe X presque
  a zero, c'est ce que teste le bloc "bouton du joystick".
- Capteur de gestes PAJ7620 en I2C (adresse 0x73). Table d'initialisation reprise
  de la bibliotheque Seeed Gesture_PAJ7620.
- Temperature & humidite : quatre jeux de blocs dans le meme sous-menu.
  - AHT20 / DHT20 (0x38, I2C) : meme puce, un seul jeu de blocs. Chaque
    mesure est controlee par son CRC ; -1 est renvoye si elle est fausse.
    Fiable sur V1 et V2.
  - DHT11 et DHT22 (protocole 1 fil) : voir l'encadre juste apres cette
    liste, ce sont les deux seuls blocs Grove qui NE fonctionnent QUE sur le
    V1.
- Ecran LCD 16x2 v1, puce JHD1802 (0x3E) : texte a une position, effacer,
  allumer et eteindre l'affichage.
- Capteur de couleur VEML6040 (0x10) : canaux rouge, vert, bleu et blanc, en
  valeur brute sur 16 bits.
- Pilote moteur DRV8830 (canal 1 : 0x65, canal 2 : 0x60) : vitesse de -63 a 63,
  arret, frein, lecture et effacement du defaut.
- CO2 SCD30 (0x61) et SCD41 (0x62) : CO2, temperature et humidite. Le SCD30 rend
  des flottants au format IEEE, le SCD41 un entier pour le CO2.

Adresses, trames et formules reprises des bibliotheques Seeed pxt-grove
(sensors/AHT20.ts, blocks/GroveLCD1602v1.ts, sensors/VEML6040.ts,
sensors/DRV8830.ts, sensors/SCD30.ts, sensors/SCD41.ts).

DHT11 / DHT22, visibles comme les autres blocs (pas masques) : protocole 1 fil
aux impulsions de quelques dizaines de microsecondes, qu'une boucle MicroPython
interpretee ne peut pas mesurer, d'ou un pilote commun en assembleur ARM Thumb
(repris de rhubarbdog/microbit-dht11, MIT) ; seul le decodage des 5 octets
recus differe entre les deux capteurs. Fiable sur le V1 (16 MHz) uniquement :
sur le V2 (64 MHz), le meme code echantillonne trop vite, et le decalage
bit-a-bit necessaire au V2 n'a jamais ete verifie sur du materiel reel. Plutot
que de deviner, la lecture refuse proprement sur V2 (temperature() et
humidite() renvoient -1 pour les deux capteurs) au lieu de donner une valeur
fausse en silence. Utiliser AHT20/DHT20 a la place si la carte peut etre un V2
— le tooltip de chaque bloc le rappelle.

Ne sont PAS fournis, et pourquoi :
- Vision AI V2 : pile SSCMA complete (JSON transporte par blocs sur I2C), hors
  de portee d'un pilote embarque dans le programme genere.
- UartWiFi : faisable, mais initialiser l'UART sur des broches externes coupe la
  liaison serie USB, et le dialogue en commandes AT demande des temporisations a
  regler avec le module en main.

Les blocs "definir ..." et "initialiser ..." sont FACULTATIFS. Chaque module est
cree tout seul a sa premiere utilisation, avec ces reglages par defaut :

- Ruban RGB      : broche P1, 16 LED
- Afficheur 4 digits : CLK sur P0, DIO sur P1
- Les modules I2C n'ont rien a regler (adresse fixe)

Le bloc "definir ..." ne sert donc qu'a choisir d'autres broches ou un autre
nombre de LED. Le poser en tete du programme si besoin ; sans lui, rien ne
casse.

Les pilotes de ces modules ne sont pas dans le firmware : ils sont ecrits dans
le programme genere, encadres par les marqueurs "# >>> pilote grove" et
"# <<< pilote grove". Le simulateur repere ces marqueurs, retire le pilote et le
remplace par ses propres objets - sur la carte on pilote des broches, dans le
navigateur on dessine. Ne pas modifier ces marqueurs.

Cote simulateur, le panneau "Peripheriques Grove" affiche le ruban et
l'afficheur, et fournit les entrees : curseur de distance, deux curseurs pour le
joystick avec sa case "bouton enfonce", et un menu de gestes avec son bouton
"Declencher". Comme le capteur reel, le geste est consomme a la lecture.
S'y ajoutent l'ecran LCD 16x2, l'etat des deux canaux moteur, trois curseurs
(temperature, humidite, CO2) et un selecteur de couleur pour le VEML6040.

La section "LED sur broche" montre une pastille par broche effectivement
pilotee, avec la valeur ecrite. Rien n'est affiche tant que le programme n'a
rien ecrit : on ne sait pas d'avance ou la LED est cablee. L'eclat suit la
racine carree du rapport cyclique, ce qui rapproche l'affichage de ce que voit
l'oeil. A noter : toute ecriture sur une broche y figure, servomoteur compris —
c'est ce qui se passerait avec une LED reellement cablee sur cette broche.

L'ecran LCD est dessine comme le vrai module 1602 : cadre noir, retro-eclairage
bleu, caracteres clairs. Chaque caractere occupe sa propre cellule de 5x8 points
(10 x 16 px), et une trame sombre au pas du point est posee par-dessus le texte
pour donner l'aspect matriciel. Le texte s'aligne donc en colonnes, exactement
comme sur le composant : ecrire a la colonne 4 laisse quatre cellules vides,
visibles. Eteindre le retro-eclairage fait virer l'ecran au gris-vert et laisse
le texte faiblement lisible, comme sur le vrai module.

Ce panneau n'affiche que les modules effectivement utilises : chaque section
apparait des qu'un bloc du module correspondant est pose dans le programme, et
disparait quand on le retire. Sans aucun bloc Grove, le panneau entier est
masque. Les curseurs temperature et humidite servent aussi bien a l'AHT20/DHT20
qu'aux SCD30 et SCD41, qui mesurent les trois grandeurs.

---------------------------------------------------------
8. LA RADIO
---------------------------------------------------------
La categorie "Communication" regroupe la radio en quatre sous-categories :
Groupe (activer, desactiver, choisir le groupe), Envoi (envoyer un nombre, un
texte, un couple nom/valeur), Reception (le bloc "lorsque un nombre / un texte /
une valeur est recu" et le bloc de lecture) et Plus (puissance d'emission,
longueur d'onde).

Le bloc de lecture donne, au choix : le nombre recu, le nom recu, la valeur
recue, le texte recu, la force du signal. Il n'a de sens qu'a l'interieur d'un
bloc "lorsque ... recu" : ailleurs il lira le dernier message arrive, ou du vide.

La convention de transport est textuelle, la meme que celle de MicroPython :
un nombre part comme "42", un couple part comme "nom=valeur", un texte part tel
quel. A la reception, le dispatcher classe le message : s'il contient "=", c'est
un couple ; sinon s'il se convertit en nombre, c'est un nombre ; sinon c'est un
texte. Deux micro:bit programmes avec cette application se comprennent donc
parfaitement.

Ce qu'il faut savoir : cette radio n'est PAS compatible en l'air avec MakeCode.
MakeCode utilise un format binaire propre a lui, avec un en-tete et un numero de
serie. Un micro:bit sous MakeCode et un micro:bit sous cette application ne
s'entendront pas, meme sur le meme groupe. C'est une limite de MicroPython, pas
de l'application.

Deux blocs MakeCode n'ont volontairement pas ete repris, faute d'equivalent
MicroPython : "regler le numero de serie de transmission" et "radio declencher
l'evenement".

Cote simulateur, la section "Radio : message a recevoir" apparait des qu'un bloc
"lorsque ... recu" est pose. On y saisit le message et on clique "Simuler la
reception" : le dispatcher le classe et appelle le bon gestionnaire, exactement
comme sur la carte. La force du signal simulee vaut -42.

---------------------------------------------------------
9. LES FONCTIONS
---------------------------------------------------------
La categorie "Fonctions" est dynamique : elle fournit la definition, la
definition avec retour, le retour conditionnel, et un bloc d'appel pour chaque
fonction creee. Les parametres s'ajoutent par le bouton + du bloc.

A savoir : tant qu'aucune fonction n'existe, la categorie ne montre que les
trois premiers blocs. Le bloc d'appel apparait des qu'on a pose une definition
et nomme la fonction — un par fonction, portant son nom. C'est la difference
avec Vittascience, qui affiche d'emblee un bloc d'appel generique. Un bloc
d'appel ne peut pas exister sans fonction cible.

Les fonctions sont ecrites en tete du programme, avant tout code executable,
comme les gestionnaires "lorsque ...". On peut donc poser les blocs n'importe
ou dans l'espace de travail.

---------------------------------------------------------
10. LES BLOCS "LORSQUE ..."
---------------------------------------------------------
MicroPython n'a pas de systeme d'evenements. Chaque bloc "lorsque ..." produit
une fonction, et l'application ajoute automatiquement une boucle qui les
appelle. S'il existe deja une boucle "Repeter indefiniment", la scrutation y est
inseree ; sinon une boucle dediee est ajoutee a la fin du programme.

Consequence pratique : un bloc "lorsque ..." pose seul suffit, le programme
tournera. Inutile de l'entourer d'une boucle.

Au demarrage de l'application, l'espace de travail contient deja deux blocs :
"Au demarrage" et "Repeter indefiniment", comme dans MakeCode.

"Au demarrage" s'execute une seule fois, avant tout le reste. Il n'a ni encoche
du dessus ni du dessous : il vit seul, et un seul exemplaire est autorise — deux
rendraient l'ordre d'execution ambigu. Son contenu est genere a plat, en tete du
programme.

L'ordre des blocs de premier niveau suit leur position verticale dans l'espace
de travail : garder "Au demarrage" au-dessus des boucles.

Les fonctions produites par les blocs "lorsque ..." font exception : elles sont
placees d'office en tete du programme, avant tout code executable. Sans cela, un
bloc "lorsque ..." pose a droite ou en dessous d'une boucle aurait ete defini
apres l'appel qui l'utilise, et le programme se serait arrete sur un NameError.
On peut donc les disposer librement dans l'espace de travail.

---------------------------------------------------------
11. LE FICHIER FIRMWARE.HEX
---------------------------------------------------------
C'est l'image MicroPython dans laquelle le programme vient s'ecrire. Celui
fourni ici est un hex universel (V1 + V2) exporte depuis python.microbit.org.

Les deux formats sont acceptes, Intel et universel. Un .hex exporte depuis
l'editeur convient meme s'il contient deja un programme : deux.js efface la zone
du systeme de fichiers avant d'y ecrire le nouveau main.py.

Attention aux copies incompletes : un firmware tronque est refuse avec le
message "firmware.hex est incomplet", qui indique le nombre d'octets recus.

Ce message peut aussi apparaitre alors que le fichier sur le disque est
parfaitement valide : si un autre projet a ete servi auparavant sur le meme
http://localhost:8000, le navigateur a garde SON firmware.hex en cache, a la
meme adresse, et le ressert. deux.js demande desormais la lecture avec
cache: "no-store" pour eviter cela ; en cas de doute, comparer la taille
annoncee dans le message avec celle du fichier sur le disque.

---------------------------------------------------------
12. REGENERER L'EXECUTABLE
---------------------------------------------------------
Apres toute modification des fichiers du projet :

   pyinstaller app.spec

Les dossiers build/ et dist/ sont regeneres. dist/app.exe embarque index.html,
un.js, deux.js, trois.js, firmware.hex et readme.txt.

---------------------------------------------------------
13. LE PANNEAU ADMINISTRATEUR
---------------------------------------------------------
Raccourci Ctrl+Alt+Maj+A : active ou desactive le mode administrateur. Le
bouton ⚙ est invisible tant que ce raccourci n'a pas ete utilise. Ce n'est pas
une vraie protection (l'app est 100% cliente, sans compte ni serveur) : ca
evite juste qu'un eleve tombe dessus par hasard.

Le panneau a quatre onglets :

- CATEGORIES : glisser pour reordonner, l'oeil masque une categorie aux
  eleves, le crayon la renomme, la pastille de couleur en tete de ligne
  change sa couleur (selecteur natif du navigateur). "Tout reinitialiser"
  revient a l'etat d'origine (ordre, noms et couleurs compris).
- SOUS-MENUS : on choisit une categorie dans la liste deroulante.
  - Communication et Grove ont deja des sous-menus (un par module) : ils se
    reordonnent/masquent/renomment/recolorent comme les categories.
  - Les autres categories sont a plat : on peut regrouper des blocs choisis
    dans un nouveau sous-menu (utile si une categorie s'allonge trop), avec
    lui aussi sa propre pastille de couleur. Un sous-menu supprime rend ses
    blocs au niveau superieur.
- LIBELLES : cherche un bloc par son nom technique ou par un mot de son
  texte affiche, puis modifie ce texte. Ca ne touche qu'a l'affichage, jamais
  au code Python genere ni au comportement du bloc.
- AIDE : le contenu de ce readme.txt, charge depuis le serveur local au
  premier clic sur l'onglet. Un lien l'ouvre aussi dans un nouvel onglet du
  navigateur.

Tout est memorise en localStorage, donc propre a chaque navigateur/poste :
pas de fichier de config partageable entre les postes d'une salle pour
l'instant. Reglages perdus si le cache du navigateur est vide.

---------------------------------------------------------
14. ÉDITION MANUELLE DU CODE
---------------------------------------------------------
Bouton "✎ Éditer" au-dessus de la transcription MicroPython : bascule le
panneau en zone de texte modifiable.

Blockly sait transformer des blocs en Python, jamais l'inverse de façon
fiable : du code tape a la main ne peut donc pas revenir en blocs. Les deux
ne peuvent pas rester synchronises, alors ce mode est exclusif plutot que de
laisser deriver l'un des deux sans le dire :

- Entrer en edition manuelle GELE le canevas Blockly (voile visible dessus,
  qui bloque aussi les clics) : impossible de modifier les blocs tant qu'on
  est en train de taper du code.
- Ce qui est tape remplace en direct le code utilise par le simulateur, le
  bouton .hex, le bouton .py et "Envoyer sur la carte".
- "↩ Revenir aux blocs" ABANDONNE la saisie manuelle et restaure le code tel
  que les blocs le decrivent a cet instant (pas celui d'avant l'edition, s'ils
  ont continue d'exister en arriere-plan).

Rien n'est sauvegarde d'une session a l'autre : recharger la page perd la
saisie manuelle, exactement comme elle perd deja l'espace de travail Blockly
lui-meme. Telecharger le .py avant de recharger si le texte tape doit etre
garde.

