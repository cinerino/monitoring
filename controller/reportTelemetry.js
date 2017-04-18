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
const createDebug = require("debug");
const moment = require("moment");
const mongoose = require("mongoose");
const querystring = require("querystring");
const mongooseConnectionOptions_1 = require("../mongooseConnectionOptions");
mongoose.Promise = global.Promise;
const debug = createDebug('sskts-reportjobs:controller:createTelemetry');
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        debug('connecting mongodb...');
        mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
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
        const telemetries = yield telemetryAdapter.telemetryModel.find({
            executed_at: {
                $gt: dateFrom,
                $lte: dateTo
            }
        }).sort({ executed_at: -1 }).lean().exec();
        debug('telemetries:', telemetries.length);
        mongoose.disconnect();
        yield reportNumberOfTransactionsReady(telemetries);
        yield reportNumberOfTransactionsUnderway(telemetries);
        yield reportNumberOfTransactionsWithQueuesUnexported(telemetries);
        yield reportNumberOfQueuesUnexported(telemetries);
    });
}
exports.main = main;
function reportNumberOfTransactionsReady(telemetries) {
    return __awaiter(this, void 0, void 0, function* () {
        const params = {
            chof: 'png',
            cht: 'ls',
            chxt: 'x,y',
            chds: 'a',
            chd: 't:',
            chls: '5,0,0',
            chxl: '0:|',
            chdl: '取引在庫',
            // chdl: '取引在庫|進行取引|未実行キュー',
            chs: '90x30'
        };
        params.chd += telemetries.map((telemetry) => telemetry.transactions.numberOfReady).join(',');
        // params.chxl += '24時間前|18時間前|12時間前|6時間前|0時間前'; // x軸
        const imageThumbnail = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
        debug('imageThumbnail:', imageThumbnail);
        params.chs = '750x250';
        const imageFullsize = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
        yield sskts.service.notification.report2developers('測定データ報告 取引在庫', '', imageThumbnail, imageFullsize)();
    });
}
function reportNumberOfTransactionsUnderway(telemetries) {
    return __awaiter(this, void 0, void 0, function* () {
        const params = {
            chof: 'png',
            cht: 'ls',
            chxt: 'x,y',
            chds: 'a',
            chd: 't:',
            chls: '5,0,0',
            chxl: '0:|',
            chdl: '進行取引',
            chs: '90x30'
        };
        params.chd += telemetries.map((telemetry) => telemetry.transactions.numberOfUnderway).join(',');
        // params.chxl += '24時間前|18時間前|12時間前|6時間前|0時間前'; // x軸
        const imageThumbnail = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
        debug('imageThumbnail:', imageThumbnail);
        params.chs = '750x250';
        const imageFullsize = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
        yield sskts.service.notification.report2developers('測定データ報告 進行取引', '', imageThumbnail, imageFullsize)();
    });
}
function reportNumberOfTransactionsWithQueuesUnexported(telemetries) {
    return __awaiter(this, void 0, void 0, function* () {
        const params = {
            chof: 'png',
            cht: 'ls',
            chxt: 'x,y',
            chds: 'a',
            chd: 't:',
            chls: '5,0,0',
            chxl: '0:|',
            chdl: '未キュー成立取引',
            chs: '90x30'
        };
        params.chd += telemetries.map((telemetry) => telemetry.transactions.numberOfClosedWithQueuesUnexported).join(',');
        // params.chxl += '24時間前|18時間前|12時間前|6時間前|0時間前'; // x軸
        const imageThumbnail = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
        debug('imageThumbnail:', imageThumbnail);
        params.chs = '750x250';
        const imageFullsize = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
        yield sskts.service.notification.report2developers('測定データ報告 未キュー成立取引', '', imageThumbnail, imageFullsize)();
    });
}
function reportNumberOfQueuesUnexported(telemetries) {
    return __awaiter(this, void 0, void 0, function* () {
        const params = {
            chof: 'png',
            cht: 'ls',
            chxt: 'x,y',
            chds: 'a',
            chd: 't:',
            chls: '5,0,0',
            chxl: '0:|',
            chdl: 'キュー',
            chs: '90x30'
        };
        params.chd += telemetries.map((telemetry) => telemetry.queues.numberOfUnexecuted).join(',');
        // params.chxl += '24時間前|18時間前|12時間前|6時間前|0時間前'; // x軸
        const imageThumbnail = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
        debug('imageThumbnail:', imageThumbnail);
        params.chs = '750x250';
        const imageFullsize = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
        yield sskts.service.notification.report2developers('測定データ報告 キュー', '', imageThumbnail, imageFullsize)();
    });
}
