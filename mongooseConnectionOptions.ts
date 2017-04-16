/**
 * mongoose接続オプション
 *
 * @ignore
 */
const options = {
    server: {
        socketOptions: {
            autoReconnect: true,
            keepAlive: 120000,
            connectTimeoutMS: 30000,
            socketTimeoutMS: 0
        },
        reconnectTries: 30,
        reconnectInterval: 1000
    },
    replset: {
        socketOptions: {
            keepAlive: 120000,
            connectTimeoutMS: 30000
        }
    }
};

export default options;
