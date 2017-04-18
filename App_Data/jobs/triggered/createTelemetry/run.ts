/**
 * 測定データを作成する
 *
 * @ignore
 */
import * as createDebug from 'debug';
import * as Controller from '../../../../controller/createTelemetry';

const debug = createDebug('sskts-reportjobs:jobs:createTelemetry:run');

Controller.main().then(() => {
    debug('success!');
}).catch((err) => {
    console.error(err);
    process.exit(1);
});
