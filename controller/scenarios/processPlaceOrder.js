"use strict";
// tslint:disable:insecure-random
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
 * 注文取引シナリオ
 * @module
 */
const sasaki = require("@motionpicture/sskts-api-nodejs-client");
const sskts = require("@motionpicture/sskts-domain");
const createDebug = require("debug");
const moment = require("moment");
const util = require("util");
const debug = createDebug('sskts-monitoring-jobs');
const auth = new sasaki.auth.ClientCredentials({
    domain: process.env.SSKTS_API_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.SSKTS_API_CLIENT_ID,
    clientSecret: process.env.SSKTS_API_CLIENT_SECRET,
    scopes: [
        `${process.env.SSKTS_API_RESOURCE_SERVER_IDENTIFIER}/transactions`,
        `${process.env.SSKTS_API_RESOURCE_SERVER_IDENTIFIER}/events.read-only`,
        `${process.env.SSKTS_API_RESOURCE_SERVER_IDENTIFIER}/organizations.read-only`
    ],
    state: 'teststate'
});
const events = new sasaki.service.Event({
    endpoint: process.env.SSKTS_API_ENDPOINT,
    auth: auth
});
const organizations = new sasaki.service.Organization({
    endpoint: process.env.SSKTS_API_ENDPOINT,
    auth: auth
});
const placeOrderTransactions = new sasaki.service.transaction.PlaceOrder({
    endpoint: process.env.SSKTS_API_ENDPOINT,
    auth: auth
});
// tslint:disable-next-line:max-func-body-length
function main(theaterCode, durationInMillisecond) {
    return __awaiter(this, void 0, void 0, function* () {
        // search movie theater organizations
        const movieTheaterOrganization = yield organizations.findMovieTheaterByBranchCode({
            branchCode: theaterCode
        });
        if (movieTheaterOrganization === null) {
            throw new Error('movie theater shop not open');
        }
        // search screening events
        const individualScreeningEvents = yield events.searchIndividualScreeningEvent({
            superEventLocationIdentifiers: [movieTheaterOrganization.identifier],
            startFrom: moment().toDate(),
            // tslint:disable-next-line:no-magic-numbers
            startThrough: moment().add(2, 'days').toDate()
        });
        debug(individualScreeningEvents.length, '件のイベントが見つかりました。');
        const availableEvents = individualScreeningEvents.filter((event) => (event.offer.availability !== 0));
        if (availableEvents.length === 0) {
            throw new Error('no available events');
        }
        // 上映イベント選択時間
        // tslint:disable-next-line:no-magic-numbers
        yield wait(Math.floor(durationInMillisecond / 6));
        const availableEvent = availableEvents[Math.floor(availableEvents.length * Math.random())];
        // retrieve an event detail
        const individualScreeningEvent = yield events.findIndividualScreeningEvent({
            identifier: availableEvent.identifier
        });
        if (individualScreeningEvent === null) {
            throw new Error('specified screening event not found');
        }
        const dateJouei = individualScreeningEvent.coaInfo.dateJouei;
        const titleCode = individualScreeningEvent.coaInfo.titleCode;
        const titleBranchNum = individualScreeningEvent.coaInfo.titleBranchNum;
        const timeBegin = individualScreeningEvent.coaInfo.timeBegin;
        const screenCode = individualScreeningEvent.coaInfo.screenCode;
        // start a transaction
        debug('取引を開始します...');
        const transaction = yield placeOrderTransactions.start({
            // tslint:disable-next-line:no-magic-numbers
            expires: moment().add(durationInMillisecond + 120000, 'milliseconds').toDate(),
            sellerId: movieTheaterOrganization.id
        });
        debug('取引を開始しました。', transaction.id);
        // search sales tickets from sskts.COA
        // このサンプルは1座席購入なので、制限単位が1枚以上の券種に絞る
        const salesTicketResult = yield sskts.COA.services.reserve.salesTicket({
            theaterCode: theaterCode,
            dateJouei: dateJouei,
            titleCode: titleCode,
            titleBranchNum: titleBranchNum,
            timeBegin: timeBegin,
            flgMember: sskts.COA.services.reserve.FlgMember.NonMember
        }).then((results) => results.filter((result) => result.limitUnit === '001' && result.limitCount === 1));
        debug(salesTicketResult.length, '件の販売可能券種が見つかりました。');
        // search available seats from sskts.COA
        const getStateReserveSeatResult = yield sskts.COA.services.reserve.stateReserveSeat({
            theaterCode: theaterCode,
            dateJouei: dateJouei,
            titleCode: titleCode,
            titleBranchNum: titleBranchNum,
            timeBegin: timeBegin,
            screenCode: screenCode
        });
        debug(getStateReserveSeatResult.cntReserveFree, 'の空席があります。');
        const sectionCode = getStateReserveSeatResult.listSeat[0].seatSection;
        const freeSeatCodes = getStateReserveSeatResult.listSeat[0].listFreeSeat.map((freeSeat) => freeSeat.seatNum);
        if (getStateReserveSeatResult.cntReserveFree <= 0) {
            throw new Error('no available seats');
        }
        // 座席選択時間
        // tslint:disable-next-line:no-magic-numbers
        yield wait(Math.floor(durationInMillisecond / 6));
        // select a seat randomly
        const selectedSeatCode = freeSeatCodes[Math.floor(freeSeatCodes.length * Math.random())];
        // select a ticket randomly
        let selectedSalesTicket = salesTicketResult[Math.floor(salesTicketResult.length * Math.random())];
        debug('座席の承認アクションを作成します...');
        let seatReservationAuthorization = yield placeOrderTransactions.createSeatReservationAuthorization({
            transactionId: transaction.id,
            eventIdentifier: individualScreeningEvent.identifier,
            offers: [
                {
                    seatSection: sectionCode,
                    seatNumber: selectedSeatCode,
                    ticketInfo: {
                        ticketCode: selectedSalesTicket.ticketCode,
                        mvtkAppPrice: 0,
                        ticketCount: 1,
                        addGlasses: selectedSalesTicket.addGlasses,
                        kbnEisyahousiki: '00',
                        mvtkNum: '',
                        mvtkKbnDenshiken: '00',
                        mvtkKbnMaeuriken: '00',
                        mvtkKbnKensyu: '00',
                        mvtkSalesPrice: 0
                    }
                }
            ]
        });
        debug('座席が承認されました。:', seatReservationAuthorization.id);
        // 座席再選択時間
        // tslint:disable-next-line:no-magic-numbers
        yield wait(Math.floor(durationInMillisecond / 6));
        debug('座席の承認を取り消します...');
        yield placeOrderTransactions.cancelSeatReservationAuthorization({
            transactionId: transaction.id,
            actionId: seatReservationAuthorization.id
        });
        debug('再度座席の承認アクションを作成します...');
        seatReservationAuthorization = yield placeOrderTransactions.createSeatReservationAuthorization({
            transactionId: transaction.id,
            eventIdentifier: individualScreeningEvent.identifier,
            offers: [
                {
                    seatSection: sectionCode,
                    seatNumber: selectedSeatCode,
                    ticketInfo: {
                        ticketCode: selectedSalesTicket.ticketCode,
                        mvtkAppPrice: 0,
                        ticketCount: 1,
                        addGlasses: selectedSalesTicket.addGlasses,
                        kbnEisyahousiki: '00',
                        mvtkNum: '',
                        mvtkKbnDenshiken: '00',
                        mvtkKbnMaeuriken: '00',
                        mvtkKbnKensyu: '00',
                        mvtkSalesPrice: 0
                    }
                }
            ]
        });
        debug('座席が承認されました:', seatReservationAuthorization.id);
        // 券種選択時間
        // tslint:disable-next-line:no-magic-numbers
        yield wait(Math.floor(durationInMillisecond / 6));
        debug('券種を変更します...');
        // select a ticket randomly
        selectedSalesTicket = salesTicketResult[Math.floor(salesTicketResult.length * Math.random())];
        seatReservationAuthorization = yield placeOrderTransactions.changeSeatReservationOffers({
            transactionId: transaction.id,
            actionId: seatReservationAuthorization.id,
            eventIdentifier: individualScreeningEvent.identifier,
            offers: [
                {
                    seatSection: sectionCode,
                    seatNumber: selectedSeatCode,
                    ticketInfo: {
                        ticketCode: selectedSalesTicket.ticketCode,
                        mvtkAppPrice: 0,
                        ticketCount: 1,
                        addGlasses: selectedSalesTicket.addGlasses,
                        kbnEisyahousiki: '00',
                        mvtkNum: '',
                        mvtkKbnDenshiken: '00',
                        mvtkKbnMaeuriken: '00',
                        mvtkKbnKensyu: '00',
                        mvtkSalesPrice: 0
                    }
                }
            ]
        });
        debug('券種が変更されました。', seatReservationAuthorization.id);
        if (seatReservationAuthorization.result === undefined) {
            throw new Error('seatReservationAuthorization.result undefined');
        }
        const amount = seatReservationAuthorization.result.price;
        const orderIdPrefix = util.format('%s%s%s', moment().format('YYYYMMDD'), theaterCode, 
        // tslint:disable-next-line:no-magic-numbers
        `00000000${seatReservationAuthorization.result.updTmpReserveSeatResult.tmpReserveNum}`.slice(-8));
        debug('クレジットカードのオーソリをとります...', orderIdPrefix);
        // tslint:disable-next-line:max-line-length
        const { creditCardAuthorization, numberOfTryAuthorizeCreditCard } = yield authorieCreditCardUntilSuccess(transaction.id, orderIdPrefix, amount);
        debug(numberOfTryAuthorizeCreditCard, '回のトライでクレジットカードのオーソリがとれました。', creditCardAuthorization.id);
        // await wait(5000);
        // debug('canceling a credit card authorization...');
        // await placeOrderTransactions.cancelCreditCardAuthorization({
        //     transactionId: transaction.id,
        //     authorizationId: creditCardAuthorization.id
        // });
        // await wait(5000);
        // debug('recreating a credit card authorization...', orderId);
        // await authorieCreditCardUntilSuccess(transaction.id, orderIdPrefix, amount).then((result) => {
        //     creditCardAuthorization = result.creditCardAuthorization;
        //     numberOfTryAuthorizeCreditCard = result.numberOfTryAuthorizeCreditCard
        // });
        // debug('creditCardAuthorization:', creditCardAuthorization, numberOfTryAuthorizeCreditCard);
        // 購入者情報入力時間
        // tslint:disable-next-line:no-magic-numbers
        yield wait(Math.floor(durationInMillisecond / 6));
        debug('購入者連絡先を登録します...');
        const contact = {
            givenName: 'たろう',
            familyName: 'もーしょん',
            telephone: '09012345678',
            email: process.env.SSKTS_DEVELOPER_EMAIL
        };
        yield placeOrderTransactions.setCustomerContact({
            transactionId: transaction.id,
            contact: contact
        });
        debug('購入者連絡先が登録されました。');
        // 購入情報確認時間
        // tslint:disable-next-line:no-magic-numbers
        yield wait(Math.floor(durationInMillisecond / 6));
        debug('取引を確定します...');
        const order = yield placeOrderTransactions.confirm({
            transactionId: transaction.id
        });
        debug('取引が確定されました。', order.orderNumber);
        return { transaction, order, numberOfTryAuthorizeCreditCard };
    });
}
exports.main = main;
const RETRY_INTERVAL_IN_MILLISECONDS = 5000;
const MAX_NUMBER_OF_RETRY = 10;
function authorieCreditCardUntilSuccess(transactionId, orderIdPrefix, amount) {
    return __awaiter(this, void 0, void 0, function* () {
        let creditCardAuthorization = null;
        let numberOfTryAuthorizeCreditCard = 0;
        while (creditCardAuthorization === null) {
            numberOfTryAuthorizeCreditCard += 1;
            yield wait(RETRY_INTERVAL_IN_MILLISECONDS);
            try {
                creditCardAuthorization = yield placeOrderTransactions.createCreditCardAuthorization({
                    transactionId: transactionId,
                    // 試行毎にオーダーIDを変更
                    // tslint:disable-next-line:no-magic-numbers
                    orderId: `${orderIdPrefix}${`00${numberOfTryAuthorizeCreditCard.toString()}`.slice(-2)}`,
                    amount: amount,
                    method: sskts.GMO.utils.util.Method.Lump,
                    creditCard: {
                        cardNo: '4111111111111111',
                        expire: '2012',
                        holderName: 'AA BB'
                    }
                });
            }
            catch (error) {
                if (numberOfTryAuthorizeCreditCard >= MAX_NUMBER_OF_RETRY) {
                    throw error;
                }
            }
        }
        return {
            creditCardAuthorization,
            numberOfTryAuthorizeCreditCard
        };
    });
}
function wait(waitInMilliseconds) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve) => setTimeout(resolve, waitInMilliseconds));
    });
}
