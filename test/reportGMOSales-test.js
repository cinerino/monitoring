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
 * GMO実売上健康診断テスト
 *
 * @ignore
 */
const sskts = require("@motionpicture/sskts-domain");
const moment = require("moment");
const mongoose = require("mongoose");
const _ = require("underscore");
const ReportGMOSalesController = require("../controller/reportGMOSales");
describe('GMO実売上報告', () => {
    let connection;
    before((done) => {
        mongoose.disconnect().then(() => __awaiter(this, void 0, void 0, function* () {
            connection = mongoose.createConnection(process.env.MONGOLAB_URI);
            // 全て削除してからテスト開始
            const gmoNotificationAdapter = sskts.adapter.gmoNotification(connection);
            yield gmoNotificationAdapter.gmoNotificationModel.remove({}).exec();
            done();
        }));
    });
    it('ok', () => __awaiter(this, void 0, void 0, function* () {
        const gmoNotificationAdapter = sskts.adapter.gmoNotification(connection);
        const numberOfNotification = 96;
        const notifications = Array.from(Array(numberOfNotification)).map((__, index) => {
            // tslint:disable-next-line:no-magic-numbers
            const amount = parseInt(_(_.keys(Array.from(Array(9)))).shuffle()[0], 10) * 1000;
            return {
                shop_id: 'xxx',
                access_id: 'xxx',
                order_id: '201704151180000151900',
                status: 'SALES',
                job_cd: 'SALES',
                amount: amount.toString(),
                tax: '0',
                currency: 'JPN',
                forward: '2a99662',
                method: '1',
                pay_times: '',
                tran_id: '1704152300111111111111877098',
                approve: '2980559',
                // tslint:disable-next-line:no-magic-numbers
                tran_date: moment().add(-900 * index, 'seconds').format('YYYYMMDDHHmmss'),
                err_code: '',
                err_info: '',
                pay_type: '0'
            };
        });
        const notificationDocs = yield gmoNotificationAdapter.gmoNotificationModel.create(notifications);
        yield ReportGMOSalesController.main();
        yield Promise.all(notificationDocs.map((notificationDoc) => __awaiter(this, void 0, void 0, function* () {
            yield notificationDoc.remove();
        })));
    }));
});
