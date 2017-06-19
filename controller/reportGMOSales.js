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
const azureStorage = require("azure-storage");
const createDebug = require("debug");
const moment = require("moment");
const mongoose = require("mongoose");
const request = require("request-promise-native");
const mongooseConnectionOptions_1 = require("../mongooseConnectionOptions");
mongoose.Promise = global.Promise;
const debug = createDebug('sskts-reportjobs:controller:reportGMOSales');
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
        mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
        yield reportGMOSalesAggregations();
        yield reportScatterChartInAmountAndTranDate();
        mongoose.disconnect();
    });
}
exports.main = main;
/**
 * 時間帯ごとの実売上をプロットしてみる
 * todo 調整
 */
function reportScatterChartInAmountAndTranDate() {
    return __awaiter(this, void 0, void 0, function* () {
        // ここ24時間の実売上をプロットする
        const dateTo = moment();
        // tslint:disable-next-line:no-magic-numbers
        const dateFrom = moment(dateTo).add(-3, 'days');
        const gmoNotificationAdapter = sskts.adapter.gmoNotification(mongoose.connection);
        const gmoNotifications = yield gmoNotificationAdapter.gmoNotificationModel.find({
            job_cd: 'SALES',
            tran_date: {
                // tslint:disable-next-line:no-magic-numbers
                $gte: dateFrom.format('YYYYMMDDHHmmss'),
                $lt: dateTo.format('YYYYMMDDHHmmss')
            }
        }, 'amount tran_date').lean().exec();
        debug('gmoNotifications:', gmoNotifications.length);
        const maxAmount = gmoNotifications.reduce((a, b) => Math.max(a, b.amount), 0);
        debug('maxAmount:', maxAmount);
        // 時間帯x金額帯ごとに集計
        const AMOUNT_UNIT = 1000;
        const prots = {};
        gmoNotifications.forEach((gmoNotification) => {
            // tslint:disable-next-line:no-magic-numbers
            const x = Number(gmoNotification.tran_date.slice(8, 10));
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
        params.chd += '|' + Object.keys(prots).map((key) => prots[key].y).join(',');
        // tslint:disable-next-line:no-magic-numbers
        params.chd += '|' + Object.keys(prots).map((key) => Math.floor(prots[key].size / sizeMax * 50)).join(',');
        // params.chd += gmoNotifications.map((gmoNotification) => Number(gmoNotification.tran_date.slice(8, 10))).join(',');
        // params.chd += '|' + gmoNotifications.map((gmoNotification) => Math.floor(gmoNotification.amount / 100)).join(',');
        const imageFullsize = yield publishUrl(params);
        yield sskts.service.notification.report2developers(`GMO売上散布図
${dateFrom.format('MM/DD HH:mm:ss')}-${dateTo.format('MM/DD HH:mm:ss')}`, `サンプル数:${gmoNotifications.length}`, imageFullsize, imageFullsize)();
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
                // tslint:disable-next-line:no-magic-numbers
                totalAmount: gmoSales.reduce((a, b) => a + parseInt(b.amount, 10), 0) // 合計金額を算出
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
${moment(aggregations[0].dateFrom).format('MM/DD HH:mm:ss')}-${moment(lastAggregation.dateTo).format('MM/DD HH:mm:ss')}`, '', imageFullsize, imageFullsize)();
    });
}
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
            debug('creating block blob... buffer.length:', buffer.length);
            // save to blob
            const blobService = azureStorage.createBlobService();
            const CONTAINER = 'telemetry-images';
            blobService.createContainerIfNotExists(CONTAINER, {}, (createContainerError) => {
                if (createContainerError instanceof Error) {
                    reject(createContainerError);
                    return;
                }
                const blob = `sskts-monitoring-jobs-telemetry-images-${moment().format('YYYYMMDDHHmmssSSS')}.png`;
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
                    const sharedAccessPolicy = {
                        AccessPolicy: {
                            Permissions: azureStorage.BlobUtilities.SharedAccessPermissions.READ,
                            // tslint:disable-next-line:no-magic-numbers
                            Start: moment().add(-10, 'minutes').toDate(),
                            // tslint:disable-next-line:no-magic-numbers
                            Expiry: moment().add(60, 'minutes').toDate()
                        }
                    };
                    const token = blobService.generateSharedAccessSignature(result.container, result.name, sharedAccessPolicy);
                    resolve(blobService.getUrl(result.container, result.name, token));
                });
            });
        }));
    });
}
