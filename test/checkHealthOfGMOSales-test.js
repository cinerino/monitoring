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
const GMO = require("@motionpicture/gmo-service");
const sskts = require("@motionpicture/sskts-domain");
const assert = require("assert");
const moment = require("moment");
const mongoose = require("mongoose");
const CheckHealthOfGMOSalesController = require("../controller/checkHealthOfGMOSales");
let orderSequence = 0;
let reserveNumSequence = 0;
beforeEach(() => __awaiter(this, void 0, void 0, function* () {
    // 全て削除してからテスト開始
    const transactionAdapter = sskts.adapter.transaction(mongoose.connection);
    yield transactionAdapter.transactionModel.remove({}).exec();
    yield transactionAdapter.transactionEventModel.remove({}).exec();
}));
describe('GMO実売上健康診断 GMOオーダーIDとDBの取引を比較する', () => {
    it('取引が存在しない', () => __awaiter(this, void 0, void 0, function* () {
        const orderId = '201704161180000000100';
        const amount = 1234;
        let compareGMOOrderIdWithTransactionError;
        try {
            yield CheckHealthOfGMOSalesController.compareGMOOrderIdWithTransaction(orderId, amount);
        }
        catch (error) {
            compareGMOOrderIdWithTransactionError = error;
        }
        assert(compareGMOOrderIdWithTransactionError instanceof Error);
        assert.equal(compareGMOOrderIdWithTransactionError.message, 'transaction not found');
    }));
    it('金額違い', () => __awaiter(this, void 0, void 0, function* () {
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
        const transactionDoc = yield transactionAdapter.transactionModel.findByIdAndUpdate(transaction.id, transaction, { new: true, upsert: true });
        const transactionEventDoc = yield transactionAdapter.transactionEventModel.findByIdAndUpdate(transactionEvent.id, transactionEvent, { new: true, upsert: true });
        let compareGMOOrderIdWithTransactionError;
        try {
            yield CheckHealthOfGMOSalesController.compareGMOOrderIdWithTransaction(orderId, amount);
        }
        catch (error) {
            compareGMOOrderIdWithTransactionError = error;
        }
        assert(compareGMOOrderIdWithTransactionError instanceof Error);
        assert.equal(compareGMOOrderIdWithTransactionError.message, 'amount not matched');
        yield transactionDoc.remove();
        yield transactionEventDoc.remove();
    }));
    it('有効なオーダーID', () => __awaiter(this, void 0, void 0, function* () {
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
        const transactionDoc = yield transactionAdapter.transactionModel.findByIdAndUpdate(transaction.id, transaction, { new: true, upsert: true });
        const transactionEventDoc = yield transactionAdapter.transactionEventModel.findByIdAndUpdate(transactionEvent.id, transactionEvent, { new: true, upsert: true });
        yield CheckHealthOfGMOSalesController.compareGMOOrderIdWithTransaction(orderId, amount);
        yield transactionDoc.remove();
        yield transactionEventDoc.remove();
    }));
});
function createOrderId(date, theaterCode, reserveNum, sequence) {
    return moment(date).format('YYYYMMDD') +
        theaterCode +
        // tslint:disable-next-line:no-magic-numbers
        ('00000000' + reserveNum.toString()).slice(-8) +
        // tslint:disable-next-line:no-magic-numbers
        ('0' + sequence.toString()).slice(-2);
}
