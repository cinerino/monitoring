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
sskts.mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
const organizationRepo = new sskts.repository.Organization(sskts.mongoose.connection);
organizationRepo.searchMovieTheaters({})
    .then((movieTheaters) => {
    movieTheaters.forEach((movieTheater) => {
        if (process.env.NODE_ENV === 'production') {
            return;
        }
        setInterval(() => {
            // 0-60秒の間でランダムにインターバルを置いてシナリオを実行する
            // tslint:disable-next-line:insecure-random no-magic-numbers
            const interval = Math.floor(60000 * Math.random());
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
            }), interval);
        }, 
        // tslint:disable-next-line:no-magic-numbers
        60000);
    });
});
