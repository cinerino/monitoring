"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:insecure-random
/**
 * 注文取引シナリオ
 */
const cinerino = require("@cinerino/domain");
const cinerinoapi = require("@cinerino/api-nodejs-client");
const createDebug = require("debug");
const moment = require("moment");
const util = require("util");
const debug = createDebug('cinerino-monitoring');
const auth = new cinerinoapi.auth.ClientCredentials({
    domain: process.env.API_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.API_CLIENT_ID,
    clientSecret: process.env.API_CLIENT_SECRET,
    scopes: [],
    state: 'teststate'
});
const events = new cinerinoapi.service.Event({
    endpoint: process.env.API_ENDPOINT,
    auth: auth
});
const sellers = new cinerinoapi.service.Seller({
    endpoint: process.env.API_ENDPOINT,
    auth: auth
});
const placeOrderService = new cinerinoapi.service.txn.PlaceOrder4sskts({
    endpoint: process.env.API_ENDPOINT,
    auth: auth
});
const paymentService = new cinerinoapi.service.Payment({
    endpoint: process.env.API_ENDPOINT,
    auth: auth
});
// tslint:disable-next-line:max-func-body-length
function main(theaterCode, durationInMillisecond) {
    return __awaiter(this, void 0, void 0, function* () {
        // 取引の進捗状況
        let progress = '';
        try {
            const searchSellersResult = yield sellers.search({
                location: { branchCodes: [theaterCode] }
            });
            const seller = searchSellersResult.data.shift();
            if (seller === undefined) {
                throw new Error('seller not found');
            }
            progress = `seller found. ${seller.id}`;
            debug(progress);
            // search screening events
            progress = 'searching events...';
            debug(progress);
            const searchEventsResult = yield events.search({
                typeOf: cinerinoapi.factory.chevre.eventType.ScreeningEvent,
                superEvent: { locationBranchCodes: [theaterCode] },
                startFrom: moment()
                    .toDate(),
                startThrough: moment()
                    // tslint:disable-next-line:no-magic-numbers
                    .add(2, 'days')
                    .toDate()
            });
            const screeningEvents = searchEventsResult.data;
            progress = `${screeningEvents.length} events found.`;
            debug(progress);
            const availableEvents = screeningEvents.filter((event) => (event.offer.availability !== 0));
            if (availableEvents.length === 0) {
                throw new Error('No available events');
            }
            // 上映イベント選択時間
            // tslint:disable-next-line:no-magic-numbers
            yield wait(Math.floor(durationInMillisecond / 6));
            const availableEvent = availableEvents[Math.floor(availableEvents.length * Math.random())];
            // retrieve an event detail
            const screeningEvent = yield events.findById({ id: availableEvent.id });
            if (screeningEvent === null) {
                throw new Error('Specified screening event not found');
            }
            const coaInfo = screeningEvent.coaInfo;
            // start a transaction
            progress = 'starting a transaction...';
            debug(progress);
            const transaction = yield placeOrderService.start({
                expires: moment()
                    // tslint:disable-next-line:no-magic-numbers
                    .add(durationInMillisecond + 120000, 'milliseconds')
                    .toDate(),
                agent: {
                    identifier: [
                        { name: 'scenarioProcessId', value: process.pid.toString() }
                    ]
                },
                seller: {
                    typeOf: cinerinoapi.factory.organizationType.MovieTheater,
                    id: seller.id
                }
                // sellerId: movieTheaterOrganization.id
            });
            progress = `transaction started. ${transaction.id}`;
            debug(progress);
            // search sales tickets from cinerino.COA
            // このサンプルは1座席購入なので、制限単位が1枚以上の券種に絞る
            const reserveService = new cinerino.COA.service.Reserve({
                endpoint: process.env.COA_ENDPOINT,
                auth: new cinerino.COA.auth.RefreshToken({
                    endpoint: process.env.COA_ENDPOINT,
                    refreshToken: process.env.COA_REFRESH_TOKEN
                })
            });
            const salesTicketResult = yield reserveService.salesTicket(Object.assign(Object.assign({}, coaInfo), { flgMember: cinerino.COA.factory.reserve.FlgMember.NonMember }))
                .then((results) => results.filter((result) => result.limitUnit === '001' && result.limitCount === 1));
            progress = `${salesTicketResult.length} sales ticket found.`;
            debug(progress);
            // search available seats from cinerino.COA
            const getStateReserveSeatResult = yield reserveService.stateReserveSeat(coaInfo);
            progress = `${getStateReserveSeatResult.cntReserveFree} seats available.`;
            debug(progress);
            const sectionCode = getStateReserveSeatResult.listSeat[0].seatSection;
            const freeSeatCodes = getStateReserveSeatResult.listSeat[0].listFreeSeat.map((freeSeat) => freeSeat.seatNum);
            if (getStateReserveSeatResult.cntReserveFree <= 0) {
                throw new Error('No available seats');
            }
            // 座席選択時間
            // tslint:disable-next-line:no-magic-numbers
            yield wait(Math.floor(durationInMillisecond / 6));
            // select a seat randomly
            const selectedSeatCode = freeSeatCodes[Math.floor(freeSeatCodes.length * Math.random())];
            // select a ticket randomly
            let selectedSalesTicket = salesTicketResult[Math.floor(salesTicketResult.length * Math.random())];
            progress = 'authorizing seat reservation...';
            debug(progress);
            let seatReservationAuthorization = yield placeOrderService.createSeatReservationAuthorization({
                purpose: { typeOf: transaction.typeOf, id: transaction.id },
                object: {
                    event: { id: screeningEvent.id },
                    acceptedOffer: [
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
                }
            });
            progress = `seat reservation authorized. ${seatReservationAuthorization.id}`;
            debug(progress);
            // 座席再選択時間
            // tslint:disable-next-line:no-magic-numbers
            yield wait(Math.floor(durationInMillisecond / 6));
            progress = 'canceling seat reservation authorization...';
            debug(progress);
            yield placeOrderService.cancelSeatReservationAuthorization({
                purpose: { typeOf: transaction.typeOf, id: transaction.id },
                id: seatReservationAuthorization.id
            });
            progress = 'reauthorizaing seat reservation...';
            debug(progress);
            seatReservationAuthorization = yield placeOrderService.createSeatReservationAuthorization({
                purpose: { typeOf: transaction.typeOf, id: transaction.id },
                object: {
                    event: { id: screeningEvent.id },
                    acceptedOffer: [
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
                }
            });
            progress = `seat reservation authorized. ${seatReservationAuthorization.id}`;
            debug(progress);
            // 券種選択時間
            // tslint:disable-next-line:no-magic-numbers
            yield wait(Math.floor(durationInMillisecond / 6));
            progress = 'changing sales ticket...';
            debug(progress);
            // select a ticket randomly
            selectedSalesTicket = salesTicketResult[Math.floor(salesTicketResult.length * Math.random())];
            seatReservationAuthorization = yield placeOrderService.changeSeatReservationOffers({
                purpose: { typeOf: transaction.typeOf, id: transaction.id },
                id: seatReservationAuthorization.id,
                object: {
                    event: { id: screeningEvent.id },
                    acceptedOffer: [
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
                }
            });
            progress = `sales ticket changed. ${seatReservationAuthorization.id}`;
            debug(progress);
            if (seatReservationAuthorization.result === undefined) {
                throw new Error('seatReservationAuthorization.result undefined');
            }
            const amount = seatReservationAuthorization.result.price;
            const orderIdPrefix = util.format('%s%s%s', moment()
                .format('YYYYMMDD'), theaterCode, 
            // tslint:disable-next-line:no-magic-numbers
            `00000000${seatReservationAuthorization.result.responseBody.tmpReserveNum}`.slice(-8));
            progress = `authorizing credit card... ${orderIdPrefix}`;
            debug(progress);
            // tslint:disable-next-line:max-line-length
            const { creditCardAuthorization, numberOfTryAuthorizeCreditCard } = yield authorieCreditCardUntilSuccess(transaction.id, orderIdPrefix, amount);
            progress = `credit card authorized with ${numberOfTryAuthorizeCreditCard} tries. ${creditCardAuthorization.id}`;
            debug(progress);
            // await wait(5000);
            // 購入者情報入力時間
            // tslint:disable-next-line:no-magic-numbers
            yield wait(Math.floor(durationInMillisecond / 6));
            progress = 'setting customer profile...';
            debug(progress);
            const profile = {
                givenName: 'たろう',
                familyName: 'もーしょん',
                telephone: '09012345678',
                email: process.env.DEVELOPER_EMAIL
            };
            yield placeOrderService.setProfile({
                id: transaction.id,
                agent: profile
            });
            progress = 'customer profile set.';
            debug(progress);
            // 購入情報確認時間
            // tslint:disable-next-line:no-magic-numbers
            yield wait(Math.floor(durationInMillisecond / 6));
            progress = 'confirming a transaction...';
            debug(progress);
            const { order } = yield placeOrderService.confirm({
                id: transaction.id
            });
            progress = `transaction confirmed. ${order.orderNumber}`;
            debug(progress);
            return { progress, transaction, order, numberOfTryAuthorizeCreditCard };
        }
        catch (error) {
            error.progress = progress;
            // tslint:disable-next-line:no-magic-numbers
            error.code = (error.code !== undefined) ? error.code : '';
            throw error;
        }
    });
}
exports.main = main;
const RETRY_INTERVAL_IN_MILLISECONDS = 5000;
const MAX_NUMBER_OF_RETRY = 10;
function authorieCreditCardUntilSuccess(transactionId, orderIdPrefix, amount) {
    return __awaiter(this, void 0, void 0, function* () {
        // tslint:disable-next-line:no-null-keyword
        let creditCardAuthorization = null;
        let numberOfTryAuthorizeCreditCard = 0;
        while (creditCardAuthorization === null) {
            numberOfTryAuthorizeCreditCard += 1;
            yield wait(RETRY_INTERVAL_IN_MILLISECONDS);
            try {
                creditCardAuthorization = yield paymentService.authorizeCreditCard({
                    purpose: { typeOf: cinerinoapi.factory.transactionType.PlaceOrder, id: transactionId },
                    object: {
                        typeOf: cinerinoapi.factory.paymentMethodType.CreditCard,
                        // 試行毎にオーダーIDを変更
                        // tslint:disable-next-line:no-magic-numbers
                        orderId: `${orderIdPrefix}${`00${numberOfTryAuthorizeCreditCard.toString()}`.slice(-2)}`,
                        amount: amount,
                        method: cinerino.GMO.utils.util.Method.Lump,
                        creditCard: {
                            cardNo: '4111111111111111',
                            expire: '2024',
                            holderName: 'TARO MOTION'
                        }
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
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve();
            }, waitInMilliseconds);
        });
    });
}
