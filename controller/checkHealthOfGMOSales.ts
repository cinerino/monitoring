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

export async function main() {
    mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions);
    const gmoNotificationAdapter = sskts.adapter.gmoNotification(mongoose.connection);

    // 15分単位での直近の日時を取得
    const aggregationUnitTimeInSeconds = 900;
    const dateNow = moment();
    // tslint:disable-next-line:no-magic-numbers
    const dateTo = moment((dateNow.unix() - dateNow.unix() % aggregationUnitTimeInSeconds) * 1000).toDate();
    // tslint:disable-next-line:no-magic-numbers
    const dateFrom = moment(dateTo).add(-aggregationUnitTimeInSeconds, 'seconds').toDate();
    // const dateTo = moment().toDate();
    const gmoSales = await sskts.service.report.searchGMOSales(dateFrom, dateTo)(gmoNotificationAdapter);
    debug(dateFrom.toISOString(), dateTo.toISOString());

    // オーダーIDごとに有効性確認
    const errors: {
        title: string;
        detail: string;
    }[] = [];
    await Promise.all(gmoSales.map(async (gmoSale) => {
        try {
            await compareGMOOrderIdWithTransaction(gmoSale.order_id, gmoSale.amount);
        } catch (error) {
            errors.push({
                title: `${gmoSale.order_id} invalid`,
                detail: error.message
            });
        }
    }));

    mongoose.disconnect();

    let content = '';
    if (errors.length > 0) {
        errors.forEach((error) => {
            content += `${error.title}\n${error.detail}`;
        });
    } else {
        content = 'healthy';
    }

    await sskts.service.notification.report2developers(
        `GMO実売上健康診断結果\n${moment(dateFrom).format('MM/DD HH:mm:ss')}-${moment(dateTo).format('MM/DD HH:mm:ss')}`,
        content
    )();
}

/**
 * GMOオーダーIDとDBの取引を比較する
 *
 * @param {string} orderId GMOオーダーID
 * @param {number} amount 金額
 */
export async function compareGMOOrderIdWithTransaction(orderId: string, amount: number) {
    const transactionAdapter = sskts.adapter.transaction(mongoose.connection);

    // オーダーIDからCOA予約番号を取得
    // tslint:disable-next-line:no-magic-numbers
    const reserveNum = parseInt(orderId.slice(11, 19), 10);
    debug('reserveNum:', reserveNum);
    if (!Number.isInteger(reserveNum)) {
        throw new Error('invalid orderId');
    }

    const transactionDoc = await transactionAdapter.transactionModel.findOne(
        {
            status: sskts.factory.transactionStatus.CLOSED,
            'inquiry_key.reserve_num': reserveNum
        },
        '_id'
    ).exec();
    debug('transactionDoc:', transactionDoc);

    if (transactionDoc === null) {
        throw new Error('transaction not found');
    }

    const authorizations = await transactionAdapter.findAuthorizationsById(transactionDoc.get('id'));
    const gmoAuthorizationObject = authorizations.find((authorization) => authorization.group === sskts.factory.authorizationGroup.GMO);

    // GMOオーソリがなければ異常
    if (gmoAuthorizationObject === undefined) {
        throw new Error('gmo authorization not found');
    }
    const gmoAuthorization = sskts.factory.authorization.gmo.create(<any>gmoAuthorizationObject);
    debug('gmoAuthorization:', gmoAuthorization);

    // オーソリのオーダーIDと同一かどうか
    if (gmoAuthorization.gmo_order_id !== orderId) {
        throw new Error('order_id not matched');
    }

    // オーソリの金額と同一かどうか
    if (gmoAuthorization.price !== amount) {
        throw new Error('amount not matched');
    }
}
