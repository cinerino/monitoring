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
 * GMO実売上の健康診断を実施する
 *
 * @ignore
 */
const sskts = require("@motionpicture/sskts-domain");
const createDebug = require("debug");
const moment = require("moment");
const mongoose = require("mongoose");
const mongooseConnectionOptions_1 = require("../mongooseConnectionOptions");
mongoose.Promise = global.Promise;
const debug = createDebug('sskts-reportjobs:controller:checkHealthOfGMOSales');
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
        const gmoNotificationAdapter = sskts.adapter.gmoNotification(mongoose.connection);
        // todo パラメータで期間設定できるようにする？
        // tslint:disable-next-line:no-magic-numbers
        const dateFrom = moment().add(-15, 'minutes').toDate();
        const dateTo = moment().toDate();
        const gmoSales = yield sskts.service.report.searchGMOSales(dateFrom, dateTo)(gmoNotificationAdapter);
        // オーダーIDごとに有効性確認
        const errors = [];
        const promises = gmoSales.map((gmoSale) => __awaiter(this, void 0, void 0, function* () {
            try {
                yield compareGMOOrderIdWithTransaction(gmoSale.order_id, gmoSale.amount);
            }
            catch (error) {
                errors.push({
                    title: `${gmoSale.order_id} invalid`,
                    detail: error.message
                });
            }
        }));
        yield Promise.all(promises);
        mongoose.disconnect();
        let content = '';
        if (errors.length > 0) {
            errors.forEach((error) => {
                content += `${error.title}\n${error.detail}`;
            });
        }
        else {
            content = 'healthy';
        }
        yield sskts.service.notification.report2developers(`GMO実売上健康診断結果\n${moment(dateFrom).format('MM/DD HH:mm:ss')}-${moment(dateTo).format('MM/DD HH:mm:ss')}`, content)();
    });
}
exports.main = main;
/**
 * GMOオーダーIDとDBの取引を比較する
 *
 * @param {string} orderId GMOオーダーID
 * @param {number} amount 金額
 */
function compareGMOOrderIdWithTransaction(orderId, amount) {
    return __awaiter(this, void 0, void 0, function* () {
        const transactionAdapter = sskts.adapter.transaction(mongoose.connection);
        // オーダーIDからCOA予約番号を取得
        // tslint:disable-next-line:no-magic-numbers
        const reserveNum = parseInt(orderId.slice(11, 19), 10);
        debug('reserveNum:', reserveNum);
        if (!Number.isInteger(reserveNum)) {
            throw new Error('invalid orderId');
        }
        const transactionDoc = yield transactionAdapter.transactionModel.findOne({
            status: sskts.factory.transactionStatus.CLOSED,
            'inquiry_key.reserve_num': reserveNum
        }, '_id').exec();
        debug('transactionDoc:', transactionDoc);
        if (transactionDoc === null) {
            throw new Error('transaction not found');
        }
        const authorizations = yield transactionAdapter.findAuthorizationsById(transactionDoc.get('id'));
        const gmoAuthorizationObject = authorizations.find((authorization) => authorization.group === sskts.factory.authorizationGroup.GMO);
        // GMOオーソリがなければ異常
        if (gmoAuthorizationObject === undefined) {
            throw new Error('gmo authorization not found');
        }
        const gmoAuthorization = sskts.factory.authorization.gmo.create(gmoAuthorizationObject);
        debug('gmoAuthorization:', gmoAuthorization);
        // オーソリのオーダーIDと同一かどうか
        if (gmoAuthorization.gmo_order_id !== orderId) {
            throw new Error('order_id not matched');
        }
        // オーソリの金額と同一かどうか
        if (gmoAuthorization.price !== amount) {
            throw new Error('amount not matched');
        }
    });
}
exports.compareGMOOrderIdWithTransaction = compareGMOOrderIdWithTransaction;
