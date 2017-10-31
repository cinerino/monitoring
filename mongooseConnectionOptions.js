"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * mongoose接続オプション
 * @see http://mongoosejs.com/docs/api.html#index_Mongoose-connect
 * @see　http://mongodb.github.io/node-mongodb-native/2.2/api/MongoClient.html
 * @ignore
 */
const mongooseConnectionOptions = {
    useMongoClient: true,
    autoReconnect: true,
    keepAlive: 120000,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 0,
    reconnectTries: 30,
    reconnectInterval: 1000
};
exports.default = mongooseConnectionOptions;
