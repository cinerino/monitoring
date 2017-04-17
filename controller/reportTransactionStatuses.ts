/**
 * 取引ステータス集計を報告する
 *
 * @ignore
 */
import * as sskts from '@motionpicture/sskts-domain';
import * as createDebug from 'debug';
import * as moment from 'moment';
import * as mongoose from 'mongoose';

import mongooseConnectionOptions from '../mongooseConnectionOptions';

(<any>mongoose).Promise = global.Promise;
const debug = createDebug('sskts-reportjobs:controller:reportTransactionStatuses');

export async function main() {
    debug('connecting mongodb...');
    mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions);

    const queueAdapter = sskts.adapter.queue(mongoose.connection);
    const transactionAdapter = sskts.adapter.transaction(mongoose.connection);
    debug('creating a report...');
    const report = await sskts.service.report.transactionStatuses()(queueAdapter, transactionAdapter);
    await sskts.service.notification.report2developers(
        `取引集計\n${moment().format('MM/DD HH:mm:ss')}`,
        `取引在庫数: ${report.numberOfTransactionsReady}
進行中取引数: ${report.numberOfTransactionsUnderway}
未キュー取引数(成立): ${report.numberOfTransactionsClosedWithQueuesUnexported}
未キュー取引数(期限切れ): ${report.numberOfTransactionsExpiredWithQueuesUnexported}
未実行キュー数: ${report.numberOfQueuesUnexecuted}`
    )();

    mongoose.disconnect();
}
