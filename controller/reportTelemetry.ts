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

import mongooseConnectionOptions from '../mongooseConnectionOptions';

(<any>mongoose).Promise = global.Promise;
const debug = createDebug('sskts-reportjobs:controller:createTelemetry');

interface ITelemetry {
    executed_at: Date;
    queues: {
        numberOfUnexecuted: number;
    };
    transactions: {
        numberOfReady: number;
        numberOfUnderway: number;
        numberOfClosedWithQueuesUnexported: number;
        numberOfExpiredWithQueuesUnexported: number;
    };
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
            executed_at: {
                $gt: dateFrom,
                $lte: dateTo
            }
        }
    ).sort({ executed_at: -1 }).lean().exec();
    debug('telemetries:', telemetries.length);

    mongoose.disconnect();

    await reportNumberOfTransactionsReady(telemetries);
    await reportNumberOfTransactionsUnderway(telemetries);
    await reportNumberOfTransactionsWithQueuesUnexported(telemetries);
    await reportNumberOfQueuesUnexported(telemetries);
}

async function reportNumberOfTransactionsReady(telemetries: ITelemetry[]) {
    const params = {
        chof: 'png',
        cht: 'ls',
        chxt: 'x,y',
        chds: 'a',
        chd: 't:',
        chls: '5,0,0',
        chxl: '0:|',
        chdl: '取引在庫',
        // chdl: '取引在庫|進行取引|未実行キュー',
        chs: '90x30'
    };
    params.chd += telemetries.map((telemetry) => telemetry.transactions.numberOfReady).join(',');
    // params.chxl += '24時間前|18時間前|12時間前|6時間前|0時間前'; // x軸
    const imageThumbnail = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
    debug('imageThumbnail:', imageThumbnail);
    params.chs = '750x250';
    const imageFullsize = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;

    await sskts.service.notification.report2developers(
        '測定データ報告 取引在庫',
        '',
        imageThumbnail,
        imageFullsize
    )();
}

async function reportNumberOfTransactionsUnderway(telemetries: ITelemetry[]) {
    const params = {
        chof: 'png',
        cht: 'ls',
        chxt: 'x,y',
        chds: 'a',
        chd: 't:',
        chls: '5,0,0',
        chxl: '0:|',
        chdl: '進行取引',
        chs: '90x30'
    };
    params.chd += telemetries.map((telemetry) => telemetry.transactions.numberOfUnderway).join(',');
    // params.chxl += '24時間前|18時間前|12時間前|6時間前|0時間前'; // x軸
    const imageThumbnail = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
    debug('imageThumbnail:', imageThumbnail);
    params.chs = '750x250';
    const imageFullsize = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;

    await sskts.service.notification.report2developers(
        '測定データ報告 進行取引',
        '',
        imageThumbnail,
        imageFullsize
    )();
}

async function reportNumberOfTransactionsWithQueuesUnexported(telemetries: ITelemetry[]) {
    const params = {
        chof: 'png',
        cht: 'ls',
        chxt: 'x,y',
        chds: 'a',
        chd: 't:',
        chls: '5,0,0',
        chxl: '0:|',
        chdl: '未キュー成立取引',
        chs: '90x30'
    };
    params.chd += telemetries.map((telemetry) => telemetry.transactions.numberOfClosedWithQueuesUnexported).join(',');
    // params.chxl += '24時間前|18時間前|12時間前|6時間前|0時間前'; // x軸
    const imageThumbnail = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
    debug('imageThumbnail:', imageThumbnail);
    params.chs = '750x250';
    const imageFullsize = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;

    await sskts.service.notification.report2developers(
        '測定データ報告 未キュー成立取引',
        '',
        imageThumbnail,
        imageFullsize
    )();
}

async function reportNumberOfQueuesUnexported(telemetries: ITelemetry[]) {
    const params = {
        chof: 'png',
        cht: 'ls',
        chxt: 'x,y',
        chds: 'a',
        chd: 't:',
        chls: '5,0,0',
        chxl: '0:|',
        chdl: 'キュー',
        chs: '90x30'
    };
    params.chd += telemetries.map((telemetry) => telemetry.queues.numberOfUnexecuted).join(',');
    // params.chxl += '24時間前|18時間前|12時間前|6時間前|0時間前'; // x軸
    const imageThumbnail = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
    debug('imageThumbnail:', imageThumbnail);
    params.chs = '750x250';
    const imageFullsize = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;

    await sskts.service.notification.report2developers(
        '測定データ報告 キュー',
        '',
        imageThumbnail,
        imageFullsize
    )();
}
