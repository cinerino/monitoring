"use strict";
/**
 * GMO実売上状況を報告する
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
const debug = createDebug('sskts-monitoring-jobs:controller:reportGMOSales');
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
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        sskts.mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
        yield reportGMOSalesAggregations();
        yield reportScatterChartInAmountAndTranDate();
        sskts.mongoose.disconnect();
    });
}
exports.main = main;
/**
 * 時間帯ごとの実売上をプロットしてみる
 */
function reportScatterChartInAmountAndTranDate() {
    return __awaiter(this, void 0, void 0, function* () {
        // ここ24時間の実売上をプロットする
        const madeThrough = moment();
        // tslint:disable-next-line:no-magic-numbers
        const madeFrom = moment(madeThrough).add(-3, 'days');
        const gmoNotificationRepo = new sskts.repository.GMONotification(sskts.mongoose.connection);
        const gmoNotifications = yield gmoNotificationRepo.searchSales({
            tranDateFrom: madeFrom.toDate(),
            tranDateThrough: madeThrough.toDate()
        });
        debug('gmoNotifications:', gmoNotifications.length);
        // tslint:disable-next-line:no-magic-numbers
        const maxAmount = gmoNotifications.reduce((a, b) => Math.max(a, b.amount), 0);
        debug('maxAmount:', maxAmount);
        // 時間帯x金額帯ごとに集計
        const AMOUNT_UNIT = 1000;
        const prots = {};
        gmoNotifications.forEach((gmoNotification) => {
            // tslint:disable-next-line:no-magic-numbers
            const x = Number(gmoNotification.tranDate.slice(8, 10));
            const y = Math.floor(gmoNotification.amount / AMOUNT_UNIT);
            if (prots[`${x}x${y}`] === undefined) {
                prots[`${x}x${y}`] = {
                    x: x,
                    y: y,
                    size: 0
                };
            }
            prots[`${x}x${y}`].size += 1;
        });
        debug('prots:', prots);
        const sizeMax = Object.keys(prots).reduce((a, b) => Math.max(a, prots[b].size), 0);
        debug('sizeMax:', sizeMax);
        const params = Object.assign({}, defaultParams, {
            cht: 's',
            chco: '3399FF',
            chxt: 'x,x,y,y',
            chds: `0,24,0,${Math.floor(maxAmount / AMOUNT_UNIT) + 1}`,
            chd: 't:',
            chxl: '1:|時台|3:|千円台',
            chxr: `0,0,24,1|2,0,${Math.floor(maxAmount / AMOUNT_UNIT) + 1}`,
            chg: '100,100',
            chs: '800x300'
        });
        params.chd += Object.keys(prots).map((key) => prots[key].x).join(',');
        params.chd += `|${Object.keys(prots).map((key) => prots[key].y).join(',')}`;
        // tslint:disable-next-line:no-magic-numbers
        params.chd += `|${Object.keys(prots).map((key) => Math.floor(prots[key].size / sizeMax * 50)).join(',')}`;
        // params.chd += gmoNotifications.map((gmoNotification) => Number(gmoNotification.tran_date.slice(8, 10))).join(',');
        // params.chd += '|' + gmoNotifications.map((gmoNotification) => Math.floor(gmoNotification.amount / 100)).join(',');
        const imageFullsize = yield publishUrl(params);
        yield sskts.service.notification.report2developers(`GMO売上散布図
${madeFrom.format('MM/DD HH:mm:ss')}-${madeThrough.format('MM/DD HH:mm:ss')}`, `サンプル数:${gmoNotifications.length}`, imageFullsize, imageFullsize)();
    });
}
function reportGMOSalesAggregations() {
    return __awaiter(this, void 0, void 0, function* () {
        // todo パラメータで期間設定できるようにする？
        // tslint:disable-next-line:no-magic-numbers
        const aggregationUnitTimeInSeconds = 900; // 集計単位時間(秒)
        const numberOfAggregationUnit = 96; // 集計単位数
        const dateNow = moment();
        const dateNowByUnitTime = moment.unix((dateNow.unix() - (dateNow.unix() % aggregationUnitTimeInSeconds)));
        // 集計単位数分の集計を行う
        let aggregations = yield Promise.all(Array.from(Array(numberOfAggregationUnit)).map((__, index) => __awaiter(this, void 0, void 0, function* () {
            debug(index);
            const madeThrough = moment.unix((dateNowByUnitTime.unix() - (dateNowByUnitTime.unix() % aggregationUnitTimeInSeconds)))
                .add(index * -aggregationUnitTimeInSeconds, 'seconds').toDate();
            // tslint:disable-next-line:no-magic-numbers
            const madeFrom = moment(madeThrough).add(-aggregationUnitTimeInSeconds, 'seconds').toDate();
            debug(madeFrom.toISOString(), madeThrough.toISOString());
            const gmoNotificationRepo = new sskts.repository.GMONotification(sskts.mongoose.connection);
            const gmoSales = yield gmoNotificationRepo.searchSales({
                tranDateFrom: madeFrom,
                tranDateThrough: madeThrough
            });
            return {
                madeFrom: madeFrom,
                madeThrough: madeThrough,
                gmoSales: gmoSales,
                totalAmount: gmoSales.reduce((a, b) => a + b.amount, 0) // 合計金額を算出
            };
        })));
        aggregations = aggregations.reverse();
        debug('aggregations:', aggregations);
        const AMOUNT_UNIT = 100;
        const params = Object.assign({}, defaultParams, {
            cht: 'ls',
            chco: '3399FF',
            chxt: 'x,y,y',
            chds: 'a',
            chd: 't:',
            chxl: '0:|24時間前|18時間前|12時間前|6時間前|0時間前|2:|百円',
            chg: '25,10',
            chs: '750x250'
        });
        params.chd += aggregations.map((agrgegation) => Math.floor(agrgegation.totalAmount / AMOUNT_UNIT)).join(',');
        const imageFullsize = yield publishUrl(params);
        const lastAggregation = aggregations[aggregations.length - 1];
        yield sskts.service.notification.report2developers(`GMO売上金額遷移(15分単位)
${moment(aggregations[0].madeFrom).format('MM/DD HH:mm:ss')}-${moment(lastAggregation.madeThrough).format('MM/DD HH:mm:ss')}`, '', imageFullsize, imageFullsize)();
    });
}
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
            fileName: `sskts-monitoring-jobs-reportGMOSales-images-${moment().format('YYYYMMDDHHmmssSSS')}.png`,
            text: buffer,
            expiryDate: moment().add(1, 'hour').toDate()
        })();
    });
}
