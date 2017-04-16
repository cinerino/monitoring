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
 * GMO実売上状況を報告する
 *
 * @ignore
 */
const sskts = require("@motionpicture/sskts-domain");
const createDebug = require("debug");
const moment = require("moment");
const mongoose = require("mongoose");
const mongooseConnectionOptions_1 = require("../mongooseConnectionOptions");
mongoose.Promise = global.Promise;
const debug = createDebug('sskts-reportjobs:controller:reportGMOSales');
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
        // todo パラメータで期間設定できるようにする？
        // tslint:disable-next-line:no-magic-numbers
        const dateFrom = moment().add(-15, 'minutes').toDate();
        const dateTo = moment().toDate();
        const gmoNotificationAdapter = sskts.adapter.gmoNotification(mongoose.connection);
        const gmoSales = yield sskts.service.report.searchGMOSales(dateFrom, dateTo)(gmoNotificationAdapter);
        debug('gmoSales:', gmoSales);
        // 合計金額を算出
        let totalAmount = 0;
        gmoSales.forEach((gmoSale) => {
            totalAmount += gmoSale.amount;
        });
        yield sskts.service.notification.report2developers(`GMO実売上集計\n${moment(dateFrom).format('MM/DD HH:mm:ss')}-${moment(dateTo).format('MM/DD HH:mm:ss')}`, `取引数: ${gmoSales.length}
合計金額: ${totalAmount}`)();
        mongoose.disconnect();
    });
}
exports.main = main;
