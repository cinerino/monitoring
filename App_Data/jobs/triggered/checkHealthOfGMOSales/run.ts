/**
 * GMO実売上の健康診断を実施する
 * @ignore
 */

import * as sskts from '@motionpicture/sskts-domain';
import * as createDebug from 'debug';
import * as moment from 'moment';

import mongooseConnectionOptions from '../../../../mongooseConnectionOptions';

const debug = createDebug('sskts-monitoring-jobs');

/**
 * 集計の時間単位(秒)
 */
const AGGREGATION_UNIT_TIME_IN_SECONDS = 86400;

export async function main() {
    sskts.mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);

    const gmoNotificationRepo = new sskts.repository.GMONotification(sskts.mongoose.connection);
    const transactionRepo = new sskts.repository.Transaction(sskts.mongoose.connection);

    const dateNow = moment();
    // tslint:disable-next-line:no-magic-numbers
    const madeThrough = moment((dateNow.unix() - dateNow.unix() % 3600) * 1000).toDate();
    // tslint:disable-next-line:no-magic-numbers
    const madeFrom = moment(madeThrough).add(-AGGREGATION_UNIT_TIME_IN_SECONDS, 'seconds').toDate();

    const report = await sskts.service.report.health.checkGMOSales(madeFrom, madeThrough)(gmoNotificationRepo, transactionRepo);
    debug('reportOfGMOSalesHealthCheck:', report);

    const subject = 'GMO売上健康診断';
    let content = `${moment(report.madeFrom).format('M/D H:mm')}-${moment(report.madeThrough).format('M/D H:mm')}
${report.totalAmount} ${report.totalAmountCurrency}
healthy: ${report.numberOfSales - report.unhealthGMOSales.length}/${report.numberOfSales}
unhealthy: ${report.unhealthGMOSales.length}/${report.numberOfSales}`;
    if (report.unhealthGMOSales.length > 0) {
        content += `
${report.unhealthGMOSales.map((unhealthGMOSale) => `▲${unhealthGMOSale.orderId}\n${unhealthGMOSale.reason}`).join('\n')}`
            ;
    }

    await sskts.service.notification.report2developers(subject, content)();

    sskts.mongoose.disconnect();
}

main().then(() => {
    debug('success!');
}).catch((err) => {
    console.error(err);
    process.exit(1);
});
