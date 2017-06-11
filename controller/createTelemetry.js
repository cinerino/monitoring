"use strict";
/**
 * 測定データを作成する
 *
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
const mongoose = require("mongoose");
const redis = require("redis");
const mongooseConnectionOptions_1 = require("../mongooseConnectionOptions");
mongoose.Promise = global.Promise;
const debug = createDebug('sskts-reportjobs:controller:createTelemetry');
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        debug('connecting mongodb...');
        mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
        const redisClient = redis.createClient({
            host: process.env.STOCK_STATUS_REDIS_HOST,
            port: process.env.STOCK_STATUS_REDIS_PORT,
            password: process.env.STOCK_STATUS_REDIS_KEY,
            tls: { servername: process.env.TEST_REDIS_HOST }
        });
        const queueAdapter = sskts.adapter.queue(mongoose.connection);
        const telemetryAdapter = sskts.adapter.telemetry(mongoose.connection);
        const transactionAdapter = sskts.adapter.transaction(mongoose.connection);
        const transactionCountAdapter = sskts.adapter.transactionCount(redisClient);
        debug('creating telemetry...');
        // todo 一時的に固定値で算出
        yield sskts.service.report.createTelemetry({}, 60, 120)(queueAdapter, telemetryAdapter, transactionAdapter, transactionCountAdapter);
        redisClient.quit();
        mongoose.disconnect();
    });
}
exports.main = main;
