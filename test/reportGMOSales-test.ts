/**
 * GMO実売上健康診断テスト
 *
 * @ignore
 */
import * as sskts from '@motionpicture/sskts-domain';
import * as moment from 'moment';
import * as mongoose from 'mongoose';
import * as _ from 'underscore';

import * as ReportGMOSalesController from '../controller/reportGMOSales';

describe('GMO実売上報告', () => {
    let connection: mongoose.Connection;
    before((done) => {
        mongoose.disconnect().then(async () => {
            connection = mongoose.createConnection(process.env.MONGOLAB_URI);

            // 全て削除してからテスト開始
            const gmoNotificationAdapter = sskts.adapter.gmoNotification(connection);
            await gmoNotificationAdapter.gmoNotificationModel.remove({}).exec();

            done();
        });
    });

    it('ok', async () => {
        const gmoNotificationAdapter = sskts.adapter.gmoNotification(connection);

        const numberOfNotification = 16;
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

        const notificationDocs = await gmoNotificationAdapter.gmoNotificationModel.create(notifications);

        await ReportGMOSalesController.main();

        await Promise.all(notificationDocs.map(async (notificationDoc) => {
            await notificationDoc.remove();
        }));
    });
});
