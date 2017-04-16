/**
 * GMO実売上健康診断テスト
 *
 * @ignore
 */
import * as GMO from '@motionpicture/gmo-service';
import * as sskts from '@motionpicture/sskts-domain';
import * as assert from 'assert';
import * as moment from 'moment';
import * as mongoose from 'mongoose';

import * as CheckHealthOfGMOSalesController from '../controller/checkHealthOfGMOSales';

let orderSequence = 0;
let reserveNumSequence = 0;
beforeEach(async () => {
    // 全て削除してからテスト開始
    const transactionAdapter = sskts.adapter.transaction(mongoose.connection);

    await transactionAdapter.transactionModel.remove({}).exec();
    await transactionAdapter.transactionEventModel.remove({}).exec();
});

describe('GMO実売上健康診断 GMOオーダーIDとDBの取引を比較する', () => {
    it('取引が存在しない', async () => {
        const orderId = '201704161180000000100';
        const amount = 1234;

        let compareGMOOrderIdWithTransactionError: any;
        try {
            await CheckHealthOfGMOSalesController.compareGMOOrderIdWithTransaction(orderId, amount);
        } catch (error) {
            compareGMOOrderIdWithTransactionError = error;
        }

        assert(compareGMOOrderIdWithTransactionError instanceof Error);
        assert.equal(compareGMOOrderIdWithTransactionError.message, 'transaction not found');
    });

    it('金額違い', async () => {
        orderSequence += 1;
        reserveNumSequence += 1;
        const closedAt = moment();
        const reserveNum = reserveNumSequence;
        const theaterCode = '118';
        const orderId = createOrderId(closedAt.toDate(), theaterCode, reserveNum, orderSequence);
        const amount = 1234;

        const transactionAdapter = sskts.adapter.transaction(mongoose.connection);
        const transaction = sskts.factory.transaction.create({
            status: sskts.factory.transactionStatus.CLOSED,
            owners: [],
            expires_at: moment().toDate(),
            closed_at: closedAt.toDate(),
            inquiry_key: sskts.factory.transactionInquiryKey.create({
                theater_code: theaterCode,
                reserve_num: reserveNum,
                tel: '09012345678'
            })
        });
        const transactionEvent = sskts.factory.transactionEvent.authorize.create({
            transaction: transaction.id,
            occurred_at: new Date(),
            authorization: sskts.factory.authorization.gmo.create({
                price: amount - 1,
                owner_from: 'xxx',
                owner_to: 'xxx',
                gmo_shop_id: 'xxx',
                gmo_shop_pass: 'xxx',
                gmo_order_id: orderId,
                gmo_amount: amount - 1,
                gmo_access_id: 'xxx',
                gmo_access_pass: 'xxx',
                gmo_job_cd: GMO.Util.JOB_CD_SALES,
                gmo_pay_type: 'xxx'
            })
        });
        const transactionDoc = await transactionAdapter.transactionModel.findByIdAndUpdate(
            transaction.id, transaction, { new: true, upsert: true }
        );
        const transactionEventDoc = await transactionAdapter.transactionEventModel.findByIdAndUpdate(
            transactionEvent.id, transactionEvent, { new: true, upsert: true }
        );

        let compareGMOOrderIdWithTransactionError: any;
        try {
            await CheckHealthOfGMOSalesController.compareGMOOrderIdWithTransaction(orderId, amount);
        } catch (error) {
            compareGMOOrderIdWithTransactionError = error;
        }

        assert(compareGMOOrderIdWithTransactionError instanceof Error);
        assert.equal(compareGMOOrderIdWithTransactionError.message, 'amount not matched');

        await transactionDoc.remove();
        await transactionEventDoc.remove();
    });

    it('有効なオーダーID', async () => {
        orderSequence += 1;
        reserveNumSequence += 1;
        const closedAt = moment();
        const reserveNum = reserveNumSequence;
        const theaterCode = '118';
        const orderId = createOrderId(closedAt.toDate(), theaterCode, reserveNum, orderSequence);
        const amount = 1234;

        const transactionAdapter = sskts.adapter.transaction(mongoose.connection);
        const transaction = sskts.factory.transaction.create({
            status: sskts.factory.transactionStatus.CLOSED,
            owners: [],
            expires_at: moment().toDate(),
            closed_at: closedAt.toDate(),
            inquiry_key: sskts.factory.transactionInquiryKey.create({
                theater_code: theaterCode,
                reserve_num: reserveNum,
                tel: '09012345678'
            })
        });
        const transactionEvent = sskts.factory.transactionEvent.authorize.create({
            transaction: transaction.id,
            occurred_at: new Date(),
            authorization: sskts.factory.authorization.gmo.create({
                price: amount,
                owner_from: 'xxx',
                owner_to: 'xxx',
                gmo_shop_id: 'xxx',
                gmo_shop_pass: 'xxx',
                gmo_order_id: orderId,
                gmo_amount: amount,
                gmo_access_id: 'xxx',
                gmo_access_pass: 'xxx',
                gmo_job_cd: GMO.Util.JOB_CD_SALES,
                gmo_pay_type: 'xxx'
            })
        });
        const transactionDoc = await transactionAdapter.transactionModel.findByIdAndUpdate(
            transaction.id, transaction, { new: true, upsert: true }
        );
        const transactionEventDoc = await transactionAdapter.transactionEventModel.findByIdAndUpdate(
            transactionEvent.id, transactionEvent, { new: true, upsert: true }
        );

        await CheckHealthOfGMOSalesController.compareGMOOrderIdWithTransaction(orderId, amount);

        await transactionDoc.remove();
        await transactionEventDoc.remove();
    });
});

function createOrderId(date: Date, theaterCode: string, reserveNum: number, sequence: number) {
    return moment(date).format('YYYYMMDD') +
        theaterCode +
        // tslint:disable-next-line:no-magic-numbers
        ('00000000' + reserveNum.toString()).slice(-8) +
        // tslint:disable-next-line:no-magic-numbers
        ('0' + sequence.toString()).slice(-2)
        ;
}
