"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongooseConnectionOptions = {
    autoIndex: false,
    autoReconnect: true,
    keepAlive: true,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 0,
    reconnectTries: 30,
    reconnectInterval: 1000,
    useCreateIndex: true,
    useFindAndModify: false,
    useNewUrlParser: true
};
exports.default = mongooseConnectionOptions;
