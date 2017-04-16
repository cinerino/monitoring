/**
 * 取引ステータス集計を報告する
 *
 * @ignore
 */
import * as createDebug from 'debug';
import * as Controller from '../../../../controller/reportTransactionStatuses';

const debug = createDebug('sskts-reportjobs:jobs:reportTransactionStatuses:run');

Controller.main().then(() => {
    debug('success!');
}).catch((err) => {
    console.error(err);
    process.exit(1);
});
