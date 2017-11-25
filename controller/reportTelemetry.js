"use strict";
/**
 * 測定データを報告する
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
const createDebug = require("debug");
const moment = require("moment");
const request = require("request-promise-native");
const mongooseConnectionOptions_1 = require("../mongooseConnectionOptions");
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
// tslint:disable-next-line:max-func-body-length
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        debug('connecting mongodb...');
        sskts.mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
        // 集計単位数分の集計を行う
        const telemetryUnitTimeInSeconds = 60; // 集計単位時間(秒)
        const numberOfAggregationUnit = 720; // 集計単位数
        const dateNow = moment();
        const dateNowByUnitTime = moment.unix(dateNow.unix() - (dateNow.unix() % telemetryUnitTimeInSeconds));
        // 基本的に、集計は別のジョブでやっておいて、この報告ジョブでは取得して表示するだけのイメージ
        // tslint:disable-next-line:no-magic-numbers
        const measuredFrom = moment(dateNowByUnitTime).add(numberOfAggregationUnit * -telemetryUnitTimeInSeconds, 'seconds');
        debug('reporting telemetries measuredFrom - dateTo...', measuredFrom, dateNowByUnitTime);
        const organizationRepo = new sskts.repository.Organization(sskts.mongoose.connection);
        const telemetryRepo = new sskts.repository.Telemetry(sskts.mongoose.connection);
        const movieTheaters = yield organizationRepo.searchMovieTheaters({});
        const globalTelemetries = yield sskts.service.report.searchTelemetries({
            measuredFrom: measuredFrom.toDate(),
            measuredThrough: dateNowByUnitTime.toDate(),
            scope: sskts.service.report.TelemetryScope.Global
        })(telemetryRepo);
        debug('globalTelemetries length:', globalTelemetries.length);
        const sellerTelemetries = yield sskts.service.report.searchTelemetries({
            measuredFrom: measuredFrom.toDate(),
            measuredThrough: dateNowByUnitTime.toDate(),
            scope: sskts.service.report.TelemetryScope.Seller
        })(telemetryRepo);
        debug('sellerTelemetries length:', sellerTelemetries.length);
        sskts.mongoose.disconnect();
        yield reportLatenciesOfTasks(globalTelemetries); // タスク待機時間
        yield reportNumberOfTrialsOfTasks(globalTelemetries); // タスク試行回数
        yield reportNumberOfTasksUnexecuted(globalTelemetries);
        // 販売者ごとにレポート送信
        yield Promise.all(movieTheaters.map((movieTheater) => __awaiter(this, void 0, void 0, function* () {
            debug('reporting...seller:', movieTheater.id);
            const telemetriesBySellerId = sellerTelemetries.filter((telemetry) => telemetry.object.sellerId === movieTheater.id);
            yield reportNumberOfTransactionsByStatuses(movieTheater.name.ja, telemetriesBySellerId); // ステータスごとの取引数
            yield reportTransactionRequiredTimes(movieTheater.name.ja, telemetriesBySellerId); // 平均所要時間
            yield reportTransactionAmounts(movieTheater.name.ja, telemetriesBySellerId); // 平均金額
            yield reportTransactionActions(movieTheater.name.ja, telemetriesBySellerId); // 平均アクション数
            yield reportNumberOfTransactionsUnderway(movieTheater.name.ja, telemetriesBySellerId);
        })));
    });
}
exports.main = main;
/**
 * タスク実行試行回数を報告する
 */
function reportNumberOfTrialsOfTasks(telemetries) {
    return __awaiter(this, void 0, void 0, function* () {
        const params = Object.assign({}, defaultParams, {
            chco: '79F67D,79CCF5,E96C6C',
            chxt: 'x,y,y',
            chd: 't:',
            chxl: '0:|12時間前|9時間前|6時間前|3時間前|0時間前|2:|回',
            chdl: '平均|最大|最小',
            chs: '750x250'
        });
        params.chd += telemetries.map((telemetry) => {
            return (telemetry.result.flow.tasks !== undefined && telemetry.result.flow.tasks.numberOfExecuted > 0)
                ? Math.floor(telemetry.result.flow.tasks.totalNumberOfTrials / telemetry.result.flow.tasks.numberOfExecuted)
                : 0;
        }).join(',');
        // tslint:disable-next-line:prefer-template
        params.chd += '|' + telemetries.map((telemetry) => (telemetry.result.flow.tasks !== undefined) ? telemetry.result.flow.tasks.maxNumberOfTrials : 0).join(',');
        // tslint:disable-next-line:prefer-template
        params.chd += '|' + telemetries.map((telemetry) => (telemetry.result.flow.tasks !== undefined) ? telemetry.result.flow.tasks.minNumberOfTrials : 0).join(',');
        const imageFullsize = yield publishUrl(params);
        debug('imageFullsize:', imageFullsize);
        yield sskts.service.notification.report2developers('タスク実行試行回数', '', imageFullsize, imageFullsize)();
    });
}
/**
 * タスク待ち時間を報告する
 */
function reportLatenciesOfTasks(telemetries) {
    return __awaiter(this, void 0, void 0, function* () {
        const params = Object.assign({}, defaultParams, {
            chco: '79F67D,79CCF5,E96C6C',
            chxt: 'x,y,y',
            chd: 't:',
            chxl: '0:|12時間前|9時間前|6時間前|3時間前|0時間前|2:|秒',
            chdl: '平均|最大|最小',
            chs: '750x250'
        });
        params.chd += telemetries.map((telemetry) => {
            const result = telemetry.result;
            return (result.flow.tasks !== undefined && result.flow.tasks.numberOfExecuted > 0)
                ? Math.floor(result.flow.tasks.totalLatencyInMilliseconds / result.flow.tasks.numberOfExecuted / KILOSECONDS)
                : 0;
        }).join(',');
        // tslint:disable-next-line:prefer-template
        params.chd += '|' + telemetries.map((telemetry) => {
            return (telemetry.result.flow.tasks !== undefined)
                ? Math.floor(telemetry.result.flow.tasks.maxLatencyInMilliseconds / KILOSECONDS)
                : 0;
        }).join(',');
        // tslint:disable-next-line:prefer-template
        params.chd += '|' + telemetries.map((telemetry) => {
            return (telemetry.result.flow.tasks !== undefined)
                ? Math.floor(telemetry.result.flow.tasks.minLatencyInMilliseconds / KILOSECONDS)
                : 0;
        }).join(',');
        const imageFullsize = yield publishUrl(params);
        debug('imageFullsize:', imageFullsize);
        yield sskts.service.notification.report2developers('タスク待ち時間', '', imageFullsize, imageFullsize)();
    });
}
/**
 * 状態別の取引数を報告する
 */
function reportNumberOfTransactionsByStatuses(sellerName, telemetries) {
    return __awaiter(this, void 0, void 0, function* () {
        const params = Object.assign({}, defaultParams, {
            chco: '79F67D,79CCF5,E96C6C',
            chxt: 'x,y',
            chd: 't:',
            chxl: '0:|12時間前|9時間前|6時間前|3時間前|0時間前|2:|個',
            chdl: '開始|成立|離脱',
            chs: '750x250'
        });
        params.chd += telemetries.map((telemetry) => telemetry.result.flow.transactions.numberOfStarted).join(',');
        params.chd += `|${telemetries.map((telemetry) => telemetry.result.flow.transactions.numberOfConfirmed).join(',')}`;
        params.chd += `|${telemetries.map((telemetry) => telemetry.result.flow.transactions.numberOfExpired).join(',')}`;
        const imageFullsize = yield publishUrl(params);
        debug('imageFullsize:', imageFullsize);
        yield sskts.service.notification.report2developers(`[${sellerName}] 開始取引数/minute 成立取引数/minute 離脱取引数/minute`, '', imageFullsize, imageFullsize)();
    });
}
/**
 * 取引所要時間を報告する
 */
function reportTransactionRequiredTimes(sellerName, telemetries) {
    return __awaiter(this, void 0, void 0, function* () {
        const params = Object.assign({}, defaultParams, {
            chco: 'DAA8F5',
            chxt: 'x,y',
            chd: 't:',
            chxl: '0:|12時間前|9時間前|6時間前|3時間前|0時間前|2:|秒',
            chdl: '所要時間',
            chs: '750x250'
        });
        params.chd += telemetries.map((telemetry) => Math.floor(telemetry.result.flow.transactions.averageRequiredTimeInMilliseconds / KILOSECONDS) // ミリ秒→秒変換
        ).join(',');
        const imageFullsize = yield publishUrl(params);
        debug('imageFullsize:', imageFullsize);
        yield sskts.service.notification.report2developers(`[${sellerName}] 取引所要時間平均値(秒)`, '', imageFullsize, imageFullsize)();
    });
}
/**
 * 取引金額を報告する
 */
function reportTransactionAmounts(sellerName, telemetries) {
    return __awaiter(this, void 0, void 0, function* () {
        const params = Object.assign({}, defaultParams, {
            chco: 'DAA8F5',
            chxt: 'x,y',
            chd: 't:',
            chxl: '0:|12時間前|9時間前|6時間前|3時間前|0時間前|2:|JPY',
            chdl: '金額',
            chs: '750x250'
        });
        params.chd += telemetries.map((telemetry) => telemetry.result.flow.transactions.averageAmount).join(',');
        const imageFullsize = yield publishUrl(params);
        debug('imageFullsize:', imageFullsize);
        yield sskts.service.notification.report2developers(`[${sellerName}] 取引金額平均値/minute`, '', imageFullsize, imageFullsize)();
    });
}
/**
 * 取引アクション数を報告する
 */
function reportTransactionActions(sellerName, telemetries) {
    return __awaiter(this, void 0, void 0, function* () {
        const params = Object.assign({}, defaultParams, {
            chco: '79CCF5,E96C6C',
            chxt: 'x,y',
            chd: 't:',
            chxl: '0:|12時間前|9時間前|6時間前|3時間前|0時間前|2:|個',
            chdl: '成立|離脱',
            chs: '750x250'
        });
        params.chd += telemetries.map((telemetry) => telemetry.result.flow.transactions.averageNumberOfActionsOnConfirmed).join(',');
        params.chd += `|${telemetries.map((telemetry) => telemetry.result.flow.transactions.averageNumberOfActionsOnExpired).join(',')}`;
        const imageFullsize = yield publishUrl(params);
        debug('imageFullsize:', imageFullsize);
        yield sskts.service.notification.report2developers(`[${sellerName}] 取引アクション数平均値/minute`, '', imageFullsize, imageFullsize)();
    });
}
/**
 * 進行中取引数を報告する
 */
function reportNumberOfTransactionsUnderway(sellerName, telemetries) {
    return __awaiter(this, void 0, void 0, function* () {
        const params = Object.assign({}, defaultParams, {
            chco: 'DAA8F5',
            chxt: 'x,y',
            chd: 't:',
            chxl: '0:|12時間前|9時間前|6時間前|3時間前|0時間前',
            chdl: '進行取引',
            chs: '750x250'
        });
        params.chd += telemetries.map((telemetry) => telemetry.result.stock.transactions.numberOfUnderway).join(',');
        const imageFullsize = yield publishUrl(params);
        yield sskts.service.notification.report2developers(`[${sellerName}] 時点での進行中取引数`, '', imageFullsize, imageFullsize)();
    });
}
/**
 * 未実行タスク数を報告する
 */
function reportNumberOfTasksUnexecuted(telemetries) {
    return __awaiter(this, void 0, void 0, function* () {
        const params = Object.assign({}, defaultParams, {
            chco: 'DAA8F5',
            chxt: 'x,y',
            chd: 't:',
            chxl: '0:|12時間前|9時間前|6時間前|3時間前|0時間前',
            chdl: 'タスク',
            chs: '750x250'
        });
        params.chd += telemetries.map((telemetry) => (telemetry.result.stock.tasks !== undefined) ? telemetry.result.stock.tasks.numberOfUnexecuted : 0).join(',');
        const imageFullsize = yield publishUrl(params);
        yield sskts.service.notification.report2developers('時点でのタスク数', '', imageFullsize, imageFullsize)();
    });
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
function publishUrl(params) {
    return __awaiter(this, void 0, void 0, function* () {
        // google chart apiで画像生成
        const buffer = yield request.post({
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
    });
}
