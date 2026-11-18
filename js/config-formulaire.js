/* Qamar — réglage de l'envoi des formulaires (devis et contact).
   ------------------------------------------------------------------
   Ce fichier est public : n'y mettez JAMAIS de clé secrète ni de mot de passe.
   Les services ci-dessous n'en ont pas besoin : l'identifiant Formspree et
   l'adresse FormSubmit sont faits pour être visibles dans une page web.

   service :
     'aucun'      → mode démonstration : rien n'est envoyé, le visiteur est prévenu
                    et peut nous écrire directement par e-mail (valeur par défaut).
     'formsubmit' → https://formsubmit.co, sans compte. À la toute première demande,
                    FormSubmit écrit à l'adresse ci-dessous pour faire activer le
                    formulaire ; tant que ce n'est pas fait, le visiteur voit une erreur.
     'formspree'  → https://formspree.io, avec un compte gratuit : créez un formulaire
                    qui envoie à qamar-conception@gmail.com et copiez son identifiant.
     'api'        → votre futur serveur (voir PRELANCEMENT.md, « Passer à un backend »).

   Voir PRELANCEMENT.md pour la marche à suivre pas à pas. */
window.QAMAR_FORMULAIRE = {
  service: 'aucun',
  destinataire: 'qamar-conception@gmail.com',
  formspreeId: '',   // À RENSEIGNER si service: 'formspree' (ex. la partie après /f/ dans l'adresse donnée par Formspree)
  apiUrl: ''         // À RENSEIGNER si service: 'api' (ex. https://api.votre-domaine.fr/demandes)
};
