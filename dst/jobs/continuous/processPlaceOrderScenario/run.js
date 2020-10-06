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
const createDebug = require("debug");
const mongoose = require("mongoose");
const processPlaceOrder = require("../../../controller/scenarios/processPlaceOrder");
const mongooseConnectionOptions_1 = require("../../../mongooseConnectionOptions");
const debug = createDebug('cinerino-monitoring');
if (process.env.RUN_CONTINUOUS_SCENARIOS !== '1') {
    process.exit(0);
}
debug('start executing scenarios...');
// tslint:disable-next-line:no-magic-numbers
const INTERVAL = Number(process.env.CONTINUOUS_SCENARIOS_INTERVAL_IN_SECONDS) * 1000;
mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default)
    .then()
    // tslint:disable-next-line:no-console
    .catch(console.error);
// const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
// sellerRepo.search({})
new Promise((resolve) => {
    resolve([]);
})
    .then((movieTheaters) => {
    movieTheaters.forEach((movieTheater) => {
        setInterval(() => {
            // 0-{INTERVAL}の間でランダムにインターバルを置いてシナリオを実行する
            // tslint:disable-next-line:insecure-random no-magic-numbers
            const executesAfter = Math.floor(INTERVAL * Math.random());
            setTimeout(() => __awaiter(void 0, void 0, void 0, function* () {
                const branchCode = movieTheater.location.branchCode;
                try {
                    // tslint:disable-next-line:insecure-random no-magic-numbers
                    const duration = Math.floor(Math.random() * 500000 + 300000);
                    const result = yield processPlaceOrder.main(branchCode, duration);
                    debug('result:', result, 'movieTheater.branchCode:', branchCode);
                }
                catch (error) {
                    // tslint:disable-next-line:no-console
                    console.error(error, 'movieTheater.branchCode:', branchCode);
                }
            }), executesAfter);
        }, INTERVAL);
    });
})
    // tslint:disable-next-line:no-console
    .catch(console.error);
