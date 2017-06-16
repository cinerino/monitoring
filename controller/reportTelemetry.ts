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
    await reportNumberOfTransactionsUnderway(telemetries);
    await reportNumberOfTransactionsWithQueuesUnexported(telemetries);
}

async function reportNumberOfTransactionsStarted(telemetries: ITelemetry[]) {
    const params = {
        chco: '00A5C6',
        chof: 'png',
        cht: 'ls',
        chxt: 'x,y',
        chds: 'a',
        chd: 't:',
        chls: '5,0,0',
        chxl: '0:|1時間前|50分前|40分前|30分前|20分前|10分前|現在',
        chdl: '開始取引',
        // chdl: '取引在庫|進行取引|未実行キュー',
        chs: '150x50'
    };
    params.chd += telemetries.map((telemetry) => telemetry.flow.transactions.numberOfStarted).join(',');
    const imageThumbnail = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
    debug('imageThumbnail:', imageThumbnail);
    params.chs = '750x250';
    const imageFullsize = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;

    await sskts.service.notification.report2developers(
        '測定データ報告 開始取引',
        '',
        imageThumbnail,
        imageFullsize
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
        '測定データ報告 進行取引',
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
        '測定データ報告 未実行キュー',
        '',
        imageThumbnail,
        imageFullsize
    )();
}
