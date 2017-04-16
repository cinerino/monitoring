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
 * 取引ステータス集計を報告する
 *
 * @ignore
 */
const sskts = require("@motionpicture/sskts-domain");
const createDebug = require("debug");
const moment = require("moment");
const mongoose = require("mongoose");
const mongooseConnectionOptions_1 = require("../mongooseConnectionOptions");
mongoose.Promise = global.Promise;
const debug = createDebug('sskts-reportjobs:controller:reportTransactionStatuses');
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        debug('connecting mongodb...');
        mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
        const queueAdapter = sskts.adapter.queue(mongoose.connection);
        const transactionAdapter = sskts.adapter.transaction(mongoose.connection);
        debug('creating a report...');
        const report = yield sskts.service.report.transactionStatuses()(queueAdapter, transactionAdapter);
        yield sskts.service.notification.report2developers(`取引集計\n${moment().toISOString()}`, `取引在庫数: ${report.numberOfTransactionsReady}
進行中取引数: ${report.numberOfTransactionsUnderway}
未キューの取引数(成立): ${report.numberOfTransactionsClosedWithQueuesUnexported}
未キューの取引数(期限切れ): ${report.numberOfTransactionsExpiredWithQueuesUnexported}
未実行キュー数: ${report.numberOfQueuesUnexecuted}`)();
        mongoose.disconnect();
    });
}
exports.main = main;
