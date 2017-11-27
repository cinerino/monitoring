/**
 * 測定データを報告する
 * @ignore
 */

import * as sskts from '@motionpicture/sskts-domain';
import * as createDebug from 'debug';
import * as moment from 'moment';
import * as request from 'request-promise-native';

import mongooseConnectionOptions from '../mongooseConnectionOptions';

const debug = createDebug('sskts-monitoring-jobs');
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

type IGlobalFlowTelemetry = sskts.service.report.telemetry.IGlobalFlowTelemetry;
type ISellerFlowTelemetry = sskts.service.report.telemetry.ISellerFlowTelemetry;

// tslint:disable-next-line:max-func-body-length
export async function main() {
    debug('connecting mongodb...');
    sskts.mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);

    // 集計単位数分の集計を行う
    const telemetryUnitTimeInSeconds = 60; // 集計単位時間(秒)
    const numberOfAggregationUnit = 720; // 集計単位数
    // tslint:disable-next-line:no-magic-numbers
    const dateNow = moment().add(-30, 'minutes');
    const dateNowByUnitTime = moment.unix(dateNow.unix() - (dateNow.unix() % telemetryUnitTimeInSeconds));

    // 基本的に、集計は別のジョブでやっておいて、この報告ジョブでは取得して表示するだけのイメージ
    // tslint:disable-next-line:no-magic-numbers
    const measuredFrom = moment(dateNowByUnitTime).add(numberOfAggregationUnit * -telemetryUnitTimeInSeconds, 'seconds');

    debug('reporting telemetries measuredFrom - dateTo...', measuredFrom, dateNowByUnitTime);
    const organizationRepo = new sskts.repository.Organization(sskts.mongoose.connection);
    const telemetryRepo = new sskts.repository.Telemetry(sskts.mongoose.connection);

    const movieTheaters = await organizationRepo.searchMovieTheaters({});

    const globalTelemetries = await sskts.service.report.telemetry.searchGlobalFlow({
        measuredFrom: measuredFrom.toDate(),
        measuredThrough: dateNowByUnitTime.toDate()
    })(telemetryRepo);
    debug('globalTelemetries length:', globalTelemetries.length);

    const sellerTelemetries = await sskts.service.report.telemetry.searchSellerFlow({
        measuredFrom: measuredFrom.toDate(),
        measuredThrough: dateNowByUnitTime.toDate()
    })(telemetryRepo);
    debug('sellerTelemetries length:', sellerTelemetries.length);

    sskts.mongoose.disconnect();

    await reportLatenciesOfTasks(globalTelemetries); // タスク待機時間
    await reportNumberOfTrialsOfTasks(globalTelemetries); // タスク試行回数

    // 販売者ごとにレポート送信
    await Promise.all(movieTheaters.map(async (movieTheater) => {
        debug('reporting...seller:', movieTheater.id);
        const telemetriesBySellerId = sellerTelemetries.filter((telemetry) => telemetry.object.sellerId === movieTheater.id);
        await reportNumberOfTransactionsByStatuses(movieTheater.name.ja, telemetriesBySellerId); // ステータスごとの取引数
        await reportConfirmedRatio(movieTheater.name.ja, telemetriesBySellerId);
        await reportTimeLeftUntilEvent(movieTheater.name.ja, telemetriesBySellerId);
        await reportTransactionRequiredTimes(movieTheater.name.ja, telemetriesBySellerId); // 平均所要時間
        await reportTransactionAmounts(movieTheater.name.ja, telemetriesBySellerId); // 平均金額
        await reportTransactionActions(movieTheater.name.ja, telemetriesBySellerId); // 平均アクション数
    }));
}

/**
 * タスク実行試行回数を報告する
 */
async function reportNumberOfTrialsOfTasks(telemetries: IGlobalFlowTelemetry[]) {
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
            return (telemetry.result.tasks !== undefined && telemetry.result.tasks.numberOfExecuted > 0)
                ? Math.floor(telemetry.result.tasks.totalNumberOfTrials / telemetry.result.tasks.numberOfExecuted)
                : 0;
        }
    ).join(',');
    // tslint:disable-next-line:prefer-template
    params.chd += '|' + telemetries.map(
        (telemetry) => (telemetry.result.tasks !== undefined) ? telemetry.result.tasks.maxNumberOfTrials : 0
    ).join(',');
    // tslint:disable-next-line:prefer-template
    params.chd += '|' + telemetries.map(
        (telemetry) => (telemetry.result.tasks !== undefined) ? telemetry.result.tasks.minNumberOfTrials : 0
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
async function reportLatenciesOfTasks(telemetries: IGlobalFlowTelemetry[]) {
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
            const result = telemetry.result;

            return (result.tasks !== undefined && result.tasks.numberOfExecuted > 0)
                ? Math.floor(result.tasks.totalLatencyInMilliseconds / result.tasks.numberOfExecuted / KILOSECONDS)
                : 0;
        }
    ).join(',');
    // tslint:disable-next-line:prefer-template
    params.chd += '|' + telemetries.map(
        (telemetry) => {
            return (telemetry.result.tasks !== undefined)
                ? Math.floor(telemetry.result.tasks.maxLatencyInMilliseconds / KILOSECONDS)
                : 0;
        }
    ).join(',');
    // tslint:disable-next-line:prefer-template
    params.chd += '|' + telemetries.map(
        (telemetry) => {
            return (telemetry.result.tasks !== undefined)
                ? Math.floor(telemetry.result.tasks.minLatencyInMilliseconds / KILOSECONDS)
                : 0;
        }
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
async function reportNumberOfTransactionsByStatuses(sellerName: string, telemetries: ISellerFlowTelemetry[]) {
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
    params.chd += telemetries.map((telemetry) => telemetry.result.transactions.numberOfStarted).join(',');
    params.chd += `|${telemetries.map((telemetry) => telemetry.result.transactions.numberOfConfirmed).join(',')}`;
    params.chd += `|${telemetries.map((telemetry) => telemetry.result.transactions.numberOfExpired).join(',')}`;
    const imageFullsize = await publishUrl(params);
    debug('imageFullsize:', imageFullsize);

    await sskts.service.notification.report2developers(
        `${sellerName}\n分あたりの開始取引数\n分あたりの成立取引数\n分あたりの離脱取引数`,
        '',
        imageFullsize,
        imageFullsize
    )();
}

/**
 * 取引成立率を報告する
 */
async function reportConfirmedRatio(sellerName: string, telemetries: ISellerFlowTelemetry[]) {
    const params = {
        ...defaultParams, ...{
            chco: 'DAA8F5',
            chxt: 'x,y',
            chd: 't:',
            chxl: '0:|12時間前|9時間前|6時間前|3時間前|0時間前|2:|個',
            chdl: '取引成立率',
            chs: '750x250'
        }
    };
    params.chd += telemetries.map(
        (telemetry) => {
            const data = telemetry.result.transactions;

            return (data.numberOfStartedAndConfirmed > 0 && data.numberOfStarted > 0)
                // tslint:disable-next-line:no-magic-numbers
                ? Math.floor(100 * data.numberOfStartedAndConfirmed / data.numberOfStarted)
                : 0;
        }
    ).join(',');
    const imageFullsize = await publishUrl(params);
    debug('imageFullsize:', imageFullsize);

    await sskts.service.notification.report2developers(
        `${sellerName}\n分ごとの取引成立率`,
        '',
        imageFullsize,
        imageFullsize
    )();
}

/**
 * イベント開始日時と取引成立日時の差を報告する
 */
async function reportTimeLeftUntilEvent(sellerName: string, telemetries: ISellerFlowTelemetry[]) {
    const params = {
        ...defaultParams, ...{
            chco: 'E96C6C,79CCF5,79F67D',
            chxt: 'x,y,y',
            chd: 't:',
            chxl: '0:|12時間前|9時間前|6時間前|3時間前|0時間前|2:|時間',
            chdl: '最大|平均|最小',
            chs: '750x250'
        }
    };

    const HOUR_IN_MILLISECONDS = 3600000;
    params.chd += telemetries.map(
        (telemetry) => Math.floor(telemetry.result.transactions.maxTimeLeftUntilEventInMilliseconds / HOUR_IN_MILLISECONDS)
    ).join(',');
    // tslint:disable-next-line:prefer-template
    params.chd += '|' + telemetries.map(
        (telemetry) => Math.floor(telemetry.result.transactions.averageTimeLeftUntilEventInMilliseconds / HOUR_IN_MILLISECONDS)
    ).join(',');
    // tslint:disable-next-line:prefer-template
    params.chd += '|' + telemetries.map(
        (telemetry) => Math.floor(telemetry.result.transactions.minTimeLeftUntilEventInMilliseconds / HOUR_IN_MILLISECONDS)
    ).join(',');
    const imageFullsize = await publishUrl(params);
    debug('imageFullsize:', imageFullsize);

    await sskts.service.notification.report2developers(
        `${sellerName}\n何時間前に予約したか`,
        '',
        imageFullsize,
        imageFullsize
    )();
}

/**
 * 取引所要時間を報告する
 */
async function reportTransactionRequiredTimes(sellerName: string, telemetries: ISellerFlowTelemetry[]) {
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
        (telemetry) => Math.floor(telemetry.result.transactions.averageRequiredTimeInMilliseconds / KILOSECONDS) // ミリ秒→秒変換
    ).join(',');
    const imageFullsize = await publishUrl(params);
    debug('imageFullsize:', imageFullsize);

    await sskts.service.notification.report2developers(
        `${sellerName}\n分ごとの平均取引所要時間`,
        '',
        imageFullsize,
        imageFullsize
    )();
}

/**
 * 取引金額を報告する
 */
async function reportTransactionAmounts(sellerName: string, telemetries: ISellerFlowTelemetry[]) {
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
        (telemetry) => telemetry.result.transactions.averageAmount
    ).join(',');
    const imageFullsize = await publishUrl(params);
    debug('imageFullsize:', imageFullsize);

    await sskts.service.notification.report2developers(
        `${sellerName}\n分ごとの平均取引金額`,
        '',
        imageFullsize,
        imageFullsize
    )();
}

/**
 * 取引アクション数を報告する
 */
async function reportTransactionActions(sellerName: string, telemetries: ISellerFlowTelemetry[]) {
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
    params.chd += telemetries.map((telemetry) => telemetry.result.transactions.averageNumberOfActionsOnConfirmed).join(',');
    params.chd += `|${telemetries.map((telemetry) => telemetry.result.transactions.averageNumberOfActionsOnExpired).join(',')}`;
    const imageFullsize = await publishUrl(params);
    debug('imageFullsize:', imageFullsize);

    await sskts.service.notification.report2developers(
        `${sellerName}\n分ごとの平均取引承認アクション数`,
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
