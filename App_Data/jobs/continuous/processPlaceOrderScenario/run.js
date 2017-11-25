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
const createDebug = require("debug");
const processPlaceOrder = require("../../../../controller/scenarios/processPlaceOrder");
const debug = createDebug('sskts-monitoring-jobs');
setInterval(() => {
    if (process.env.NODE_ENV === 'production') {
        return;
    }
    // 0-60秒の間でランダムにインターバルを置いてシナリオを実行する
    // tslint:disable-next-line:insecure-random no-magic-numbers
    const interval = Math.floor(60000 * Math.random());
    setTimeout(() => __awaiter(this, void 0, void 0, function* () {
        const theaterCodes = ['112', '118'];
        // tslint:disable-next-line:insecure-random
        const theaterCode = theaterCodes[Math.floor(theaterCodes.length * Math.random())];
        try {
            const result = yield processPlaceOrder.main(theaterCode);
            debug('result:', result);
        }
        catch (error) {
            console.error(error);
        }
    }), interval);
}, 
// tslint:disable-next-line:no-magic-numbers
500);
