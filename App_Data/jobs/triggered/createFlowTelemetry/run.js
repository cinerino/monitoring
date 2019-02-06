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
 * 販売者向け測定データを作成する
 */
const sskts = require("@motionpicture/sskts-domain");
const createDebug = require("debug");
const moment = require("moment");
const mongoose = require("mongoose");
const mongooseConnectionOptions_1 = require("../../../../mongooseConnectionOptions");
const debug = createDebug('sskts-monitoring-jobs');
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        debug('connecting mongodb...');
        mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
        const sellerRepo = new sskts.repository.Seller(mongoose.connection);
        const taskRepo = new sskts.repository.Task(mongoose.connection);
        const telemetryRepo = new sskts.repository.Telemetry(mongoose.connection);
        const transactionRepo = new sskts.repository.Transaction(mongoose.connection);
        const actionRepo = new sskts.repository.Action(mongoose.connection);
        debug('creating telemetry...');
        // 取引セッション時間に対して十分に時間を置いて計測する
        // tslint:disable-next-line:no-magic-numbers
        const dateNow = moment().add(-30, 'minutes');
        // tslint:disable-next-line:no-magic-numbers
        const measuredAt = moment.unix((dateNow.unix() - (dateNow.unix() % 60)));
        // 劇場組織ごとに販売者向け測定データを作成する
        const movieTheaters = yield sellerRepo.search({});
        yield Promise.all(movieTheaters.map((movieTheater) => __awaiter(this, void 0, void 0, function* () {
            yield sskts.service.report.telemetry.createFlow({
                measuredAt: measuredAt.toDate(),
                sellerId: movieTheater.id
            })({
                task: taskRepo,
                telemetry: telemetryRepo,
                transaction: transactionRepo,
                action: actionRepo
            });
        })));
        yield sskts.service.report.telemetry.createFlow({
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
main().then(() => {
    debug('success!');
}).catch((err) => {
    console.error(err);
    process.exit(1);
});
