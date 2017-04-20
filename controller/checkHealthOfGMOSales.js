"use strict";
/**
 * GMO実売上の健康診断を実施する
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
const mongooseConnectionOptions_1 = require("../mongooseConnectionOptions");
mongoose.Promise = global.Promise;
const debug = createDebug('sskts-reportjobs:controller:checkHealthOfGMOSales');
/**
 * 集計の時間単位(秒)
 */
const AGGREGATION_UNIT_TIME_IN_SECONDS = 86400;
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
        const gmoNotificationAdapter = sskts.adapter.gmoNotification(mongoose.connection);
        const transactionAdapter = sskts.adapter.transaction(mongoose.connection);
        const dateNow = moment();
        // tslint:disable-next-line:no-magic-numbers
        const dateTo = moment((dateNow.unix() - dateNow.unix() % 3600) * 1000).toDate();
        // tslint:disable-next-line:no-magic-numbers
        const dateFrom = moment(dateTo).add(-AGGREGATION_UNIT_TIME_IN_SECONDS, 'seconds').toDate();
        const gmoSales = yield sskts.service.report.searchGMOSales(dateFrom, dateTo)(gmoNotificationAdapter);
        debug(dateFrom.toISOString(), dateTo.toISOString());
        const totalAmount = gmoSales.reduce((a, b) => a + parseInt(b.amount, 10), 0);
        // オーダーIDごとに有効性確認
        const errors = [];
        yield Promise.all(gmoSales.map((gmoSale) => __awaiter(this, void 0, void 0, function* () {
            try {
                yield sskts.service.report.examineGMOSales(gmoSale)(transactionAdapter);
            }
            catch (error) {
                errors.push({
                    title: `${gmoSale.order_id} invalid`,
                    detail: error.message
                });
            }
        })));
        mongoose.disconnect();
        yield sskts.service.notification.report2developers(`GMO実売上健康診断結果\n${moment(dateFrom).format('MM/DD HH:mm:ss')}-${moment(dateTo).format('MM/DD HH:mm:ss')}`, `取引数:${gmoSales.length}
合計金額:￥${totalAmount}
${(errors.length > 0) ? errors.map((error) => `#${error.title}\n${error.detail}`).join('\n') : 'healthy'}`)();
    });
}
exports.main = main;
