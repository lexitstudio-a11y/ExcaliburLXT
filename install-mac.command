#!/bin/bash
# Double-cliquez (ou : chmod +x install-mac.command) depuis le dossier ExcaliburLXT décompressé.
SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/ExcaliburLXT"
mkdir -p "$DEST" && cp -R "$SRC/." "$DEST/"
for v in 9 10 11 12; do defaults write com.adobe.CSXS.$v PlayerDebugMode 1; done
echo "Installé dans $DEST"
echo "Redémarrez Première Pro : Fenêtre > Extensions > ExcaliburLXT"
