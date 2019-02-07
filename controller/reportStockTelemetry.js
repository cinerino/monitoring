"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * ストック測定データを報告する
 */
const sskts = require("@motionpicture/sskts-domain");
const createDebug = require("debug");
const moment = require("moment");
const mongoose = require("mongoose");
const mongooseConnectionOptions_1 = require("../mongooseConnectionOptions");
const GoogleChart = require("./googleChart");
const debug = createDebug('sskts-monitoring-jobs');
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
        mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
        // 集計単位数分の集計を行う
        const telemetryUnitTimeInSeconds = 60; // 集計単位時間(秒)
        const numberOfAggregationUnit = 720; // 集計単位数
        // tslint:disable-next-line:no-magic-numbers
        const dateNow = moment();
        const dateNowByUnitTime = moment.unix(dateNow.unix() - (dateNow.unix() % telemetryUnitTimeInSeconds));
        // 基本的に、集計は別のジョブでやっておいて、この報告ジョブでは取得して表示するだけのイメージ
        // tslint:disable-next-line:no-magic-numbers
        const measuredFrom = moment(dateNowByUnitTime).add(numberOfAggregationUnit * -telemetryUnitTimeInSeconds, 'seconds');
        debug('reporting telemetries measuredFrom - dateTo...', measuredFrom, dateNowByUnitTime);
        const sellerRepo = new sskts.repository.Seller(mongoose.connection);
        const telemetryRepo = new sskts.repository.Telemetry(mongoose.connection);
        const movieTheaters = yield sellerRepo.search({});
        const globalTelemetries = yield sskts.service.report.telemetry.searchGlobalStock({
            measuredFrom: measuredFrom.toDate(),
            measuredThrough: dateNowByUnitTime.toDate()
        })({ telemetry: telemetryRepo });
        debug('globalTelemetries length:', globalTelemetries.length);
        const sellerTelemetries = yield sskts.service.report.telemetry.searchSellerStock({
            measuredFrom: measuredFrom.toDate(),
            measuredThrough: dateNowByUnitTime.toDate()
        })({ telemetry: telemetryRepo });
        debug('sellerTelemetries length:', sellerTelemetries.length);
        debug('diconnecting mongo...');
        yield mongoose.disconnect();
        yield reportNumberOfTasksUnexecuted(globalTelemetries);
        // 販売者ごとにレポート送信
        yield Promise.all(movieTheaters.map((movieTheater) => __awaiter(this, void 0, void 0, function* () {
            debug('reporting...seller:', movieTheater.id);
            const telemetriesBySellerId = sellerTelemetries.filter((telemetry) => telemetry.object.sellerId === movieTheater.id);
            yield reportNumberOfTransactionsUnderway(movieTheater.name.ja, telemetriesBySellerId);
        })));
    });
}
exports.main = main;
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
        params.chd += telemetries.map((telemetry) => telemetry.result.transactions.numberOfUnderway).join(',');
        const imageFullsize = yield GoogleChart.publishUrl(params);
        yield sskts.service.notification.report2developers(`${sellerName}\n時点での進行中取引数`, '', imageFullsize, imageFullsize)();
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
        params.chd += telemetries.map((telemetry) => (telemetry.result.tasks !== undefined) ? telemetry.result.tasks.numberOfUnexecuted : 0).join(',');
        const imageFullsize = yield GoogleChart.publishUrl(params);
        yield sskts.service.notification.report2developers('時点でのタスク数', '', imageFullsize, imageFullsize)();
    });
}
