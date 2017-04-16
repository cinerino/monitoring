/**
 * GMO実売上の健康診断を実施する
 *
 * @ignore
 */
import * as createDebug from 'debug';
import * as Controller from '../../../../controller/checkHealthOfGMOSales';

const debug = createDebug('sskts-reportjobs:jobs:checkHealthOfGMOSales:run');

Controller.main().then(() => {
    debug('success!');
}).catch((err) => {
    console.error(err);
    process.exit(1);
});
