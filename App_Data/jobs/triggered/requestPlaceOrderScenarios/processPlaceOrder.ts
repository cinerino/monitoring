// tslint:disable:insecure-random

/**
 * a sample processing placeOrder transaction
 * @ignore
 */

import * as sasaki from '@motionpicture/sskts-api-nodejs-client';
import * as sskts from '@motionpicture/sskts-domain';
import * as createDebug from 'debug';
import * as moment from 'moment';
import * as util from 'util';

const debug = createDebug('sskts-monitoring-jobs:requestPlaceOrderScenarios');

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
export async function main(theaterCode: string) {
    // search screening events
    const individualScreeningEvents = await events.searchIndividualScreeningEvent({
        theater: theaterCode,
        day: moment().add(1, 'day').format('YYYYMMDD')
    });

    const availableEvents = individualScreeningEvents.filter(
        (event) => (event.offer.availability !== null && event.offer.availability > 0)
    );
    if (availableEvents.length === 0) {
        throw new Error('no available events');
    }

    // tslint:disable-next-line:no-magic-numbers
    await wait(5000);

    const availableEvent = availableEvents[Math.floor(availableEvents.length * Math.random())];

    // retrieve an event detail
    const individualScreeningEvent = await events.findIndividualScreeningEvent({
        identifier: availableEvent.identifier
    });
    if (individualScreeningEvent === null) {
        throw new Error('specified screening event not found');
    }

    // search movie theater organizations
    const movieTheaterOrganization = await organizations.findMovieTheaterByBranchCode({
        branchCode: individualScreeningEvent.coaInfo.theaterCode
    });
    if (movieTheaterOrganization === null) {
        throw new Error('movie theater shop not open');
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
        expires: moment().add(10, 'minutes').toDate(),
        sellerId: movieTheaterOrganization.id
    });

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
    if (getStateReserveSeatResult.cntReserveFree <= 0) {
        throw new Error('no available seats');
    }

    // tslint:disable-next-line:no-magic-numbers
    await wait(5000);

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
                    // ticketName: selectedSalesTicket.ticketName,
                    // ticketNameEng: selectedSalesTicket.ticketNameEng,
                    // ticketNameKana: selectedSalesTicket.ticketNameKana,
                    // stdPrice: selectedSalesTicket.stdPrice,
                    // addPrice: selectedSalesTicket.addPrice,
                    // disPrice: 0,
                    // salePrice: selectedSalesTicket.salePrice,
                    mvtkAppPrice: 0,
                    ticketCount: 1,
                    // seatNum: selectedSeatCode,
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

    debug('canceling a seat reservation authorization...');
    await placeOrderTransactions.cancelSeatReservationAuthorization({
        transactionId: transaction.id,
        actionId: seatReservationAuthorization.id
    });

    // tslint:disable-next-line:no-magic-numbers
    await wait(1000);

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
                    // ticketName: selectedSalesTicket.ticketName,
                    // ticketNameEng: selectedSalesTicket.ticketNameEng,
                    // ticketNameKana: selectedSalesTicket.ticketNameKana,
                    // stdPrice: selectedSalesTicket.stdPrice,
                    // addPrice: selectedSalesTicket.addPrice,
                    // disPrice: 0,
                    // salePrice: selectedSalesTicket.salePrice,
                    mvtkAppPrice: 0,
                    ticketCount: 1,
                    // seatNum: selectedSeatCode,
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

    // tslint:disable-next-line:no-magic-numbers
    await wait(5000);

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
                    // ticketName: selectedSalesTicket.ticketName,
                    // ticketNameEng: selectedSalesTicket.ticketNameEng,
                    // ticketNameKana: selectedSalesTicket.ticketNameKana,
                    // stdPrice: selectedSalesTicket.stdPrice,
                    // addPrice: selectedSalesTicket.addPrice,
                    // disPrice: 0,
                    // salePrice: selectedSalesTicket.salePrice,
                    mvtkAppPrice: 0,
                    ticketCount: 1,
                    // seatNum: selectedSeatCode,
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

    debug('registering a customer contact...');
    const contact = {
        givenName: 'John',
        familyName: 'Smith',
        telephone: '09012345678',
        email: <string>process.env.SSKTS_DEVELOPER_EMAIL
    };
    await placeOrderTransactions.setCustomerContact({
        transactionId: transaction.id,
        contact: contact
    }).then((result) => {
        debug('customer contact registered.', result);
    });

    // tslint:disable-next-line:no-magic-numbers
    await wait(3000);

    debug('confirming a transaction...');
    const order = await placeOrderTransactions.confirm({
        transactionId: transaction.id
    });
    debug('confirmed. order:', order);

    // send an email
    const content = `Dear ${order.customer.name}
-------------------
Thank you for the order below.
-------------------
confirmationNumber: ${order.orderInquiryKey.confirmationNumber}
telephone: ${order.orderInquiryKey.telephone}
amount: ${order.price} yen
-------------------
`;
    debug('sending an email notification...', content);
    await placeOrderTransactions.sendEmailNotification({
        transactionId: transaction.id,
        emailMessageAttributes: {
            sender: {
                name: transaction.seller.name,
                email: 'noreply@example.com'
            },
            toRecipient: {
                name: `${contact.familyName} ${contact.givenName}`,
                email: contact.email
            },
            // tslint:disable-next-line:max-line-length
            about: `${individualScreeningEvent.superEvent.location.name.ja} Your order created [${individualScreeningEvent.superEvent.workPerformed.name}]`,
            text: content
        }
    });
    debug('an email sent');

    return { transaction, order, numberOfTryAuthorizeCreditCard };
}

const RETRY_INTERVAL_IN_MILLISECONDS = 5000;
const MAX_NUMBER_OF_RETRY = 10;
async function authorieCreditCardUntilSuccess(transactionId: string, orderIdPrefix: string, amount: number) {
    let creditCardAuthorization = null;
    let numberOfTryAuthorizeCreditCard = 0;

    while (creditCardAuthorization === null) {
        numberOfTryAuthorizeCreditCard += 1;

        if (numberOfTryAuthorizeCreditCard > 1) {
            await wait(RETRY_INTERVAL_IN_MILLISECONDS);
        }

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
