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
    const gmoNotificationAdapter = sskts.adapter.gmoNotification(mongoose.connection);
    const gmoNotifications = <IGMONotification4ScatterChart[]>await gmoNotificationAdapter.gmoNotificationModel.find(
        {
            job_cd: 'SALES',
            tran_date: {
                // tslint:disable-next-line:no-magic-numbers
                $gte: moment().add(-3, 'day').format('YYYYMMDDHHmmss'),
                $lt: moment().format('YYYYMMDDHHmmss')
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
        chxt: 'x,y',
        // tslint:disable-next-line:no-magic-numbers
        chds: `0,24,0,${maxAmount + 2000}`,
        chd: 't:',
        chls: '5,0,0',
        // tslint:disable-next-line:no-magic-numbers
        chxr: `0,0,24,1|1,0,${maxAmount + 2000}`,
        chdl: '金額',
        chs: '300x100'
    };
    // tslint:disable-next-line:no-magic-numbers
    params.chd += gmoNotifications.map((gmoNotification) => gmoNotification.tran_date.slice(8, 10)).join(',');
    params.chd += '|' + gmoNotifications.map((gmoNotification) => gmoNotification.amount).join(',');
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
        'GMO実売上集計',
        '',
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
            totalAmount: gmoSales.reduce((a, b) => a + b.amount, 0) // 合計金額を算出
        };
    }));
    aggregations = aggregations.reverse();
    debug('aggregations:', aggregations);

    const params = {
        chof: 'png',
        cht: 'ls',
        chxt: 'x,y',
        chds: 'a',
        chd: 't:',
        chls: '5,0,0',
        chxl: '0:|',
        chdl: '金額',
        chs: '300x100'
    };
    params.chd += aggregations.map((agrgegation) => agrgegation.totalAmount).join(',');
    params.chxl += '24時間前|18時間前|12時間前|6時間前|0時間前'; // x軸
    const imageThumbnail = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
    debug('imageThumbnail:', imageThumbnail);
    params.chs = '750x250';
    const imageFullsize = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;

    const lastAggregation = aggregations[aggregations.length - 1];

    await sskts.service.notification.report2developers(
        `GMO実売上集計\n${moment(lastAggregation.dateFrom).format('MM/DD HH:mm:ss')}-${moment(lastAggregation.dateTo).format('MM/DD HH:mm:ss')}`,
        `取引数: ${lastAggregation.gmoSales.length}
合計金額: ${lastAggregation.totalAmount}`,
        imageThumbnail,
        imageFullsize
    )();
}
