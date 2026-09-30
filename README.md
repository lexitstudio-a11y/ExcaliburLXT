# ExcaliburLXT — panneau Première Pro (CEP)

Assigne des touches libres à des **calques** ou à des **effets**.

## Utilisation
1. **Calques** : sélectionnez un ou plusieurs clips/calques dans la timeline → *Capturer la sélection*.
   Cochez *Conserver aussi l'effet présent dans le calque* pour réappliquer les effets (et leurs valeurs) du calque d'origine ; sinon seul le calque nu est posé.
   Choisissez la touche puis *Assigner*. À l'appui, tous les calques sont posés ensemble à la tête de lecture, sur leur piste d'origine, avec leur durée d'origine.
2. **Effet** : saisissez le nom exact de l'effet (panneau Effets) ; il est ajouté aux clips sélectionnés.
3. Les touches déjà utilisées par Première Pro (`js/reserved.js`, à ajuster à votre préréglage) sont refusées.

## Installation
1. Copier ce dossier dans `%APPDATA%\Adobe\CEP\extensions\ExcaliburLXT` (Windows) ou `~/Library/Application Support/Adobe/CEP/extensions/ExcaliburLXT` (macOS).
2. Extensions non signées : activer `PlayerDebugMode=1` (macOS : `defaults write com.adobe.CSXS.11 PlayerDebugMode 1` ; Windows : clé `HKCU\Software\Adobe\CSXS.11`, valeur chaîne `PlayerDebugMode` = `1` ; adapter le numéro CSXS à votre version).
3. Redémarrer Première Pro → Fenêtre > Extensions > ExcaliburLXT.

## Mise à jour sans re-télécharger
- **↻ Recharger** : relit les fichiers locaux (panneau + script Première Pro) sans redémarrer.
- **⬇ Mettre à jour** : télécharge la dernière version depuis GitHub dans le dossier de l'extension puis recharge. Renseignez dépôt, branche et, si le dépôt est privé, un jeton GitHub en lecture (section « Mise à jour »). Si `CSXS/manifest.xml` change, redémarrez Première Pro.
- Vos assignations sont conservées lors d'une mise à jour.

## Limites (API Adobe)
- Les touches ne sont interceptées que lorsque le **panneau a le focus** : CEP ne peut pas enregistrer de raccourci global. Cliquez dans le panneau (ou dockez-le) avant d'utiliser les touches.
- Les effets conservés le sont avec leurs valeurs statiques ; les images clés ne sont pas copiées.
- Non testé dans une instance réelle de Première Pro (aucune disponible ici) : vérifiez sur une séquence de test.
