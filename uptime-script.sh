#!/bin/bash

# Script de démarrage pour le système Always-On
echo "===========================================" 
echo "Démarrage du système Always-On pour Zenwa"
echo "===========================================" 

# Vérifier que le script exists
if [ ! -f "always-on.js" ]; then
  echo "ERREUR: Le script always-on.js n'existe pas"
  exit 1
fi

# Démarrer le script Always-On en arrière-plan
node always-on.js
