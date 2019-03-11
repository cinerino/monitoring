/**
 * 測定データ報告
 */
import * as createDebug from 'debug';
import * as Controller from '../../../controller/reportStockTelemetry';

const debug = createDebug('cinerino-monitoring');

Controller.main()
    .then(() => {
        debug('success!');
    })
    .catch((err) => {
        // tslint:disable-next-line:no-console
        console.error(err);
        process.exit(1);
    });
