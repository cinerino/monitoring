/**
 * mongoose接続オプション
 * @see http://mongoosejs.com/docs/api.html#index_Mongoose-connect
 */
import * as mongoose from 'mongoose';

const mongooseConnectionOptions: mongoose.ConnectionOptions = {
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

export default mongooseConnectionOptions;
