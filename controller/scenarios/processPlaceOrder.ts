// tslint:disable:insecure-random
/**
 * 注文取引シナリオ
 */
import * as ssktsapi from '@motionpicture/sskts-api-nodejs-client';
import * as sskts from '@motionpicture/sskts-domain';
import * as createDebug from 'debug';
import * as moment from 'moment';
import * as util from 'util';

const debug = createDebug('sskts-monitoring-jobs');

const auth = new ssktsapi.auth.ClientCredentials({
    domain: <string>process.env.SSKTS_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.SSKTS_CLIENT_ID,
    clientSecret: <string>process.env.SSKTS_CLIENT_SECRET,
    scopes: [],
    state: 'teststate'
});

const events = new ssktsapi.service.Event({
    endpoint: <string>process.env.SSKTS_ENDPOINT,
    auth: auth
});

const sellers = new ssktsapi.service.Seller({
    endpoint: <string>process.env.SSKTS_ENDPOINT,
    auth: auth
});

const placeOrderTransactions = new ssktsapi.service.transaction.PlaceOrder({
    endpoint: <string>process.env.SSKTS_ENDPOINT,
    auth: auth
});

// tslint:disable-next-line:max-func-body-length
export async function main(theaterCode: string, durationInMillisecond: number) {
    // 取引の進捗状況
    let progress = '';

    try {
        // search movie theater organizations
        const searchSellersResult = await sellers.search({
            location: { branchCodes: [theaterCode] }
        });
        const movieTheaterOrganization = searchSellersResult.data.shift();
        if (movieTheaterOrganization === undefined) {
            throw new Error('movie theater shop not open');
        }
        progress = `movie theater found. ${movieTheaterOrganization.id}`;
        debug(progress);

        // search screening events
        progress = 'searching events...';
        debug(progress);
        const searchEventsResult = await events.searchScreeningEvents({
            typeOf: ssktsapi.factory.eventType.ScreeningEvent,
            superEvent: { locationBranchCodes: [theaterCode] },
            startFrom: moment().toDate(),
            // tslint:disable-next-line:no-magic-numbers
            startThrough: moment().add(2, 'days').toDate()
        });
        const screeningEvents = searchEventsResult.data;
        progress = `${screeningEvents.length} events found.`;
        debug(progress);

        const availableEvents = screeningEvents.filter(
            (event) => ((<any>event).offer.availability !== 0)
        );
        if (availableEvents.length === 0) {
            throw new Error('No available events');
        }

        // 上映イベント選択時間
        // tslint:disable-next-line:no-magic-numbers
        await wait(Math.floor(durationInMillisecond / 6));

        const availableEvent = availableEvents[Math.floor(availableEvents.length * Math.random())];

        // retrieve an event detail

        const screeningEvent = await events.findScreeningEventById(availableEvent);
        if (screeningEvent === null) {
            throw new Error('Specified screening event not found');
        }
        const coaInfo = <ssktsapi.factory.event.screeningEvent.ICOAInfo>screeningEvent.coaInfo;

        const dateJouei = coaInfo.dateJouei;
        const titleCode = coaInfo.titleCode;
        const titleBranchNum = coaInfo.titleBranchNum;
        const timeBegin = coaInfo.timeBegin;
        const screenCode = coaInfo.screenCode;

        // start a transaction
        progress = 'starting a transaction...';
        debug(progress);
        const transaction = await placeOrderTransactions.start({
            // tslint:disable-next-line:no-magic-numbers
            expires: moment().add(durationInMillisecond + 120000, 'milliseconds').toDate(),
            sellerId: movieTheaterOrganization.id
        });
        progress = `transaction started. ${transaction.id}`;
        debug(progress);

        // search sales tickets from sskts.COA
        // このサンプルは1座席購入なので、制限単位が1枚以上の券種に絞る
        const salesTicketResult = await sskts.COA.services.reserve.salesTicket({
            theaterCode: theaterCode,
            dateJouei: dateJouei,
            titleCode: titleCode,
            titleBranchNum: titleBranchNum,
            timeBegin: timeBegin,
            flgMember: sskts.COA.services.reserve.FlgMember.NonMember
        }).then((results) => results.filter((result) => result.limitUnit === '001' && result.limitCount === 1));
        progress = `${salesTicketResult.length} sales ticket found.`;
        debug(progress);

        // search available seats from sskts.COA
        const getStateReserveSeatResult = await sskts.COA.services.reserve.stateReserveSeat({
            theaterCode: theaterCode,
            dateJouei: dateJouei,
            titleCode: titleCode,
            titleBranchNum: titleBranchNum,
            timeBegin: timeBegin,
            screenCode: screenCode
        });
        progress = `${getStateReserveSeatResult.cntReserveFree} seats available.`;
        debug(progress);
        const sectionCode = getStateReserveSeatResult.listSeat[0].seatSection;
        const freeSeatCodes = getStateReserveSeatResult.listSeat[0].listFreeSeat.map((freeSeat) => freeSeat.seatNum);
        if (getStateReserveSeatResult.cntReserveFree <= 0) {
            throw new Error('No available seats');
        }

        // 座席選択時間
        // tslint:disable-next-line:no-magic-numbers
        await wait(Math.floor(durationInMillisecond / 6));

        // select a seat randomly
        const selectedSeatCode = freeSeatCodes[Math.floor(freeSeatCodes.length * Math.random())];

        // select a ticket randomly
        let selectedSalesTicket = salesTicketResult[Math.floor(salesTicketResult.length * Math.random())];

        progress = 'authorizing seat reservation...';
        debug(progress);
        let seatReservationAuthorization = await placeOrderTransactions.createSeatReservationAuthorization({
            transactionId: transaction.id,
            eventIdentifier: screeningEvent.identifier,
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
        progress = `seat reservation authorized. ${seatReservationAuthorization.id}`;
        debug(progress);

        // 座席再選択時間
        // tslint:disable-next-line:no-magic-numbers
        await wait(Math.floor(durationInMillisecond / 6));

        progress = 'canceling seat reservation authorization...';
        debug(progress);
        await placeOrderTransactions.cancelSeatReservationAuthorization({
            transactionId: transaction.id,
            actionId: seatReservationAuthorization.id
        });

        progress = 'reauthorizaing seat reservation...';
        debug(progress);
        seatReservationAuthorization = await placeOrderTransactions.createSeatReservationAuthorization({
            transactionId: transaction.id,
            eventIdentifier: screeningEvent.identifier,
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
        progress = `seat reservation authorized. ${seatReservationAuthorization.id}`;
        debug(progress);

        // 券種選択時間
        // tslint:disable-next-line:no-magic-numbers
        await wait(Math.floor(durationInMillisecond / 6));

        progress = 'changing sales ticket...';
        debug(progress);
        // select a ticket randomly
        selectedSalesTicket = salesTicketResult[Math.floor(salesTicketResult.length * Math.random())];
        seatReservationAuthorization = await placeOrderTransactions.changeSeatReservationOffers({
            transactionId: transaction.id,
            actionId: seatReservationAuthorization.id,
            eventIdentifier: screeningEvent.identifier,
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
        progress = `sales ticket changed. ${seatReservationAuthorization.id}`;
        debug(progress);
        if (seatReservationAuthorization.result === undefined) {
            throw new Error('seatReservationAuthorization.result undefined');
        }

        const amount = seatReservationAuthorization.result.price;
        const orderIdPrefix = util.format(
            '%s%s%s',
            moment().format('YYYYMMDD'),
            theaterCode,
            // tslint:disable-next-line:no-magic-numbers
            `00000000${seatReservationAuthorization.result.updTmpReserveSeatResult.tmpReserveNum}`.slice(-8)
        );
        progress = `authorizing credit card... ${orderIdPrefix}`;
        debug(progress);
        // tslint:disable-next-line:max-line-length
        const { creditCardAuthorization, numberOfTryAuthorizeCreditCard } = await authorieCreditCardUntilSuccess(transaction.id, orderIdPrefix, amount);
        progress = `credit card authorized with ${numberOfTryAuthorizeCreditCard} tries. ${creditCardAuthorization.id}`;
        debug(progress);

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
        await wait(Math.floor(durationInMillisecond / 6));

        progress = 'setting customer contact...';
        debug(progress);
        const contact = {
            givenName: 'たろう',
            familyName: 'もーしょん',
            telephone: '09012345678',
            email: <string>process.env.SSKTS_DEVELOPER_EMAIL
        };
        await placeOrderTransactions.setCustomerContact({
            transactionId: transaction.id,
            contact: contact
        });
        progress = 'customer contact set.';
        debug(progress);

        // 購入情報確認時間
        // tslint:disable-next-line:no-magic-numbers
        await wait(Math.floor(durationInMillisecond / 6));

        progress = 'confirming a transaction...';
        debug(progress);
        const order = await placeOrderTransactions.confirm({
            transactionId: transaction.id,
            sendEmailMessage: true
        });
        progress = `transaction confirmed. ${order.orderNumber}`;
        debug(progress);

        return { progress, transaction, order, numberOfTryAuthorizeCreditCard };
    } catch (error) {
        error.progress = progress;
        // tslint:disable-next-line:no-magic-numbers
        error.code = (error.code !== undefined) ? error.code : '';
        throw error;
    }
}

const RETRY_INTERVAL_IN_MILLISECONDS = 5000;
const MAX_NUMBER_OF_RETRY = 10;
async function authorieCreditCardUntilSuccess(transactionId: string, orderIdPrefix: string, amount: number) {
    let creditCardAuthorization = null;
    let numberOfTryAuthorizeCreditCard = 0;

    while (creditCardAuthorization === null) {
        numberOfTryAuthorizeCreditCard += 1;

        await wait(RETRY_INTERVAL_IN_MILLISECONDS);

        try {
            creditCardAuthorization = await placeOrderTransactions.createCreditCardAuthorization({
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
        } catch (error) {
            if (numberOfTryAuthorizeCreditCard >= MAX_NUMBER_OF_RETRY) {
                throw error;
            }
        }
    }

    return {
        creditCardAuthorization,
        numberOfTryAuthorizeCreditCard
    };
}

async function wait(waitInMilliseconds: number) {
    return new Promise((resolve) => setTimeout(resolve, waitInMilliseconds));
}
