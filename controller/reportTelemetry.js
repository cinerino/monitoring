"use strict";
/**
 * 測定データを報告する
 *
 * @ignore
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const sskts = require("@motionpicture/sskts-domain");
const azureStorage = require("azure-storage");
const createDebug = require("debug");
const moment = require("moment");
const mongoose = require("mongoose");
const request = require("request-promise-native");
const mongooseConnectionOptions_1 = require("../mongooseConnectionOptions");
mongoose.Promise = global.Promise;
const debug = createDebug('sskts-reportjobs:controller:createTelemetry');
const KILOSECONDS = 1000;
// tslint:disable-next-line:max-func-body-length
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        debug('connecting mongodb...');
        mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
        // todo パラメータで期間設定できるようにする？
        // 集計単位数分の集計を行う
        const telemetryUnitTimeInSeconds = 300; // 集計単位時間(秒)
        const numberOfAggregationUnit = 288; // 集計単位数
        const dateNow = moment();
        const dateNowByUnitTime = moment.unix(dateNow.unix() - (dateNow.unix() % telemetryUnitTimeInSeconds));
        // 集計単位数分の集計を行う
        // tslint:disable-next-line:cyclomatic-complexity
        let aggregations = yield Promise.all(Array.from(Array(numberOfAggregationUnit)).map((__, index) => __awaiter(this, void 0, void 0, function* () {
            debug(index);
            // tslint:disable-next-line:no-magic-numbers
            const dateTo = moment(dateNowByUnitTime).add(index * -telemetryUnitTimeInSeconds, 'seconds').toDate();
            // tslint:disable-next-line:no-magic-numbers
            const dateFrom = moment(dateTo).add(-telemetryUnitTimeInSeconds, 'seconds').toDate();
            debug(dateFrom.toISOString(), dateTo.toISOString());
            debug('reporting telemetries dateFrom - dateTo...', dateFrom, dateTo);
            const telemetries = yield findTelemetriesByPeriod(dateFrom, dateTo);
            debug('telemetries length:', telemetries.length);
            const numberOfExecutedQueues = (telemetries.length > 0 && telemetries[0].flow.queues.numberOfExecuted !== undefined)
                ? telemetries.reduce((a, b) => a + b.flow.queues.numberOfExecuted, 0)
                : 0;
            const totalNumberOfQueueTrials = (telemetries.length > 0 && telemetries[0].flow.queues.numberOfExecuted !== undefined)
                ? telemetries.reduce((a, b) => a + b.flow.queues.totalNumberOfTrials, 0)
                : 0;
            const maxNumberOfQueueTrials = (telemetries.length > 0 && telemetries[0].flow.queues.numberOfExecuted !== undefined)
                ? telemetries.reduce((a, b) => Math.max(a, b.flow.queues.maxNumberOfTrials), 0)
                : 0;
            const minNumberOfQueueTrials = (telemetries.length > 0 && telemetries[0].flow.queues.numberOfExecuted !== undefined)
                ? telemetries.reduce((a, b) => Math.min(a, b.flow.queues.minNumberOfTrials), telemetries[0].flow.queues.minNumberOfTrials)
                : 0;
            const totalQueueLatencyInMilliseconds = (telemetries.length > 0 && telemetries[0].flow.queues.numberOfExecuted !== undefined)
                ? telemetries.reduce((a, b) => a + b.flow.queues.totalLatencyInMilliseconds, 0)
                : 0;
            const maxQueueLatencyInMilliseconds = (telemetries.length > 0 && telemetries[0].flow.queues.numberOfExecuted !== undefined)
                ? telemetries.reduce((a, b) => Math.max(a, b.flow.queues.maxLatencyInMilliseconds), 0)
                : 0;
            const minQueueLatencyInMilliseconds = (telemetries.length > 0 && telemetries[0].flow.queues.numberOfExecuted !== undefined)
                ? telemetries.reduce((a, b) => Math.min(a, b.flow.queues.minLatencyInMilliseconds), telemetries[0].flow.queues.minLatencyInMilliseconds)
                : 0;
            const numberOfTransactionsStarted = (telemetries.length > 0 && telemetries[0].flow.transactions.numberOfStarted !== undefined)
                ? telemetries.reduce((a, b) => a + b.flow.transactions.numberOfStarted, 0)
                : 0;
            const numberOfTransactionsClosed = (telemetries.length > 0 && telemetries[0].flow.transactions.numberOfClosed !== undefined)
                ? telemetries.reduce((a, b) => a + b.flow.transactions.numberOfClosed, 0)
                : 0;
            const numberOfTransactionsExpired = (telemetries.length > 0 && telemetries[0].flow.transactions.numberOfExpired !== undefined)
                ? telemetries.reduce((a, b) => a + b.flow.transactions.numberOfExpired, 0)
                : 0;
            const totalTransactionRequiredTimeInMilliseconds = (telemetries.length > 0 && telemetries[0].flow.transactions.numberOfClosed !== undefined)
                ? telemetries.reduce((a, b) => a + b.flow.transactions.totalRequiredTimeInMilliseconds, 0)
                : 0;
            const totalTransactionAmount = (telemetries.length > 0 && telemetries[0].flow.transactions.numberOfClosed !== undefined)
                ? telemetries.reduce((a, b) => a + b.flow.transactions.totalAmount, 0)
                : 0;
            return {
                dateFrom: dateFrom,
                dateTo: dateTo,
                telemetries: telemetries,
                numberOfTransactionsStarted: numberOfTransactionsStarted,
                numberOfTransactionsClosed: numberOfTransactionsClosed,
                numberOfTransactionsExpired: numberOfTransactionsExpired,
                totalTransactionRequiredTimeInMilliseconds: totalTransactionRequiredTimeInMilliseconds,
                // maxTransactionRequiredTimeInMilliseconds: maxTransactionRequiredTimeInMilliseconds,
                // minTransactionRequiredTimeInMilliseconds: minTransactionRequiredTimeInMilliseconds,
                totalTransactionAmount: totalTransactionAmount,
                // maxTransactionAmount: maxTransactionAmount,
                // minTransactionAmount: minTransactionAmount,
                numberOfExecutedQueues: numberOfExecutedQueues,
                totalNumberOfQueueTrials: totalNumberOfQueueTrials,
                maxNumberOfQueueTrials: maxNumberOfQueueTrials,
                minNumberOfQueueTrials: minNumberOfQueueTrials,
                totalQueueLatencyInMilliseconds: totalQueueLatencyInMilliseconds,
                maxQueueLatencyInMilliseconds: maxQueueLatencyInMilliseconds,
                minQueueLatencyInMilliseconds: minQueueLatencyInMilliseconds
            };
        })));
        aggregations = aggregations.reverse();
        debug('aggregations length:', aggregations.length);
        mongoose.disconnect();
        yield reportNumberOfTransactionsStarted(aggregations);
        yield reportTransactionAmounts(aggregations);
        yield reportTransactionRequiredTimes(aggregations);
        // await reportNumberOfTransactionsUnderway(telemetries);
        // await reportNumberOfTransactionsWithQueuesUnexported(telemetries);
        yield reportLatenciesOfQueues(aggregations);
        yield reportNumberOfTrialsOfQueues(aggregations);
    });
}
exports.main = main;
function findTelemetriesByPeriod(dateFrom, dateTo) {
    return __awaiter(this, void 0, void 0, function* () {
        const telemetryAdapter = sskts.adapter.telemetry(mongoose.connection);
        return yield telemetryAdapter.telemetryModel.find({
            'stock.measured_at': {
                $gt: dateFrom,
                $lte: dateTo
            }
        }).sort({ 'stock.measured_at': 1 }).lean().exec();
    });
}
function reportLatenciesOfQueues(aggregations) {
    return __awaiter(this, void 0, void 0, function* () {
        const params = {
            chco: '00FF00,0000FF,FF0000',
            chof: 'png',
            cht: 'ls',
            chxt: 'x,y,y',
            chds: 'a',
            chd: 't:',
            chls: '2,0,0|2,0,0|2,0,0',
            chxl: '0:|24時間前|18時間前|12時間前|6時間前|0時間前|2:|秒',
            chdl: '平均|最大|最小',
            chs: '150x50'
        };
        params.chd += aggregations.map((aggregation) => {
            return (aggregation.numberOfExecutedQueues > 0)
                ? Math.floor(aggregation.totalQueueLatencyInMilliseconds / aggregation.numberOfExecutedQueues / KILOSECONDS)
                : 0;
        }).join(',');
        params.chd += '|' + aggregations.map((aggregation) => Math.floor(aggregation.maxQueueLatencyInMilliseconds / KILOSECONDS)).join(',');
        params.chd += '|' + aggregations.map((aggregation) => Math.floor(aggregation.minQueueLatencyInMilliseconds / KILOSECONDS)).join(',');
        const imageThumbnail = yield publishUrl(params);
        params.chs = '750x250';
        const imageFullsize = yield publishUrl(params);
        yield sskts.service.notification.report2developers('キュー待ち時間', '', imageThumbnail, imageFullsize)();
    });
}
function reportNumberOfTrialsOfQueues(aggregations) {
    return __awaiter(this, void 0, void 0, function* () {
        const params = {
            chco: '00FF00,0000FF,FF0000',
            chof: 'png',
            cht: 'ls',
            chxt: 'x,y,y',
            chds: 'a',
            chd: 't:',
            chls: '2,0,0|2,0,0|2,0,0',
            chxl: '0:|24時間前|18時間前|12時間前|6時間前|0時間前|2:|回',
            // chxl: '0:|1時間前|50分前|40分前|30分前|20分前|10分前|現在',
            chdl: '平均|最大|最小',
            chs: '150x50'
        };
        params.chd += aggregations.map((aggregation) => {
            return (aggregation.numberOfExecutedQueues > 0)
                ? Math.floor(aggregation.totalNumberOfQueueTrials / aggregation.numberOfExecutedQueues)
                : 0;
        }).join(',');
        params.chd += '|' + aggregations.map((aggregation) => aggregation.maxNumberOfQueueTrials).join(',');
        params.chd += '|' + aggregations.map((aggregation) => aggregation.minNumberOfQueueTrials).join(',');
        const imageThumbnail = yield publishUrl(params);
        params.chs = '750x250';
        const imageFullsize = yield publishUrl(params);
        yield sskts.service.notification.report2developers('キュー実行試行回数', '', imageThumbnail, imageFullsize)();
    });
}
function reportNumberOfTransactionsStarted(aggregations) {
    return __awaiter(this, void 0, void 0, function* () {
        const params = {
            chco: '00FF00,0000FF,FF0000',
            chof: 'png',
            cht: 'ls',
            chxt: 'x,y',
            chds: 'a',
            chd: 't:',
            chls: '2,0,0|2,0,0|2,0,0',
            chxl: '0:|24時間前|18時間前|12時間前|6時間前|0時間前|2:|回',
            chdl: '開始|成立|離脱',
            chs: '150x50'
        };
        params.chd += aggregations.map((aggregation) => aggregation.numberOfTransactionsStarted).join(',');
        params.chd += '|' + aggregations.map((aggregation) => aggregation.numberOfTransactionsClosed).join(',');
        params.chd += '|' + aggregations.map((aggregation) => aggregation.numberOfTransactionsExpired).join(',');
        const imageThumbnail = yield publishUrl(params);
        params.chs = '750x250';
        const imageFullsize = yield publishUrl(params);
        yield sskts.service.notification.report2developers('開始取引数/分 成立取引数/分 離脱取引数/分', '', imageThumbnail, imageFullsize)();
    });
}
function reportTransactionRequiredTimes(aggregations) {
    return __awaiter(this, void 0, void 0, function* () {
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
            chxl: '0:|24時間前|18時間前|12時間前|6時間前|0時間前|2:|回',
            chdl: '所要時間',
            chs: '150x50'
        };
        params.chd += aggregations.map((aggregation) => {
            return (aggregation.numberOfTransactionsClosed > 0)
                ? Math.floor(
                // ミリ秒→秒変換
                aggregation.totalTransactionRequiredTimeInMilliseconds / aggregation.numberOfTransactionsClosed / KILOSECONDS)
                : 0;
        }).join(',');
        const imageThumbnail = yield publishUrl(params);
        params.chs = '750x250';
        const imageFullsize = yield publishUrl(params);
        yield sskts.service.notification.report2developers('取引平均所要時間(秒)', '', imageThumbnail, imageFullsize)();
    });
}
function reportTransactionAmounts(aggregations) {
    return __awaiter(this, void 0, void 0, function* () {
        const params = {
            chco: '00FF00',
            chof: 'png',
            cht: 'ls',
            chxt: 'x,y',
            chds: 'a',
            chd: 't:',
            chls: '5,0,0',
            chxl: '0:|24時間前|18時間前|12時間前|6時間前|0時間前|2:|回',
            chdl: '金額',
            chs: '150x50'
        };
        params.chd += aggregations.map((aggregation) => {
            return (aggregation.numberOfTransactionsClosed > 0)
                ? Math.floor(aggregation.totalTransactionAmount / aggregation.numberOfTransactionsClosed)
                : 0;
        }).join(',');
        const imageThumbnail = yield publishUrl(params);
        params.chs = '750x250';
        const imageFullsize = yield publishUrl(params);
        yield sskts.service.notification.report2developers('取引平均金額/分', '', imageThumbnail, imageFullsize)();
    });
}
// async function reportNumberOfTransactionsUnderway(aggregations: IAggregation[]) {
//     const params = {
//         chco: '00A5C6',
//         chof: 'png',
//         cht: 'ls',
//         chxt: 'x,y',
//         chds: 'a',
//         chd: 't:',
//         chls: '5,0,0',
//         chxl: '0:|24時間前|18時間前|12時間前|6時間前|0時間前|2:|回',
//         chdl: '進行取引',
//         chs: '150x50'
//     };
//     params.chd += aggregations.map((aggregation) => aggregation.numberOfTransactionsUnderway).join(',');
//     const imageThumbnail = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
//     debug('imageThumbnail:', imageThumbnail);
//     params.chs = '750x250';
//     const imageFullsize = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
//     await sskts.service.notification.report2developers(
//         '時点での進行中取引数',
//         '',
//        imageThumbnail,
//        imageFullsize
//     )();
// }
// async function reportNumberOfTransactionsWithQueuesUnexported(aggregations: IAggregation[]) {
//     const params = {
//         chco: '00A5C6',
//         chof: 'png',
//         cht: 'ls',
//         chxt: 'x,y',
//         chds: 'a',
//         chd: 't:',
//         chls: '5,0,0',
//         chxl: '0:|24時間前|18時間前|12時間前|6時間前|0時間前|2:|回',
//         chdl: 'キュー',
//         chs: '150x50'
//     };
//     params.chd += aggregations.map((aggregation) => telemetry.stock.queues.numberOfUnexecuted).join(',');
//     // params.chd += '|' + telemetries.map((telemetry) => telemetry.transactions.numberOfClosedWithQueuesUnexported).join(',');
//     const imageThumbnail = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
//     params.chs = '750x250';
//     const imageFullsize = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
//     await sskts.service.notification.report2developers(
//         '時点でのキュー数',
//         '',
//        imageThumbnail,
//        imageFullsize
//     )();
// }
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
function publishUrl(params) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            // google chart apiで画像生成
            const body = yield request.post({
                url: 'https://chart.googleapis.com/chart',
                form: params,
                encoding: 'binary'
            }).then();
            const buffer = new Buffer(body, 'binary');
            debug('buffer.length is', buffer.length);
            // save to blob
            const blobService = azureStorage.createBlobService();
            const CONTAINER = 'telemetry-images';
            blobService.createContainerIfNotExists(CONTAINER, {}, (createContainerError) => {
                if (createContainerError instanceof Error) {
                    reject(createContainerError);
                    return;
                }
                const blob = 'sskts-monitoring-jobs-telemetry-images-' + moment().format('YYYYMMDDHHmmss') + '.png';
                blobService.createBlockBlobFromText(CONTAINER, blob, buffer, {
                    contentSettings: {
                        contentType: 'image/png'
                    }
                }, (createBlockBlobError, result, response) => {
                    debug(createBlockBlobError, result, response);
                    if (createBlockBlobError instanceof Error) {
                        reject(createBlockBlobError);
                        return;
                    }
                    // 期限つきのURLを発行する
                    const startDate = new Date();
                    const expiryDate = new Date(startDate);
                    // tslint:disable-next-line:no-magic-numbers
                    expiryDate.setMinutes(startDate.getMinutes() + 10);
                    // tslint:disable-next-line:no-magic-numbers
                    startDate.setMinutes(startDate.getMinutes() - 10);
                    const sharedAccessPolicy = {
                        AccessPolicy: {
                            Permissions: azureStorage.BlobUtilities.SharedAccessPermissions.READ,
                            Start: startDate,
                            Expiry: expiryDate
                        }
                    };
                    // tslint:disable-next-line:max-line-length
                    const token = blobService.generateSharedAccessSignature(result.container, result.name, sharedAccessPolicy);
                    resolve(blobService.getUrl(result.container, result.name, token));
                });
            });
        }));
    });
}
