/**
 * フロー測定データを報告する
 * @ignore
 */

import * as sskts from '@motionpicture/sskts-domain';
import * as createDebug from 'debug';
import * as moment from 'moment';

import mongooseConnectionOptions from '../mongooseConnectionOptions';
import * as GoogleChart from './googleChart';

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

    debug('reporting telemetries...', measuredFrom, '-', dateNowByUnitTime);
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

    await reportLatenciesOfTasks(globalTelemetries, measuredFrom.toDate(), dateNowByUnitTime.toDate()); // タスク待機時間
    await reportNumberOfTrialsOfTasks(globalTelemetries, measuredFrom.toDate(), dateNowByUnitTime.toDate()); // タスク試行回数

    // 販売者ごとにレポート送信
    await Promise.all(movieTheaters.map(async (movieTheater) => {
        debug('reporting...seller:', movieTheater.id);
        const telemetriesBySellerId = sellerTelemetries.filter((telemetry) => telemetry.object.sellerId === movieTheater.id);
        await reportNumberOfTransactionsByStatuses(
            movieTheater.name.ja, telemetriesBySellerId, measuredFrom.toDate(), dateNowByUnitTime.toDate()); // ステータスごとの取引数
        await reportExpiredRatio(movieTheater.name.ja, telemetriesBySellerId, measuredFrom.toDate(), dateNowByUnitTime.toDate()
        );
        await reportTimeLeftUntilEvent(movieTheater.name.ja, telemetriesBySellerId, measuredFrom.toDate(), dateNowByUnitTime.toDate());
        await reportTransactionRequiredTimes(
            movieTheater.name.ja, telemetriesBySellerId, measuredFrom.toDate(), dateNowByUnitTime.toDate()
        ); // 平均所要時間
        await reportTransactionAmounts(
            movieTheater.name.ja, telemetriesBySellerId, measuredFrom.toDate(), dateNowByUnitTime.toDate()
        ); // 平均金額
        await reportTransactionActions(
            movieTheater.name.ja, telemetriesBySellerId, measuredFrom.toDate(), dateNowByUnitTime.toDate()
        ); // 平均アクション数
    }));
}

/**
 * タスク実行試行回数を報告する
 */
async function reportNumberOfTrialsOfTasks(telemetries: IGlobalFlowTelemetry[], measuredFrom: Date, measuredThrough: Date) {
    const targetTaskNames = Object.keys(sskts.factory.taskName).map((k) => (<any>sskts.factory.taskName)[k]);

    await Promise.all(targetTaskNames.map(async (taskName) => {
        const xLabels = createXLabels(measuredFrom, measuredThrough);
        const params = {
            ...defaultParams, ...{
                chco: '79F67D,79CCF5,E96C6C',
                chxt: 'x,y,y',
                chd: 't:',
                chxl: `0:|${xLabels.join('|')}|2:|回`,
                chdl: 'avg|max|min',
                chs: '750x250'
            }
        };
        params.chd += telemetries.map(
            (telemetry) => {
                if (!Array.isArray(telemetry.result.tasks)) {
                    return 0;
                }

                const taskData = telemetry.result.tasks.find((t) => t.name === taskName);

                return (taskData !== undefined && taskData.numberOfExecuted > 0)
                    ? Math.floor(taskData.totalNumberOfTrials / taskData.numberOfExecuted)
                    : 0;
            }
        ).join(',');
        // tslint:disable-next-line:prefer-template
        params.chd += '|' + telemetries.map(
            (telemetry) => {
                if (!Array.isArray(telemetry.result.tasks)) {
                    return 0;
                }
                const taskData = telemetry.result.tasks.find((t) => t.name === taskName);

                return (taskData !== undefined) ? taskData.maxNumberOfTrials : 0;
            }
        ).join(',');
        // tslint:disable-next-line:prefer-template
        params.chd += '|' + telemetries.map(
            (telemetry) => {
                if (!Array.isArray(telemetry.result.tasks)) {
                    return 0;
                }
                const taskData = telemetry.result.tasks.find((t) => t.name === taskName);

                return (taskData !== undefined) ? taskData.minNumberOfTrials : 0;
            }
        ).join(',');
        const imageFullsize = await GoogleChart.publishUrl(params);
        debug('url published.', imageFullsize);

        await sskts.service.notification.report2developers(
            `タスク実行試行回数\n${taskName}`,
            '',
            imageFullsize,
            imageFullsize
        )();
    }));
}

/**
 * タスク待ち時間を報告する
 */
async function reportLatenciesOfTasks(telemetries: IGlobalFlowTelemetry[], measuredFrom: Date, measuredThrough: Date) {
    const targetTaskNames = Object.keys(sskts.factory.taskName).map((k) => (<any>sskts.factory.taskName)[k]);

    await Promise.all(targetTaskNames.map(async (taskName) => {
        const xLabels = createXLabels(measuredFrom, measuredThrough);
        const params = {
            ...defaultParams, ...{
                chco: '79F67D,79CCF5,E96C6C',
                chxt: 'x,y,y',
                chd: 't:',
                chxl: `0:|${xLabels.join('|')}|2:|秒`,
                chdl: 'avg|max|min',
                chs: '750x250'
            }
        };
        params.chd += telemetries.map(
            (telemetry) => {
                if (!Array.isArray(telemetry.result.tasks)) {
                    return 0;
                }
                const taskData = telemetry.result.tasks.find((t) => t.name === taskName);

                return (taskData !== undefined && taskData.numberOfExecuted > 0)
                    ? Math.floor(taskData.totalLatencyInMilliseconds / taskData.numberOfExecuted)
                    : 0;
            }
        ).join(',');
        // tslint:disable-next-line:prefer-template
        params.chd += '|' + telemetries.map(
            (telemetry) => {
                if (!Array.isArray(telemetry.result.tasks)) {
                    return 0;
                }
                const taskData = telemetry.result.tasks.find((t) => t.name === taskName);

                return (taskData !== undefined) ? taskData.maxLatencyInMilliseconds : 0;
            }
        ).join(',');
        // tslint:disable-next-line:prefer-template
        params.chd += '|' + telemetries.map(
            (telemetry) => {
                if (!Array.isArray(telemetry.result.tasks)) {
                    return 0;
                }
                const taskData = telemetry.result.tasks.find((t) => t.name === taskName);

                return (taskData !== undefined) ? taskData.minLatencyInMilliseconds : 0;
            }
        ).join(',');
        const imageFullsize = await GoogleChart.publishUrl(params);
        debug('url published.', imageFullsize);

        await sskts.service.notification.report2developers(
            `タスク待機時間\n${taskName}`,
            '',
            imageFullsize,
            imageFullsize
        )();
    }));
}

/**
 * 状態別の取引数を報告する
 */
async function reportNumberOfTransactionsByStatuses(
    sellerName: string, telemetries: ISellerFlowTelemetry[], measuredFrom: Date, measuredThrough: Date
) {
    const xLabels = createXLabels(measuredFrom, measuredThrough);
    const params = {
        ...defaultParams, ...{
            chco: '79F67D,79CCF5,E96C6C',
            chxt: 'x,y',
            chd: 't:',
            chxl: `0:|${xLabels.join(' | ')}|2:|個`,
            chdl: '開始|成立|離脱',
            chs: '750x250'
        }
    };
    params.chd += telemetries.map((telemetry) => telemetry.result.transactions.numberOfStarted).join(',');
    params.chd += `|${telemetries.map((telemetry) => telemetry.result.transactions.numberOfConfirmed).join(',')}`;
    params.chd += `|${telemetries.map((telemetry) => telemetry.result.transactions.numberOfExpired).join(',')}`;
    const imageFullsize = await GoogleChart.publishUrl(params);
    debug('url published.', imageFullsize);

    await sskts.service.notification.report2developers(
        `${sellerName}\n分あたりの開始取引数\n分あたりの成立取引数\n分あたりの離脱取引数`,
        '',
        imageFullsize,
        imageFullsize
    )();
}

/**
 * 取引離脱率を報告する
 */
async function reportExpiredRatio(sellerName: string, telemetries: ISellerFlowTelemetry[], measuredFrom: Date, measuredThrough: Date) {
    // 5分ごとのデータに再集計
    const AGGREGATION_UNIT_IN_MINUTES = 5;
    const telemetriesBy5minutes: {
        numberOfStarted: number;
        numberOfStartedAndExpired: number;
    }[] = [];
    let telemetryBy5minutest: {
        numberOfStarted: number;
        numberOfStartedAndExpired: number;
    };
    telemetries.forEach((telemetry, index) => {
        if (index % AGGREGATION_UNIT_IN_MINUTES === 0) {
            telemetryBy5minutest = {
                numberOfStarted: 0,
                numberOfStartedAndExpired: 0
            };
        }
        telemetryBy5minutest.numberOfStarted += telemetry.result.transactions.numberOfStarted;
        telemetryBy5minutest.numberOfStartedAndExpired += telemetry.result.transactions.numberOfStartedAndExpired;
        if (index % AGGREGATION_UNIT_IN_MINUTES === AGGREGATION_UNIT_IN_MINUTES - 1 || index === telemetries.length - 1) {
            telemetriesBy5minutes.push(telemetryBy5minutest);
        }
    });

    const xLabels = createXLabels(measuredFrom, measuredThrough);
    const params = {
        ...defaultParams, ...{
            chco: '79CCF5,E96C6C',
            chxt: 'x,y',
            chd: 't:',
            chxl: `0:|${xLabels.join('|')}|2:|個`,
            chdl: '開始|離脱',
            chs: '750x250'
        }
    };
    params.chd += telemetriesBy5minutes.map((telemetry) => telemetry.numberOfStarted).join(',');
    params.chd += `|${telemetriesBy5minutes.map((telemetry) => telemetry.numberOfStartedAndExpired).join(',')}`;
    const imageFullsize = await GoogleChart.publishUrl(params);
    debug('url published.', imageFullsize);

    await sskts.service.notification.report2developers(
        `${sellerName}\n${AGGREGATION_UNIT_IN_MINUTES}分ごとの取引離脱率`,
        '',
        imageFullsize,
        imageFullsize
    )();
}

/**
 * イベント開始日時と取引成立日時の差を報告する
 */
async function reportTimeLeftUntilEvent(
    sellerName: string, telemetries: ISellerFlowTelemetry[], measuredFrom: Date, measuredThrough: Date
) {
    const xLabels = createXLabels(measuredFrom, measuredThrough);
    const params = {
        ...defaultParams, ...{
            chco: 'E96C6C,79CCF5,79F67D',
            chxt: 'x,y,y',
            chd: 't:',
            chxl: `0:|${xLabels.join(' | ')}|2:|時間`,
            chdl: 'max|avg|min',
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
    const imageFullsize = await GoogleChart.publishUrl(params);
    debug('url published.', imageFullsize);

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
async function reportTransactionRequiredTimes(
    sellerName: string, telemetries: ISellerFlowTelemetry[], measuredFrom: Date, measuredThrough: Date
) {
    const xLabels = createXLabels(measuredFrom, measuredThrough);
    const params = {
        ...defaultParams, ...{
            chco: 'DAA8F5',
            chxt: 'x,y',
            chd: 't:',
            chxl: `0:|${xLabels.join(' | ')}|2:|秒`,
            chdl: '所要時間',
            chs: '750x250'
        }
    };
    params.chd += telemetries.map(
        (telemetry) => Math.floor(telemetry.result.transactions.averageRequiredTimeInMilliseconds / KILOSECONDS) // ミリ秒→秒変換
    ).join(',');
    const imageFullsize = await GoogleChart.publishUrl(params);
    debug('url published.', imageFullsize);

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
async function reportTransactionAmounts(
    sellerName: string, telemetries: ISellerFlowTelemetry[], measuredFrom: Date, measuredThrough: Date
) {
    const xLabels = createXLabels(measuredFrom, measuredThrough);
    const params = {
        ...defaultParams, ...{
            chco: 'DAA8F5',
            chxt: 'x,y',
            chd: 't:',
            chxl: `0:|${xLabels.join(' | ')}|2:|JPY`,
            chdl: '金額',
            chs: '750x250'
        }
    };
    params.chd += telemetries.map(
        (telemetry) => telemetry.result.transactions.averageAmount
    ).join(',');
    const imageFullsize = await GoogleChart.publishUrl(params);
    debug('url published.', imageFullsize);

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
async function reportTransactionActions(
    sellerName: string, telemetries: ISellerFlowTelemetry[], measuredFrom: Date, measuredThrough: Date
) {
    const xLabels = createXLabels(measuredFrom, measuredThrough);
    const params = {
        ...defaultParams, ...{
            chco: '79CCF5,E96C6C',
            chxt: 'x,y',
            chd: 't:',
            chxl: `0:|${xLabels.join(' | ')}|2:|個`,
            chdl: '成立|離脱',
            chs: '750x250'
        }
    };
    params.chd += telemetries.map((telemetry) => telemetry.result.transactions.averageNumberOfActionsOnConfirmed).join(',');
    params.chd += `|${telemetries.map((telemetry) => telemetry.result.transactions.averageNumberOfActionsOnExpired).join(',')}`;
    const imageFullsize = await GoogleChart.publishUrl(params);
    debug('url published.', imageFullsize);

    await sskts.service.notification.report2developers(
        `${sellerName}\n分ごとの平均取引承認アクション数`,
        '',
        imageFullsize,
        imageFullsize
    )();
}

function createXLabels(measuredFrom: Date, measuredThrough: Date) {
    const diff = moment(measuredThrough).diff(moment(measuredFrom), 'hours');
    const numberOfLabels = 6;

    return Array.from(Array(numberOfLabels + 1)).map((__, index) => {
        return moment(measuredFrom).add(diff / numberOfLabels * index, 'hours').format('H:mm');
    });
}
