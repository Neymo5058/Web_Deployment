# Manuel d'installation du backend

Ce guide décrit les étapes nécessaires pour installer, configurer et lancer l'API backend du projet.

## 1. Prérequis

- **Node.js** version 18 LTS ou supérieure (inclut `npm`).
- **MongoDB** 6.x ou un service MongoDB compatible, accessible depuis la machine qui héberge l'API.
- Une clé API **Stripe** (secret et publishable) si vous souhaitez activer les paiements.
- Accès réseau vers les services externes nécessaires (MongoDB, Stripe, etc.).

## 2. Récupération du code

```bash
git clone <URL_DU_DEPOT>
cd <repertoire-du-projet>
```

> Remplacez `<URL_DU_DEPOT>` et `<repertoire-du-projet>` par les valeurs adaptées à votre contexte.

## 3. Installation des dépendances

Depuis la racine du projet, installez les dépendances partagées frontend/backend :

```bash
npm install
```

Toutes les dépendances serveur se trouvent dans le fichier [`package.json`](../package.json).

## 4. Configuration de l'environnement

Créez un fichier `.env` à la racine du projet (ou configurez vos variables d'environnement au niveau du système) avec les clés suivantes :

| Variable | Obligatoire | Description |
| --- | :---: | --- |
| `MONGO_URI` | ✅ | Chaîne de connexion MongoDB utilisée par Mongoose. |
| `JWT_SECRET` | ✅ | Secret utilisé pour signer les jetons JWT. |
| `STRIPE_SECRET_KEY` | ⚠️ | Clé secrète Stripe pour créer les paiements (`sk_...`). Requise pour activer les paiements. |
| `STRIPE_PUBLISHABLE_KEY` | ⚠️ | Clé publique Stripe (`pk_...`). Utilisée par le frontend pour finaliser les paiements. |
| `CLIENT_ORIGIN` | ⚠️ | Liste d'URL autorisées (séparées par des virgules) pour les requêtes CORS. Valeur par défaut : `http://localhost:5173`. |
| `PORT` | ❌ | Port HTTP du serveur Express. Par défaut `5000`. |
| `BODY_LIMIT` | ❌ | Limite de taille des requêtes JSON/URL-encoded (ex : `10mb`). Par défaut `5mb`. |
| `PAYMENT_TAX_RATE` | ❌ | Taux de taxe appliqué aux commandes (ex : `0.1495`). Par défaut `0.15`. |
| `PAYMENT_SERVICE_FEE` | ❌ | Frais de service fixe ajouté aux commandes (ex : `2.99`). Par défaut `2.99`. |
| `DEFAULT_LOCALE` | ❌ | Langue par défaut pour l'internationalisation. Par défaut `en`. |

### Exemple de fichier `.env`

```bash
MONGO_URI=mongodb://localhost:27017/peb
JWT_SECRET=changez-moi
CLIENT_ORIGIN=http://localhost:5173
PORT=5000
BODY_LIMIT=5mb
PAYMENT_TAX_RATE=0.15
PAYMENT_SERVICE_FEE=2.99
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxx
```

## 5. Lancement du serveur

Assurez-vous que MongoDB est démarré puis lancez l'API :

```bash
npm run server
```

Par défaut l'application écoute sur `http://localhost:5000`. Un endpoint de santé est disponible pour vérifier que le service fonctionne :

```bash
curl http://localhost:5000/health
```

Vous devriez recevoir une réponse JSON contenant `{"status":"ok"}` et un horodatage.

## 6. Tests

Les tests unitaires (Vitest) peuvent être exécutés avec :

```bash
npm test
```

> Les tests backend s'appuient sur une base MongoDB en mémoire. Aucune donnée de production n'est modifiée.

## 7. Déploiement

Pour un déploiement en production :

1. Configurez toutes les variables d'environnement obligatoires sur votre plateforme d'hébergement.
2. Assurez-vous que le processus Node.js s'exécute derrière un gestionnaire (PM2, systemd, Docker, etc.).
3. Activez HTTPS (via un proxy ou un load balancer) et mettez à jour `CLIENT_ORIGIN` avec le(s) domaine(s) définitifs.
4. Surveillez les logs applicatifs pour détecter toute erreur (`npm run server` affiche les logs sur la sortie standard).

## 8. Dépannage

- **Erreur `MONGO_URI not defined`** : vérifiez que la variable `MONGO_URI` est définie avant de lancer le serveur.
- **Erreur Stripe** : assurez-vous que `STRIPE_SECRET_KEY` est valide et que votre compte Stripe autorise l'opération demandée.
- **Problèmes CORS** : ajoutez l'URL de votre frontend à `CLIENT_ORIGIN` (séparée par une virgule si plusieurs valeurs).

Pour plus de détails, consultez les fichiers sources principaux du backend :

- [server.js](./server.js)
- [controllers](./controllers)
- [routes](./routes)


