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
    // const transactionAdapter = sskts.adapter.transaction(mongoose.connection);

    const dateNow = moment();
    // tslint:disable-next-line:no-magic-numbers
    const dateTo = moment((dateNow.unix() - dateNow.unix() % 3600) * 1000).toDate();
    // tslint:disable-next-line:no-magic-numbers
    const dateFrom = moment(dateTo).add(-AGGREGATION_UNIT_TIME_IN_SECONDS, 'seconds').toDate();
    const gmoSaleses = await sskts.service.report.searchGMOSales(dateFrom, dateTo)(gmoNotificationAdapter);
    debug(dateFrom.toISOString(), dateTo.toISOString());
    // tslint:disable-next-line:no-magic-numbers
    const totalAmount = gmoSaleses.reduce((a, b) => a + parseInt(b.amount, 10), 0);

    // オーダーIDごとに有効性確認すると、コマンド過多でMongoDBにある程度の負荷をかけてしまう
    // まとめて検索してから、ローカルで有効性を確認する必要がある
    const orderIds = gmoSaleses.map((gmoSales) => gmoSales.order_id);
    const tasks = <any[]>await sskts.adapter.task(mongoose.connection).taskModel.find(
        {
            name: sskts.factory.taskName.SettleGMOAuthorization,
            'data.authorization.gmo_order_id': { $in: orderIds }
        }
    ).lean().exec();
    debug('tasks are', tasks);

    const errors: {
        title: string;
        detail: string;
    }[] = [];
    gmoSaleses.forEach((gmoSales) => {
        try {
            const taskByOrderId = tasks.find((task) => task.data.authorization.gmo_order_id === gmoSales.order_id);
            if (taskByOrderId === undefined) {
                throw new Error('task not found');
            }

            const authorization = <sskts.factory.authorization.gmo.IAuthorization>taskByOrderId.data.authorization;
            debug('authorization is', authorization);
            if (authorization.gmo_access_id !== gmoSales.access_id) {
                throw new Error('gmo_access_id not matched');
            }

            if (authorization.gmo_pay_type !== gmoSales.pay_type) {
                throw new Error('gmo_pay_type not matched');
            }

            // オーソリの金額と同一かどうか
            // tslint:disable-next-line:no-magic-numbers
            if (authorization.gmo_amount !== parseInt(gmoSales.amount, 10)) {
                throw new Error('amount not matched');
            }
        } catch (error) {
            errors.push({
                title: `${gmoSales.order_id} invalid`,
                detail: error.message
            });
        }
    });

    mongoose.disconnect();

    let result = `healthy: ${gmoSaleses.length - errors.length}/${gmoSaleses.length}
unhealthy: ${errors.length}/${gmoSaleses.length}`;
    if (errors.length > 0) {
        result += `
${errors.map((error) => `#${error.title}\n${error.detail}`).join('\n')}`
            ;
    }
    await sskts.service.notification.report2developers(
        'GMO売上健康診断',
        `${moment(dateFrom).format('M/D H:mm')}-${moment(dateTo).format('M/D H:mm')}
￥${totalAmount}
${result}`
    )();
}
