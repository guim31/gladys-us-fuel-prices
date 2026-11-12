# US Fuel Prices (EIA)

Les prix moyens hebdomadaires de l’essence et du gazole aux États-Unis dans
Gladys, publiés par l’U.S. Energy Information Administration (EIA) : la
moyenne nationale, les régions PADD, et les États et villes que l’EIA publie.

Ce sont **des moyennes de l’enquête du lundi, pas les prix des stations** :
l’EIA interroge un échantillon de stations chaque lundi matin et publie les
moyennes l’après-midi même (heure de l’Est). GasBuddy et AAA ne sont pas
utilisés : ils n’offrent pas d’API ouverte.

Sans lien avec l’EIA. Développée depuis l’Europe, avec les données publiques
de l’EIA : vos retours sont les bienvenus.

## Ce que vous obtenez

- Un appareil par **zone** suivie, avec pour chaque carburant (essence
  Regular, Midgrade, Premium et gazole) : le prix en $/gal, sa variation sur
  une semaine et sur un an (52 semaines, comme l’EIA), et la date de
  l’enquête.
- Un déclencheur de scène **Nouveaux prix hebdomadaires des carburants
  (EIA)**, avec un résumé prêt pour un message.
- Un widget de tableau de bord avec les prix de n’importe quelle zone et
  leurs variations.

## Prérequis

- Gladys 5.3.0 ou plus récent.
- Un accès à Internet depuis Gladys (`api.eia.gov`).
- Une **clé d’API EIA** gratuite : inscrivez-vous sur
  https://www.eia.gov/opendata/register.php (un nom et une adresse e-mail),
  la clé arrive aussitôt par e-mail. Sans clé, l’intégration utilise
  `DEMO_KEY`, la clé de démonstration partagée de l’EIA : elle est limitée à
  quelques requêtes par heure et par jour, souvent déjà épuisées.

## Installation

Dans Gladys, ouvrez **Intégrations → Installer depuis GitHub** et saisissez
l’adresse du dépôt : `https://github.com/guim31/gladys-us-fuel-prices`.

## Configuration

| Champ           | Rôle                                                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clé d’API EIA   | Votre clé gratuite. Vide : `DEMO_KEY`. Gardée par Gladys, jamais écrite dans les journaux.                                                                                                  |
| Zones à suivre  | Un appareil par zone : la moyenne des États-Unis (par défaut), les 5 régions PADD et 4 sous-régions, 9 États, 10 villes. Le gazole n’existe que pour le pays, les régions et la Californie. |
| Carburants      | Les carburants affichés sur chaque appareil et dans le widget. Vide : les quatre.                                                                                                           |
| Langue des noms | Langue des noms d’appareils et de fonctionnalités (figés à l’ajout d’un appareil), de la date de l’enquête et du résumé du déclencheur. Français par défaut.                                |

Ouvrez ensuite l’onglet **Découverte** de l’intégration et ajoutez les
appareils.

## Appareils

### Prix des carburants – zone

| Fonctionnalité                     | Type                      | Exemple (États-Unis, 09/11/2026) |
| ---------------------------------- | ------------------------- | -------------------------------- |
| Ordinaire ($/gal)                  | Monnaie, dollars          | 3,995                            |
| Ordinaire, variation sur 1 semaine | Monnaie, dollars (signée) | −0,158                           |
| Ordinaire, variation sur 1 an      | Monnaie, dollars (signée) | 0,939                            |
| … de même pour chaque carburant    |                           |                                  |
| Date de l’enquête                  | Texte                     | 9 nov. 2026                      |

Gladys n’a pas d’unité $/gal : la fonctionnalité de prix affiche un signe
dollar, et son nom précise « par gallon ». Une variation de −0,158 est une
baisse de 15,8 cents.

## Scènes

### Prix sous un seuil

Pas besoin d’un déclencheur spécial : dans une scène, choisissez **Valeur
d’un appareil** sur la fonctionnalité de prix, par exemple « Ordinaire
($/gal) inférieur à 3,50 ».

### Une baisse de N cents

Même chose sur la variation sur une semaine : « Ordinaire, variation sur 1
semaine inférieure à −0,10 » lance la scène quand le prix a baissé de plus de
10 cents dans la semaine.

### Nouveaux prix hebdomadaires des carburants (EIA)

Se déclenche une fois par semaine et par zone suivie, quand l’EIA publie une
nouvelle enquête (jamais pour l’enquête déjà connue au démarrage de
l’intégration). Filtre : les zones. Variables : `zone` (identifiant EIA, par
exemple `NUS`), `zone_name`, `survey_date` (`AAAA-MM-JJ`) et `summary`, par
exemple « Ordinaire 3,995 $ (−15,8 ¢), Gazole 6,127 $ (−16,5 ¢) », prêt pour
un message.

## Tableau de bord

### Widget Carburants aux USA

Réglages : la zone (n’importe laquelle, suivie ou non ; la moyenne des
États-Unis par défaut) et l’affichage des variations. Une tuile par
carburant, verte quand le prix a baissé dans la semaine, orange quand il a
monté ; puis les variations sur une semaine et sur un an en cents, et la date
de l’enquête.

## Actions

**Tester la connexion à l’EIA** (onglet Configuration) lit tout de suite la
dernière enquête, avec la clé de la configuration, et répond avec un prix.

## Données et limites

- Données hebdomadaires : l’intégration lit l’EIA toutes les 6 heures, et
  toutes les heures à partir du lundi 21 h UTC jusqu’à la sortie de la
  nouvelle enquête (le mardi après un jour férié fédéral). Quelques dizaines
  de requêtes par semaine, très loin des limites d’une clé gratuite.
- Une enquête de plus de 15 jours n’est pas affichée : mieux vaut aucune
  valeur qu’une valeur ancienne.
- Le gazole n’est publié que pour le pays, les régions et la Californie.
- Certaines semaines, l’EIA retient une valeur : la fonctionnalité garde
  alors sa dernière valeur, de même qu’une variation qui ne peut pas être
  calculée sans elle.
- Les prix incluent toutes les taxes.

## Dépannage

- **« L’EIA refuse la clé d’API »** : vérifiez la clé (recopiez-la depuis
  l’e-mail), puis lancez **Tester la connexion à l’EIA**.
- **« La limite de la clé de démonstration de l’EIA est atteinte »** :
  saisissez votre propre clé gratuite.
- **Aucune valeur** : ajoutez d’abord les appareils dans l’onglet
  Découverte ; les valeurs arrivent dans la minute.
- Plus de détails dans les journaux de l’intégration (`LOG_LEVEL=debug`).

## Crédits

Données : U.S. Energy Information Administration, Open Data API v2
(`petroleum/pri/gnd`), domaine public (œuvre du gouvernement américain).
Intégration sous licence Apache 2.0.
