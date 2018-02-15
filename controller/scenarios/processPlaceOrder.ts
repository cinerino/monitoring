// tslint:disable:insecure-random

/**
 * 注文取引シナリオ
 * @module
 */

import * as sasaki from '@motionpicture/sskts-api-nodejs-client';
import * as sskts from '@motionpicture/sskts-domain';
import * as createDebug from 'debug';
import * as moment from 'moment';
import * as util from 'util';

const debug = createDebug('sskts-monitoring-jobs');

const auth = new sasaki.auth.ClientCredentials({
    domain: <string>process.env.SSKTS_API_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.SSKTS_API_CLIENT_ID,
    clientSecret: <string>process.env.SSKTS_API_CLIENT_SECRET,
    scopes: [
        `${process.env.SSKTS_API_RESOURCE_SERVER_IDENTIFIER}/transactions`,
        `${process.env.SSKTS_API_RESOURCE_SERVER_IDENTIFIER}/events.read-only`,
        `${process.env.SSKTS_API_RESOURCE_SERVER_IDENTIFIER}/organizations.read-only`
    ],
    state: 'teststate'
});

const events = sasaki.service.event({
    endpoint: <string>process.env.SSKTS_API_ENDPOINT,
    auth: auth
});

const organizations = sasaki.service.organization({
    endpoint: <string>process.env.SSKTS_API_ENDPOINT,
    auth: auth
});

const placeOrderTransactions = sasaki.service.transaction.placeOrder({
    endpoint: <string>process.env.SSKTS_API_ENDPOINT,
    auth: auth
});

// tslint:disable-next-line:max-func-body-length
export async function main(theaterCode: string, durationInMillisecond: number) {
    // search movie theater organizations
    const movieTheaterOrganization = await organizations.findMovieTheaterByBranchCode({
        branchCode: theaterCode
    });
    if (movieTheaterOrganization === null) {
        throw new Error('movie theater shop not open');
    }

    // search screening events
    const individualScreeningEvents = await events.searchIndividualScreeningEvent({
        superEventLocationIdentifiers: [movieTheaterOrganization.identifier],
        startFrom: moment().toDate(),
        // tslint:disable-next-line:no-magic-numbers
        startThrough: moment().add(2, 'days').toDate()
    });
    debug('individualScreeningEvents length:', individualScreeningEvents.length);

    const availableEvents = individualScreeningEvents.filter(
        (event) => (event.offer.availability !== 0)
    );
    if (availableEvents.length === 0) {
        throw new Error('no available events');
    }

    // 上映イベント選択時間
    // tslint:disable-next-line:no-magic-numbers
    await wait(Math.floor(durationInMillisecond / 6));

    const availableEvent = availableEvents[Math.floor(availableEvents.length * Math.random())];

    // retrieve an event detail
    const individualScreeningEvent = await events.findIndividualScreeningEvent({
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
    debug('starting a transaction...');
    const transaction = await placeOrderTransactions.start({
        // tslint:disable-next-line:no-magic-numbers
        expires: moment().add(durationInMillisecond + 120000, 'milliseconds').toDate(),
        sellerId: movieTheaterOrganization.id
    });
    debug('transaction started.', transaction);

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
    debug('salesTicketResult:', salesTicketResult);

    // search available seats from sskts.COA
    const getStateReserveSeatResult = await sskts.COA.services.reserve.stateReserveSeat({
        theaterCode: theaterCode,
        dateJouei: dateJouei,
        titleCode: titleCode,
        titleBranchNum: titleBranchNum,
        timeBegin: timeBegin,
        screenCode: screenCode
    });
    debug('getStateReserveSeatResult:', getStateReserveSeatResult);
    const sectionCode = getStateReserveSeatResult.listSeat[0].seatSection;
    const freeSeatCodes = getStateReserveSeatResult.listSeat[0].listFreeSeat.map((freeSeat) => {
        return freeSeat.seatNum;
    });
    debug('sectionCode:', sectionCode);
    debug('freeSeatCodes:', freeSeatCodes);
    if (getStateReserveSeatResult.cntReserveFree <= 0) {
        throw new Error('no available seats');
    }

    // 座席選択時間
    // tslint:disable-next-line:no-magic-numbers
    await wait(Math.floor(durationInMillisecond / 6));

    // select a seat randomly
    const selectedSeatCode = freeSeatCodes[Math.floor(freeSeatCodes.length * Math.random())];

    // select a ticket randomly
    let selectedSalesTicket = salesTicketResult[Math.floor(salesTicketResult.length * Math.random())];

    debug('creating a seat reservation authorization...');
    let seatReservationAuthorization = await placeOrderTransactions.createSeatReservationAuthorization({
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
    debug('seatReservationAuthorization:', seatReservationAuthorization);

    // 座席再選択時間
    // tslint:disable-next-line:no-magic-numbers
    await wait(Math.floor(durationInMillisecond / 6));

    debug('canceling a seat reservation authorization...');
    await placeOrderTransactions.cancelSeatReservationAuthorization({
        transactionId: transaction.id,
        actionId: seatReservationAuthorization.id
    });

    debug('recreating a seat reservation authorization...');
    seatReservationAuthorization = await placeOrderTransactions.createSeatReservationAuthorization({
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
    debug('seatReservationAuthorization:', seatReservationAuthorization);

    // 券種選択時間
    // tslint:disable-next-line:no-magic-numbers
    await wait(Math.floor(durationInMillisecond / 6));

    debug('券種を変更します...');
    // select a ticket randomly
    selectedSalesTicket = salesTicketResult[Math.floor(salesTicketResult.length * Math.random())];
    seatReservationAuthorization = await placeOrderTransactions.changeSeatReservationOffers({
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
    debug('seatReservationAuthorization:', seatReservationAuthorization);
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
    debug('creating a credit card authorization...', orderIdPrefix);
    // tslint:disable-next-line:max-line-length
    const { creditCardAuthorization, numberOfTryAuthorizeCreditCard } = await authorieCreditCardUntilSuccess(transaction.id, orderIdPrefix, amount);
    debug('creditCardAuthorization:', creditCardAuthorization, numberOfTryAuthorizeCreditCard);

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

    debug('registering a customer contact...');
    const contact = {
        givenName: 'たろう',
        familyName: 'もーしょん',
        telephone: '09012345678',
        email: <string>process.env.SSKTS_DEVELOPER_EMAIL
    };
    await placeOrderTransactions.setCustomerContact({
        transactionId: transaction.id,
        contact: contact
    }).then((result) => {
        debug('customer contact registered.', result);
    });

    // 購入情報確認時間
    // tslint:disable-next-line:no-magic-numbers
    await wait(Math.floor(durationInMillisecond / 6));

    debug('confirming a transaction...');
    const order = await placeOrderTransactions.confirm({
        transactionId: transaction.id
    });
    debug('confirmed. order:', order);

    return { transaction, order, numberOfTryAuthorizeCreditCard };
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
