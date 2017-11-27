"use strict";
/**
 * GMO実売上の健康診断を実施する
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
const mongooseConnectionOptions_1 = require("../../../../mongooseConnectionOptions");
const debug = createDebug('sskts-monitoring-jobs');
/**
 * 集計の時間単位(秒)
 */
const AGGREGATION_UNIT_TIME_IN_SECONDS = 86400;
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        sskts.mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
        const gmoNotificationRepo = new sskts.repository.GMONotification(sskts.mongoose.connection);
        const transactionRepo = new sskts.repository.Transaction(sskts.mongoose.connection);
        const dateNow = moment();
        // tslint:disable-next-line:no-magic-numbers
        const madeThrough = moment((dateNow.unix() - dateNow.unix() % 3600) * 1000).toDate();
        // tslint:disable-next-line:no-magic-numbers
        const madeFrom = moment(madeThrough).add(-AGGREGATION_UNIT_TIME_IN_SECONDS, 'seconds').toDate();
        const report = yield sskts.service.report.health.checkGMOSales(madeFrom, madeThrough)(gmoNotificationRepo, transactionRepo);
        debug('reportOfGMOSalesHealthCheck:', report);
        const subject = 'GMO売上健康診断';
        let content = `${moment(report.madeFrom).format('M/D H:mm')}-${moment(report.madeThrough).format('M/D H:mm')}
${report.totalAmount} ${report.totalAmountCurrency}
healthy: ${report.numberOfSales - report.unhealthGMOSales.length}/${report.numberOfSales}
unhealthy: ${report.unhealthGMOSales.length}/${report.numberOfSales}`;
        if (report.unhealthGMOSales.length > 0) {
            content += `
${report.unhealthGMOSales.map((unhealthGMOSale) => `▲${unhealthGMOSale.orderId}\n${unhealthGMOSale.reason}`).join('\n')}`;
        }
        yield sskts.service.notification.report2developers(subject, content)();
        sskts.mongoose.disconnect();
    });
}
exports.main = main;
main().then(() => {
    debug('success!');
}).catch((err) => {
    console.error(err);
    process.exit(1);
});
