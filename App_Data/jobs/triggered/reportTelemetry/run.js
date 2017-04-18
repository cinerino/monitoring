"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 測定データ報告
 *
 * @ignore
 */
const createDebug = require("debug");
const Controller = require("../../../../controller/reportTelemetry");
const debug = createDebug('sskts-reportjobs:jobs:reportTelemetry:run');
Controller.main().then(() => {
    debug('success!');
}).catch((err) => {
    console.error(err);
    process.exit(1);
});