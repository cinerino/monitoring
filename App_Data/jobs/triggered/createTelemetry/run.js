"use strict";
/**
 * 測定データを作成する
 * @ignore
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const sskts = require("@motionpicture/sskts-domain");
const createDebug = require("debug");
const moment = require("moment");
const mongooseConnectionOptions_1 = require("../../../../mongooseConnectionOptions");
const debug = createDebug('sskts-monitoring-jobs:createTelemetry');
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        debug('connecting mongodb...');
        sskts.mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
        const taskRepo = new sskts.repository.Task(sskts.mongoose.connection);
        const telemetryRepo = new sskts.repository.Telemetry(sskts.mongoose.connection);
        const transactionRepo = new sskts.repository.Transaction(sskts.mongoose.connection);
        const authorizeActionRepo = new sskts.repository.action.Authorize(sskts.mongoose.connection);
        debug('creating telemetry...');
        const dateNow = moment();
        // tslint:disable-next-line:no-magic-numbers
        const measuredAt = moment.unix((dateNow.unix() - (dateNow.unix() % 60)));
        yield sskts.service.report.createTelemetry(measuredAt.toDate())(taskRepo, telemetryRepo, transactionRepo, authorizeActionRepo);
        sskts.mongoose.disconnect();
    });
}
exports.main = main;
main().then(() => {
    debug('success!');
}).catch((err) => {
    console.error(err);
    process.exit(1);
});
