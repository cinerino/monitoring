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
 * 測定データを報告する
 *
 * @ignore
 */
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
        const aggregationUnitTimeInSeconds = 60; // 集計単位時間(秒)
        const numberOfAggregationUnit = 30; // 集計単位数
        const dateNow = moment();
        const dateNowByUnitTime = moment.unix((dateNow.unix() - (dateNow.unix() % aggregationUnitTimeInSeconds)));
        // 集計単位数分の集計を行う
        let telemetries = yield Promise.all(Array.from(Array(numberOfAggregationUnit)).map((__, index) => __awaiter(this, void 0, void 0, function* () {
            const executedAt = moment.unix((dateNowByUnitTime.unix() - (dateNowByUnitTime.unix() % aggregationUnitTimeInSeconds)))
                .add(index * -aggregationUnitTimeInSeconds, 'seconds').toDate();
            const telemetryAdapter = sskts.adapter.telemetry(mongoose.connection);
            const telemetry = yield telemetryAdapter.telemetryModel.findOne({ executed_at: executedAt }).exec();
            return (telemetry !== null) ? telemetry.toObject() : null;
        })));
        telemetries = telemetries.reverse();
        debug('telemetries:', telemetries);
        mongoose.disconnect();
        const params = {
            chof: 'png',
            cht: 'ls',
            chxt: 'x,y',
            chds: 'a',
            chd: 't:',
            chls: '5,0,0',
            chxl: '0:|',
            chdl: '取引在庫|進行取引|未実行キュー',
            chs: '300x100'
        };
        params.chd += telemetries.map((telemetry) => (telemetry !== null) ? telemetry.transactions.numberOfReady : '').join(',');
        params.chd += '|' + telemetries.map((telemetry) => (telemetry !== null) ? telemetry.transactions.numberOfUnderway : '').join(',');
        params.chd += '|' + telemetries.map((telemetry) => (telemetry !== null) ? telemetry.queues.numberOfUnexecuted : '').join(',');
        // params.chxl += '24時間前|18時間前|12時間前|6時間前|0時間前'; // x軸
        const imageThumbnail = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
        debug('imageThumbnail:', imageThumbnail);
        params.chs = '750x250';
        const imageFullsize = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
        yield sskts.service.notification.report2developers('測定データ報告', `データ数: ${telemetries.length}`, imageThumbnail, imageFullsize)();
    });
}
exports.main = main;
