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
 * 座席予約の空席時間率を算出する
 * 実験的実装
 */
const sskts = require("@motionpicture/sskts-domain");
const createDebug = require("debug");
const fs = require("fs");
const moment = require("moment");
const mongoose = require("mongoose");
const mongooseConnectionOptions_1 = require("../../../../mongooseConnectionOptions");
const debug = createDebug('sskts-monitoring-jobs');
const TIME_UNIT = 'seconds';
// tslint:disable-next-line:max-func-body-length
function aggregateOfferAvailableHoursRateByScreen(theaterCode, screenBranchCode) {
    return __awaiter(this, void 0, void 0, function* () {
        // ここ1ヵ月の座席に対する上映イベントリストを取得
        const placeRepo = new sskts.repository.Place(mongoose.connection);
        const eventRepo = new sskts.repository.Event(mongoose.connection);
        const orderRepo = new sskts.repository.Order(mongoose.connection);
        const movieTheater = yield placeRepo.findMovieTheaterByBranchCode(theaterCode);
        const screeningRoom = movieTheater.containsPlace.find((p) => p.branchCode === screenBranchCode);
        if (screeningRoom === undefined) {
            throw new Error('screeningRoom not found.');
        }
        const screeningRoomSections = screeningRoom.containsPlace;
        if (screeningRoomSections === undefined) {
            throw new Error('screeningRoomSection not found.');
        }
        const screeningRoomSection = screeningRoomSections[0];
        const seats = screeningRoomSection.containsPlace;
        if (seats === undefined) {
            throw new Error('seats not found.');
        }
        let events = yield eventRepo.eventModel.find({
            typeOf: sskts.factory.eventType.IndividualScreeningEvent,
            // tslint:disable-next-line:no-magic-numbers
            startDate: { $gte: moment().add(-3, 'months').toDate() },
            'location.branchCode': screenBranchCode,
            'superEvent.location.branchCode': theaterCode
        }, 'identifier name startDate coaInfo.rsvStartDate').exec().then((docs) => docs
            .map((doc) => doc.toObject())
            .map((e) => {
            return {
                identifier: e.identifier,
                startDate: e.startDate,
                reserveStartDate: moment(`${e.coaInfo.rsvStartDate} 00:00:00+09:00`, 'YYYYMMDD HH:mm:ssZ').toDate(),
                firstOrderDate: null
            };
        }));
        debug(events.length, 'events found.');
        // イベントに対する注文を取得
        const orders = yield orderRepo.orderModel.find({ 'acceptedOffers.itemOffered.reservationFor.identifier': { $in: events.map((e) => e.identifier) } }, 'acceptedOffers orderDate').exec().then((docs) => docs.map((doc) => doc.toObject()));
        debug(orders.length, 'orders found.');
        // 最初の注文をイベントごとに取り出す
        events = events.map((e) => {
            const ordersOnEvent = orders
                .filter((o) => o.acceptedOffers[0].itemOffered.reservationFor.identifier === e.identifier)
                .sort((a, b) => (a.orderDate < b.orderDate) ? -1 : 1);
            return Object.assign({}, e, { firstOrderDate: (ordersOnEvent.length > 0) ? ordersOnEvent[0].orderDate : null });
        });
        // 注文がないイベントは集計から除外
        events = events.filter((e) => e.firstOrderDate !== null);
        const aggregations = seats.map((seat) => {
            // 各上映イベントにおける、注文日時、予約開始日時、上映開始日時と比較する
            // 供給時間sum
            const offeredHours = events.reduce((a, b) => a + moment(b.startDate).diff(moment(b.firstOrderDate), TIME_UNIT), 0);
            // 空席時間sum
            const availableHours = events.reduce((a, b) => {
                const order = orders.find((o) => {
                    return o.acceptedOffers[0].itemOffered.reservationFor.identifier === b.identifier
                        && o.acceptedOffers[0].itemOffered.reservedTicket.ticketedSeat.seatNumber === seat.branchCode;
                });
                if (order === undefined) {
                    return a + moment(b.startDate).diff(moment(b.firstOrderDate), TIME_UNIT);
                }
                else {
                    // 注文が入っていれば、最初の予約から自分の予約までの時間
                    return a + moment(order.orderDate).diff(moment(b.firstOrderDate), TIME_UNIT);
                }
            }, 0);
            return {
                seatNumber: seat.branchCode,
                offeredHours: offeredHours,
                availableHours: availableHours,
                // tslint:disable-next-line:no-magic-numbers
                availableRate: Math.floor(availableHours * 100 / offeredHours)
            };
        });
        debug(aggregations);
        // tslint:disable-next-line:max-line-length
        fs.writeFileSync(`${__dirname}/output/aggregations-${theaterCode}-${screenBranchCode}.json`, JSON.stringify(aggregations, null, '    '));
    });
}
exports.aggregateOfferAvailableHoursRateByScreen = aggregateOfferAvailableHoursRateByScreen;
const screenBranchCodes = ['21', '22', '23', '24', '25', '26', '31', '34', '35'];
const promises = screenBranchCodes.map((screenBranchCode) => __awaiter(this, void 0, void 0, function* () {
    try {
        yield aggregateOfferAvailableHoursRateByScreen('001', screenBranchCode);
    }
    catch (error) {
        console.error(error);
    }
}));
mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
Promise.all(promises).then(() => {
    debug('success!');
}).catch((err) => {
    console.error(err);
    process.exit(1);
}).then(() => {
    mongoose.disconnect();
});
