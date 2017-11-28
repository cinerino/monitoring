/**
 * 測定データ報告
 * @ignore
 */
import * as createDebug from 'debug';
import * as Controller from '../../../../controller/reportFlowTelemetry';

const debug = createDebug('sskts-monitoring-jobs');

Controller.main().then(() => {
    debug('success!');
}).catch((err) => {
    console.error(err);
    process.exit(1);
});
