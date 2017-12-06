"use strict";
/**
 * 注文シナリオをランダムに実行し続ける
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
const processPlaceOrder = require("../../../../controller/scenarios/processPlaceOrder");
const mongooseConnectionOptions_1 = require("../../../../mongooseConnectionOptions");
const debug = createDebug('sskts-monitoring-jobs');
if (process.env.CONTINUOUS_SCENARIOS_STOPPED === '1') {
    process.exit(0);
}
debug('start executing scenarios...');
const INTERVAL = 60000;
sskts.mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
const organizationRepo = new sskts.repository.Organization(sskts.mongoose.connection);
organizationRepo.searchMovieTheaters({}).then((movieTheaters) => {
    movieTheaters.forEach((movieTheater) => {
        setInterval(() => {
            // 0-{INTERVAL}の間でランダムにインターバルを置いてシナリオを実行する
            // tslint:disable-next-line:insecure-random no-magic-numbers
            const executesAfter = Math.floor(INTERVAL * Math.random());
            setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                try {
                    // tslint:disable-next-line:insecure-random no-magic-numbers
                    const duration = Math.floor(500000 * Math.random() + 300000);
                    const result = yield processPlaceOrder.main(movieTheater.location.branchCode, duration);
                    debug('result:', result, 'movieTheater.branchCode:', movieTheater.branchCode);
                }
                catch (error) {
                    console.error(error, 'movieTheater.branchCode:', movieTheater.branchCode);
                }
            }), executesAfter);
        }, INTERVAL);
    });
});
