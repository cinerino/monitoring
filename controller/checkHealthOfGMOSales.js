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
        // const transactionAdapter = sskts.adapter.transaction(mongoose.connection);
        const dateNow = moment();
        // tslint:disable-next-line:no-magic-numbers
        const dateTo = moment((dateNow.unix() - dateNow.unix() % 3600) * 1000).toDate();
        // tslint:disable-next-line:no-magic-numbers
        const dateFrom = moment(dateTo).add(-AGGREGATION_UNIT_TIME_IN_SECONDS, 'seconds').toDate();
        const gmoSaleses = yield sskts.service.report.searchGMOSales(dateFrom, dateTo)(gmoNotificationAdapter);
        debug(dateFrom.toISOString(), dateTo.toISOString());
        // tslint:disable-next-line:no-magic-numbers
        const totalAmount = gmoSaleses.reduce((a, b) => a + parseInt(b.amount, 10), 0);
        // オーダーIDごとに有効性確認すると、コマンド過多でMongoDBにある程度の負荷をかけてしまう
        // まとめて検索してから、ローカルで有効性を確認する必要がある
        const orderIds = gmoSaleses.map((gmoSales) => gmoSales.order_id);
        const tasks = yield sskts.adapter.task(mongoose.connection).taskModel.find({
            name: sskts.factory.taskName.SettleGMOAuthorization,
            'data.authorization.gmo_order_id': { $in: orderIds }
        }).lean().exec();
        debug('tasks are', tasks);
        const errors = [];
        gmoSaleses.forEach((gmoSales) => {
            try {
                const taskByOrderId = tasks.find((task) => task.data.authorization.gmo_order_id === gmoSales.order_id);
                if (taskByOrderId === undefined) {
                    throw new Error('task not found');
                }
                const authorization = taskByOrderId.data.authorization;
                debug('authorization is', authorization);
                if (authorization.gmo_access_id !== gmoSales.access_id) {
                    throw new Error('gmo_access_id not matched');
                }
                if (authorization.gmo_pay_type !== gmoSales.pay_type) {
                    throw new Error('gmo_pay_type not matched');
                }
                // オーソリの金額と同一かどうか
                // tslint:disable-next-line:no-magic-numbers
                if (authorization.gmo_amount !== parseInt(gmoSales.amount, 10)) {
                    throw new Error('amount not matched');
                }
            }
            catch (error) {
                errors.push({
                    title: `${gmoSales.order_id} invalid`,
                    detail: error.message
                });
            }
        });
        mongoose.disconnect();
        let result = `healthy: ${gmoSaleses.length - errors.length}/${gmoSaleses.length}
unhealthy: ${errors.length}/${gmoSaleses.length}`;
        if (errors.length > 0) {
            result += `
${errors.map((error) => `#${error.title}\n${error.detail}`).join('\n')}`;
        }
        yield sskts.service.notification.report2developers('GMO売上健康診断', `${moment(dateFrom).format('M/D H:mm')}-${moment(dateTo).format('M/D H:mm')}
￥${totalAmount}
${result}`)();
    });
}
exports.main = main;
