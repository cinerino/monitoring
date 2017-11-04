/**
 * 測定データを報告する
 * @ignore
 */

import * as sskts from '@motionpicture/sskts-domain';
import * as createDebug from 'debug';
import * as moment from 'moment';
import * as request from 'request-promise-native';

import mongooseConnectionOptions from '../mongooseConnectionOptions';

const debug = createDebug('sskts-monitoring-jobs:controller:createTelemetry');
const KILOSECONDS = 1000;
const defaultParams = {
    chco: 'DAA8F5',
    chf: 'bg,s,283037',
    chof: 'png',
    cht: 'ls',
    chds: 'a',
    chdls: 'a1a6a9,12',
    chls: '1,0,0|1,0,0|1,0,0',
    chxs: '0,a1a6a9,12|1,a1a6a9,12|2,a1a6a9,12'
};

type ITelemetry = sskts.service.report.ITelemetry;

// tslint:disable-next-line:max-func-body-length
export async function main() {
    debug('connecting mongodb...');
    sskts.mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);

    // 集計単位数分の集計を行う
    const telemetryUnitTimeInSeconds = 60; // 集計単位時間(秒)
    const numberOfAggregationUnit = 720; // 集計単位数
    const dateNow = moment();
    const dateNowByUnitTime = moment.unix(dateNow.unix() - (dateNow.unix() % telemetryUnitTimeInSeconds));

    // 基本的に、集計は別のジョブでやっておいて、この報告ジョブでは取得して表示するだけのイメージ
    // tslint:disable-next-line:no-magic-numbers
    const measuredFrom = moment(dateNowByUnitTime).add(numberOfAggregationUnit * -telemetryUnitTimeInSeconds, 'seconds');

    debug('reporting telemetries measuredFrom - dateTo...', measuredFrom, dateNowByUnitTime);
    const telemetryRepo = new sskts.repository.Telemetry(sskts.mongoose.connection);
    const telemetries = await sskts.service.report.searchTelemetries({
        measuredFrom: measuredFrom.toDate(),
        measuredThrough: dateNowByUnitTime.toDate()
    })(telemetryRepo);
    debug('telemetries length:', telemetries.length);

    sskts.mongoose.disconnect();

    await reportLatenciesOfTasks(telemetries); // タスク待機時間
    await reportNumberOfTrialsOfTasks(telemetries); // タスク試行回数
    await reportNumberOfTransactionsByStatuses(telemetries); // ステータスごとの取引数
    await reportTransactionRequiredTimes(telemetries); // 平均所要時間
    await reportTransactionAmounts(telemetries); // 平均金額
    await reportTransactionActions(telemetries); // 平均アクション数
    await reportNumberOfTransactionsUnderway(telemetries);
    await reportNumberOfTasksUnexecuted(telemetries);
}

/**
 * タスク実行試行回数を報告する
 */
async function reportNumberOfTrialsOfTasks(telemetries: ITelemetry[]) {
    const params = {
        ...defaultParams, ...{
            chco: '79F67D,79CCF5,E96C6C',
            chxt: 'x,y,y',
            chd: 't:',
            chxl: '0:|12時間前|9時間前|6時間前|3時間前|0時間前|2:|回',
            chdl: '平均|最大|最小',
            chs: '750x250'
        }
    };
    params.chd += telemetries.map(
        (telemetry) => {
            return (telemetry.flow.tasks !== undefined && telemetry.flow.tasks.numberOfExecuted > 0)
                ? Math.floor(telemetry.flow.tasks.totalNumberOfTrials / telemetry.flow.tasks.numberOfExecuted)
                : 0;
        }
    ).join(',');
    // tslint:disable-next-line:prefer-template
    params.chd += '|' + telemetries.map(
        (telemetry) => (telemetry.flow.tasks !== undefined) ? telemetry.flow.tasks.maxNumberOfTrials : 0
    ).join(',');
    // tslint:disable-next-line:prefer-template
    params.chd += '|' + telemetries.map(
        (telemetry) => (telemetry.flow.tasks !== undefined) ? telemetry.flow.tasks.minNumberOfTrials : 0
    ).join(',');
    const imageFullsize = await publishUrl(params);
    debug('imageFullsize:', imageFullsize);

    await sskts.service.notification.report2developers(
        'タスク実行試行回数',
        '',
        imageFullsize,
        imageFullsize
    )();
}

/**
 * タスク待ち時間を報告する
 */
async function reportLatenciesOfTasks(telemetries: ITelemetry[]) {
    const params = {
        ...defaultParams, ...{
            chco: '79F67D,79CCF5,E96C6C',
            chxt: 'x,y,y',
            chd: 't:',
            chxl: '0:|12時間前|9時間前|6時間前|3時間前|0時間前|2:|秒',
            chdl: '平均|最大|最小',
            chs: '750x250'
        }
    };
    params.chd += telemetries.map(
        (telemetry) => {
            return (telemetry.flow.tasks !== undefined && telemetry.flow.tasks.numberOfExecuted > 0)
                ? Math.floor(telemetry.flow.tasks.totalLatencyInMilliseconds / telemetry.flow.tasks.numberOfExecuted / KILOSECONDS)
                : 0;
        }
    ).join(',');
    // tslint:disable-next-line:prefer-template
    params.chd += '|' + telemetries.map(
        (telemetry) => (telemetry.flow.tasks !== undefined) ? Math.floor(telemetry.flow.tasks.maxLatencyInMilliseconds / KILOSECONDS) : 0
    ).join(',');
    // tslint:disable-next-line:prefer-template
    params.chd += '|' + telemetries.map(
        (telemetry) => (telemetry.flow.tasks !== undefined) ? Math.floor(telemetry.flow.tasks.minLatencyInMilliseconds / KILOSECONDS) : 0
    ).join(',');
    const imageFullsize = await publishUrl(params);
    debug('imageFullsize:', imageFullsize);

    await sskts.service.notification.report2developers(
        'タスク待ち時間',
        '',
        imageFullsize,
        imageFullsize
    )();
}

/**
 * 状態別の取引数を報告する
 */
async function reportNumberOfTransactionsByStatuses(telemetries: ITelemetry[]) {
    const params = {
        ...defaultParams, ...{
            chco: '79F67D,79CCF5,E96C6C',
            chxt: 'x,y',
            chd: 't:',
            chxl: '0:|12時間前|9時間前|6時間前|3時間前|0時間前|2:|個',
            chdl: '開始|成立|離脱',
            chs: '750x250'
        }
    };
    params.chd += telemetries.map((telemetry) => telemetry.flow.transactions.numberOfStarted).join(',');
    params.chd += `|${telemetries.map((telemetry) => telemetry.flow.transactions.numberOfConfirmed).join(',')}`;
    params.chd += `|${telemetries.map((telemetry) => telemetry.flow.transactions.numberOfExpired).join(',')}`;
    const imageFullsize = await publishUrl(params);
    debug('imageFullsize:', imageFullsize);

    await sskts.service.notification.report2developers(
        '開始取引数/minute 成立取引数/minute 離脱取引数/minute',
        '',
        imageFullsize,
        imageFullsize
    )();
}

/**
 * 取引所要時間を報告する
 */
async function reportTransactionRequiredTimes(telemetries: ITelemetry[]) {
    const params = {
        ...defaultParams, ...{
            chco: 'DAA8F5',
            chxt: 'x,y',
            chd: 't:',
            chxl: '0:|12時間前|9時間前|6時間前|3時間前|0時間前|2:|秒',
            chdl: '所要時間',
            chs: '750x250'
        }
    };
    params.chd += telemetries.map(
        (telemetry) => Math.floor(telemetry.flow.transactions.averageRequiredTimeInMilliseconds / KILOSECONDS) // ミリ秒→秒変換
    ).join(',');
    const imageFullsize = await publishUrl(params);
    debug('imageFullsize:', imageFullsize);

    await sskts.service.notification.report2developers(
        '取引所要時間平均値(秒)',
        '',
        imageFullsize,
        imageFullsize
    )();
}

/**
 * 取引金額を報告する
 */
async function reportTransactionAmounts(telemetries: ITelemetry[]) {
    const params = {
        ...defaultParams, ...{
            chco: 'DAA8F5',
            chxt: 'x,y',
            chd: 't:',
            chxl: '0:|12時間前|9時間前|6時間前|3時間前|0時間前|2:|JPY',
            chdl: '金額',
            chs: '750x250'
        }
    };
    params.chd += telemetries.map(
        (telemetry) => telemetry.flow.transactions.averageAmount
    ).join(',');
    const imageFullsize = await publishUrl(params);
    debug('imageFullsize:', imageFullsize);

    await sskts.service.notification.report2developers(
        '取引金額平均値/minute',
        '',
        imageFullsize,
        imageFullsize
    )();
}

/**
 * 取引アクション数を報告する
 */
async function reportTransactionActions(telemetries: ITelemetry[]) {
    const params = {
        ...defaultParams, ...{
            chco: '79CCF5,E96C6C',
            chxt: 'x,y',
            chd: 't:',
            chxl: '0:|12時間前|9時間前|6時間前|3時間前|0時間前|2:|個',
            chdl: '成立|離脱',
            chs: '750x250'
        }
    };
    params.chd += telemetries.map((telemetry) => telemetry.flow.transactions.averageNumberOfActionsOnConfirmed).join(',');
    params.chd += `|${telemetries.map((telemetry) => telemetry.flow.transactions.averageNumberOfActionsOnExpired).join(',')}`;
    const imageFullsize = await publishUrl(params);
    debug('imageFullsize:', imageFullsize);

    await sskts.service.notification.report2developers(
        '取引アクション数平均値/minute',
        '',
        imageFullsize,
        imageFullsize
    )();
}

/**
 * 進行中取引数を報告する
 */
async function reportNumberOfTransactionsUnderway(telemetries: ITelemetry[]) {
    const params = {
        ...defaultParams, ...{
            chco: 'DAA8F5',
            chxt: 'x,y',
            chd: 't:',
            chxl: '0:|12時間前|9時間前|6時間前|3時間前|0時間前',
            chdl: '進行取引',
            chs: '750x250'
        }
    };
    params.chd += telemetries.map((telemetry) => telemetry.stock.transactions.numberOfUnderway).join(',');
    const imageFullsize = await publishUrl(params);

    await sskts.service.notification.report2developers(
        '時点での進行中取引数',
        '',
        imageFullsize,
        imageFullsize
    )();
}

/**
 * 未実行タスク数を報告する
 */
async function reportNumberOfTasksUnexecuted(telemetries: ITelemetry[]) {
    const params = {
        ...defaultParams, ...{
            chco: 'DAA8F5',
            chxt: 'x,y',
            chd: 't:',
            chxl: '0:|12時間前|9時間前|6時間前|3時間前|0時間前',
            chdl: 'タスク',
            chs: '750x250'
        }
    };
    params.chd += telemetries.map(
        (telemetry) => (telemetry.stock.tasks !== undefined) ? telemetry.stock.tasks.numberOfUnexecuted : 0
    ).join(',');
    const imageFullsize = await publishUrl(params);

    await sskts.service.notification.report2developers(
        '時点でのタスク数',
        '',
        imageFullsize,
        imageFullsize
    )();
}

/**
 * URL短縮
 *
 * @param {string} originalUrl 元のURL
 * @returns {Promise<string>}
 */
// async function shortenUrl(originalUrl: string): Promise<string> {
//     return await request.get({
//         url: 'https://is.gd/create.php',
//         qs: {
//             format: 'json',
//             url: originalUrl
//         },
//         json: true
//     }).then((body) => <string>body.shorturl);
// }

async function publishUrl(params: any) {
    // google chart apiで画像生成
    const buffer = await request.post({
        url: 'https://chart.googleapis.com/chart',
        form: params,
        encoding: 'binary'
    }).then((body) => new Buffer(body, 'binary'));
    debug('creating block blob... buffer.length:', buffer.length);

    return sskts.service.util.uploadFile({
        fileName: `sskts-monitoring-jobs-reportTelemetry-images-${moment().format('YYYYMMDDHHmmssSSS')}.png`,
        text: buffer,
        expiryDate: moment().add(1, 'hour').toDate()
    })();
}
