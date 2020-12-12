'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Like extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here

      // Relation N:M, relation entre la table User et Message, via Like.
      models.User.belongsToMany(models.Message,{
        through: models.Like,
        foreignKey: 'userId',
        otherKey: 'messageId',
      });

      // Relation N:M, relation entre la table User et Message, via Like.
      models.Message.belongsToMany(models.User,{
        through: models.Like,
        foreignKey:'messageId',
        otherKey: 'userId',
      });

      // Relation entre les clés étrangères et la table de référence
      models.Like.belongsTo(models.User,{
        foreignKey:'userId',
        // utilisation d'un Alias
        as: 'user',
      });
      
      // Relation entre les clés étrangères et la table de référence
      models.Like.belongsTo(models.Message,{
        foreignKey:'messageId',
        // utilisation d'un Alias
        as: 'message',
      });
    };
  };
  Like.init({
    messageId: {
      type: DataTypes.INTEGER,
      references: {
        model: 'Message',
        key: 'id'
      }
    },

    userId: {
      type: DataTypes.INTEGER,
      references: {
        model: 'User',
        key: 'id'
      }
    }
  }, {
    sequelize,
    modelName: 'Like',
  });
  return Like;
};