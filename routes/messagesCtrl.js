// Imports
let models = require('../models');
let asyncLib = require('async');
let jwtUtils = require('../utils/jwt.utils');
let fs = require('fs');

// Constants
const TITLE_LIMIT = 2;
const CONTENT_LIMIT = 4;
// Routes

module.exports = {
    createMessage: function(req, res, next){
        // Récupération de l'en-tête d'authorisation
        let headerAuth = req.headers['authorization'];

        // Verifier que ce token est valide pour faire une requête en BDD
        let userId = jwtUtils.getUserId(headerAuth);

        // Params (recupération du title & du contenue) et de l'image si existante
        let title = req.body.title;
        let content = req.body.content;
        let image = req.body.image;
        let attachment = req.body.attachment;
        let mediaUrl = "";
        
        if(attachment == 1){
            // Renseigner le chemin du stockage de l'image
            mediaUrl = `${req.protocol}://${req.get('host')}/images/${req.file.filename}`;
        }

        // Verification de données non null & cohérente
        if (title == null || content == null){
            return res.status(400).json({'error':'invalid parameters'})
        }

        if (title.length <= TITLE_LIMIT || content.length <= CONTENT_LIMIT){
            return res.status(400).json({'error':'invalid parameters'})
        }

        asyncLib.waterfall([
            // Récupérer l'utilisateur dans la base de données (correspondant au token)
            // Function (callback)
            function(done){
                models.User.findOne({
                    where: {id: userId}
                })
                .then(function(userFound){
                    // Si l'utilisateur est trouvé, on continue (premier paramètre null)
                    done(null, userFound);
                })
                .catch(function(err){
                    // Sinon, on retourne une erreur
                    return res.status(500).json({'error':'unable to verify user'});
                });
            },
            function(userFound, done){
                if(userFound){
                    models.Message.create({
                        title : title,
                        content : content,
                        attachment : mediaUrl,
                        like : 0,
                        UserId : userFound.id
                    })
                    .then(function(newMessage){
                        // Si tout c'est bien passé, le message est envoyé.
                        done(newMessage);
                    })
                    .catch(function(err){
                        // En d'erreur serveur, un message d'erreur est retourné.
                        return res.status(500).json({'error':'unable to create message in DB'});
                    });
                } else {
                    // En cas de problème, un message d'erreur est retourné.
                    res.status(404).json({'error':'user not found'});
                }
            },
        ],
        function(newMessage){
            if(newMessage){
                // post du message OK
                return res.status(201).json(newMessage);
            } else {
                // Le message n'est pas passé.
                return res.status(500).json({'error':'cannot post message'});
            }
        });
    },

    moderateMessage: function(req, res, next){
        // Récupération de l'en-tête d'authorisation
        let headerAuth = req.headers['authorization'];

        // Verifier que ce token est valide pour faire une requête en BDD
        let userId = jwtUtils.getUserId(headerAuth);

        // Params (recupération du title & du contenue) & de l'état Admin.
        let title = req.body.title;
        let content = req.body.content;
    
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
                    return res.status(500).json({'error':'unable to verify user'});
                });
            },

            function(userFound, done){
                // Verifier si l'utilisateur dispose des droits admin
                models.User.findOne({
                    attributes : ['isAdmin'],
                    where : {isAdmin: userFound.isAdmin}
                })
                .then(function(userFound){
                    if(userFound.isAdmin == true){
                    console.log(userFound.isAdmin);
                    done(null, userFound);
                    } else {
                        return res.status(403).json({'error':'you do not have sufficient privileges'});
                    }
                })
                .catch(function(err){
                    return res.status(500).json({err});
                });
            },

            function(userFound, done){
                // Récupérer l'id du message concerné
                let messageId = parseInt(req.params.messageId);

                models.Message.findOne({
                    attributes: ['id', 'title', 'content'],
                    where : {id: messageId}
                })
                .then(function(messageId){
                    // Si le message est trouvé, procéder a la modification

                    messageId.update({
                        title : (title? title : userFound.title),
                        content : (content? content : userFound.content)
                        // attachment : attachment,
                    })
                    .then(function(moderateMessage){
                        // Si tout c'est bien passé, le message est envoyé.
                        done(moderateMessage.id);
                    })
                    .catch(function(err){
                        console.log(messageId);
                        // En cas d'erreur serveur, un message d'erreur est retourné.
                        return res.status(500).json({'error':'unable to modify message in DB'});
                    });
                })
                .catch(function(err){
                    // En d'erreur serveur, un message d'erreur est retourné.
                    return res.status(404).json({'error':'message not found'});
                });

            },

        ], function(moderateMessage){
            if(moderateMessage){
                // put du message OK
                return res.status(201).json({'Message':'Moderate message number' + moderateMessage});
            } else {
                // Le message n'est pas passé.
                return res.status(500).json({'error':'cannot put message'});
            }
        });
    },

    listMessage: function(req, res, next){
        // Récupération des paramètres dans l'Url
        // fields, permet de selectionner les collones a afficher
        // limit & offset, permet de récupérer les messages par ségmentation (pour limiter la qté)
        // Order, sert a sortir les messages via un ordre particulier
        let fields = req.query.fields;
        let limit = parseInt(req.query.limit);
        let offset = parseInt(req.query.offset);
        let order = req.query.order;

        // Récupération de tous les messages via findAll
        models.Message.findAll({
            // Verification des entrées utilisateurs, si vide mettre des données par défaut.
            order: [(order != null) ? order.split(':'):['title','ASC']],
            attributes : (fields !== '*' && fields != null) ? fields.split(',') :null,
            limit: (!isNaN(limit)) ? limit : null,
            offset: (!isNaN(offset)) ? offset : null,

            // Inclusion de la table User
            include: [{
                model: models.User,
                attributes: ['username']
            }]
        })
        .then(function(messages){
            // Verification non null
            if(messages){
                // retour des données en json
                res.status(200).json(messages);
            } else {
                res.status(404).json({'error':'no messages found'});
            }
        })
        .catch(function(err){
            console.log(err);
            res.status(500).json({'error':'invalid fields'});
        });
    },

    deleteMessage: function(req, res, next){
        // Récupération de l'en-tête d'authorisation
        let headerAuth = req.headers['authorization'];

        // Verifier que ce token est valide pour faire une requête en BDD
        let userId = jwtUtils.getUserId(headerAuth);

        // Récupération des paramètres
        let messageId = parseInt(req.params.messageId);

        asyncLib.waterfall([
            // Récupérer l'utilisateur dans la base de données (correspondant au token)
            function(done){
                models.User.findOne({
                    where: {id: userId}
                })
                .then(function(userFound){
                    // Si l'utilisateur est trouvé, on continue (premier paramètre null)
                    done(null, userFound);
                })
                .catch(function(err){
                    // Sinon, on retourne une erreur
                    return res.status(500).json({'error':'unable to verify user'});
                });
            },

            function(userFound, done){
                // Verifier si l'utilisateur dispose des droits admin
                models.User.findOne({
                    attributes : ['isAdmin'],
                    where : {isAdmin: userFound.isAdmin}
                })
                .then(function(userFound){
                    if(userFound.isAdmin == true){
                    done(null, userFound);
                    } else {
                        return res.status(403).json({'error':'you do not have sufficient privileges'});
                    }
                })
                .catch(function(err){
                    return res.status(500).json({err});
                });
            },

            function(userFound ,done){
                // S'il y a des likes liée au messages, il seront supprimés.
                if(messageId){
                    models.Like.destroy({
                        where: {messageId : messageId}
                    })
                    .then(function(userFound){
                        done(null, userFound);
                    })
                    .catch(function(err){
                        return res.status(500).json({'error':'unable to remove Likes in DB'});
                    })
                } else {
                    done(null, userFound);
                }
            },
/*            
            // WIP
            function(userFound, done){
                // Suppression des images uploadés (si presentes)
                models.Message.findOne({
                    attributes : ['attachment'],
                    where : {userId}
                })
                .then(function(userFound){
                    let filename = Message.attachment.split('/images/')[1];
                    fs.unlink(`images/${filename}`);
                    done(null, userFound);
                })
                .catch(function(err){
                    return res.status(500).json({'error':'unable to delete file! - ' + err});
                })
            },
*/
            function(userFound, done){
                // Récupérer l'id du message concerné

                if(messageId){
                    models.Message.destroy({
                        where : {id: messageId}
                    })
                    .then(function(deleteMessage){
                        // Si tout c'est bien passé, un information de réussite est envoyée.
                        done(deleteMessage);
                    })
                    .catch(function(err){
                        // En cas de problème, un message d'erreur est retourné.
                        res.status(500).json({'error':'unable to delete message in DB'});
                    });
                } else {
                    // En cas de problème, un message d'erreur est retourné.
                    res.status(404).json({'error':'message not found'});
                }
            },

        ], function(deleteMessage){
            if(deleteMessage){
                // delete du message OK
                return res.status(201).json({'message':'message deleted successfully'});
            } else {
                // Le message n'est pas présent.
                return res.status(500).json({'error':'message not found'});
            }
        });
    },

    putMyMessage: function(req, res, next){
        // Récupération de l'en-tête d'authorisation
        let headerAuth = req.headers['authorization'];

        // Verifier que ce token est valide pour faire une requête en BDD
        let userId = jwtUtils.getUserId(headerAuth);

        // Params (recupération du title & du contenue) et de l'image si existante
        let messageId = parseInt(req.params.messageId);
        let title = req.body.title;
        let content = req.body.content;
        let image = req.body.image;
        let attachment = req.body.attachment;
        let mediaUrl = "";
        
        if(attachment == 1){
            // Renseigner le chemin du stockage de l'image
            mediaUrl = `${req.protocol}://${req.get('host')}/images/${req.file.filename}`;
        }

        // Verification de données non null & cohérente
        if (title == null || content == null){
            return res.status(400).json({'error':'invalid parameters'})
        }

        if (title.length <= TITLE_LIMIT || content.length <= CONTENT_LIMIT){
            return res.status(400).json({'error':'invalid parameters'})
        }

        asyncLib.waterfall([
            // Récupérer l'utilisateur dans la base de données (correspondant au token)
            // Function (callback)
            function(done){
                models.User.findOne({
                    where: {id: userId}
                })
                .then(function(userFound){
                    // Si l'utilisateur est trouvé, on continue (premier paramètre null)
                    done(null, userFound);
                })
                .catch(function(err){
                    // Sinon, on retourne une erreur
                    return res.status(500).json({'error':'unable to verify user'});
                });
            },

            function(userFound, done){
                // Récupération de l'ID du message
                models.Message.findOne({
                    where: {id : messageId}
                })
                .then(function(messageFound){
                    // Si trouvé, il est comparé a l'UserId
                    if(messageFound.UserId == userFound.id){
                        done(null, messageFound.id);
                    } else {
                        // Sinon, on retourne une erreur d'accès
                        return res.status(403).json({'error':'this is not your message.'});
                    }
                })
                .catch(function(err){
                    // Sinon, on retourne une erreur serveur
                    return res.status(500).json({'error':'faillure - ' + err});
                });
            },

            function(userFound, done){
                // Récupérer l'id du message concerné

                models.Message.findOne({
                    attributes: ['id', 'title', 'content', 'attachment'],
                    where : {id: messageId}
                })
                .then(function(messageId){
                    // Si le message est trouvé, procéder a la modification

                    messageId.update({
                        title : (title? title : userFound.title),
                        content : (content? content : userFound.content),
                        attachment : (mediaUrl? mediaUrl : mediaUrl)
                    })
                    .then(function(putMessage){
                        // Si tout c'est bien passé, le message est envoyé.
                        done(putMessage.id);
                    })
                    .catch(function(err){
                        console.log(messageId);
                        // En cas d'erreur serveur, un message d'erreur est retourné.
                        return res.status(500).json({'error':'unable to modify message in DB'});
                    });
                })
                .catch(function(err){
                    // En d'erreur serveur, un message d'erreur est retourné.
                    return res.status(404).json({'error':'message not found'});
                });
            },
        ],
        function(putMessage){
            if(putMessage){
                // post du message OK
                return res.status(201).json({'Message':'Modified message number : ' + putMessage});
            } else {
                // Le message n'est pas passé.
                return res.status(500).json({'error':'cannot put message'});
            }
        });
    },

    deleteMyMessage: function(req, res, next){
        // Récupération de l'en-tête d'authorisation
        let headerAuth = req.headers['authorization'];

        // Verifier que ce token est valide pour faire une requête en BDD
        let userId = jwtUtils.getUserId(headerAuth);

        // Récupération des paramètres
        let messageId = parseInt(req.params.messageId);

        asyncLib.waterfall([
            // Récupérer l'utilisateur dans la base de données (correspondant au token)
            function(done){
                models.User.findOne({
                    where: {id: userId}
                })
                .then(function(userFound){
                    // Si l'utilisateur est trouvé, on continue (premier paramètre null)
                    done(null, userFound);
                })
                .catch(function(err){
                    // Sinon, on retourne une erreur
                    return res.status(500).json({'error':'unable to verify user'});
                });
            },

            function(userFound, done){
                // Récupération de l'ID du message
                models.Message.findOne({
                    where: {id : messageId}
                })
                .then(function(messageFound){
                    // Si trouvé, il est comparé a l'UserId
                    if(messageFound.UserId == userFound.id){
                        done(null, messageFound.id);
                    } else {
                        // Sinon, on retourne une erreur d'accès
                        return res.status(403).json({'error':'this is not your message.'});
                    }
                })
                .catch(function(err){
                    // Sinon, on retourne une erreur serveur
                    return res.status(500).json({'error':'faillure - ' + err});
                });
            },

            function(messageFound ,done){
                // S'il y a des likes liée au messages, il seront supprimés.
                if(messageFound.id == messageId){
                    models.Like.destroy({
                        where: {messageId : messageId}
                    })
                    .then(function(messageFound){
                        console.log(messageFound.id);
                        console.log('done');
                        done(null, messageFound);
                    })
                    .catch(function(err){
                        return res.status(500).json({'error':'unable to remove Likes in DB'});
                    })
                } else {
                    console.log(messageFound);
                    done(null, messageFound);
                }
            },

            function(messageFound, done){
                // Récupérer l'id du message concerné
                if(messageId){
                    models.Message.destroy({
                        where : {id: messageFound}
                    })
                    .then(function(deleteMessage){
                        // Si tout c'est bien passé, un information de réussite est envoyée.
                        done(deleteMessage);
                    })
                    .catch(function(err){
                        // En cas de problème, un message d'erreur est retourné.
                        res.status(500).json({'error':'unable to delete message in DB'});
                    });
                } else {
                    // En cas de problème, un message d'erreur est retourné.
                    res.status(404).json({'error':'message not found'});
                }
            },

        ], function(deleteMessage){
            if(deleteMessage){
                // delete du message OK
                return res.status(201).json({'message':'message deleted successfully'});
            } else {
                // Le message n'est pas présent.
                return res.status(500).json({'error':'message not found'});
            }
        });
    }
}