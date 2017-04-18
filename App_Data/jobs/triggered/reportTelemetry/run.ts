/**
 * 測定データ報告
 *
 * @ignore
 */
import * as createDebug from 'debug';
import * as Controller from '../../../../controller/reportTelemetry';

const debug = createDebug('sskts-reportjobs:jobs:reportTelemetry:run');

Controller.main().then(() => {
    debug('success!');
}).catch((err) => {
    console.error(err);
    process.exit(1);
});
