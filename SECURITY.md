# Politique de sécurité

## Signaler une vulnérabilité

Merci de ne pas ouvrir d'issue publique. Contactez le mainteneur du dépôt en privé
(onglet *Security → Report a vulnerability* sur GitHub) en décrivant le problème et comment le reproduire.
Une réponse est donnée sous 7 jours.

## Bonnes pratiques du projet

- Ne jamais committer de fichier `.env`, de mot de passe ou de clé : utiliser les variables d'environnement
  décrites dans `back-end/.env.example`.
- Si un secret a été publié par erreur, le **changer immédiatement**. Le supprimer de l'historique git
  ne suffit pas, car des copies peuvent déjà exister.
- Déployer l'API derrière HTTPS uniquement.

## Données personnelles

L'application stocke des données clients (nom, téléphone, historique d'achats et dettes). Le propriétaire
de la boutique en est responsable : ne collecter que le nécessaire, protéger l'accès au serveur et à la base,
et supprimer les données d'un client sur sa demande (exigences du RGPD et de la loi marocaine 09-08).
