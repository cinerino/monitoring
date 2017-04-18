"use strict";
/**
 * GMO実売上状況を報告する
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
const debug = createDebug('sskts-reportjobs:controller:reportGMOSales');
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
        // todo パラメータで期間設定できるようにする？
        // tslint:disable-next-line:no-magic-numbers
        const aggregationUnitTimeInSeconds = 900; // 集計単位時間(秒)
        const numberOfAggregationUnit = 96; // 集計単位数
        const dateNow = moment();
        const dateNowByUnitTime = moment.unix((dateNow.unix() - (dateNow.unix() % aggregationUnitTimeInSeconds)));
        // 集計単位数分の集計を行う
        let aggregations = yield Promise.all(Array.from(Array(numberOfAggregationUnit)).map((__, index) => __awaiter(this, void 0, void 0, function* () {
            debug(index);
            const dateTo = moment.unix((dateNowByUnitTime.unix() - (dateNowByUnitTime.unix() % aggregationUnitTimeInSeconds)))
                .add(index * -aggregationUnitTimeInSeconds, 'seconds').toDate();
            // tslint:disable-next-line:no-magic-numbers
            const dateFrom = moment(dateTo).add(-aggregationUnitTimeInSeconds, 'seconds').toDate();
            debug(dateFrom.toISOString(), dateTo.toISOString());
            const gmoNotificationAdapter = sskts.adapter.gmoNotification(mongoose.connection);
            const gmoSales = yield sskts.service.report.searchGMOSales(dateFrom, dateTo)(gmoNotificationAdapter);
            return {
                dateFrom: dateFrom,
                dateTo: dateTo,
                gmoSales: gmoSales,
                totalAmount: gmoSales.reduce((a, b) => a + b.amount, 0) // 合計金額を算出
            };
        })));
        aggregations = aggregations.reverse();
        debug('aggregations:', aggregations);
        mongoose.disconnect();
        const params = {
            chof: 'png',
            cht: 'ls',
            chxt: 'x,y',
            chds: 'a',
            chd: 't:',
            chls: '5,0,0',
            chxl: '0:|',
            chdl: '金額',
            chs: '300x100'
        };
        params.chd += aggregations.map((agrgegation) => agrgegation.totalAmount).join(',');
        params.chxl += '24時間前|18時間前|12時間前|6時間前|0時間前'; // x軸
        const imageThumbnail = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
        debug('imageThumbnail:', imageThumbnail);
        params.chs = '750x250';
        const imageFullsize = `https://chart.googleapis.com/chart?${querystring.stringify(params)}`;
        const lastAggregation = aggregations[aggregations.length - 1];
        yield sskts.service.notification.report2developers(`GMO実売上集計\n${moment(lastAggregation.dateFrom).format('MM/DD HH:mm:ss')}-${moment(lastAggregation.dateTo).format('MM/DD HH:mm:ss')}`, `取引数: ${lastAggregation.gmoSales.length}
合計金額: ${lastAggregation.totalAmount}`, imageThumbnail, imageFullsize)();
    });
}
exports.main = main;
