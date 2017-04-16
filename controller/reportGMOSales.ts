/**
 * GMO実売上状況を報告する
 *
 * @ignore
 */
import * as sskts from '@motionpicture/sskts-domain';
import * as createDebug from 'debug';
import * as moment from 'moment';
import * as mongoose from 'mongoose';

import mongooseConnectionOptions from '../mongooseConnectionOptions';

(<any>mongoose).Promise = global.Promise;
const debug = createDebug('sskts-reportjobs:controller:reportGMOSales');

export async function main() {
    mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions);

    // todo パラメータで期間設定できるようにする？
    // tslint:disable-next-line:no-magic-numbers
    const dateFrom = moment().add(-15, 'minutes').toDate();
    const dateTo = moment().toDate();
    const gmoNotificationAdapter = sskts.adapter.gmoNotification(mongoose.connection);
    const gmoSales = await sskts.service.report.searchGMOSales(dateFrom, dateTo)(gmoNotificationAdapter);
    debug('gmoSales:', gmoSales);

    // 合計金額を算出
    let totalAmount = 0;
    gmoSales.forEach((gmoSale) => {
        totalAmount += gmoSale.amount;
    });

    await sskts.service.notification.report2developers(
        `GMO実売上集計\n${moment(dateFrom).format('MM/DD HH:mm:ss')}-${moment(dateTo).format('MM/DD HH:mm:ss')}`,
        `取引数: ${gmoSales.length}
合計金額: ${totalAmount}`
    )();

    mongoose.disconnect();
}
