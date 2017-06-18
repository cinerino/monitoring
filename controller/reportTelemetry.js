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
const request = require("request-promise-native");
const mongooseConnectionOptions_1 = require("../mongooseConnectionOptions");
mongoose.Promise = global.Promise;
const debug = createDebug('sskts-reportjobs:controller:createTelemetry');
const KILOSECONDS = 1000;
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        debug('connecting mongodb...');
        mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
        // todo パラメータで期間設定できるようにする？
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
        yield reportTransactionAmounts(telemetries);
        yield reportTransactionRequiredTimes(telemetries);
        yield reportNumberOfTransactionsUnderway(telemetries);
        yield reportNumberOfTransactionsWithQueuesUnexported(telemetries);
        yield reportLatenciesOfQueues(telemetries);
    });
}
exports.main = main;
function reportLatenciesOfQueues(telemetries) {
    return __awaiter(this, void 0, void 0, function* () {
        // 互換性維持のため、期待通りのデータのみにフィルター
        const datas = telemetries.filter((telemetry) => (telemetry.flow.queues.numberOfExecuted !== undefined));
        datas.forEach((data) => {
            debug('data.flow', data.flow);
        });
        const params = {
            chco: '00FF00,0000FF,FF0000',
            chof: 'png',
            cht: 'ls',
            chxt: 'x,y',
            chds: 'a',
            chd: 't:',
            chls: '2,0,0|2,0,0|2,0,0',
            chxl: '0:|1時間前|50分前|40分前|30分前|20分前|10分前|現在',
            chdl: '平均|最大|最小',
            chs: '150x50'
        };
        params.chd += datas.map((telemetry) => {
            return (telemetry.flow.queues.numberOfExecuted > 0)
                ? Math.floor(telemetry.flow.queues.totalLatencyInMilliseconds / telemetry.flow.queues.numberOfExecuted)
                : 0;
        }).join(',');
        params.chd += '|' + datas.map((telemetry) => telemetry.flow.queues.maxLatencyInMilliseconds).join(',');
        params.chd += '|' + datas.map((telemetry) => telemetry.flow.queues.minLatencyInMilliseconds).join(',');
        const imageThumbnail = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
        params.chs = '750x250';
        const imageFullsize = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
        debug('imageFullsize:', imageFullsize);
        yield sskts.service.notification.report2developers('キュー待ち時間', '', yield shortenUrl(imageThumbnail), yield shortenUrl(imageFullsize))();
    });
}
function reportNumberOfTransactionsStarted(telemetries) {
    return __awaiter(this, void 0, void 0, function* () {
        const params = {
            chco: '00FF00,0000FF,FF0000',
            chof: 'png',
            cht: 'ls',
            chxt: 'x,y',
            chds: 'a',
            chd: 't:',
            chls: '2,0,0|2,0,0|2,0,0',
            chxl: '0:|1時間前|50分前|40分前|30分前|20分前|10分前|現在',
            chdl: '開始|成立|離脱',
            chs: '150x50'
        };
        params.chd += telemetries.map((telemetry) => telemetry.flow.transactions.numberOfStarted).join(',');
        params.chd += '|' + telemetries.map((telemetry) => telemetry.flow.transactions.numberOfClosed).join(',');
        params.chd += '|' + telemetries.map((telemetry) => telemetry.flow.transactions.numberOfExpired).join(',');
        const imageThumbnail = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
        params.chs = '750x250';
        const imageFullsize = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
        yield sskts.service.notification.report2developers('開始取引数/分 成立取引数/分 離脱取引数/分', '', yield shortenUrl(imageThumbnail), yield shortenUrl(imageFullsize))();
    });
}
function reportTransactionRequiredTimes(telemetries) {
    return __awaiter(this, void 0, void 0, function* () {
        // 互換性維持のため、期待通りのデータのみにフィルター
        const datas = telemetries.filter((telemetry) => (telemetry.flow.transactions.totalAmount !== undefined));
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
            chxl: '0:|1時間前|50分前|40分前|30分前|20分前|10分前|現在',
            chdl: '所要時間',
            chs: '150x50'
        };
        params.chd += datas.map((telemetry) => {
            return (telemetry.flow.transactions.numberOfClosed > 0)
                ? Math.floor(
                // ミリ秒→秒変換
                telemetry.flow.transactions.totalRequiredTimeInMilliseconds / telemetry.flow.transactions.numberOfClosed / KILOSECONDS)
                : 0;
        }).join(',');
        const imageThumbnail = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
        params.chs = '750x250';
        const imageFullsize = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
        debug('imageFullsize:', imageFullsize);
        yield sskts.service.notification.report2developers('取引平均所要時間(秒)', '', yield shortenUrl(imageThumbnail), yield shortenUrl(imageFullsize))();
    });
}
function reportTransactionAmounts(telemetries) {
    return __awaiter(this, void 0, void 0, function* () {
        // 互換性維持のため、期待通りのデータのみにフィルター
        const datas = telemetries.filter((telemetry) => (telemetry.flow.transactions.totalAmount !== undefined));
        const params = {
            chco: '00FF00',
            chof: 'png',
            cht: 'ls',
            chxt: 'x,y',
            chds: 'a',
            chd: 't:',
            chls: '5,0,0',
            chxl: '0:|1時間前|50分前|40分前|30分前|20分前|10分前|現在',
            chdl: '金額',
            chs: '150x50'
        };
        params.chd += datas.map((telemetry) => {
            return (telemetry.flow.transactions.numberOfClosed > 0)
                ? Math.floor(
                // tslint:disable-next-line:no-magic-numbers ミリ秒→秒変換
                telemetry.flow.transactions.totalAmount / telemetry.flow.transactions.numberOfClosed)
                : 0;
        }).join(',');
        const imageThumbnail = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
        params.chs = '750x250';
        const imageFullsize = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
        yield sskts.service.notification.report2developers('取引平均金額/分', '', yield shortenUrl(imageThumbnail), yield shortenUrl(imageFullsize))();
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
        yield sskts.service.notification.report2developers('時点での進行中取引数', '', yield shortenUrl(imageThumbnail), yield shortenUrl(imageFullsize))();
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
        params.chs = '750x250';
        const imageFullsize = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
        yield sskts.service.notification.report2developers('時点でのキュー数', '', yield shortenUrl(imageThumbnail), yield shortenUrl(imageFullsize))();
    });
}
function shortenUrl(originalUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield request.get({
            url: `http://is.gd/create.php?format=simple&format=json&url=${encodeURIComponent(originalUrl)}`,
            json: true
        }).promise().then((body) => {
            return body.shorturl;
        });
    });
}
;
