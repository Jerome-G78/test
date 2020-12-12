// Imports
let bcrypt = require('bcrypt');
let jwtUtils = require('../utils/jwt.utils');
let models = require('../models');
let asyncLib = require('async');
let fs = require('fs');
const { where } = require('sequelize/types');

// Regex
const EMAIL_REGEX = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/;
const PASSWORD_REGEX = /^(?=.*\d).{4,8}$/;

// Routes

module.exports = {
  register: function(req, res, next){
    // Params
    /* 
        Récupération des paramètres envoyés dans la requête
    */
    let email = req.body.email;
    let username = req.body.username;
    let password = req.body.password;
    let bio = req.body.bio;

    // Vérification si les données obligatoires sont bien récupérés
    if(email == null || username == null || password == null){
      return res.status(400).json({'error':'missing parameters'});
    }

    // Vérification des variables envoyés

    // Si le pseudo est égal ou plus grand que 13, ou inferrieur ou égal à 4 on rejette la demande
    if (username.length >= 16 || username.length <= 4){
      return res.status(400).json({'error':'username must be length 5 - 15'});
    }

    // Verification de l'adresse E-Mail via le Regex
    if (!EMAIL_REGEX.test(email)){
        return res.status(400).json({'error':'email is not valid'});
    }

    // Verification du mot de passe via le Regex
    if (!PASSWORD_REGEX.test(password)){
        return res.status(400).json({'error':'Password must be between 4 and 8 digits long and include at least one numeric digit.'});
    }

    // Après verifications, Ajout de l'utilisateur dans la base de données

    // L'utilisateur existe-t-il dans la base ? (promesse)
       
    asyncLib.waterfall([
      function(done) {
        models.User.findOne({
          attributes: ['email'],
          where: { email: email }
        })
        .then(function(userFound) {
          done(null, userFound);
        })
        .catch(function(err) {
          return res.status(500).json({ 'error': 'unable to verify user' });
        });
      },
      function(userFound, done) {
        if (!userFound) {
          bcrypt.hash(password, 5, function( err, bcryptedPassword ) {
            done(null, userFound, bcryptedPassword);
          });
        } else {
          return res.status(409).json({ 'error': 'user already exist' });
        }
      },
      function(userFound, bcryptedPassword, done) {
        let newUser = models.User.create({
          email: email,
          username: username,
          password: bcryptedPassword,
          bio: bio,
          isAdmin: 0
        })
        .then(function(newUser) {
          done(newUser);
        })
        .catch(function(err) {
          return res.status(500).json({ 'error': 'cannot add user' });
        });
      }
    ], 
    function(newUser) {
      if (newUser) {
        return res.status(201).json({
          'userId': newUser.id
        });
      } else {
        return res.status(500).json({ 'error': 'cannot add user' });
      }
    });
  },

  login: function(req, res, next){
    // Récupération des paramètres de connexion (User & Mdp)

    let email = req.body.email;
    let password = req.body.password;

    // Vérification des variables envoyés

    if (email == null || password == null) {
        return res.status(400).json({'error':'missing parameters'});
    }

    // TODO verify mail regex & password length

    // L'utilisateur existe-t-il dans la base ? (promesse)

    asyncLib.waterfall([
      function(done) {
        models.User.findOne({
          where: { email: email }
        })
        .then(function(userFound) {
          done(null, userFound);
        })
        .catch(function(err) {
          return res.status(500).json({ 'error': 'unable to verify user' });
        });
      },
      function(userFound, done) {
        if (userFound) {
          bcrypt.compare(password, userFound.password, function(errBycrypt, resBycrypt) {
            done(null, userFound, resBycrypt);
          });
        } else {
          return res.status(404).json({ 'error': 'user not exist in DB' });
        }
      },
      function(userFound, resBycrypt, done) {
        if(resBycrypt) {
          done(userFound);
        } else {
          return res.status(403).json({ 'error': 'invalid password' });
        }
      }
    ], 
    function(userFound) {
      if (userFound) {
        return res.status(201).json({
          'userId': userFound.id,
          'token': jwtUtils.generateTokenForUser(userFound)
        });
      } else {
        return res.status(500).json({ 'error': 'cannot log on user' });
      }
    });
  },

  getUserProfile: function(req, res, next){
    // Récupération de l'en-tête d'authorisation
    let headerAuth = req.headers['authorization'];

    // Verifier que ce token est valide pour faire une requête en BDD
    let userId = jwtUtils.getUserId(headerAuth);

    // Vérifier que userId n'est pas négatif (par sécurité)
    if (userId <0)
        return res.status(400).json({'error':'wrong token'});

    // Si tout va bien, on fait un appel ORM(sequelize) pour récupérer les informations de l'utilisateur en BDD
    models.User.findOne({
        attributes: ['id', 'email', 'username', 'bio'],
        where: {id: userId}
    })
    .then(function(user){
        if(user){
            res.status(201).json(user);
        } else {
            res.status(404).json({'error':'user not found'});
        }
    })
    .catch(function(err){
        res.status(500).json({'error':'cannot fetch user'});
    });
  },

  updateUserProfile: function(req, res, next){
    // Récupération de l'en-tête d'authorisation
    let headerAuth = req.headers['authorization'];

    // Verifier que ce token est valide pour faire une requête en BDD
    let userId = jwtUtils.getUserId(headerAuth);

    // Params : Récupération des données du Frontend.
    let bio = req.body.bio;

    asyncLib.waterfall([
      function(done){
        // Récupérer l'utilisateur dans la base de données
        models.User.findOne({
            attributes: ['id', 'bio'],
            where: {id: userId}
        })
        .then(function(userFound){
            // Si l'utilisateur est trouvé, le retourner
            done(null,userFound);
        })
        .catch(function(err){
            // Sinon envoyer une erreur
            return res.status(500).json({'error':'unable to verify user'});
        });
      },
      function(userFound, done){
        // Verifier si l'utilisateur est valide
        if(userFound) {
          // Après verification, mise à jour des données concernés
          userFound.update({
              bio: (bio? bio : userFound.bio)
          })
          .then(function(){
              // Opération reussi
              done(userFound);
          })
          .catch(function(err){
              res.status(500).json({'error':'cannot update user'});
          });
        } else {
          // si celui-ci n'existe pas, retourner une erreur
          res.status(404).json({'error':'user not found'});
        }
      },
    ],
    function(userFound){
      if(userFound){
          // Mise a jour effectuée
          return res.status(201).json(userFound);
      } else {
          // Une erreur est survenue
          return res.status(500).json({'error':'cannot update user profile'});
      }
    });
  },

  deleteProfile: function(req, res, next){
    // Récupération de l'en-tête d'authorisation
    let headerAuth = req.headers['authorization'];

    // Verifier que ce token est valide pour faire une requête en BDD
    let userId = jwtUtils.getUserId(headerAuth);
    let anonId = 2;

    asyncLib.waterfall([
      function(done){
        // Récupérer l'utilisateur dans la base de données
        models.User.findOne({
          where: {id: userId}
      })
      .then(function(userFound){
        // Si l'utilisateur est rouvé, le retourner
        done(null,userFound);
      })
      .catch(function(err){
        // Sinon envoyer une erreur
        return res.status(500).json({'error':'unable to verify user', err});
      });
    },
/*
    function(userFound, done){
      // Anonimysation des messages utilisateur (Table Messages)
      models.Message.findAll({
        attributes:['id', 'userId'],
        where:{userId}
      })
      .then(function(messageFound){
        console.log(messageFound);
          done(messageFound);
      })
      .catch(function(err){
        return res.status(500).json({err});
      });
    },
*/
    function(userFound, done){
      models.User.destroy({
        where : {id : userId}
      })
      .then(function(userId){
        done(userId);
      })
      .catch(function(err){
        return res.status(500).json({'error':'unable to unsubscribe', err});
      });
    }
    ],
    function(userId){
        if(userId){
            // Désinscription effectuée
            return res.status(201).json({'message':'unsubscribe sucess'});
        } else {
            // Une erreur est survenue
            return res.status(500).json({'error':'user not found in DB'});
        }
    });
  }

}