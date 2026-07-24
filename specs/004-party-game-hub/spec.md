# Feature Specification: Hub de mini-jeux, parties configurables et podium

**Feature Branch**: `004-party-game-hub`

**Created**: 2026-07-24

**Status**: Draft

**Input**: User description: "Use the claude_design MCP to import this project: IArdoise Prototype.dc.html. Implement: IArdoise Prototype.dc.html"

## Clarifications

### Session 2026-07-24

- Q: Le design montre un toggle « Compter les points » et un écran podium en fin de partie, mais ne montre pas comment les points sont attribués à chaque manche. Qui décide des points de chaque joueur, et comment ? → A: L'admin note manuellement les dessins après chaque manche et attribue un rang/des points à chaque joueur.
- Q: L'écran de configuration propose un nombre max de joueurs (4/8/12/16), mais le prototype ne montre pas ce qui se passe une fois ce plafond atteint. Doit-il être appliqué strictement ? → A: Indicatif seulement — le plafond sert de repère pour l'admin ; le système n'empêche pas des joueurs supplémentaires de rejoindre.
- Q: Comment l'admin visualise-t-il les dessins des joueurs pour les noter ? → A: En présentiel uniquement — aucune image n'est transmise par l'app ; le joueur signale qu'il a terminé son dessin puis attend, l'admin regarde les écrans des joueurs en vrai (même pièce) et note directement dans l'app.
- Q: Comment le classement attribué par l'admin se traduit-il en points ? → A: Saisie libre — l'admin attribue un nombre de points arbitraire à chaque joueur pour la manche, sans barème de points imposé par rang.
- Q: La notation d'une manche est-elle obligatoire avant de passer à la manche suivante ou de terminer la partie ? → A: Non bloquant — l'admin peut avancer ou terminer sans noter ; une manche non notée contribue 0 point.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - L'admin configure et pilote une partie en manches limitées et chronométrées (Priority: P1)

Après s'être connecté, l'admin choisit la durée de chaque manche, le nombre de manches et le nombre de joueurs indicatif, puis crée la partie. Une fois la partie lancée, l'admin voit la manche en cours (ex. "Manche 2/5") et un chronomètre visible, envoie une question par manche, et passe explicitement à la manche suivante jusqu'à épuisement des manches configurées ou jusqu'à ce qu'il termine la partie manuellement.

**Why this priority**: C'est le cœur de la nouvelle valeur ajoutée : transformer une session "à durée indéterminée" en une partie structurée avec un début et une fin prévisibles, ce qui est indispensable pour organiser une soirée avec plusieurs jeux à la suite.

**Independent Test**: Un admin crée une partie avec des réglages personnalisés (ex. 30s / 3 manches), au moins un joueur rejoint, l'admin lance la partie, envoie une question par manche, avance jusqu'à la dernière manche configurée — le système reflète à tout moment le numéro de manche courant et empêche d'avancer au-delà du nombre configuré.

**Acceptance Scenarios**:

1. **Given** l'admin est sur l'écran de configuration, **When** il sélectionne une durée de manche, un nombre de manches et un nombre de joueurs indicatif puis valide, **Then** ces réglages sont appliqués à la partie créée.
2. **Given** aucun réglage n'a été explicitement choisi, **When** l'admin crée la partie, **Then** des valeurs par défaut raisonnables sont utilisées (60 secondes, 3 manches, 8 joueurs).
3. **Given** une partie en cours à la manche N sur un total de M manches, **When** l'admin déclenche la manche suivante, **Then** le compteur passe à N+1 et un nouveau chronomètre démarre pour la durée configurée.
4. **Given** la partie est à sa dernière manche configurée, **When** l'admin déclenche "manche suivante", **Then** le système ne propose plus d'avancer une manche supplémentaire (l'action mène à la fin de partie plutôt qu'à une manche N+1 hors limite).
5. **Given** une partie en cours à n'importe quelle manche, **When** l'admin choisit de terminer la partie avant la dernière manche, **Then** la partie se termine immédiatement et passe à l'écran de résultats.
6. **Given** le chronomètre d'une manche atteint zéro, **When** aucune action de l'admin n'a eu lieu, **Then** la manche reste active (le minuteur est informatif, il ne force pas automatiquement le passage à la manche suivante).

---

### User Story 2 - L'admin note les manches et tout le monde consulte le classement final (Priority: P2)

Pendant chaque manche, un joueur qui a terminé son dessin le signale explicitement ("J'ai fini") et voit un écran d'attente ; l'admin, dans la même pièce, observe qui a terminé et regarde les écrans des joueurs en vrai (aucune image n'est transmise par l'app). En fin de manche (dernière manche atteinte ou arrêt anticipé par l'admin), si l'option "Compter les points" était activée à la configuration, l'admin attribue librement un nombre de points à chaque joueur pour la manche qui vient de se terminer, avant de passer à la manche suivante ou de terminer la partie. À la fin, l'admin et les joueurs voient un écran de résultats avec un podium (top 3) et le classement complet, puis peuvent relancer une nouvelle partie ou retourner au hub de jeux.

**Why this priority**: Donne une conclusion et un enjeu à la partie ; dépend de l'existence des manches (US1) mais reste indépendamment testable une fois celles-ci en place.

**Independent Test**: Créer une partie avec "Compter les points" activé, jouer plusieurs manches en notant les joueurs à chaque manche, terminer la partie, vérifier que le classement cumulé reflète les points attribués et qu'un podium top 3 s'affiche correctement trié.

**Acceptance Scenarios**:

1. **Given** l'option "Compter les points" est activée et une manche vient de se terminer, **When** l'admin regarde les dessins des joueurs en vrai (dans la même pièce), **Then** il peut attribuer librement un nombre de points à chacun des joueurs ayant participé à cette manche, directement dans l'app, sans barème imposé par rang.
2. **Given** un joueur a terminé son dessin et clique "J'ai fini", **When** l'action est confirmée, **Then** ce joueur voit un écran d'attente et son statut passe à "a terminé" côté admin, sans transmission d'image à l'app.
3. **Given** l'option "Compter les points" est désactivée, **When** la partie se termine, **Then** l'écran de résultats affiche la liste des participants sans classement par points (pas de podium chiffré).
4. **Given** plusieurs manches ont été notées, **When** la partie se termine, **Then** l'écran de résultats montre le classement cumulé (somme des points par joueur) avec les 3 premiers mis en avant sous forme de podium.
5. **Given** l'écran de résultats est affiché, **When** l'admin choisit "on rejoue", **Then** une nouvelle partie démarre avec les mêmes réglages et un salon vide prêt à accueillir des joueurs.
6. **Given** l'écran de résultats est affiché, **When** l'admin choisit de retourner au hub, **Then** il est ramené à l'écran de sélection de jeu (User Story 3).

---

### User Story 3 - L'admin choisit son jeu depuis un hub après connexion (Priority: P3)

Après connexion, l'admin arrive sur un hub listant les mini-jeux disponibles. Le jeu de dessin existant est sélectionnable et mène à l'écran de configuration (US1). Les autres jeux apparaissent comme "bientôt disponibles" et ne sont pas sélectionnables.

**Why this priority**: Prépare l'extensibilité vers de futurs mini-jeux et améliore la lisibilité de l'entrée dans l'app, mais n'est pas bloquant pour jouer une partie — l'admin peut toujours passer directement au jeu existant.

**Independent Test**: Se connecter avec un compte admin valide, vérifier que le hub affiche le jeu de dessin comme jouable et au moins un autre jeu comme non disponible, sélectionner le jeu jouable et vérifier l'arrivée sur l'écran de configuration.

**Acceptance Scenarios**:

1. **Given** l'admin vient de se connecter, **When** la page se charge, **Then** il voit une liste de mini-jeux avec un statut clair (jouable vs. bientôt disponible) pour chacun.
2. **Given** le hub est affiché, **When** l'admin sélectionne le jeu de dessin, **Then** il arrive sur l'écran de configuration de partie.
3. **Given** le hub est affiché, **When** l'admin tente de sélectionner un jeu marqué "bientôt disponible", **Then** aucune navigation n'a lieu (l'action est neutralisée).

---

### Edge Cases

- Que se passe-t-il si l'admin recharge la page pendant une partie en cours (manche N, chronomètre actif) ? Le système doit permettre de reprendre à l'état courant (manche, chronomètre, points déjà notés) plutôt que de repartir de zéro.
- Que se passe-t-il si l'admin passe à la manche suivante ou termine la partie sans avoir noté la manche en cours, alors que "Compter les points" est activé ? La notation n'est pas bloquante : l'action est autorisée, et cette manche non notée contribue simplement 0 point au classement final.
- Que se passe-t-il si un joueur rejoint après le lancement de la partie (manche déjà en cours) ? Il rejoint le salon mais n'apparaît dans le classement qu'à partir des manches auxquelles il participe.
- Que se passe-t-il si zéro joueur n'a rejoint le salon et que l'admin tente de lancer la partie ? Le lancement reste bloqué, comme c'est déjà le cas aujourd'hui pour la partie existante.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Après connexion, le système DOIT présenter un hub listant les mini-jeux, avec un statut visuellement distinct pour "jouable" vs "bientôt disponible".
- **FR-002**: Le système DOIT permettre de sélectionner uniquement les jeux marqués "jouables" ; les jeux "bientôt disponibles" ne déclenchent aucune navigation.
- **FR-003**: Le système DOIT proposer un écran de configuration de partie permettant de choisir : la durée par manche (parmi un ensemble de valeurs prédéfinies), le nombre de manches (parmi un ensemble de valeurs prédéfinies), un nombre de joueurs indicatif (parmi un ensemble de valeurs prédéfinies), et l'activation ou non du comptage des points.
- **FR-004**: Le système DOIT appliquer des valeurs par défaut (60 secondes par manche, 3 manches, 8 joueurs, comptage des points activé) lorsque l'admin crée une partie sans modifier les réglages proposés.
- **FR-005**: Le nombre de joueurs configuré est indicatif : le système NE DOIT PAS bloquer les tentatives de rejoindre une partie déjà à ce nombre de joueurs.
- **FR-006**: Le système DOIT suivre et afficher le numéro de la manche en cours ainsi que le nombre total de manches configuré (ex. "Manche 2/5"), visible par l'admin.
- **FR-007**: Le système DOIT démarrer un chronomètre visible par l'admin au début de chaque manche, initialisé à la durée configurée, et décomptant jusqu'à zéro sans forcer automatiquement la fin de la manche.
- **FR-008**: Le système DOIT permettre à l'admin de passer explicitement à la manche suivante tant que le nombre de manches configuré n'est pas atteint.
- **FR-009**: Le système NE DOIT PAS permettre d'avancer au-delà du nombre de manches configuré ; à la dernière manche, l'action de progression mène à la fin de partie plutôt qu'à une manche supplémentaire.
- **FR-010**: Le système DOIT permettre à l'admin de terminer la partie à tout moment, quelle que soit la manche en cours.
- **FR-011**: Lorsque le comptage des points est activé, le système DOIT permettre à l'admin d'attribuer librement un nombre de points à chaque joueur ayant participé à la manche qui vient de se terminer (sans barème imposé par rang), avant de passer à la manche suivante ou de terminer la partie. La notation se fait en présentiel (l'admin regarde les écrans des joueurs en vrai) ; le système ne transmet ni ne stocke aucune image de dessin. La notation N'EST PAS bloquante : l'admin peut avancer à la manche suivante ou terminer la partie sans avoir noté la manche en cours.
- **FR-012**: Le système DOIT permettre à un joueur de signaler explicitement la fin de son dessin ("J'ai fini"), après quoi il voit un écran d'attente jusqu'à la prochaine question ou la fin de la partie.
- **FR-013**: Le système DOIT afficher à l'admin, pour chaque joueur participant à la manche en cours, un statut visible indiquant s'il est encore en train de dessiner ou s'il a signalé la fin de son dessin.
- **FR-014**: Le système DOIT calculer un classement cumulé par joueur en sommant les points attribués sur l'ensemble des manches notées de la partie.
- **FR-015**: À la fin de la partie, le système DOIT afficher un écran de résultats accessible à l'admin et aux joueurs, incluant : si le comptage des points était activé, un podium (top 3) et la liste complète classée ; sinon, la liste des participants sans classement chiffré.
- **FR-016**: L'écran de résultats DOIT proposer deux actions à l'admin : démarrer une nouvelle partie avec les mêmes réglages, ou retourner au hub de sélection de jeu.
- **FR-017**: Le système DOIT réutiliser l'authentification, le salon d'attente (QR code / lien de partage, liste des joueurs connectés), et l'écran de dessin déjà existants sans en modifier le fonctionnement, tout en adaptant leur habillage visuel à l'identité graphique définie dans FR-018.
- **FR-018**: Le système DOIT appliquer une identité visuelle cohérente (palette de couleurs, typographies, style des boutons/cartes/animations) sur l'ensemble des écrans du parcours admin et joueur, conforme au prototype de référence.
- **FR-019**: Le système DOIT permettre à un admin de reprendre une partie en cours (manche, chronomètre, points déjà notés) après un rechargement de page, sans perte de progression.

### Key Entities

- **Partie (Session)** : instance d'une partie configurée, avec ses réglages (durée par manche, nombre de manches, nombre de joueurs indicatif, comptage des points activé ou non), son statut (configuration, en salon, en cours, terminée), sa manche courante et le total de manches.
- **Manche (Round)** : une itération numérotée au sein d'une partie, associée à une question, une durée de chronomètre, et — si le comptage des points est activé — des points attribués par joueur pour cette manche.
- **Score de joueur** : cumul des points attribués à un joueur sur l'ensemble des manches notées d'une partie, utilisé pour construire le classement et le podium final.
- **Jeu (catalogue)** : entrée du hub représentant un mini-jeu, avec un nom, une description courte et un statut (jouable ou bientôt disponible).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un admin peut configurer et lancer une nouvelle partie personnalisée (durée, manches, joueurs, points) en moins de 30 secondes.
- **SC-002**: 100% des parties atteignant leur dernier réglage de manches, ou terminées manuellement par l'admin, affichent un écran de résultats cohérent avec les points effectivement notés.
- **SC-003**: Le numéro de manche affiché et le classement affiché à l'écran de résultats correspondent exactement aux actions effectuées par l'admin pendant la partie (aucune manche fantôme, aucun point perdu ou dupliqué).
- **SC-004**: Depuis l'écran de résultats, un admin peut relancer une nouvelle partie avec les mêmes réglages en une seule action.
- **SC-005**: L'ensemble des écrans du parcours (connexion, hub, configuration, salon, partie, dessin, résultats) présentent une identité visuelle cohérente, sans rupture de style perceptible entre écrans.

## Assumptions

- Le mécanisme d'authentification admin (identifiant/mot de passe) et l'outil de dessin (couleurs, gomme) existent déjà et ne font pas partie du périmètre de cette fonctionnalité ; seul leur habillage visuel est mis à jour.
- Le salon d'attente (génération de QR code / lien, liste des joueurs connectés en direct) existe déjà et est réutilisé tel quel, avec un nouvel habillage visuel.
- Seul le jeu de dessin existant ("L'Ardoise") est réellement jouable dans le cadre de cette fonctionnalité ; les autres entrées du hub sont des emplacements réservés visuellement présents mais non fonctionnels.
- Le chronomètre de manche est purement informatif : il ne déclenche aucune action automatique (ni fin de manche, ni fin de partie) — seul l'admin déclenche les transitions.
- Les valeurs prédéfinies proposées à la configuration reprennent celles du prototype : durée par manche (30s / 60s / 90s / 120s), nombre de manches (3 / 5 / 10), nombre de joueurs indicatif (4 / 8 / 12 / 16).
- La notation se fait en présentiel : l'app ne capture, ne transmet ni ne stocke aucune image de dessin. L'interface de saisie libre des points par joueur (ex. champs numériques ou sélecteurs incrémentaux) reste à choisir en implémentation tant qu'elle respecte FR-011 et FR-012.
