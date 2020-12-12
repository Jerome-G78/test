// Imports
const jwt = require('jsonwebtoken');

// Initialiser la clé de signature JWT (64)
const JWT_SIGN_SECRET = '3^3GWE6_!2jWD&kk?ad3-6Hp9=g6xsR/4)3+eFUk/Q/kUc/9Yh5E(xX4eD8]48W!';

// Exported function
module.exports = {
    generateTokenForUser: function(userData){
        // Signer le token
        return jwt.sign({
            // Dans ce 'Payload' on renseigne les éléments :
            userId: userData.id,
            isAdmin : userData.isAdmin 
        },
        // génération & paramètrage du TOKEN
        JWT_SIGN_SECRET,
        {
            // Durée de validité
            expiresIn: '12h'
        })
    },

    parseAuthorization: function(authorisation){
        // On verifie si la chaine n'est pas null, si tel est le cas on remplace "Bearer "
        // par une chaine vide pour récupérer le Token.
        return (authorisation !=null) ? authorisation.replace('Bearer ','') :null;
    },

    getUserId: function(authorisation){
        // Récupérer l'ID de l'utilisateur
        // Fixer la variable userId à -1 pour être sûr que la requête ne pointe pas nulle part. 
        let userId = -1;

        // Récupérer le module parseAuthorization dans la variable token
        let token = module.exports.parseAuthorization(authorisation);
        
        if(token!= null){
            try{
                // verifier si le token est valide
                let jwtToken = jwt.verify(token, JWT_SIGN_SECRET);
                if(jwtToken !=null)
                    userId = jwtToken.userId;
            } catch(err){

            }
            // Si tout va bien, retourner l'userID
            return userId;
        }
    }
}