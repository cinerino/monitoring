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
    const aggregationUnitTimeInSeconds = 60; // 集計単位時間(秒)
    const numberOfAggregationUnit = 30; // 集計単位数
    const dateNow = moment();
    const dateNowByUnitTime = moment.unix((dateNow.unix() - (dateNow.unix() % aggregationUnitTimeInSeconds)));

    // 集計単位数分の集計を行う
    let telemetries = await Promise.all(Array.from(Array(numberOfAggregationUnit)).map(async (__, index) => {
        const executedAt = moment.unix((dateNowByUnitTime.unix() - (dateNowByUnitTime.unix() % aggregationUnitTimeInSeconds)))
            // tslint:disable-next-line:no-magic-numbers
            .add(index * -aggregationUnitTimeInSeconds, 'seconds').toDate();

        const telemetryAdapter = sskts.adapter.telemetry(mongoose.connection);
        const telemetry = await telemetryAdapter.telemetryModel.findOne(
            { executed_at: executedAt }
        ).exec();

        return (telemetry !== null) ? <ITelemetry>telemetry.toObject() : null;
    }));
    telemetries = telemetries.reverse();
    debug('telemetries:', telemetries);

    mongoose.disconnect();

    const params = {
        chof: 'png',
        cht: 'ls',
        chxt: 'x,y',
        chds: 'a',
        chd: 't:',
        chls: '5,0,0',
        chxl: '0:|',
        chdl: '取引在庫|進行取引|未実行キュー',
        chs: '300x100'
    };
    params.chd += telemetries.map((telemetry) => (telemetry !== null) ? telemetry.transactions.numberOfReady : '').join(',');
    params.chd += '|' + telemetries.map((telemetry) => (telemetry !== null) ? telemetry.transactions.numberOfUnderway : '').join(',');
    params.chd += '|' + telemetries.map((telemetry) => (telemetry !== null) ? telemetry.queues.numberOfUnexecuted : '').join(',');
    // params.chxl += '24時間前|18時間前|12時間前|6時間前|0時間前'; // x軸
    const imageThumbnail = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
    debug('imageThumbnail:', imageThumbnail);
    params.chs = '750x250';
    const imageFullsize = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;

    await sskts.service.notification.report2developers(
        '測定データ報告',
        `データ数: ${telemetries.length}`,
        imageThumbnail,
        imageFullsize
    )();
}
