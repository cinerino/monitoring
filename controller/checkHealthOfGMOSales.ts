/**
 * GMO実売上の健康診断を実施する
 *
 * @ignore
 */

import * as sskts from '@motionpicture/sskts-domain';
import * as createDebug from 'debug';
import * as moment from 'moment';
import * as mongoose from 'mongoose';

import mongooseConnectionOptions from '../mongooseConnectionOptions';

(<any>mongoose).Promise = global.Promise;
const debug = createDebug('sskts-reportjobs:controller:checkHealthOfGMOSales');
/**
 * 集計の時間単位(秒)
 */
const AGGREGATION_UNIT_TIME_IN_SECONDS = 86400;

export async function main() {
    mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);
    const gmoNotificationAdapter = sskts.adapter.gmoNotification(mongoose.connection);
    const transactionAdapter = sskts.adapter.transaction(mongoose.connection);

    const dateNow = moment();
    // tslint:disable-next-line:no-magic-numbers
    const dateTo = moment((dateNow.unix() - dateNow.unix() % 3600) * 1000).toDate();
    // tslint:disable-next-line:no-magic-numbers
    const dateFrom = moment(dateTo).add(-AGGREGATION_UNIT_TIME_IN_SECONDS, 'seconds').toDate();
    const gmoSales = await sskts.service.report.searchGMOSales(dateFrom, dateTo)(gmoNotificationAdapter);
    debug(dateFrom.toISOString(), dateTo.toISOString());
    const totalAmount = gmoSales.reduce((a, b) => a + parseInt(b.amount, 10), 0);

    // オーダーIDごとに有効性確認
    const errors: {
        title: string;
        detail: string;
    }[] = [];
    await Promise.all(gmoSales.map(async (gmoSale) => {
        try {
            await sskts.service.report.examineGMOSales(gmoSale)(transactionAdapter);
        } catch (error) {
            errors.push({
                title: `${gmoSale.order_id} invalid`,
                detail: error.message
            });
        }
    }));

    mongoose.disconnect();

    await sskts.service.notification.report2developers(
        `GMO実売上健康診断結果\n${moment(dateFrom).format('MM/DD HH:mm:ss')}-${moment(dateTo).format('MM/DD HH:mm:ss')}`,
        `取引数:${gmoSales.length}
合計金額:￥${totalAmount}
${(errors.length > 0) ? errors.map((error) => `#${error.title}\n${error.detail}`).join('\n') : 'healthy'}`
    )();
}
