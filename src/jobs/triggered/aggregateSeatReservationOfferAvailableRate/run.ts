/**
 * 座席予約の空席時間率を算出する
 * 実験的実装
 */
// import * as cinerino from '@cinerino/domain';
import * as createDebug from 'debug';
// import * as fs from 'fs';
// import * as moment from 'moment';
import * as mongoose from 'mongoose';

import mongooseConnectionOptions from '../../../mongooseConnectionOptions';

const debug = createDebug('cinerino-monitoring');

// const TIME_UNIT: moment.unitOfTime.Diff = 'seconds';

// tslint:disable-next-line:max-func-body-length
export async function aggregateOfferAvailableHoursRateByScreen(__: string, ___: string) {
    // // ここ1ヵ月の座席に対する上映イベントリストを取得
    // const masterService = new cinerino.COA.service.Master({
    //     endpoint: <string>process.env.COA_ENDPOINT,
    //     auth: new cinerino.COA.auth.RefreshToken({
    //         endpoint: <string>process.env.COA_ENDPOINT,
    //         refreshToken: <string>process.env.COA_REFRESH_TOKEN
    //     })
    // });

    // const orderRepo = new cinerino.repository.Order(mongoose.connection);

    // const screenResult = await masterService.screen({ theaterCode: theaterCode });
    // const screeningRoom = screenResult.find((p) => p.screenCode === screenBranchCode);
    // if (screeningRoom === undefined) {
    //     throw new Error('screeningRoom not found.');
    // }
    // const seats = screeningRoom.listSeat;
    // if (seats === undefined) {
    //     throw new Error('seats not found.');
    // }

    // let events = await eventRepo.eventModel.find(
    //     {
    //         typeOf: cinerino.factory.chevre.eventType.ScreeningEvent,
    //         startDate: {
    //             $gte: moment()
    //                 // tslint:disable-next-line:no-magic-numbers
    //                 .add(-3, 'months')
    //                 .toDate()
    //         },
    //         'location.branchCode': screenBranchCode,
    //         'superEvent.location.branchCode': theaterCode
    //     },
    //     'name startDate coaInfo.rsvStartDate'
    // )
    //     .exec()
    //     .then((docs) => docs
    //         .map((doc) => doc.toObject())
    //         .map((e) => {
    //             return {
    //                 id: <string>e.id,
    //                 startDate: <Date>e.startDate,
    //                 reserveStartDate: moment(`${e.coaInfo.rsvStartDate} 00:00:00+09:00`, 'YYYYMMDD HH:mm:ssZ')
    //                     .toDate(),
    //                 // tslint:disable-next-line:no-null-keyword
    //                 firstOrderDate: <Date | null>null
    //             };
    //         }));
    // debug(events.length, 'events found.');

    // // イベントに対する注文を取得
    // const orders = await orderRepo.orderModel.find(
    //     { 'acceptedOffers.itemOffered.reservationFor.id': { $in: events.map((e) => e.id) } },
    //     'acceptedOffers orderDate'
    // )
    //     .exec()
    //     .then((docs) => docs.map((doc) => doc.toObject()));
    // debug(orders.length, 'orders found.');

    // // 最初の注文をイベントごとに取り出す
    // events = events.map((e) => {
    //     const ordersOnEvent = orders
    //         .filter((o) => o.acceptedOffers[0].itemOffered.reservationFor.id === e.id)
    //         .sort((a, b) => (a.orderDate < b.orderDate) ? -1 : 1);

    //     return {
    //         ...e,
    //         // tslint:disable-next-line:no-null-keyword
    //         firstOrderDate: (ordersOnEvent.length > 0) ? ordersOnEvent[0].orderDate : null
    //     };
    // });

    // // 注文がないイベントは集計から除外
    // events = events.filter((e) => e.firstOrderDate !== null);

    // const aggregations = seats.map((seat) => {
    //     // 各上映イベントにおける、注文日時、予約開始日時、上映開始日時と比較する
    //     // 供給時間sum
    //     const offeredHours = events.reduce(
    //         (a, b) => a + moment(b.startDate)
    //             .diff(moment(<Date>b.firstOrderDate), TIME_UNIT),
    //         0
    //     );

    //     // 空席時間sum
    //     const availableHours = events.reduce(
    //         (a, b) => {
    //             const order = orders.find((o) => {
    //                 return o.acceptedOffers[0].itemOffered.reservationFor.id === b.id
    //                     && o.acceptedOffers[0].itemOffered.reservedTicket.ticketedSeat.seatNumber === seat.seatNum;
    //             });
    //             if (order === undefined) {
    //                 return a + moment(b.startDate)
    //                     .diff(moment(<Date>b.firstOrderDate), TIME_UNIT);
    //             } else {
    //                 // 注文が入っていれば、最初の予約から自分の予約までの時間
    //                 return a + moment(order.orderDate)
    //                     .diff(moment(<Date>b.firstOrderDate), TIME_UNIT);
    //             }
    //         },
    //         0
    //     );

    //     return {
    //         seatNumber: seat.seatNum,
    //         offeredHours: offeredHours,
    //         availableHours: availableHours,
    //         // tslint:disable-next-line:no-magic-numbers
    //         availableRate: Math.floor(availableHours * 100 / offeredHours)
    //     };
    // });
    // debug(aggregations);

    // const path = `${__dirname}/../../../../output/aggregations-${theaterCode}-${screenBranchCode}.json`;
    // // tslint:disable-next-line:non-literal-fs-path no-null-keyword
    // fs.writeFileSync(path, JSON.stringify(aggregations, null, '    '));
}

const screenBranchCodes = [
    '10',
    '100',
    '110',
    '120',
    '121',
    '122',
    '123',
    '20',
    '30',
    '40',
    '41',
    '50',
    '60',
    '70',
    '80',
    '90'
];
const promises = screenBranchCodes.map(async (screenBranchCode) => {
    try {
        await aggregateOfferAvailableHoursRateByScreen('120', screenBranchCode);
    } catch (error) {
        // tslint:disable-next-line:no-console
        console.error(error);
    }
});

mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions)
    .then()
    // tslint:disable-next-line:no-console
    .catch(console.error);

Promise.all(promises)
    .then(() => {
        debug('success!');
    })
    .catch((err) => {
        // tslint:disable-next-line:no-console
        console.error(err);
        process.exit(1);
    })
    .then(async () => {
        await mongoose.disconnect();
    })
    .catch((err) => {
        // tslint:disable-next-line:no-console
        console.error(err);
        process.exit(1);
    });
