'use strict';
const loader = require('./sequelize-loader');
const Sequelize = loader.Sequelize;

// データモデルの sync 関数が呼ばれた際に、
// これらの設定にもとづいて SQL の CREATE TABLE が実行され、
// データベースとの対応が取れるようになる
const User = loader.database.define('users', {
  userId: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    allowNull: false
  },
  username: {
    type: Sequelize.STRING,
    allowNull: false
  }
}, {
  // freezeTableName は、テーブルという定義したデータを保存する領域の名前を
  // User という名前に固定するという設定
  freezeTableName: true,
  // 自動的に createdAt という作成日時と
  // updatedAt という更新日時を自動的に追加する設定 true なら自動で追加する
  timestamps: false
});

module.exports = User;