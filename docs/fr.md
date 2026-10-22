# LubeLogger

Suivez vos véhicules dans Gladys grâce à
[LubeLogger](https://lubelogger.com), le carnet d'entretien auto-hébergé :
kilométrage, consommation moyenne, dépenses du mois et surtout les **rappels
d'entretien** (vidange, pneus, contrôle technique, assurance) en déclencheurs
de scène. Gladys parle directement à votre serveur LubeLogger, chez vous ou
sur un serveur distant.

Testée contre un vrai serveur LubeLogger 1.7.4 (l'image Docker officielle),
rappels par date et par kilométrage compris. Vos retours sont les bienvenus sur
le forum Gladys.

## Prérequis

- Gladys Assistant 5.1 ou plus récent.
- LubeLogger **1.5.9 ou plus récent**, joignable depuis la machine Gladys (port
  8080 par défaut, ou derrière un proxy inverse).
- Si l'authentification est activée dans LubeLogger : une **clé d'API**
  (LubeLogger → Paramètres → Clés d'API, droits **View** et **Edit** ; View
  seul suffit si vous n'ajoutez pas de relevés de compteur), ou le nom
  d'utilisateur et le mot de passe d'un utilisateur LubeLogger. L'intégration
  voit les véhicules de cet utilisateur.

## Configuration

1. Ouvrez l'onglet **Configuration** de l'intégration.
2. Dans **Adresse de LubeLogger**, saisissez l'adresse IP du serveur, par
   exemple `192.168.1.50` : l'intégration utilise alors le port 8080. Ajoutez
   un port si le vôtre diffère (`192.168.1.50:8081`). Derrière un proxy
   inverse, saisissez l'adresse complète (`https://example.org/lubelogger`).
3. Si l'authentification est activée dans LubeLogger, collez une **clé
   d'API**, ou remplissez **Nom d'utilisateur** et **Mot de passe**. La clé
   l'emporte si les deux sont remplis. Sinon, laissez ces champs vides.
4. **Unité de distance utilisée dans LubeLogger** : LubeLogger enregistre des
   nombres sans unité. Choisissez **Kilomètres** (litres, L/100 km, kWh/100 km)
   ou **Miles** (gallons US, mpg, mi/kWh), comme dans vos relevés.
5. **Lire LubeLogger toutes les** : 5, 15 (par défaut), 30 ou 60 minutes.
6. **Langue des noms et messages** fixe les noms des fonctionnalités (figés à
   l'ajout de l'appareil), les textes et les dates des variables de scène.
   Français par défaut.
7. Enregistrez, puis utilisez **Tester la connexion** : elle affiche la version
   de LubeLogger, le nombre de véhicules et de rappels.
8. Dans l'onglet **Découverte**, ajoutez les véhicules à suivre.

## Appareils

Un appareil par véhicule de LubeLogger, nommé d'après sa marque, son modèle et
sa plaque (`Renault Clio (AA-000-AA)`). Les véhicules vendus sont ignorés.

| Fonctionnalité       | Valeur                                                                         |
| -------------------- | ------------------------------------------------------------------------------ |
| Kilométrage          | dernier relevé connu de LubeLogger, en km ou en miles                          |
| Consommation moyenne | L/100 km (ou mpg) ; kWh/100 km (ou mi/kWh) pour un véhicule électrique         |
| Coût du mois         | carburant, entretiens, réparations, améliorations et taxes du mois en cours    |
| Prochain rappel      | le rappel le plus urgent et son échéance (`Vidange · 45 000 km`), ou « Aucun » |
| Rappels en retard    | rappels dont la date ou le kilométrage est dépassé                             |
| Rappels urgents      | rappels urgents ou très urgents                                                |

La consommation est la moyenne de LubeLogger : la distance parcourue sur le
carburant utilisé, pour les pleins qu'il sait calculer (pas le premier, pas
après un plein oublié). Gladys n'a pas d'unité « L/100 km » : la valeur est
publiée en litres, l'unité complète est dans le nom de la fonctionnalité. Le
coût est dans la monnaie de LubeLogger (euro, dollar ou livre sterling ; une
autre monnaie apparaît dans le nom). Un véhicule compté en heures (bateau,
tracteur) affiche ses **Heures moteur**, sans consommation.

L'urgence des rappels est celle de LubeLogger (par défaut : urgent à 30 jours
ou 100 km, très urgent à 7 jours ou 50 km, réglable dans ses paramètres) :
Gladys et LubeLogger sont toujours d'accord.

## Widget de tableau de bord

**Prochains entretiens** : deux tuiles (rappels en retard, rappels urgents) et
la liste des rappels, les plus urgents d'abord, avec leur échéance et un badge
de couleur. Réglage **Véhicule** : vide pour tous les véhicules, ou un seul.
Lecture seule.

## Déclencheurs de scène

- **Rappel d'entretien devenu urgent** : un rappel devient urgent, puis très
  urgent. Une fois par niveau et par échéance. Variables : véhicule, rappel,
  échéance, urgence (« Urgent » ou « Très urgent »).
- **Rappel d'entretien en retard** : un rappel dépasse sa date ou son
  kilométrage. Une fois par échéance. Variables : véhicule, rappel, échéance.

Les deux se filtrent par **Véhicule** (vide : tous). La première lecture après
l'installation est silencieuse : ce qui est déjà urgent ou en retard est
affiché sur l'appareil, pas annoncé. Un rappel récurrent marqué comme fait dans
LubeLogger reçoit une nouvelle échéance : il sera annoncé à nouveau le moment
venu. Les déclencheurs partent à la première lecture qui suit le changement.

## Actions de scène

- **Ajouter un relevé de compteur à LubeLogger** : choisissez le véhicule et
  saisissez le relevé, un nombre ou une variable de scène (par exemple le
  kilométrage remonté par l'intégration constructeur de votre voiture).
  L'action relit LubeLogger, ajoute le relevé à la date du jour, puis relit
  les rappels (ceux au kilométrage avancent avec lui). Un relevé égal au
  dernier n'ajoute rien ; un relevé inférieur, ou supérieur de plus de 10 000
  (mauvaise unité, valeur aberrante d'un capteur), est refusé. Résultats : **Relevé
  ajouté** et **Kilométrage**.
- **Lire un véhicule dans LubeLogger** : renvoie le véhicule, le kilométrage,
  la consommation moyenne, le coût du mois, le prochain rappel et son urgence,
  le nombre de rappels en retard et urgents, pour un message ou une condition.

## Exemples de scènes

- **Vidange à prévoir** : déclencheur « Rappel d'entretien devenu urgent » →
  message « {{triggerEvent.data.vehicle_name}} :
  {{triggerEvent.data.reminder}} à prévoir ({{triggerEvent.data.due}}) ».
- **Contrôle technique dépassé** : déclencheur « Rappel d'entretien en
  retard » → message urgent à toute la famille.
- **Relevé automatique** : chaque soir à 21 h → « Ajouter un relevé de
  compteur » avec la variable du kilométrage de la voiture, puis « Lire un
  véhicule » → continuer seulement si des rappels sont en retard → message
  avec le prochain rappel.

## Dépannage

- **« Accès refusé »** : vérifiez la clé d'API (elle a pu être supprimée), ou le
  nom d'utilisateur et le mot de passe.
- **« LubeLogger a refusé l'écriture »** à l'ajout d'un relevé : la clé d'API
  n'a que le droit View ; créez-en une avec View et Edit.
- **« LubeLogger ne répond pas »** : vérifiez l'adresse et le port depuis la
  machine Gladys. Le conteneur est sur un réseau en pont : `localhost` désigne
  le conteneur lui-même, saisissez plutôt l'adresse IP du serveur.
- **« Cette adresse ne répond pas comme LubeLogger 1.5.9 ou plus récent »** :
  une page de connexion de proxy répond à la place de LubeLogger, ou sa version
  est trop ancienne.
- Kilométrage ou consommation incohérents : vérifiez l'**Unité de distance**.
- Pour plus de détails dans les journaux de l'intégration, réglez
  `LOG_LEVEL=debug`.

## Limites

- Chaque lecture fait sept requêtes, dont la liste de tous les pleins (pour la
  consommation) : gardez un intervalle long sur un très gros historique.
- La seule écriture est le relevé de compteur de l'action de scène ; rien n'est
  jamais supprimé.
- Les rappels « à la date ou au kilométrage » ne se comparent pas entre eux :
  à urgence égale, ceux qui ont une date passent avant ceux au kilométrage
  seul.
- Sans lien avec le projet LubeLogger.
