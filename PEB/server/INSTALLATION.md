# Manuel d'installation du backend

Ce document décrit la mise en place du serveur Node.js/Express utilisé par Pro Event Booking. Il couvre la configuration locale pour le développement ainsi que les points d'attention pour un déploiement géré par Railway ou toute autre plateforme compatible Node.js.

## 1. Architecture en bref
- **Serveur** : [Express 5](./server.js) avec middleware CORS, cookies et JSON.
- **Base de données** : MongoDB via Mongoose ; la connexion est initialisée dans [`server.js`](./server.js) et requiert `MONGO_URI`.
- **Authentification** : JWT signé à l'aide de `JWT_SECRET` (voir [`server/config/auth.js`](./config/auth.js)).
- **Paiements** : intégration Stripe côté serveur (voir [`server/controllers/paymentController.js`](./controllers/paymentController.js)).
- **Seeding** : scripts [`seed.js`](./seed.js) et [`seed-local.js`](./seed-local.js) pour créer des données d'exemple et un compte administrateur.

## 2. Prérequis
1. **Node.js** ≥ 20 et npm ≥ 10.
2. **MongoDB** : URL de connexion valide (cluster Atlas ou serveur local).
3. **Compte Stripe** (obligatoire uniquement pour tester les paiements) avec clés secrète et publique de test.
4. Accès au dépôt et aux scripts `npm`.

## 3. Installation des dépendances
```bash
# depuis la racine du projet
npm install
```

## 4. Configuration des variables d'environnement
Le backend charge automatiquement un fichier `.env.local` à la racine du projet (voir [`server/utils/local-env.js`](./utils/local-env.js)). À défaut, Express utilisera les variables du shell ou d'un fichier `.env` classique.

1. Dupliquer le modèle ci-dessous dans `./.env.local` :

```ini
# --- Configuration serveur ---
NODE_ENV=development
PORT=8080               # peut être surchargé par Railway
BODY_LIMIT=5mb          # taille max des payloads JSON
CLIENT_ORIGIN=http://localhost:5173

# --- Base de données ---
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>/<database>?retryWrites=true&w=majority

# --- Authentification ---
JWT_SECRET=remplacez-moi-par-une-valeur-secrète
DEFAULT_LOCALE=fr

# --- Paiements (Stripe) ---
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
PAYMENT_TAX_RATE=0.15
PAYMENT_SERVICE_FEE=2.99

# --- Données de seed ---
SEED_ADMIN_EMAIL=admin@peb.test
SEED_ADMIN_PASSWORD=123456
SEED_ADMIN_NAME=Pro Event Admin
SEED_RESET_ADMIN_PASSWORD=false
SEED_RESET_EVENTS=false
```

2. Variables supplémentaires disponibles :

| Variable | Obligatoire | Description |
| --- | --- | --- |
| `CLIENT_ORIGIN` | Non (défaut : `http://localhost:5173` + Netlify) | Liste d'origines autorisées séparées par des virgules pour CORS. |
| `PAYMENT_TAX_RATE` | Non (défaut : `0.15`) | Taux de taxes appliqué lors du calcul du panier. |
| `PAYMENT_SERVICE_FEE` | Non (défaut : `2.99`) | Frais de service fixes ajoutés aux commandes. |
| `SEED_RESET_ADMIN_PASSWORD` | Non | Réinitialise le mot de passe admin lors du seed si `true`. |
| `SEED_RESET_EVENTS` | Non | Vide la collection `events` avant de regénérer les exemples. |
| `DOTENV_CONFIG_PATH` | Non | Permet de pointer explicitement vers un autre fichier `.env`. |

⚠️ Si vous ne disposez pas de clés Stripe, les routes `/api/payments` renverront `503`. Vous pouvez toujours explorer le reste de l'API sans configurer Stripe.

## 5. Lancement du serveur en local
```bash
npm run server:backend
```

Le serveur écoute sur `http://localhost:8080` (ou le port défini par `PORT`) et expose les routes REST sous `/api/*`. Une route santé est disponible sur `GET /health`.

Pour démarrer simultanément le backend et le frontend Vue :
```bash
npm run server
```

## 6. Peupler la base de données (seed)
Après configuration de `MONGO_URI` :

```bash
# Respecte .env.local automatiquement
npm run seed:local

# Ou depuis un environnement déjà configuré
npm run seed
```

Le script crée un compte administrateur et trois événements de démonstration (voir [`server/seed.js`](./seed.js)). Utilisez `SEED_RESET_EVENTS=true` pour régénérer les événements.

## 7. Déploiement
- **Railway / Render** : assurez-vous que `MONGO_URI`, `JWT_SECRET`, `STRIPE_SECRET_KEY` et `STRIPE_PUBLISHABLE_KEY` sont définis dans le tableau de bord d'environnement. Railway fournit automatiquement `PORT`.
- **Sécurité** : activez `NODE_ENV=production` et forcez `CLIENT_ORIGIN` sur vos domaines publics.
- **Logs & erreurs** : le middleware [`error-handler`](./middlewares/error-handler.js) masque les traces en production (`NODE_ENV=production`).

## 8. Diagnostic rapide
- `Mongo connected` n'apparaît pas → vérifier `MONGO_URI` et l'accessibilité réseau.
- Erreur CORS → ajouter l'URL du client dans `CLIENT_ORIGIN`.
- Paiements Stripe indisponibles → vérifier `STRIPE_SECRET_KEY` (clé de test par défaut recommandée en développement).

Vous disposez désormais d'un backend opérationnel pour Pro Event Booking.
