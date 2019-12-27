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
/**
 * グローバル測定データを作成する
 */
const cinerino = require("@cinerino/domain");
const createDebug = require("debug");
const moment = require("moment");
const mongoose = require("mongoose");
const mongooseConnectionOptions_1 = require("../../../mongooseConnectionOptions");
const debug = createDebug('cinerino-monitoring');
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        debug('connecting mongodb...');
        yield mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
        const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
        const taskRepo = new cinerino.repository.Task(mongoose.connection);
        const telemetryRepo = new cinerino.repository.Telemetry(mongoose.connection);
        const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        debug('creating telemetry...');
        const dateNow = moment();
        // tslint:disable-next-line:no-magic-numbers
        const measuredAt = moment.unix((dateNow.unix() - (dateNow.unix() % 60)));
        // 劇場組織ごとに販売者向け測定データを作成する
        const movieTheaters = yield sellerRepo.search({});
        yield Promise.all(movieTheaters.map((movieTheater) => __awaiter(this, void 0, void 0, function* () {
            yield cinerino.service.report.telemetry.createStock({
                measuredAt: measuredAt.toDate(),
                sellerId: movieTheater.id
            })({
                task: taskRepo,
                telemetry: telemetryRepo,
                transaction: transactionRepo,
                action: actionRepo
            });
        })));
        yield cinerino.service.report.telemetry.createStock({
            measuredAt: measuredAt.toDate()
        })({
            task: taskRepo,
            telemetry: telemetryRepo,
            transaction: transactionRepo,
            action: actionRepo
        });
        debug('diconnecting mongo...');
        yield mongoose.disconnect();
    });
}
exports.main = main;
main()
    .then(() => {
    debug('success!');
})
    .catch((err) => {
    // tslint:disable-next-line:no-console
    console.error(err);
    process.exit(1);
});
