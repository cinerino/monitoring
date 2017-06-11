/**
 * 測定データを作成する
 *
 * @ignore
 */

import * as sskts from '@motionpicture/sskts-domain';
import * as createDebug from 'debug';
import * as mongoose from 'mongoose';
import * as redis from 'redis';

import mongooseConnectionOptions from '../mongooseConnectionOptions';

(<any>mongoose).Promise = global.Promise;
const debug = createDebug('sskts-reportjobs:controller:createTelemetry');

export async function main() {
    debug('connecting mongodb...');
    mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions);

    const redisClient = redis.createClient({
        host: process.env.STOCK_STATUS_REDIS_HOST,
        port: process.env.STOCK_STATUS_REDIS_PORT,
        password: process.env.STOCK_STATUS_REDIS_KEY,
        tls: { servername: process.env.TEST_REDIS_HOST }
    });

    const queueAdapter = sskts.adapter.queue(mongoose.connection);
    const telemetryAdapter = sskts.adapter.telemetry(mongoose.connection);
    const transactionAdapter = sskts.adapter.transaction(mongoose.connection);
    const transactionCountAdapter = sskts.adapter.transactionCount(redisClient);
    debug('creating telemetry...');
    // todo 一時的に固定値で算出
    await sskts.service.report.createTelemetry({}, 60, 120)(queueAdapter, telemetryAdapter, transactionAdapter, transactionCountAdapter);

    redisClient.quit();
    mongoose.disconnect();
}
