/**
 * GMO実売上状況を報告する
 *
 * @ignore
 */

import * as sskts from '@motionpicture/sskts-domain';
import * as createDebug from 'debug';
import * as moment from 'moment';
import * as mongoose from 'mongoose';
import * as querystring from 'querystring';
import * as request from 'request-promise-native';

import mongooseConnectionOptions from '../mongooseConnectionOptions';

(<any>mongoose).Promise = global.Promise;
const debug = createDebug('sskts-reportjobs:controller:reportGMOSales');

export async function main() {
    mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions);

    await reportGMOSalesAggregations();
    await reportScatterChartInAmountAndTranDate();

    mongoose.disconnect();
}

interface IGMONotification4ScatterChart {
    amount: number;
    tran_date: string;
}

/**
 * 時間帯ごとの実売上をプロットしてみる
 * todo 調整
 */
async function reportScatterChartInAmountAndTranDate() {
    // ここ24時間の実売上をプロットする
    const dateTo = moment();
    // tslint:disable-next-line:no-magic-numbers
    const dateFrom = moment(dateTo).add(-3, 'days');
    const gmoNotificationAdapter = sskts.adapter.gmoNotification(mongoose.connection);
    const gmoNotifications = <IGMONotification4ScatterChart[]>await gmoNotificationAdapter.gmoNotificationModel.find(
        {
            job_cd: 'SALES',
            tran_date: {
                // tslint:disable-next-line:no-magic-numbers
                $gte: dateFrom.format('YYYYMMDDHHmmss'),
                $lt: dateTo.format('YYYYMMDDHHmmss')
            }
        },
        'amount tran_date'
    ).lean().exec();
    debug('gmoNotifications:', gmoNotifications.length);
    const maxAmount = gmoNotifications.reduce((a, b) => Math.max(a, b.amount), 0);
    debug('maxAmount:', maxAmount);

    const params = {
        chof: 'png',
        cht: 's',
        chxt: 'x,x,y,y',
        // tslint:disable-next-line:no-magic-numbers
        chds: `0,24,0,${Math.floor(maxAmount / 100) + 20}`,
        chd: 't:',
        chls: '5,0,0',
        chxl: '1:|時|3:|百円',
        // tslint:disable-next-line:no-magic-numbers
        chxr: `0,0,24,1|2,0,${Math.floor(maxAmount / 100) + 20}`,
        // chdl: '金額',
        chs: '300x100'
    };
    // tslint:disable-next-line:no-magic-numbers
    params.chd += gmoNotifications.map((gmoNotification) => Number(gmoNotification.tran_date.slice(8, 10))).join(',');
    // tslint:disable-next-line:no-magic-numbers
    params.chd += '|' + gmoNotifications.map((gmoNotification) => Math.floor(gmoNotification.amount / 100)).join(',');
    debug('params:', params);
    const imageThumbnail = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
    let body = await request.get({
        url: `http://is.gd/create.php?format=simple&format=json&url=${encodeURIComponent(imageThumbnail)}`,
        json: true
    }).promise();
    const imageThumbnailShort = body.shorturl;
    debug('imageThumbnail:', imageThumbnail);
    params.chs = '750x250';
    const imageFullsize = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
    body = await request.get({
        url: `http://is.gd/create.php?format=simple&format=json&url=${encodeURIComponent(imageFullsize)}`,
        json: true
    }).promise();
    const imageFullsizeShort = body.shorturl;

    await sskts.service.notification.report2developers(
        `GMO売上散布図
${dateFrom.format('MM/DD HH:mm:ss')}-${dateTo.format('MM/DD HH:mm:ss')}`,
        `サンプル数:${gmoNotifications.length}`,
        imageThumbnailShort,
        imageFullsizeShort
    )();
}

async function reportGMOSalesAggregations() {
    // todo パラメータで期間設定できるようにする？
    // tslint:disable-next-line:no-magic-numbers
    const aggregationUnitTimeInSeconds = 900; // 集計単位時間(秒)
    const numberOfAggregationUnit = 96; // 集計単位数
    const dateNow = moment();
    const dateNowByUnitTime = moment.unix((dateNow.unix() - (dateNow.unix() % aggregationUnitTimeInSeconds)));

    // 集計単位数分の集計を行う
    let aggregations = await Promise.all(Array.from(Array(numberOfAggregationUnit)).map(async (__, index) => {
        debug(index);
        const dateTo = moment.unix((dateNowByUnitTime.unix() - (dateNowByUnitTime.unix() % aggregationUnitTimeInSeconds)))
            // tslint:disable-next-line:no-magic-numbers
            .add(index * -aggregationUnitTimeInSeconds, 'seconds').toDate();
        // tslint:disable-next-line:no-magic-numbers
        const dateFrom = moment(dateTo).add(-aggregationUnitTimeInSeconds, 'seconds').toDate();
        debug(dateFrom.toISOString(), dateTo.toISOString());

        const gmoNotificationAdapter = sskts.adapter.gmoNotification(mongoose.connection);
        const gmoSales = await sskts.service.report.searchGMOSales(dateFrom, dateTo)(gmoNotificationAdapter);

        return {
            dateFrom: dateFrom,
            dateTo: dateTo,
            gmoSales: gmoSales,
            // tslint:disable-next-line:no-magic-numbers
            totalAmount: gmoSales.reduce((a, b) => a + parseInt(b.amount, 10), 0) // 合計金額を算出
        };
    }));
    aggregations = aggregations.reverse();
    debug('aggregations:', aggregations);

    const params = {
        chof: 'png',
        cht: 'ls',
        chxt: 'x,y,y',
        chds: 'a',
        chd: 't:',
        chls: '5,0,0',
        chxl: '0:|24時間前|18時間前|12時間前|6時間前|0時間前|2:|円',
        // chdl: '金額',
        chs: '300x100'
    };
    params.chd += aggregations.map((agrgegation) => agrgegation.totalAmount).join(',');
    const imageThumbnail = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
    debug('imageThumbnail:', imageThumbnail);
    params.chs = '750x250';
    const imageFullsize = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;

    const lastAggregation = aggregations[aggregations.length - 1];

    await sskts.service.notification.report2developers(
        `GMO売上金額遷移(15分単位)
${moment(aggregations[0].dateFrom).format('MM/DD HH:mm:ss')}-${moment(lastAggregation.dateTo).format('MM/DD HH:mm:ss')}`,
        '',
        imageThumbnail,
        imageFullsize
    )();
}
