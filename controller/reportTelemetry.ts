/**
 * 測定データを報告する
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
const debug = createDebug('sskts-reportjobs:controller:createTelemetry');

interface IFlow {
    transactions: {
        /**
         * 集計期間中に開始された取引数
         */
        numberOfStarted: number;
        /**
         * 集計期間中に成立した取引数
         */
        numberOfClosed: number;
        /**
         * 集計期間中に期限切れになった取引数
         */
        numberOfExpired: number;
        /**
         * 取引の合計所要時間(ミリ秒)
         */
        totalRequiredTimeInMilliseconds: number;
        /**
         * 取引の最大所要時間(ミリ秒)
         */
        maxRequiredTimeInMilliseconds: number;
        /**
         * 取引の最小所要時間(ミリ秒)
         */
        minRequiredTimeInMilliseconds: number;
        /**
         * 取引の合計金額(yen)
         */
        totalAmount: number;
        /**
         * 取引の合計金額(yen)
         */
        maxAmount: number;
        /**
         * 取引の合計金額(yen)
         */
        minAmount: number;
    };
    queues: {
        /**
         * 集計期間中に作成されたキュー数
         */
        numberOfCreated: number;
    };
    measured_from: Date;
    measured_to: Date;
}

/**
 * ストックデータ
 *
 * @interface IStock
 * @see https://en.wikipedia.org/wiki/Stock_and_flow
 */
interface IStock {
    transactions: {
        numberOfUnderway: number;
    };
    queues: {
        numberOfUnexecuted: number;
    };
    measured_at: Date;
}

interface ITelemetry {
    flow: IFlow;
    stock: IStock;
}

export async function main() {
    debug('connecting mongodb...');
    mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions);

    // todo パラメータで期間設定できるようにする？
    // tslint:disable-next-line:no-magic-numbers
    const telemetryUnitTimeInSeconds = 60; // 集計単位時間(秒)
    const numberOfAggregationUnit = 60; // 集計単位数
    const dateNow = moment();
    const dateNowByUnitTime = moment.unix((dateNow.unix() - (dateNow.unix() % telemetryUnitTimeInSeconds)));

    // 集計単位数分の集計を行う
    // tslint:disable-next-line:max-line-length
    const dateFrom = moment.unix(dateNow.unix() - (dateNow.unix() % telemetryUnitTimeInSeconds) - (telemetryUnitTimeInSeconds * numberOfAggregationUnit)).toDate();
    const dateTo = dateNowByUnitTime.toDate();
    debug('dateFrom:', dateFrom);
    debug('dateTo:', dateTo);
    const telemetryAdapter = sskts.adapter.telemetry(mongoose.connection);
    const telemetries = <ITelemetry[]>await telemetryAdapter.telemetryModel.find(
        {
            'stock.measured_at': {
                $gt: dateFrom,
                $lte: dateTo
            }
        }
    ).sort({ 'stock.measured_at': 1 }).lean().exec();
    debug('telemetries:', telemetries.length);

    mongoose.disconnect();

    await reportNumberOfTransactionsStarted(telemetries);
    await reportTransactionAmounts(telemetries);
    await reportTransactionRequiredTimes(telemetries);
    await reportNumberOfTransactionsUnderway(telemetries);
    await reportNumberOfTransactionsWithQueuesUnexported(telemetries);
}

async function reportNumberOfTransactionsStarted(telemetries: ITelemetry[]) {
    const params = {
        chco: '00FF00,0000FF,FF0000',
        chof: 'png',
        cht: 'ls',
        chxt: 'x,y',
        chds: 'a',
        chd: 't:',
        chls: '2,0,0|2,0,0|2,0,0',
        chxl: '0:|1時間前|50分前|40分前|30分前|20分前|10分前|現在',
        chdl: '開始|成立|離脱',
        chs: '150x50'
    };
    params.chd += telemetries.map((telemetry) => telemetry.flow.transactions.numberOfStarted).join(',');
    params.chd += '|' + telemetries.map((telemetry) => telemetry.flow.transactions.numberOfClosed).join(',');
    params.chd += '|' + telemetries.map((telemetry) => telemetry.flow.transactions.numberOfExpired).join(',');
    const imageThumbnail = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
    const imageThumbnailShort = await request.get({
        url: `http://is.gd/create.php?format=simple&format=json&url=${encodeURIComponent(imageThumbnail)}`,
        json: true
    }).promise().then((body) => {
        return body.shorturl;
    });
    debug('imageThumbnailShort:', imageThumbnailShort);

    params.chs = '750x250';
    const imageFullsize = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
    debug('imageFullsize:', imageFullsize);
    const imageFullsizeShort = await request.get({
        url: `http://is.gd/create.php?format=simple&format=json&url=${encodeURIComponent(imageFullsize)}`,
        json: true
    }).promise().then((body) => {
        return body.shorturl;
    });
    debug('imageFullsizeShort:', imageFullsizeShort);

    await sskts.service.notification.report2developers(
        '開始取引数/分 成立取引数/分 離脱取引数/分',
        '',
        imageThumbnailShort,
        imageFullsizeShort
    )();
}

async function reportTransactionRequiredTimes(telemetries: ITelemetry[]) {
    // 互換性維持のため、期待通りのデータのみにフィルター
    telemetries = telemetries.filter((telemetry) => (telemetry.flow.transactions.totalAmount !== undefined));

    const params = {
        chco: '00FF00',
        chof: 'png',
        cht: 'ls',
        // chxt: 'x,y,r',
        chxt: 'x,y',
        // chxr: `1,0,${maxAmount}|2,0,${maxRequiredTime}`,
        // chds: `0,${maxAmount},0,${maxRequiredTime}`,
        chds: 'a',
        chd: 't:',
        chls: '5,0,0',
        chxl: '0:|1時間前|50分前|40分前|30分前|20分前|10分前|現在',
        chdl: '所要時間',
        chs: '150x50'
    };
    params.chd += telemetries.map(
        (telemetry) => Math.floor(
            // tslint:disable-next-line:no-magic-numbers ミリ秒→秒変換
            telemetry.flow.transactions.totalRequiredTimeInMilliseconds / telemetry.flow.transactions.numberOfClosed / 1000
        )
    ).join(',');
    const imageThumbnail = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
    const imageThumbnailShort = await request.get({
        url: `http://is.gd/create.php?format=simple&format=json&url=${encodeURIComponent(imageThumbnail)}`,
        json: true
    }).promise().then((body) => {
        return body.shorturl;
    });
    debug('imageThumbnailShort:', imageThumbnailShort);

    params.chs = '750x250';
    const imageFullsize = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
    debug('imageFullsize:', imageFullsize);
    const imageFullsizeShort = await request.get({
        url: `http://is.gd/create.php?format=simple&format=json&url=${encodeURIComponent(imageFullsize)}`,
        json: true
    }).promise().then((body) => {
        return body.shorturl;
    });
    debug('imageFullsizeShort:', imageFullsizeShort);

    await sskts.service.notification.report2developers(
        '取引平均所要時間(秒)',
        '',
        imageThumbnailShort,
        imageFullsizeShort
    )();
}

async function reportTransactionAmounts(telemetries: ITelemetry[]) {
    // 互換性維持のため、期待通りのデータのみにフィルター
    telemetries = telemetries.filter((telemetry) => (telemetry.flow.transactions.totalAmount !== undefined));

    const params = {
        chco: '00FF00',
        chof: 'png',
        cht: 'ls',
        chxt: 'x,y',
        chds: 'a',
        chd: 't:',
        chls: '5,0,0',
        chxl: '0:|1時間前|50分前|40分前|30分前|20分前|10分前|現在',
        chdl: '金額',
        chs: '150x50'
    };
    params.chd += telemetries.map(
        (telemetry) => Math.floor(telemetry.flow.transactions.totalAmount / telemetry.flow.transactions.numberOfClosed)
    ).join(',');
    const imageThumbnail = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
    const imageThumbnailShort = await request.get({
        url: `http://is.gd/create.php?format=simple&format=json&url=${encodeURIComponent(imageThumbnail)}`,
        json: true
    }).promise().then((body) => {
        return body.shorturl;
    });
    debug('imageThumbnailShort:', imageThumbnailShort);

    params.chs = '750x250';
    const imageFullsize = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
    debug('imageFullsize:', imageFullsize);
    const imageFullsizeShort = await request.get({
        url: `http://is.gd/create.php?format=simple&format=json&url=${encodeURIComponent(imageFullsize)}`,
        json: true
    }).promise().then((body) => {
        return body.shorturl;
    });
    debug('imageFullsizeShort:', imageFullsizeShort);

    await sskts.service.notification.report2developers(
        '取引平均金額/分',
        '',
        imageThumbnailShort,
        imageFullsizeShort
    )();
}

async function reportNumberOfTransactionsUnderway(telemetries: ITelemetry[]) {
    const params = {
        chco: '00A5C6',
        chof: 'png',
        cht: 'ls',
        chxt: 'x,y',
        chds: 'a',
        chd: 't:',
        chls: '5,0,0',
        chxl: '0:|1時間前|50分前|40分前|30分前|20分前|10分前|現在',
        chdl: '進行取引',
        chs: '150x50'
    };
    params.chd += telemetries.map((telemetry) => telemetry.stock.transactions.numberOfUnderway).join(',');
    const imageThumbnail = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
    debug('imageThumbnail:', imageThumbnail);
    params.chs = '750x250';
    const imageFullsize = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;

    await sskts.service.notification.report2developers(
        '時点での進行中取引数',
        '',
        imageThumbnail,
        imageFullsize
    )();
}

async function reportNumberOfTransactionsWithQueuesUnexported(telemetries: ITelemetry[]) {
    const params = {
        chco: '00A5C6',
        chof: 'png',
        cht: 'ls',
        chxt: 'x,y',
        chds: 'a',
        chd: 't:',
        chls: '5,0,0',
        chxl: '0:|1時間前|50分前|40分前|30分前|20分前|10分前|現在',
        chdl: 'キュー',
        chs: '150x50'
    };
    params.chd += telemetries.map((telemetry) => telemetry.stock.queues.numberOfUnexecuted).join(',');
    // params.chd += '|' + telemetries.map((telemetry) => telemetry.transactions.numberOfClosedWithQueuesUnexported).join(',');
    const imageThumbnail = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
    debug('imageThumbnail:', imageThumbnail);
    params.chs = '750x250';
    const imageFullsize = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;

    await sskts.service.notification.report2developers(
        '時点でのキュー数',
        '',
        imageThumbnail,
        imageFullsize
    )();
}
