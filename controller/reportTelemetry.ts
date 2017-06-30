/**
 * 測定データを報告する
 *
 * @ignore
 */

import * as sskts from '@motionpicture/sskts-domain';
import * as azureStorage from 'azure-storage';
import * as createDebug from 'debug';
import * as moment from 'moment';
import * as mongoose from 'mongoose';
import * as request from 'request-promise-native';

import mongooseConnectionOptions from '../mongooseConnectionOptions';

(<any>mongoose).Promise = global.Promise;
const debug = createDebug('sskts-reportjobs:controller:createTelemetry');
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

interface IFlow {
    transactions: {
        numberOfStarted: number;
        numberOfClosed: number;
        numberOfExpired: number;
        totalRequiredTimeInMilliseconds: number;
        maxRequiredTimeInMilliseconds: number;
        minRequiredTimeInMilliseconds: number;
        totalAmount: number;
        maxAmount: number;
        minAmount: number;
    };
    queues: {
        numberOfCreated: number;
        numberOfExecuted: number;
        numberOfAborted: number;
        totalLatencyInMilliseconds: number;
        maxLatencyInMilliseconds: number;
        minLatencyInMilliseconds: number;
        totalNumberOfTrials: number;
        maxNumberOfTrials: number;
        minNumberOfTrials: number;
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

// tslint:disable-next-line:max-func-body-length
export async function main() {
    debug('connecting mongodb...');
    mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);

    // 集計単位数分の集計を行う
    const telemetryUnitTimeInSeconds = 60; // 集計単位時間(秒)
    const numberOfAggregationUnit = 720; // 集計単位数
    const dateNow = moment();
    const dateNowByUnitTime = moment.unix(dateNow.unix() - (dateNow.unix() % telemetryUnitTimeInSeconds));

    // 基本的に、集計は別のジョブでやっておいて、この報告ジョブでは取得して表示するだけのイメージ
    // tslint:disable-next-line:no-magic-numbers
    const dateFrom = moment(dateNowByUnitTime).add(numberOfAggregationUnit * -telemetryUnitTimeInSeconds, 'seconds');

    debug('reporting telemetries dateFrom - dateTo...', dateFrom, dateNowByUnitTime);
    const telemetries = await findTelemetriesByPeriod(dateFrom.toDate(), dateNowByUnitTime.toDate());
    debug('telemetries length:', telemetries.length);

    mongoose.disconnect();

    await reportLatenciesOfQueues(telemetries);
    await reportNumberOfTrialsOfQueues(telemetries);
    await reportNumberOfTransactionsByStatuses(telemetries);
    await reportTransactionRequiredTimes(telemetries);
    await reportTransactionAmounts(telemetries);
    await reportNumberOfTransactionsUnderway(telemetries);
    await reportNumberOfTransactionsWithQueuesUnexported(telemetries);
}

async function findTelemetriesByPeriod(dateFrom: Date, dateTo: Date) {
    const telemetryAdapter = sskts.adapter.telemetry(mongoose.connection);
    return <ITelemetry[]>await telemetryAdapter.telemetryModel.find(
        {
            'stock.measured_at': {
                $gte: dateFrom,
                $lt: dateTo
            }
        }
    ).sort({ 'stock.measured_at': 1 }).lean().exec();
}

async function reportNumberOfTrialsOfQueues(telemetries: ITelemetry[]) {
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
            return (telemetry.flow.queues.numberOfExecuted > 0)
                ? Math.floor(telemetry.flow.queues.totalNumberOfTrials / telemetry.flow.queues.numberOfExecuted)
                : 0;
        }
    ).join(',');
    params.chd += '|' + telemetries.map((telemetry) => telemetry.flow.queues.maxNumberOfTrials).join(',');
    params.chd += '|' + telemetries.map((telemetry) => telemetry.flow.queues.minNumberOfTrials).join(',');
    const imageFullsize = await publishUrl(params);
    debug('imageFullsize:', imageFullsize);

    await sskts.service.notification.report2developers(
        'キュー実行試行回数',
        '',
        imageFullsize,
        imageFullsize
    )();
}

async function reportLatenciesOfQueues(telemetries: ITelemetry[]) {
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
            return (telemetry.flow.queues.numberOfExecuted > 0)
                ? Math.floor(telemetry.flow.queues.totalLatencyInMilliseconds / telemetry.flow.queues.numberOfExecuted / KILOSECONDS)
                : 0;
        }
    ).join(',');
    params.chd += '|' + telemetries.map((telemetry) => Math.floor(telemetry.flow.queues.maxLatencyInMilliseconds / KILOSECONDS)).join(',');
    params.chd += '|' + telemetries.map((telemetry) => Math.floor(telemetry.flow.queues.minLatencyInMilliseconds / KILOSECONDS)).join(',');
    const imageFullsize = await publishUrl(params);
    debug('imageFullsize:', imageFullsize);

    await sskts.service.notification.report2developers(
        'キュー待ち時間',
        '',
        imageFullsize,
        imageFullsize
    )();
}

async function reportNumberOfTransactionsByStatuses(telemetries: ITelemetry[]) {
    const params = {
        ...defaultParams, ...{
            chco: '79F67D,79CCF5,E96C6C',
            chxt: 'x,y',
            chd: 't:',
            chxl: '0:|12時間前|9時間前|6時間前|3時間前|0時間前|2:|回',
            chdl: '開始|成立|離脱',
            chs: '750x250'
        }
    };
    params.chd += telemetries.map((telemetry) => telemetry.flow.transactions.numberOfStarted).join(',');
    params.chd += '|' + telemetries.map((telemetry) => telemetry.flow.transactions.numberOfClosed).join(',');
    params.chd += '|' + telemetries.map((telemetry) => telemetry.flow.transactions.numberOfExpired).join(',');
    const imageFullsize = await publishUrl(params);
    debug('imageFullsize:', imageFullsize);

    await sskts.service.notification.report2developers(
        '開始取引数/minute 成立取引数/minute 離脱取引数/minute',
        '',
        imageFullsize,
        imageFullsize
    )();
}

async function reportTransactionRequiredTimes(telemetries: ITelemetry[]) {
    const params = {
        ...defaultParams, ...{
            chco: 'DAA8F5',
            chxt: 'x,y',
            chd: 't:',
            chxl: '0:|12時間前|9時間前|6時間前|3時間前|0時間前|2:|回',
            chdl: '所要時間',
            chs: '750x250'
        }
    };
    params.chd += telemetries.map(
        (telemetry) => {
            return (telemetry.flow.transactions.numberOfClosed > 0)
                ? Math.floor(
                    // ミリ秒→秒変換
                    telemetry.flow.transactions.totalRequiredTimeInMilliseconds / telemetry.flow.transactions.numberOfClosed / KILOSECONDS
                )
                : 0;
        }
    ).join(',');
    const imageFullsize = await publishUrl(params);
    debug('imageFullsize:', imageFullsize);

    await sskts.service.notification.report2developers(
        '取引平均所要時間(秒)',
        '',
        imageFullsize,
        imageFullsize
    )();
}

async function reportTransactionAmounts(telemetries: ITelemetry[]) {
    const params = {
        ...defaultParams, ...{
            chco: 'DAA8F5',
            chxt: 'x,y',
            chd: 't:',
            chxl: '0:|12時間前|9時間前|6時間前|3時間前|0時間前|2:|円',
            chdl: '金額',
            chs: '750x250'
        }
    };
    params.chd += telemetries.map(
        (telemetry) => {
            return (telemetry.flow.transactions.numberOfClosed > 0)
                ? Math.floor(
                    telemetry.flow.transactions.totalAmount / telemetry.flow.transactions.numberOfClosed
                )
                : 0;
        }
    ).join(',');
    const imageFullsize = await publishUrl(params);
    debug('imageFullsize:', imageFullsize);

    await sskts.service.notification.report2developers(
        '取引平均金額/minute',
        '',
        imageFullsize,
        imageFullsize
    )();
}

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

async function reportNumberOfTransactionsWithQueuesUnexported(telemetries: ITelemetry[]) {
    const params = {
        ...defaultParams, ...{
            chco: 'DAA8F5',
            chxt: 'x,y',
            chd: 't:',
            chxl: '0:|12時間前|9時間前|6時間前|3時間前|0時間前',
            chdl: 'キュー',
            chs: '750x250'
        }
    };
    params.chd += telemetries.map((telemetry) => telemetry.stock.queues.numberOfUnexecuted).join(',');
    const imageFullsize = await publishUrl(params);

    await sskts.service.notification.report2developers(
        '時点でのキュー数',
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
    return new Promise<string>(async (resolve, reject) => {
        // google chart apiで画像生成
        const body = <string>await request.post({
            url: 'https://chart.googleapis.com/chart',
            form: params,
            encoding: 'binary'
        }).then();
        const buffer = new Buffer(body, 'binary');
        debug('creating block blob... buffer.length:', buffer.length);

        // save to blob
        const blobService = azureStorage.createBlobService();
        const CONTAINER = 'telemetry-images';
        blobService.createContainerIfNotExists(
            CONTAINER,
            {
                // publicAccessLevel: 'blob'
            },
            (createContainerError) => {
                if (createContainerError instanceof Error) {
                    reject(createContainerError);

                    return;
                }

                const blob = `sskts-monitoring-jobs-telemetry-images-${moment().format('YYYYMMDDHHmmssSSS')}.png`;
                blobService.createBlockBlobFromText(
                    CONTAINER, blob, buffer, {
                        contentSettings: {
                            contentType: 'image/png'
                        }
                    },
                    (createBlockBlobError, result, response) => {
                        debug(createBlockBlobError, result, response);
                        if (createBlockBlobError instanceof Error) {
                            reject(createBlockBlobError);

                            return;
                        }

                        // 期限つきのURLを発行する
                        const sharedAccessPolicy = {
                            AccessPolicy: {
                                Permissions: azureStorage.BlobUtilities.SharedAccessPermissions.READ,
                                // tslint:disable-next-line:no-magic-numbers
                                Start: moment().add(-10, 'minutes').toDate(),
                                // tslint:disable-next-line:no-magic-numbers
                                Expiry: moment().add(60, 'minutes').toDate()
                            }
                        };
                        const token = blobService.generateSharedAccessSignature(result.container, result.name, sharedAccessPolicy);
                        resolve(blobService.getUrl(result.container, result.name, token));
                    }
                );
            }
        );
    });
}
