/**
 * 測定データを作成する
 *
 * @ignore
 */

import * as sskts from '@motionpicture/sskts-domain';
import * as createDebug from 'debug';
import * as mongoose from 'mongoose';

import mongooseConnectionOptions from '../mongooseConnectionOptions';

(<any>mongoose).Promise = global.Promise;
const debug = createDebug('sskts-reportjobs:controller:createTelemetry');

export async function main() {
    debug('connecting mongodb...');
    mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions);

    const queueAdapter = sskts.adapter.queue(mongoose.connection);
    const telemetryAdapter = sskts.adapter.telemetry(mongoose.connection);
    const transactionAdapter = sskts.adapter.transaction(mongoose.connection);
    debug('creating telemetry...');
    await sskts.service.report.createTelemetry()(queueAdapter, telemetryAdapter, transactionAdapter);

    mongoose.disconnect();
}
