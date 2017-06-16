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
            'stock.measured_at': {
                $gt: dateFrom,
                $lte: dateTo
            }
        }).sort({ 'stock.measured_at': 1 }).lean().exec();
        debug('telemetries:', telemetries.length);
        mongoose.disconnect();
        yield reportNumberOfTransactionsStarted(telemetries);
        yield reportNumberOfTransactionsUnderway(telemetries);
        yield reportNumberOfTransactionsWithQueuesUnexported(telemetries);
    });
}
exports.main = main;
function reportNumberOfTransactionsStarted(telemetries) {
    return __awaiter(this, void 0, void 0, function* () {
        const params = {
            chco: '00A5C6',
            chof: 'png',
            cht: 'ls',
            chxt: 'x,y',
            chds: 'a',
            chd: 't:',
            chls: '5,0,0',
            chxl: '0:|1時間前|50分前|40分前|30分前|20分前|10分前|現在',
            chdl: '開始取引',
            // chdl: '取引在庫|進行取引|未実行キュー',
            chs: '150x50'
        };
        params.chd += telemetries.map((telemetry) => telemetry.flow.transactions.numberOfStarted).join(',');
        const imageThumbnail = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
        debug('imageThumbnail:', imageThumbnail);
        params.chs = '750x250';
        const imageFullsize = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
        yield sskts.service.notification.report2developers('測定データ報告 開始取引', '', imageThumbnail, imageFullsize)();
    });
}
function reportNumberOfTransactionsUnderway(telemetries) {
    return __awaiter(this, void 0, void 0, function* () {
        const params = {
            chco: '00A5C6',
            chof: 'png',
            cht: 'ls',
            chxt: 'x,y',
            chds: 'a',
            chd: 't:',
            chls: '5,0,0',
            chxl: '0:|1時間前|50分前|40分前|30分前|20分前|10分前|現在',
            chdl: '進行取引',
            chs: '150x50'
        };
        params.chd += telemetries.map((telemetry) => telemetry.stock.transactions.numberOfUnderway).join(',');
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
            chco: '00A5C6',
            chof: 'png',
            cht: 'ls',
            chxt: 'x,y',
            chds: 'a',
            chd: 't:',
            chls: '5,0,0',
            chxl: '0:|1時間前|50分前|40分前|30分前|20分前|10分前|現在',
            chdl: 'キュー',
            chs: '150x50'
        };
        params.chd += telemetries.map((telemetry) => telemetry.stock.queues.numberOfUnexecuted).join(',');
        // params.chd += '|' + telemetries.map((telemetry) => telemetry.transactions.numberOfClosedWithQueuesUnexported).join(',');
        const imageThumbnail = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
        debug('imageThumbnail:', imageThumbnail);
        params.chs = '750x250';
        const imageFullsize = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
        yield sskts.service.notification.report2developers('測定データ報告 未実行キュー', '', imageThumbnail, imageFullsize)();
    });
}
