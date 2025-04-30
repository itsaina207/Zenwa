# Guide d'exportation vers GitHub

Ce document explique comment exporter correctement ce projet vers GitHub, incluant tous les fichiers importants tout en excluant les fichiers temporaires et sensibles.

## Méthode recommandée 

La meilleure façon d'exporter ce projet vers GitHub est d'utiliser l'intégration GitHub de Replit:

1. Dans l'interface Replit, cliquez sur l'icône "Version control" dans la barre latérale gauche (icône de branche)
2. Cliquez sur "Connect to GitHub"
3. Autorisez Replit à accéder à votre compte GitHub
4. Choisissez de créer un nouveau dépôt (repository) ou de connecter à un dépôt existant
5. Suivez les instructions à l'écran

## Méthode alternative (manuelle)

Si l'intégration ne fonctionne pas, vous pouvez suivre ces étapes:

1. Créez un nouveau dépôt sur GitHub.com
2. Clonez-le sur votre machine locale
3. Téléchargez le contenu de ce projet depuis Replit (utilisez "Download as ZIP" sur la page de votre projet Replit)
4. Extrayez les fichiers dans votre dépôt local
5. Assurez-vous d'avoir le fichier `.gitignore` qui est déjà configuré dans ce projet
6. Faites un commit et un push vers GitHub:
   ```
   git add .
   git commit -m "Initial commit of Zenwa project"
   git push origin main
   ```

## Fichiers importants à inclure

Assurez-vous que les répertoires et fichiers suivants sont inclus dans votre dépôt GitHub:

- `src/` - Code source principal du projet
- `public/` - Fichiers de l'interface web
- `docs/` - Documentation du projet
- `attached_assets/` - Ressources incluses dans le projet
- `hedera-agent-kit/` - Code lié au kit d'agent Hedera
- `.env.example` - Exemple de configuration d'environnement (mais pas le fichier .env lui-même)
- `package.json` et `package-lock.json` - Configuration NPM
- `pyproject.toml` et `uv.lock` - Configuration Python
- `README.md` - Documentation principale
- `main.py` - Point d'entrée de l'application Python
- `.gitignore` - Configuration des fichiers à ignorer dans Git

## Fichiers à exclure

Les fichiers suivants ne devraient PAS être inclus dans votre dépôt GitHub (ils sont déjà configurés pour être ignorés dans le fichier .gitignore):

- `node_modules/` - Dépendances Node.js (seront réinstallées via npm install)
- `.env` - Variables d'environnement contenant des informations sensibles
- `.cache/`, `.upm/`, `.local/`, `.pythonlibs/` - Fichiers temporaires spécifiques à Replit
- `__pycache__/` - Fichiers Python compilés

## Pour les contributeurs

Pour les personnes qui vont cloner ce dépôt depuis GitHub, ils devront:

1. Cloner le dépôt
2. Installer les dépendances: `npm install`
3. Copier `.env.example` vers `.env` et remplir les valeurs appropriées
4. Démarrer l'application avec `npm start` ou `npm run dev`