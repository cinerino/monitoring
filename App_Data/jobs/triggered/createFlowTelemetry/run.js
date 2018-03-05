"use strict";
/**
 * 販売者向け測定データを作成する
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
const debug = createDebug('sskts-monitoring-jobs');
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        debug('connecting mongodb...');
        sskts.mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
        const organizationRepo = new sskts.repository.Organization(sskts.mongoose.connection);
        const taskRepo = new sskts.repository.Task(sskts.mongoose.connection);
        const telemetryRepo = new sskts.repository.Telemetry(sskts.mongoose.connection);
        const transactionRepo = new sskts.repository.Transaction(sskts.mongoose.connection);
        const actionRepo = new sskts.repository.Action(sskts.mongoose.connection);
        debug('creating telemetry...');
        // 取引セッション時間に対して十分に時間を置いて計測する
        // tslint:disable-next-line:no-magic-numbers
        const dateNow = moment().add(-30, 'minutes');
        // tslint:disable-next-line:no-magic-numbers
        const measuredAt = moment.unix((dateNow.unix() - (dateNow.unix() % 60)));
        // 劇場組織ごとに販売者向け測定データを作成する
        const movieTheaters = yield organizationRepo.searchMovieTheaters({});
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
        yield sskts.mongoose.disconnect();
    });
}
exports.main = main;
main().then(() => {
    debug('success!');
}).catch((err) => {
    console.error(err);
    process.exit(1);
});
