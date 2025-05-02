#!/bin/bash

# Démarrer l'application Flask en arrière-plan
gunicorn --bind 0.0.0.0:5000 main:app &

# Démarrer le bot Telegram (Node.js)
cd src && node index.js
