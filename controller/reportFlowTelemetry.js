"use strict";
/**
 * フロー測定データを報告する
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
const mongooseConnectionOptions_1 = require("../mongooseConnectionOptions");
const GoogleChart = require("./googleChart");
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
// tslint:disable-next-line:max-func-body-length
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        debug('connecting mongodb...');
        sskts.mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
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
        const movieTheaters = yield organizationRepo.searchMovieTheaters({});
        const globalTelemetries = yield sskts.service.report.telemetry.searchGlobalFlow({
            measuredFrom: measuredFrom.toDate(),
            measuredThrough: dateNowByUnitTime.toDate()
        })(telemetryRepo);
        debug('globalTelemetries length:', globalTelemetries.length);
        const sellerTelemetries = yield sskts.service.report.telemetry.searchSellerFlow({
            measuredFrom: measuredFrom.toDate(),
            measuredThrough: dateNowByUnitTime.toDate()
        })(telemetryRepo);
        debug('sellerTelemetries length:', sellerTelemetries.length);
        sskts.mongoose.disconnect();
        yield reportLatenciesOfTasks(globalTelemetries, measuredFrom.toDate(), dateNowByUnitTime.toDate()); // タスク待機時間
        yield reportNumberOfTrialsOfTasks(globalTelemetries, measuredFrom.toDate(), dateNowByUnitTime.toDate()); // タスク試行回数
        // 販売者ごとにレポート送信
        yield Promise.all(movieTheaters.map((movieTheater) => __awaiter(this, void 0, void 0, function* () {
            debug('reporting...seller:', movieTheater.id);
            const telemetriesBySellerId = sellerTelemetries.filter((telemetry) => telemetry.object.sellerId === movieTheater.id);
            yield reportNumberOfTransactionsByStatuses(movieTheater.name.ja, telemetriesBySellerId, measuredFrom.toDate(), dateNowByUnitTime.toDate()); // ステータスごとの取引数
            yield reportExpiredRatio(movieTheater.name.ja, telemetriesBySellerId, measuredFrom.toDate(), dateNowByUnitTime.toDate());
            yield reportTimeLeftUntilEvent(movieTheater.name.ja, telemetriesBySellerId, measuredFrom.toDate(), dateNowByUnitTime.toDate());
            yield reportTransactionRequiredTimes(movieTheater.name.ja, telemetriesBySellerId, measuredFrom.toDate(), dateNowByUnitTime.toDate()); // 平均所要時間
            yield reportTransactionAmounts(movieTheater.name.ja, telemetriesBySellerId, measuredFrom.toDate(), dateNowByUnitTime.toDate()); // 平均金額
            yield reportTransactionActions(movieTheater.name.ja, telemetriesBySellerId, measuredFrom.toDate(), dateNowByUnitTime.toDate()); // 平均アクション数
        })));
    });
}
exports.main = main;
/**
 * タスク実行試行回数を報告する
 */
function reportNumberOfTrialsOfTasks(telemetries, measuredFrom, measuredThrough) {
    return __awaiter(this, void 0, void 0, function* () {
        const targetTaskNames = [
            sskts.factory.taskName.CreateOrder,
            sskts.factory.taskName.CreateOwnershipInfos,
            sskts.factory.taskName.SendEmailNotification,
            sskts.factory.taskName.SettleCreditCard,
            sskts.factory.taskName.SettleMvtk,
            sskts.factory.taskName.SettleSeatReservation
        ];
        yield Promise.all(targetTaskNames.map((taskName) => __awaiter(this, void 0, void 0, function* () {
            const xLabels = createXLabels(measuredFrom, measuredThrough);
            const params = Object.assign({}, defaultParams, {
                chco: '79F67D,79CCF5,E96C6C',
                chxt: 'x,y,y',
                chd: 't:',
                chxl: `0:|${xLabels.join('|')}|2:|回`,
                chdl: 'avg|max|min',
                chs: '750x250'
            });
            params.chd += telemetries.map((telemetry) => {
                if (!Array.isArray(telemetry.result.tasks)) {
                    return 0;
                }
                const taskData = telemetry.result.tasks.find((t) => t.name === taskName);
                return (taskData !== undefined && taskData.numberOfExecuted > 0)
                    ? Math.floor(taskData.totalNumberOfTrials / taskData.numberOfExecuted)
                    : 0;
            }).join(',');
            // tslint:disable-next-line:prefer-template
            params.chd += '|' + telemetries.map((telemetry) => {
                if (!Array.isArray(telemetry.result.tasks)) {
                    return 0;
                }
                const taskData = telemetry.result.tasks.find((t) => t.name === taskName);
                return (taskData !== undefined) ? taskData.maxNumberOfTrials : 0;
            }).join(',');
            // tslint:disable-next-line:prefer-template
            params.chd += '|' + telemetries.map((telemetry) => {
                if (!Array.isArray(telemetry.result.tasks)) {
                    return 0;
                }
                const taskData = telemetry.result.tasks.find((t) => t.name === taskName);
                return (taskData !== undefined) ? taskData.minNumberOfTrials : 0;
            }).join(',');
            const imageFullsize = yield GoogleChart.publishUrl(params);
            debug('url published.', imageFullsize);
            yield sskts.service.notification.report2developers(`タスク実行試行回数\n${taskName}`, '', imageFullsize, imageFullsize)();
        })));
    });
}
/**
 * タスク待ち時間を報告する
 */
function reportLatenciesOfTasks(telemetries, measuredFrom, measuredThrough) {
    return __awaiter(this, void 0, void 0, function* () {
        const targetTaskNames = [
            sskts.factory.taskName.CreateOrder,
            sskts.factory.taskName.CreateOwnershipInfos,
            sskts.factory.taskName.SendEmailNotification,
            sskts.factory.taskName.SettleCreditCard,
            sskts.factory.taskName.SettleMvtk,
            sskts.factory.taskName.SettleSeatReservation
        ];
        yield Promise.all(targetTaskNames.map((taskName) => __awaiter(this, void 0, void 0, function* () {
            const xLabels = createXLabels(measuredFrom, measuredThrough);
            const params = Object.assign({}, defaultParams, {
                chco: '79F67D,79CCF5,E96C6C',
                chxt: 'x,y,y',
                chd: 't:',
                chxl: `0:|${xLabels.join('|')}|2:|秒`,
                chdl: 'avg|max|min',
                chs: '750x250'
            });
            params.chd += telemetries.map((telemetry) => {
                if (!Array.isArray(telemetry.result.tasks)) {
                    return 0;
                }
                const taskData = telemetry.result.tasks.find((t) => t.name === taskName);
                return (taskData !== undefined && taskData.numberOfExecuted > 0)
                    ? Math.floor(taskData.totalLatencyInMilliseconds / taskData.numberOfExecuted)
                    : 0;
            }).join(',');
            // tslint:disable-next-line:prefer-template
            params.chd += '|' + telemetries.map((telemetry) => {
                if (!Array.isArray(telemetry.result.tasks)) {
                    return 0;
                }
                const taskData = telemetry.result.tasks.find((t) => t.name === taskName);
                return (taskData !== undefined) ? taskData.maxLatencyInMilliseconds : 0;
            }).join(',');
            // tslint:disable-next-line:prefer-template
            params.chd += '|' + telemetries.map((telemetry) => {
                if (!Array.isArray(telemetry.result.tasks)) {
                    return 0;
                }
                const taskData = telemetry.result.tasks.find((t) => t.name === taskName);
                return (taskData !== undefined) ? taskData.minLatencyInMilliseconds : 0;
            }).join(',');
            const imageFullsize = yield GoogleChart.publishUrl(params);
            debug('url published.', imageFullsize);
            yield sskts.service.notification.report2developers(`タスク待機時間\n${taskName}`, '', imageFullsize, imageFullsize)();
        })));
    });
}
/**
 * 状態別の取引数を報告する
 */
function reportNumberOfTransactionsByStatuses(sellerName, telemetries, measuredFrom, measuredThrough) {
    return __awaiter(this, void 0, void 0, function* () {
        const xLabels = createXLabels(measuredFrom, measuredThrough);
        const params = Object.assign({}, defaultParams, {
            chco: '79F67D,79CCF5,E96C6C',
            chxt: 'x,y',
            chd: 't:',
            chxl: `0:|${xLabels.join(' | ')}|2:|個`,
            chdl: '開始|成立|離脱',
            chs: '750x250'
        });
        params.chd += telemetries.map((telemetry) => telemetry.result.transactions.numberOfStarted).join(',');
        params.chd += `|${telemetries.map((telemetry) => telemetry.result.transactions.numberOfConfirmed).join(',')}`;
        params.chd += `|${telemetries.map((telemetry) => telemetry.result.transactions.numberOfExpired).join(',')}`;
        const imageFullsize = yield GoogleChart.publishUrl(params);
        debug('url published.', imageFullsize);
        yield sskts.service.notification.report2developers(`${sellerName}\n分あたりの開始取引数\n分あたりの成立取引数\n分あたりの離脱取引数`, '', imageFullsize, imageFullsize)();
    });
}
/**
 * 取引離脱率を報告する
 */
function reportExpiredRatio(sellerName, telemetries, measuredFrom, measuredThrough) {
    return __awaiter(this, void 0, void 0, function* () {
        // 5分ごとのデータに再集計
        const AGGREGATION_UNIT_IN_MINUTES = 5;
        const telemetriesBy5minutes = [];
        let telemetryBy5minutest;
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
        const params = Object.assign({}, defaultParams, {
            chco: '79CCF5,E96C6C',
            chxt: 'x,y',
            chd: 't:',
            chxl: `0:|${xLabels.join('|')}|2:|個`,
            chdl: '開始|離脱',
            chs: '750x250'
        });
        params.chd += telemetriesBy5minutes.map((telemetry) => telemetry.numberOfStarted).join(',');
        params.chd += `|${telemetriesBy5minutes.map((telemetry) => telemetry.numberOfStartedAndExpired).join(',')}`;
        const imageFullsize = yield GoogleChart.publishUrl(params);
        debug('url published.', imageFullsize);
        yield sskts.service.notification.report2developers(`${sellerName}\n${AGGREGATION_UNIT_IN_MINUTES}分ごとの取引離脱率`, '', imageFullsize, imageFullsize)();
    });
}
/**
 * イベント開始日時と取引成立日時の差を報告する
 */
function reportTimeLeftUntilEvent(sellerName, telemetries, measuredFrom, measuredThrough) {
    return __awaiter(this, void 0, void 0, function* () {
        const xLabels = createXLabels(measuredFrom, measuredThrough);
        const params = Object.assign({}, defaultParams, {
            chco: 'E96C6C,79CCF5,79F67D',
            chxt: 'x,y,y',
            chd: 't:',
            chxl: `0:|${xLabels.join(' | ')}|2:|時間`,
            chdl: 'max|avg|min',
            chs: '750x250'
        });
        const HOUR_IN_MILLISECONDS = 3600000;
        params.chd += telemetries.map((telemetry) => Math.floor(telemetry.result.transactions.maxTimeLeftUntilEventInMilliseconds / HOUR_IN_MILLISECONDS)).join(',');
        // tslint:disable-next-line:prefer-template
        params.chd += '|' + telemetries.map((telemetry) => Math.floor(telemetry.result.transactions.averageTimeLeftUntilEventInMilliseconds / HOUR_IN_MILLISECONDS)).join(',');
        // tslint:disable-next-line:prefer-template
        params.chd += '|' + telemetries.map((telemetry) => Math.floor(telemetry.result.transactions.minTimeLeftUntilEventInMilliseconds / HOUR_IN_MILLISECONDS)).join(',');
        const imageFullsize = yield GoogleChart.publishUrl(params);
        debug('url published.', imageFullsize);
        yield sskts.service.notification.report2developers(`${sellerName}\n何時間前に予約したか`, '', imageFullsize, imageFullsize)();
    });
}
/**
 * 取引所要時間を報告する
 */
function reportTransactionRequiredTimes(sellerName, telemetries, measuredFrom, measuredThrough) {
    return __awaiter(this, void 0, void 0, function* () {
        const xLabels = createXLabels(measuredFrom, measuredThrough);
        const params = Object.assign({}, defaultParams, {
            chco: 'DAA8F5',
            chxt: 'x,y',
            chd: 't:',
            chxl: `0:|${xLabels.join(' | ')}|2:|秒`,
            chdl: '所要時間',
            chs: '750x250'
        });
        params.chd += telemetries.map((telemetry) => Math.floor(telemetry.result.transactions.averageRequiredTimeInMilliseconds / KILOSECONDS) // ミリ秒→秒変換
        ).join(',');
        const imageFullsize = yield GoogleChart.publishUrl(params);
        debug('url published.', imageFullsize);
        yield sskts.service.notification.report2developers(`${sellerName}\n分ごとの平均取引所要時間`, '', imageFullsize, imageFullsize)();
    });
}
/**
 * 取引金額を報告する
 */
function reportTransactionAmounts(sellerName, telemetries, measuredFrom, measuredThrough) {
    return __awaiter(this, void 0, void 0, function* () {
        const xLabels = createXLabels(measuredFrom, measuredThrough);
        const params = Object.assign({}, defaultParams, {
            chco: 'DAA8F5',
            chxt: 'x,y',
            chd: 't:',
            chxl: `0:|${xLabels.join(' | ')}|2:|JPY`,
            chdl: '金額',
            chs: '750x250'
        });
        params.chd += telemetries.map((telemetry) => telemetry.result.transactions.averageAmount).join(',');
        const imageFullsize = yield GoogleChart.publishUrl(params);
        debug('url published.', imageFullsize);
        yield sskts.service.notification.report2developers(`${sellerName}\n分ごとの平均取引金額`, '', imageFullsize, imageFullsize)();
    });
}
/**
 * 取引アクション数を報告する
 */
function reportTransactionActions(sellerName, telemetries, measuredFrom, measuredThrough) {
    return __awaiter(this, void 0, void 0, function* () {
        const xLabels = createXLabels(measuredFrom, measuredThrough);
        const params = Object.assign({}, defaultParams, {
            chco: '79CCF5,E96C6C',
            chxt: 'x,y',
            chd: 't:',
            chxl: `0:|${xLabels.join(' | ')}|2:|個`,
            chdl: '成立|離脱',
            chs: '750x250'
        });
        params.chd += telemetries.map((telemetry) => telemetry.result.transactions.averageNumberOfActionsOnConfirmed).join(',');
        params.chd += `|${telemetries.map((telemetry) => telemetry.result.transactions.averageNumberOfActionsOnExpired).join(',')}`;
        const imageFullsize = yield GoogleChart.publishUrl(params);
        debug('url published.', imageFullsize);
        yield sskts.service.notification.report2developers(`${sellerName}\n分ごとの平均取引承認アクション数`, '', imageFullsize, imageFullsize)();
    });
}
function createXLabels(measuredFrom, measuredThrough) {
    const diff = moment(measuredThrough).diff(moment(measuredFrom), 'hours');
    const numberOfLabels = 6;
    return Array.from(Array(numberOfLabels + 1)).map((__, index) => {
        return moment(measuredFrom).add(diff / numberOfLabels * index, 'hours').format('H:mm');
    });
}
